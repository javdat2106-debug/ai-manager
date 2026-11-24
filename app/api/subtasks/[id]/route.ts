import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { subtasks } from "@/lib/db/schema";
import { handleError, jsonError } from "@/lib/http";
import { toSubtask } from "@/lib/repo";
import { PRIORITIES } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z
  .object({
    done: z.boolean(),
    title: z.string().trim().min(1).max(200),
    position: z.number().finite(),
    priority: z.enum(PRIORITIES),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = PatchBody.parse(await req.json());
    if (Object.keys(patch).length === 0) return jsonError("Пустое обновление");
    const db = await getDb();
    const [row] = await db.update(subtasks).set(patch).where(eq(subtasks.id, id)).returning();
    if (!row) return jsonError("Подзадача не найдена", 404);
    return NextResponse.json({ subtask: toSubtask(row) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = await getDb();
    await db.delete(subtasks).where(eq(subtasks.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}
