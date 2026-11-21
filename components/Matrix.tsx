"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { QUADRANTS, type Quadrant as Q, type Task, type TaskPatch } from "@/lib/types";
import { isPrayerTask } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { Quadrant } from "./Quadrant";
import { TaskCard, type TaskActions } from "./TaskCard";

/** Намаз всегда первым, дальше — ручной порядок */
function sortTasks(a: Task, b: Task) {
  const pa = isPrayerTask(a.title);
  const pb = isPrayerTask(b.title);
  if (pa !== pb) return pa ? -1 : 1;
  return a.position - b.position || b.createdAt - a.createdAt;
}

function group(tasks: Task[]): Record<Q, Task[]> {
  const g = Object.fromEntries(QUADRANTS.map((q) => [q, [] as Task[]])) as Record<Q, Task[]>;
  for (const t of tasks) g[t.quadrant].push(t);
  for (const q of QUADRANTS) g[q].sort(sortTasks);
  return g;
}

const isQuadrant = (id: unknown): id is Q => QUADRANTS.includes(id as Q);

/** Позиция между соседями в уже упорядоченном списке */
function positionAt(list: Task[], index: number): number {
  const prev = list[index - 1]?.position;
  const next = list[index + 1]?.position;
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1;
  if (next !== undefined) return next - 1;
  return 0;
}

const PRAYER_LOCK = "Намаз всегда в приоритете — он остаётся в «Срочно и важно»";

export function Matrix({
  tasks,
  onMove,
  actions,
}: {
  tasks: Task[];
  onMove: (id: string, patch: TaskPatch) => void;
  actions: TaskActions;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Копия задач на время перетаскивания: карточка «переезжает» между квадрантами вживую */
  const [preview, setPreview] = useState<Task[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const view = preview ?? tasks;
  const grouped = useMemo(() => group(view), [view]);
  const active = activeId ? view.find((t) => t.id === activeId) : null;

  const quadrantOf = (id: unknown, list: Task[]): Q | undefined =>
    isQuadrant(id) ? id : list.find((t) => t.id === id)?.quadrant;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setPreview(tasks);
  };

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || !preview) return;
    const task = preview.find((t) => t.id === a.id);
    const to = quadrantOf(over.id, preview);
    if (!task || !to || task.quadrant === to) return;
    if (isPrayerTask(task.title) && to !== "do") return;

    // временно ставим карточку перед той, над которой курсор (или в конец пустого квадранта)
    const target = group(preview)[to];
    const overIdx = target.findIndex((t) => t.id === over.id);
    const position =
      overIdx >= 0 ? target[overIdx].position - 1e-6 : (target.at(-1)?.position ?? 0) + 1;
    setPreview(preview.map((t) => (t.id === task.id ? { ...t, quadrant: to, position } : t)));
  };

  const finish = () => {
    setActiveId(null);
    setPreview(null);
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    const list = preview;
    finish();
    if (!over || !list) return;

    const original = tasks.find((t) => t.id === a.id);
    const to = quadrantOf(over.id, list);
    if (!original || !to) return;
    if (isPrayerTask(original.title) && to !== "do") {
      toast(PRAYER_LOCK, "info");
      return;
    }

    const column = group(list)[to];
    const from = column.findIndex((t) => t.id === a.id);
    if (from < 0) return;
    const overIdx = column.findIndex((t) => t.id === over.id);
    const ordered = overIdx >= 0 ? arrayMove(column, from, overIdx) : column;
    const index = ordered.findIndex((t) => t.id === a.id);

    const sameQuadrant = original.quadrant === to;
    const originalIndex = group(tasks)[to].findIndex((t) => t.id === a.id);
    if (sameQuadrant && index === originalIndex) return;

    const position = positionAt(ordered, index);
    onMove(original.id, sameQuadrant ? { position } : { quadrant: to, position });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
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
