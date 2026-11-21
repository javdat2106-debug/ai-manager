"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Task, TaskPatch } from "@/lib/types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTasks(await api.list());
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (task: Task) => setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));

  /** Оптимистичное изменение с откатом при ошибке */
  const optimistic = useCallback(async (mutate: (ts: Task[]) => Task[], run: () => Promise<void>) => {
    const snapshot = tasksRef.current;
    setTasks(mutate);
    try {
      await run();
    } catch (e) {
      setTasks(snapshot);
      toast((e as Error).message, "error");
    }
  }, []);

  const parse = useCallback(async (text: string) => {
    const created = await api.parse(text);
    setTasks((ts) => [...created, ...ts]);
    return created;
  }, []);

  const update = useCallback(
    (id: string, patch: TaskPatch) =>
      optimistic(
        (ts) =>
          ts.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  completedAt: patch.done === undefined ? t.completedAt : patch.done ? Date.now() : null,
                }
              : t,
          ),
        async () => replace(await api.update(id, patch)),
      ),
    [optimistic],
  );

  const remove = useCallback(
    (id: string) =>
      optimistic(
        (ts) => ts.filter((t) => t.id !== id),
        () => api.remove(id),
      ),
    [optimistic],
  );

  const breakdown = useCallback(async (id: string) => {
    try {
      replace(await api.breakdown(id));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, []);

  const toggleSubtask = useCallback(
    (taskId: string, subId: string, done: boolean) =>
      optimistic(
        (ts) =>
          ts.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done } : s)) }
              : t,
          ),
        async () => {
          await api.updateSubtask(subId, { done });
        },
      ),
    [optimistic],
  );

  const removeSubtask = useCallback(
    (taskId: string, subId: string) =>
      optimistic(
        (ts) =>
          ts.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t)),
        () => api.removeSubtask(subId),
      ),
    [optimistic],
  );

  return { tasks, loading, loadError, reload: load, parse, update, remove, breakdown, toggleSubtask, removeSubtask };
}
