import "server-only";
import { GoogleGenAI, Type, ApiError, ThinkingLevel, type Schema, type ThinkingConfig } from "@google/genai";

export const MODEL_CANDIDATES = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

/** Повторов на одну модель при временных сбоях (5xx / 429) */
const ATTEMPTS_PER_MODEL = 2;
/** Общий бюджет времени на запрос к ИИ (route maxDuration = 60s — максимум Vercel Hobby) */
const TIME_BUDGET_MS = 45_000;
/** Таймаут одного запроса к Gemini */
const ATTEMPT_TIMEOUT_MS = 18_000;

/** Модели, которые отклонили thinkingConfig — для них отправляем запрос без него */
const noThinking = new Set<string>();

/**
 * Для задачи извлечения JSON «размышления» не нужны, а они сильно замедляют ответ
 * (модели 3.x по умолчанию думают и могут отвечать десятки секунд).
 */
export function thinkingFor(model: string): ThinkingConfig | undefined {
  if (noThinking.has(model)) return undefined;
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-2\./.test(model)) return undefined;
  return { thinkingLevel: ThinkingLevel.MINIMAL };
}

function isThinkingRejected(e: unknown): boolean {
  return e instanceof ApiError && e.status === 400 && /think/i.test(e.message);
}

export class AITimeoutError extends Error {}

export class AIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

let ai: GoogleGenAI | null = null;
let resolvedModel: string | null = null;

export function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AIError("GEMINI_API_KEY не задан на сервере", 500);
  ai ??= new GoogleGenAI({ apiKey });
  return ai;
}

export function candidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const list = fromEnv ? [fromEnv, ...MODEL_CANDIDATES] : MODEL_CANDIDATES;
  return [...new Set(list)];
}

/** Короткий человекочитаемый текст ошибки от Google */
export function describeError(e: unknown): { status: number | null; message: string } {
  if (e instanceof ApiError) {
    const inner = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(e.message)?.[1];
    const msg = (inner ?? e.message).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
    return { status: e.status, message: msg.slice(0, 160) };
  }
  if (e instanceof Error) return { status: null, message: e.message.slice(0, 160) };
  return { status: null, message: String(e).slice(0, 160) };
}

function isModelUnavailable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 404) return true;
  return e.status === 400 && /model|not found|not supported/i.test(e.message);
}

function isTransient(e: unknown): boolean {
  return e instanceof AITimeoutError || (e instanceof ApiError && (e.status === 429 || e.status >= 500));
}

