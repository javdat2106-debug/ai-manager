import "server-only";
import { GoogleGenAI, Type, ApiError, type Schema } from "@google/genai";

const MODEL_CANDIDATES = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

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

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIError("GEMINI_API_KEY не задан на сервере", 500);
  ai ??= new GoogleGenAI({ apiKey });
  return ai;
}

function candidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const list = fromEnv ? [fromEnv, ...MODEL_CANDIDATES] : MODEL_CANDIDATES;
  return [...new Set(list)];
}

function isModelUnavailable(e: unknown): boolean {
  if (e instanceof ApiError) {
    if (e.status === 404) return true;
    if (e.status === 400 && /model|not found|not supported/i.test(e.message)) return true;
  }
  return false;
}

function mapError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new AIError("Превышен лимит запросов к ИИ, попробуйте позже", 429);
    if (e.status === 401 || e.status === 403) return new AIError("Неверный или недоступный GEMINI_API_KEY", 500);
    if (e.status >= 500) return new AIError("ИИ временно недоступен", 503);
    return new AIError(`Ошибка Gemini: ${e.message}`, 502);
  }
  return new AIError("Не удалось обратиться к ИИ", 502);
}

/**
 * Запрос со строгим JSON (Structured Output).
 * Перебирает доступные модели, рабочую кеширует в памяти процесса.
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
}): Promise<T> {
  const client = getAI();
  const models = resolvedModel ? [resolvedModel] : candidates();
  let lastErr: unknown;

  for (const model of models) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
        },
      });
      resolvedModel = model;
      const text = res.text;
      if (!text) throw new AIError("ИИ вернул пустой ответ");
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new AIError("ИИ вернул некорректный JSON");
      }
    } catch (e) {
      lastErr = e;
      if (isModelUnavailable(e)) {
        console.warn(`[gemini] модель ${model} недоступна, пробую следующую`);
        if (resolvedModel === model) resolvedModel = null;
        continue;
      }
      throw mapError(e);
    }
  }
  console.error("[gemini] ни одна модель не доступна", lastErr);
  throw new AIError(`Ни одна из моделей недоступна: ${models.join(", ")}`, 502);
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
