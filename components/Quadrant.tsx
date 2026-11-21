"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Quadrant as Q, Task } from "@/lib/types";
import { QUADRANT_META } from "@/lib/quadrants";
import { DraggableTaskCard, type TaskActions } from "./TaskCard";

export function Quadrant({ id, tasks, actions }: { id: Q; tasks: Task[]; actions: TaskActions }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const meta = QUADRANT_META[id];
  const open = tasks.filter((t) => !t.done).length;

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[220px] flex-col rounded-xl border bg-surface transition-colors ${
        isOver ? "border-accent/60 bg-accent-soft" : "border-line"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="size-2 rounded-full" style={{ background: meta.color }} />
        <h2 className="text-sm font-medium">{meta.title}</h2>
        <span className="text-xs text-faint">· {meta.subtitle}</span>
        <span className="ml-auto rounded bg-surface-3 px-1.5 py-px text-[11px] tabular-nums text-muted">{open}</span>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {tasks.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line/70 p-4 text-center text-xs text-faint">
            {isOver ? "Отпустите, чтобы перенести" : meta.hint}
          </div>
        ) : (
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((t) => (
              <DraggableTaskCard key={t.id} task={t} {...actions} />
            ))}
          </SortableContext>
        )}
      </div>
    </section>
  );
}
