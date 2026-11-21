import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./db/client";
import { subtasks, tasks, type SubtaskRow, type TaskRow } from "./db/schema";
import type { Subtask, Task } from "./types";

export function toSubtask(r: SubtaskRow): Subtask {
  return { id: r.id, taskId: r.taskId, title: r.title, done: r.done };
}

export function toTask(r: TaskRow, subs: SubtaskRow[] = []): Task {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    deadline: r.deadline,
    quadrant: r.quadrant,
    priorityReason: r.priorityReason,
    done: r.done,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    position: r.position,
    subtasks: subs.map(toSubtask),
  };
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select().from(tasks).orderBy(asc(tasks.position), desc(tasks.createdAt));
  const subs = rows.length
    ? await db
        .select()
        .from(subtasks)
        .where(inArray(subtasks.taskId, rows.map((r) => r.id)))
        .orderBy(asc(subtasks.position))
    : [];
  const byTask = new Map<string, SubtaskRow[]>();
  for (const s of subs) {
    const arr = byTask.get(s.taskId) ?? [];
    arr.push(s);
    byTask.set(s.taskId, arr);
  }
  return rows.map((r) => toTask(r, byTask.get(r.id)));
}

export async function getTask(id: string): Promise<Task | null> {
  const db = await getDb();
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!row) return null;
  const subs = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, id))
    .orderBy(asc(subtasks.position));
  return toTask(row, subs);
}
