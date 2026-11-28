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
      className={`material flex min-h-[220px] flex-col rounded-panel transition-[box-shadow,background-color] ${
        isOver ? "bg-accent-soft ring-2 ring-accent/50" : ""
      }`}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.15)]" style={{ background: meta.color }} />
        <h2 className="text-[13px] font-semibold">{meta.title}</h2>
        <span className="text-xs text-muted">{meta.subtitle}</span>
        <span className="ml-auto min-w-5 rounded-full bg-surface-3 px-1.5 py-px text-center text-[11px] font-medium tabular-nums text-muted">{open}</span>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {tasks.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-card border border-dashed border-line-strong p-4 text-center text-xs text-muted">
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
