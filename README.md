# AI Tasks — матрица Эйзенхауэра с ИИ

Next.js 15 (App Router) · Turso (libSQL) + Drizzle · Gemini (Structured Output) · Tailwind v4 · dnd-kit.

## Возможности
- **Brain Dump** — свободный текст или голос (Web Speech API, `ru-RU`). Кнопка «Разобрать с помощью ИИ» (или `Ctrl+Enter`) отправляет текст на `/api/parse`; Gemini возвращает строгий JSON: задача, категория, дедлайн, срочность/важность и причина приоритета (≤ 7 слов). Задачи сохраняются в БД.
- **Матрица Эйзенхауэра 2×2** — чекбокс, обоснование ИИ, дедлайн (клик для изменения), разбиение на подзадачи через Gemini, перетаскивание между квадрантами и внутри квадранта (порядок сохраняется в БД), удаление.
- **Намаз всегда в приоритете** — задачи про намаз (молитва, фаджр, зухр, аср, магриб, иша, джума…) всегда попадают в «Срочно и важно» и стоят первыми; вынести их оттуда нельзя.
- **Прогресс дня в %** + мини-график за 7 дней.

## Запуск
```bash
npm install
cp .env.example .env.local   # заполните переменные
npm run dev
```

| Переменная | Описание |
|---|---|
| `GEMINI_API_KEY` | Ключ Gemini. Используется только на сервере (Route Handlers, модуль `server-only`). |
| `GEMINI_MODEL` | Необязательно. Иначе перебираются `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash`; первая доступная кешируется. |
| `TURSO_DATABASE_URL` | `libsql://<db>.turso.io` или `file:local.db` для локальной разработки. |
| `TURSO_AUTH_TOKEN` | Токен Turso (`turso db tokens create <db>`). |

Таблицы создаются автоматически при первом запросе. Также доступен `npx drizzle-kit push` / `npx drizzle-kit studio`.

## API
| Метод | Путь | Назначение |
|---|---|---|
| GET / POST | `/api/tasks` | список / ручное создание |
| PATCH / DELETE | `/api/tasks/:id` | `done`, `quadrant`, `deadline`, `title`, `category` / удаление (вместе с подзадачами) |
| POST | `/api/parse` | `{ text, today }` → Gemini → новые задачи |
| POST | `/api/tasks/:id/subtasks` | Gemini разбивает задачу на 3–7 подзадач (заменяет текущие) |
| PATCH / DELETE | `/api/subtasks/:id` | отметка / удаление подзадачи |

Голосовой ввод работает в Chrome/Edge/Safari (Firefox не поддерживает Web Speech API — кнопка будет неактивна).

## Если ИИ недоступен (Vercel)
1. Откройте `https://<ваш-домен>/api/ai-status` — там видно, задан ли ключ, какие flash-модели доступны этому ключу (`availableFlashModels`) и какая модель реально отвечает (`workingModel`). Сам ключ не показывается.
2. Подробности каждой неудачной попытки — в Vercel → Project → Logs (строки `[gemini]`).
3. При необходимости задайте `GEMINI_MODEL` одной из `availableFlashModels` и сделайте **Redeploy**: переменные окружения применяются только к новому деплою.

При временных сбоях Gemini (503 «model is overloaded», 500, 429) сервер сам повторяет запрос до 3 раз и переходит к следующей модели из списка: `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-flash-latest` → `gemini-2.5-flash`.
