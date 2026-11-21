import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { generateJSON, PARSE_SCHEMA, parseSystemPrompt } from "@/lib/gemini";
import { handleError } from "@/lib/http";
import { toTask } from "@/lib/repo";
import { CATEGORIES, toQuadrant } from "@/lib/types";
import { toDateKey } from "@/lib/date";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  text: z.string().trim().min(1, "Пустой текст").max(5000, "Текст слишком длинный (макс. 5000 символов)"),
  /** Локальная дата клиента YYYY-MM-DD — для корректного «завтра» в его часовом поясе */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const AIResult = z.object({
  tasks: z.array(
    z.object({
      title: z.string().trim().min(1).max(300),
      category: z.string().trim(),
      deadline: z.string().nullable(),
      isUrgent: z.boolean(),
      isImportant: z.boolean(),
      priorityReason: z.string().trim(),
    }),
  ),
});

function limitWords(s: string, max = 7): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, max).join(" ").replace(/[.,;:]+$/, "");
}

export async function POST(req: Request) {
  try {
    const { text, today = toDateKey() } = Body.parse(await req.json());

    const raw = await generateJSON<unknown>({
      system: parseSystemPrompt(today),
      prompt: text,
      schema: PARSE_SCHEMA,
    });
    const result = AIResult.parse(raw);

    const now = Date.now();
    const rows = result.tasks.map((t, i) => ({
      id: crypto.randomUUID(),
      title: t.title,
      category: (CATEGORIES as readonly string[]).includes(t.category) ? t.category : "Другое",
      deadline: t.deadline && DATE_RE.test(t.deadline) ? t.deadline : null,
      quadrant: toQuadrant(t.isUrgent, t.isImportant),
      priorityReason: limitWords(t.priorityReason),
      done: false,
      createdAt: now + i, // сохраняем порядок из текста
    }));

    if (rows.length === 0) return NextResponse.json({ tasks: [] });

    const db = await getDb();
    const inserted = await db.insert(tasks).values(rows).returning();
    return NextResponse.json({ tasks: inserted.map((r) => toTask(r)) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
