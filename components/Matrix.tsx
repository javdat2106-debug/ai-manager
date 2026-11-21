"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { QUADRANTS, type Quadrant as Q, type Task } from "@/lib/types";
import { Quadrant } from "./Quadrant";
import { TaskCard, type TaskActions } from "./TaskCard";

function sortTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
  if (!!a.deadline !== !!b.deadline) return a.deadline ? -1 : 1;
  return b.createdAt - a.createdAt;
}

export function Matrix({
  tasks,
  onMove,
  actions,
}: {
  tasks: Task[];
  onMove: (id: string, quadrant: Q) => void;
  actions: TaskActions;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const g = Object.fromEntries(QUADRANTS.map((q) => [q, [] as Task[]])) as Record<Q, Task[]>;
    for (const t of tasks) g[t.quadrant].push(t);
    for (const q of QUADRANTS) g[q].sort(sortTasks);
    return g;
  }, [tasks]);

  const active = activeId ? tasks.find((t) => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as Q | undefined;
    const from = e.active.data.current?.quadrant as Q | undefined;
    if (to && to !== from) onMove(String(e.active.id), to);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <Quadrant key={q} id={q} tasks={grouped[q]} actions={actions} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {active ? <TaskCard task={active} overlay {...actions} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
