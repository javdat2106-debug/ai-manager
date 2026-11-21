import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { candidates, describeError, getAI, thinkingFor } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Диагностика Gemini: какие модели доступны ключу и отвечает ли выбранная. Ключ не раскрывается. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const keyConfigured = !!process.env.GEMINI_API_KEY?.trim();
  const base = {
    keyConfigured,
    configuredModel: process.env.GEMINI_MODEL?.trim() || null,
    candidates: candidates(),
  };
  if (!keyConfigured) return NextResponse.json(base, { headers });

  const ai = getAI();

  let availableFlashModels: string[] = [];
  let listError: string | null = null;
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const name = (m.name ?? "").replace(/^models\//, "");
      const canGenerate = !m.supportedActions || m.supportedActions.includes("generateContent");
      if (name.includes("flash") && canGenerate) availableFlashModels.push(name);
    }
    availableFlashModels = availableFlashModels.sort().reverse();
  } catch (e) {
    const d = describeError(e);
    listError = `${d.status ?? ""} ${d.message}`.trim();
  }

  const probes: { model: string; ok: boolean; status: number | null; message: string; ms: number }[] = [];
  for (const model of candidates()) {
    const started = Date.now();
    const signal = AbortSignal.timeout(8_000);
    try {
      await ai.models.generateContent({
        model,
        contents: "ping",
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.OBJECT, properties: { ok: { type: Type.BOOLEAN } }, required: ["ok"] },
          thinkingConfig: thinkingFor(model),
          abortSignal: signal,
        },
      });
      probes.push({ model, ok: true, status: 200, message: "ok", ms: Date.now() - started });
      break; // первая рабочая модель найдена
    } catch (e) {
      const d = signal.aborted ? { status: null, message: "таймаут 8 с" } : describeError(e);
      probes.push({ model, ok: false, ...d, ms: Date.now() - started });
    }
  }

  return NextResponse.json(
    { ...base, availableFlashModels, listError, probes, workingModel: probes.find((p) => p.ok)?.model ?? null },
    { headers },
  );
}