function mapError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  const { status, message } = describeError(e);
  if (e instanceof AITimeoutError)
    return new AIError("ИИ отвечает слишком долго. Попробуйте ещё раз или сократите текст", 504);
  if (e instanceof ApiError) {
    if (status === 429) return new AIError(`Превышен лимит запросов к Gemini (${message}). Попробуйте позже`, 429);
    if (status === 401 || status === 403)
      return new AIError(`Gemini отклонил ключ (${status}: ${message}). Проверьте GEMINI_API_KEY`, 500);
    if (status !== null && status >= 500)
      return new AIError(`ИИ временно недоступен (Gemini ${status}: ${message}). Попробуйте ещё раз`, 503);
    return new AIError(`Ошибка Gemini ${status}: ${message}`, 502);
  }
  return new AIError(`Не удалось обратиться к ИИ: ${message}`, 502);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Запрос со строгим JSON (Structured Output).
 * Повторяет запрос при временных сбоях, при недоступности модели переходит к следующей.
 * Рабочую модель кеширует в памяти процесса.
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
}): Promise<T> {
  const client = getAI();
  const all = candidates();
  const models = resolvedModel ? [resolvedModel, ...all.filter((m) => m !== resolvedModel)] : all;
  const deadline = Date.now() + TIME_BUDGET_MS;
  let lastErr: unknown = null;

  outer: for (const model of models) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) break outer;
      const timeout = Math.min(ATTEMPT_TIMEOUT_MS, remaining);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const started = Date.now();
      try {
        const res = await client.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseSchema: opts.schema,
            temperature: opts.temperature ?? 0.2,
            thinkingConfig: thinkingFor(model),
            abortSignal: controller.signal,
          },
        });

        const finish = res.candidates?.[0]?.finishReason;
        if (finish && finish !== "STOP") {
          throw new AIError(
            finish === "MAX_TOKENS"
              ? "Ответ ИИ оказался слишком длинным — сократите текст"
              : `ИИ не смог ответить (${finish})`,
            422,
          );
        }
        const text = res.text;
        if (!text) throw new AIError("ИИ вернул пустой ответ");

        let parsed: T;
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          throw new AIError("ИИ вернул некорректный JSON");
        }
        console.info(`[gemini] ${model} ответила за ${Date.now() - started} мс`);
        resolvedModel = model;
        return parsed;
      } catch (raw) {
        if (raw instanceof AIError) throw raw;
        const e = controller.signal.aborted ? new AITimeoutError(`таймаут ${timeout} мс`) : raw;
        lastErr = e;
        console.error("[gemini]", { model, attempt, ms: Date.now() - started, ...describeError(e) });

        if (isThinkingRejected(e) && !noThinking.has(model)) {
          noThinking.add(model); // повторяем ту же модель без thinkingConfig
          attempt--;
          continue;
        }
        if (isModelUnavailable(e)) break; // следующая модель, без повторов
        if (!isTransient(e)) throw mapError(e);
        if (resolvedModel === model) resolvedModel = null;
        if (e instanceof AITimeoutError) break; // долго думает — пробуем следующую модель
        if (attempt < ATTEMPTS_PER_MODEL) {
          await sleep(600 + Math.random() * 400);
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  if (lastErr && isTransient(lastErr)) throw mapError(lastErr);
  const tried = describeError(lastErr);
  throw new AIError(
    `Ни одна модель Gemini не доступна (${models.join(", ")}). Последняя ошибка: ${tried.status ?? ""} ${tried.message}. Укажите GEMINI_MODEL`,
    502,
  );
}

// ---------- Схемы ----------

export const PARSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Краткая формулировка задачи, начинается с глагола" },
          category: {
            type: Type.STRING,
            enum: ["Работа", "Личное", "Здоровье", "Учёба", "Финансы", "Дом", "Другое"],
          },
          deadline: {
            type: Type.STRING,
            nullable: true,
            description: "Дедлайн в формате YYYY-MM-DD или null, если не указан",
          },
          isUrgent: { type: Type.BOOLEAN },
          isImportant: { type: Type.BOOLEAN },
          priorityReason: {
            type: Type.STRING,
            description: "Причина приоритета, не более 7 слов, по-русски",
          },
        },
        required: ["title", "category", "deadline", "isUrgent", "isImportant", "priorityReason"],
        propertyOrdering: ["title", "category", "deadline", "isUrgent", "isImportant", "priorityReason"],
      },
    },
  },
  required: ["tasks"],
};

export const SUBTASKS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    subtasks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "2",
      maxItems: "7",
    },
  },
  required: ["subtasks"],
};

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export function parseSystemPrompt(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return [
    "Ты — ассистент по планированию. Пользователь присылает поток мыслей (brain dump), возможно надиктованный голосом.",
    "Извлеки из текста все отдельные задачи. Не выдумывай задачи, которых нет в тексте. Объединяй дубли.",
    `Сегодня ${today} (${weekday}). Относительные даты («завтра», «в пятницу», «через неделю», «до конца месяца») переводи в абсолютные YYYY-MM-DD. Если срок не указан — deadline = null.`,
    "Оцени по матрице Эйзенхауэра: isUrgent — нужно сделать в ближайшие 1–2 дня или есть жёсткий срок; isImportant — влияет на цели, здоровье, финансы, работу или обязательства перед людьми.",
    "category — одна из: Работа, Личное, Здоровье, Учёба, Финансы, Дом, Другое.",
    "priorityReason — по-русски, не более 7 слов, объясняет выбор срочности/важности.",
    "title — по-русски, коротко, с заглавной буквы, начинается с глагола.",
    "Если задач нет — верни пустой массив tasks.",
  ].join("\n");
}

export const SUBTASKS_SYSTEM = [
  "Ты — ассистент по планированию. Разбей задачу на 3–7 конкретных, выполнимых шагов по порядку.",
  "Каждый шаг — по-русски, короткий (до 8 слов), начинается с глагола, без нумерации.",
].join("\n");
