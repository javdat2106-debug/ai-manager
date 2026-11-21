import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIError } from "./gemini";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof AIError) return jsonError(e.message, e.status);
  if (e instanceof ZodError) return jsonError("Некорректные данные запроса", 400);
  console.error(e);
  const msg = e instanceof Error ? e.message : "Внутренняя ошибка сервера";
  return jsonError(msg, 500);
}
