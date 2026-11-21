import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { subtasks, tasks } from "@/lib/db/schema";
import { handleError, jsonError } from "@/lib/http";
import { getTask } from "@/lib/repo";
import { QUADRANTS } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z
  .object({
    title: z.string().trim().min(1).max(300),
    category: z.string().trim().min(1).max(40),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    quadrant: z.enum(QUADRANTS),
    done: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = PatchBody.parse(await req.json());
    const db = await getDb();
    const values: Partial<typeof tasks.$inferInsert> = { ...patch };
    if (patch.done !== undefined) values.completedAt = patch.done ? Date.now() : null;
    if (Object.keys(values).length === 0) return jsonError("Пустое обновление");

    const res = await db.update(tasks).set(values).where(eq(tasks.id, id)).returning({ id: tasks.id });
    if (res.length === 0) return jsonError("Задача не найдена", 404);
    return NextResponse.json({ task: await getTask(id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = await getDb();
    // Явно удаляем подзадачи: FK cascade в libSQL зависит от PRAGMA foreign_keys
    await db.batch([
      db.delete(subtasks).where(eq(subtasks.taskId, id)),
      db.delete(tasks).where(eq(tasks.id, id)),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}
