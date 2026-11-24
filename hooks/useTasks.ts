"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Priority, Subtask, SubtaskPatch, Task, TaskPatch } from "@/lib/types";
import { positionForPriority } from "@/lib/priorityLevels";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  /** Очередь запросов на задачу: изменения уходят на сервер строго по порядку */
  const queues = useRef(new Map<string, Promise<unknown>>());
  const enqueue = useCallback(<T,>(id: string, run: () => Promise<T>): Promise<T> => {
    const prev = queues.current.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(run);
    queues.current.set(id, next);
    next.finally(() => queues.current.get(id) === next && queues.current.delete(id)).catch(() => {});
    return next;
  }, []);

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
  /** Обновить поля задачи ответом сервера, не трогая подзадачи (они могли измениться локально за время запроса) */
  const replaceFields = (task: Task) =>
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...task, subtasks: t.subtasks } : t)));

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
        async () => replaceFields(await enqueue(id, () => api.update(id, patch))),
      ),
    [optimistic, enqueue],
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

  /** Смена приоритета задачи: высокий поднимается в начало квадранта, низкий — в конец */
  const setPriority = useCallback(
    (id: string, priority: Priority) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const others = tasksRef.current
        .filter((t) => t.quadrant === task.quadrant && t.id !== id)
        .map((t) => t.position);
      return update(id, { priority, position: positionForPriority(priority, task.position, others) });
    },
    [update],
  );

  const patchSubtaskLocal = (ts: Task[], taskId: string, subId: string, patch: SubtaskPatch) =>
    ts.map((t) =>
      t.id === taskId
        ? {
            ...t,
            subtasks: t.subtasks
              .map((s) => (s.id === subId ? { ...s, ...patch } : s))
              .sort((a, b) => a.position - b.position),
          }
        : t,
    );

  const updateSubtask = useCallback(
    (taskId: string, subId: string, patch: SubtaskPatch) =>
      optimistic(
        (ts) => patchSubtaskLocal(ts, taskId, subId, patch),
        async () => {
          await api.updateSubtask(subId, patch);
        },
      ),
    [optimistic],
  );

  const setSubtaskPriority = useCallback(
    (taskId: string, subId: string, priority: Priority) => {
      const subs = tasksRef.current.find((t) => t.id === taskId)?.subtasks ?? [];
      const sub = subs.find((s) => s.id === subId);
      if (!sub) return;
      const others = subs.filter((s) => s.id !== subId).map((s) => s.position);
      return updateSubtask(taskId, subId, {
        priority,
        position: positionForPriority(priority, sub.position, others),
      });
    },
    [updateSubtask],
  );

  const renameSubtask = useCallback(
    (taskId: string, subId: string, title: string) => updateSubtask(taskId, subId, { title }),
    [updateSubtask],
  );

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const tempId = `tmp-${crypto.randomUUID()}`;
    const task = tasksRef.current.find((t) => t.id === taskId);
    const temp: Subtask = {
      id: tempId,
      taskId,
      title,
      done: false,
      priority: "medium",
      position: Math.max(-1, ...(task?.subtasks.map((s) => s.position) ?? [])) + 1,
    };
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, temp] } : t)));
    try {
      const sub = await api.addSubtask(taskId, title);
      setTasks((ts) =>
        ts.map((t) =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => (s.id === tempId ? sub : s)) } : t,
        ),
      );
    } catch (e) {
      setTasks((ts) =>
        ts.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== tempId) } : t)),
      );
      toast((e as Error).message, "error");
    }
  }, []);

  const reorderSubtasks = useCallback(
    (taskId: string, ids: string[]) =>
      optimistic(
        (ts) =>
          ts.map((t) => {
            if (t.id !== taskId) return t;
            const byId = new Map(t.subtasks.map((s) => [s.id, s]));
            return {
              ...t,
              subtasks: ids.flatMap((id, i) => {
                const s = byId.get(id);
                return s ? [{ ...s, position: i }] : [];
              }),
            };
          }),
        async () => {
          await api.reorderSubtasks(taskId, ids);
        },
      ),
    [optimistic],
  );

  return {
    tasks,
    loading,
    loadError,
    reload: load,
    parse,
    update,
    remove,
    breakdown,
    setPriority,
    toggleSubtask,
    removeSubtask,
    addSubtask,
    renameSubtask,
    setSubtaskPriority,
    reorderSubtasks,
  };
}
