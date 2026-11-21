import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { handleError } from "@/lib/http";
import { listTasks, toTask } from "@/lib/repo";
import { QUADRANTS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch (e) {
    return handleError(e);
  }
}

const CreateBody = z.object({
  title: z.string().trim().min(1).max(300),
  category: z.string().trim().max(40).default("Другое"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  quadrant: z.enum(QUADRANTS).default("schedule"),
});

export async function POST(req: Request) {
  try {
    const body = CreateBody.parse(await req.json());
    const db = await getDb();
    const [row] = await db
      .insert(tasks)
      .values({ id: crypto.randomUUID(), ...body, priorityReason: "", createdAt: Date.now() })
      .returning();
    return NextResponse.json({ task: toTask(row) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
