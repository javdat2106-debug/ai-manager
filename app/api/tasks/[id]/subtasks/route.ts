import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { subtasks } from "@/lib/db/schema";
import { generateJSON, SUBTASKS_SCHEMA, SUBTASKS_SYSTEM } from "@/lib/gemini";
import { handleError, jsonError } from "@/lib/http";
import { getTask } from "@/lib/repo";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const AIResult = z.object({
  subtasks: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
});

/** ИИ разбивает задачу на подзадачи (заменяет существующие). */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return jsonError("Задача не найдена", 404);

    const raw = await generateJSON<unknown>({
      system: SUBTASKS_SYSTEM,
      prompt: [
        `Задача: ${task.title}`,
        `Категория: ${task.category}`,
        task.deadline ? `Дедлайн: ${task.deadline}` : "Дедлайн не указан",
        task.priorityReason ? `Контекст приоритета: ${task.priorityReason}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      schema: SUBTASKS_SCHEMA,
      temperature: 0.4,
    });
    const { subtasks: titles } = AIResult.parse(raw);

    const db = await getDb();
    const rows = titles.slice(0, 7).map((title, i) => ({
      id: crypto.randomUUID(),
      taskId: id,
      title,
      done: false,
      position: i,
    }));
    await db.batch([
      db.delete(subtasks).where(eq(subtasks.taskId, id)),
      db.insert(subtasks).values(rows),
    ]);

    return NextResponse.json({ task: await getTask(id) });
  } catch (e) {
    return handleError(e);
  }
}
