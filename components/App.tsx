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
    <>
      {/* Функциональный слой: плавающий стеклянный тулбар */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-12 w-full max-w-6xl items-center gap-3 rounded-full pr-4 pl-2">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-[#5aa2ff] to-[#0a6cff] text-white shadow-sm">
            <LayoutGrid className="size-4" />
          </div>
          <h1 className="text-[15px] font-semibold tracking-tight">AI Tasks</h1>
          <span className="hidden text-[13px] font-medium text-muted sm:inline">Матрица Эйзенхауэра</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-5 pb-10 sm:px-6">
        <BrainDump onParse={async (text) => (await t.parse(text)).length} />
        <DailyProgress tasks={t.tasks} />

        {t.loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[220px] material animate-pulse rounded-panel" />
            ))}
          </div>
        ) : t.loadError ? (
          <div className="material flex flex-col items-center gap-3 rounded-panel p-8 text-center">
            <p className="text-sm text-fg">Не удалось загрузить задачи</p>
            <p className="max-w-md text-xs text-muted">{t.loadError}</p>
            <button
              onClick={t.reload}
              className="glass inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium hover:brightness-105"
            >
              <RotateCw className="size-3.5" /> Повторить
            </button>
          </div>
        ) : (
          <Matrix tasks={t.tasks} onMove={(id, patch) => t.update(id, patch)} actions={actions} />
        )}

        <Toaster />
      </main>
    </>
  );
}
