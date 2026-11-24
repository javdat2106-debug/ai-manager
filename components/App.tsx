"use client";

import { useMemo } from "react";
import { LayoutGrid, RotateCw } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { BrainDump } from "./BrainDump";
import { DailyProgress } from "./DailyProgress";
import { Matrix } from "./Matrix";
import { Toaster } from "./Toaster";
import type { TaskActions } from "./TaskCard";

export function App() {
  const t = useTasks();

  const actions: TaskActions = useMemo(
    () => ({
      onToggle: (id, done) => t.update(id, { done }),
      onDeadline: (id, deadline) => t.update(id, { deadline }),
      onDelete: t.remove,
      onBreakdown: t.breakdown,
      onToggleSubtask: t.toggleSubtask,
      onRemoveSubtask: t.removeSubtask,
      onPriority: t.setPriority,
      onAddSubtask: t.addSubtask,
      onRenameSubtask: t.renameSubtask,
      onSubtaskPriority: t.setSubtaskPriority,
      onReorderSubtasks: t.reorderSubtasks,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      t.update,
      t.remove,
      t.breakdown,
      t.setPriority,
      t.toggleSubtask,
      t.removeSubtask,
      t.addSubtask,
      t.renameSubtask,
      t.setSubtaskPriority,
      t.reorderSubtasks,
    ],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center gap-2.5">
        <div className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
          <LayoutGrid className="size-4" />
        </div>
        <h1 className="text-[15px] font-semibold tracking-tight">AI Tasks</h1>
        <span className="text-sm text-faint">/ Матрица Эйзенхауэра</span>
      </header>

      <BrainDump onParse={async (text) => (await t.parse(text)).length} />
      <DailyProgress tasks={t.tasks} />

      {t.loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : t.loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-q-do/30 bg-q-do/5 p-8 text-center">
          <p className="text-sm text-fg">Не удалось загрузить задачи</p>
          <p className="max-w-md text-xs text-muted">{t.loadError}</p>
          <button
            onClick={t.reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            <RotateCw className="size-3.5" /> Повторить
          </button>
        </div>
      ) : (
        <Matrix tasks={t.tasks} onMove={(id, patch) => t.update(id, patch)} actions={actions} />
      )}

      <Toaster />
    </main>
  );
}
