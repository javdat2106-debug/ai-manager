import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { subtasks } from "@/lib/db/schema";
import { generateJSON, SUBTASKS_SCHEMA, SUBTASKS_SYSTEM } from "@/lib/gemini";
import { handleError, jsonError } from "@/lib/http";
import { getTask, toSubtask } from "@/lib/repo";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const AIResult = z.object({
  subtasks: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
});

const AddBody = z.object({ title: z.string().trim().min(1).max(200) });
const ReorderBody = z.object({ ids: z.array(z.string()).max(200) });

/**
 * С телом `{ title }` — добавляет одну подзадачу вручную (в конец списка).
 * Без тела — ИИ разбивает задачу на подзадачи (заменяет существующие).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const text = await req.text();
    if (text.trim()) return addSubtask(id, AddBody.parse(JSON.parse(text)).title);

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

async function addSubtask(taskId: string, title: string) {
  const db = await getDb();
  const task = await getTask(taskId);
  if (!task) return jsonError("Задача не найдена", 404);
  // позиция считается в том же запросе, чтобы параллельные добавления не получили одинаковую
  const [row] = await db
    .insert(subtasks)
    .values({
      id: crypto.randomUUID(),
      taskId,
      title,
      done: false,
      position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE task_id = ${taskId})`,
    })
    .returning();
  return NextResponse.json({ subtask: toSubtask(row) }, { status: 201 });
}

/** Переупорядочивание: `{ ids }` в новом порядке → position 0..n. */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { ids } = ReorderBody.parse(await req.json());
    if (ids.length === 0) return jsonError("Пустой список");
    const db = await getDb();
    const existing = await db
      .select({ id: subtasks.id })
      .from(subtasks)
      .where(and(eq(subtasks.taskId, id), inArray(subtasks.id, ids)));
    if (existing.length !== ids.length) return jsonError("Подзадачи не принадлежат задаче", 400);
    const [first, ...rest] = ids.map((sid, i) =>
      db.update(subtasks).set({ position: i }).where(eq(subtasks.id, sid)),
    );
    await db.batch([first, ...rest]);
    return NextResponse.json({ task: await getTask(id) });
  } catch (e) {
    return handleError(e);
  }
}
