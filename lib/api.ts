import type { Subtask, Task, TaskPatch } from "./types";
import { toDateKey } from "./date";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data as T;
}

export const api = {
  list: () => request<{ tasks: Task[] }>("/api/tasks").then((r) => r.tasks),

  parse: (text: string) =>
    request<{ tasks: Task[] }>("/api/parse", {
      method: "POST",
      body: JSON.stringify({ text, today: toDateKey() }),
    }).then((r) => r.tasks),

  update: (id: string, patch: TaskPatch) =>
    request<{ task: Task }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.task),

  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),

  breakdown: (id: string) =>
    request<{ task: Task }>(`/api/tasks/${id}/subtasks`, { method: "POST" }).then((r) => r.task),

  updateSubtask: (id: string, patch: Partial<Pick<Subtask, "done" | "title">>) =>
    request<{ subtask: Subtask }>(`/api/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.subtask),

  removeSubtask: (id: string) => request<void>(`/api/subtasks/${id}`, { method: "DELETE" }),
};
