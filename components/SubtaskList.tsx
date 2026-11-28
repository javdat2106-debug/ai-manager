"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import type { Priority, Subtask } from "@/lib/types";
import { Checkbox } from "./Checkbox";
import { PriorityToggle } from "./PriorityToggle";

export interface SubtaskActions {
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPriority: (id: string, p: Priority) => void;
  onReorder: (ids: string[]) => void;
  onAdd: (title: string) => void;
}

/** Подзадачи двигаются только по вертикали */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const isTemp = (id: string) => id.startsWith("tmp-");

function SubtaskItem({ s, actions }: { s: Subtask; actions: SubtaskActions }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: s.id,
    disabled: isTemp(s.id),
  });
  const [editing, setEditing] = useState(false);
  const pending = isTemp(s.id);

  const commit = (value: string) => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== s.title) actions.onRename(s.id, v);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group/sub flex items-center gap-1.5 rounded-md py-0.5 ${isDragging ? "glass relative z-10" : ""} ${
        pending ? "opacity-60" : ""
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label="Перетащить подзадачу"
        className="-ml-1 cursor-grab touch-none text-faint opacity-40 transition-opacity hover:text-muted focus:opacity-100 group-hover/sub:opacity-100 active:cursor-grabbing sm:opacity-0"
      >
        <GripVertical className="size-3.5" />
      </button>
      <Checkbox size="sm" checked={s.done} onChange={(v) => !pending && actions.onToggle(s.id, v)} label={s.title} />
      {editing ? (
        <input
          autoFocus
          defaultValue={s.title}
          maxLength={200}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-6 min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-1.5 text-[13px] text-fg outline-none focus:ring-[3px] focus:ring-accent/30"
        />
      ) : (
        <span
          onDoubleClick={() => !pending && setEditing(true)}
          title="Двойной клик — переименовать"
          className={`min-w-0 flex-1 cursor-text text-[13px] leading-snug ${s.done ? "text-faint line-through" : "text-muted"}`}
        >
          {s.title}
        </span>
      )}
      {!pending && (
        <PriorityToggle
          size="sm"
          value={s.priority}
          onChange={(p) => actions.onPriority(s.id, p)}
          className={s.priority === "medium" ? "opacity-40 group-hover/sub:opacity-100 sm:opacity-0" : ""}
        />
      )}
      <button
        onClick={() => !pending && actions.onRemove(s.id)}
        className="text-faint opacity-40 transition-opacity hover:text-q-do focus:opacity-100 group-hover/sub:opacity-100 sm:opacity-0"
        aria-label="Удалить подзадачу"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

export function AddSubtaskInput({ onAdd, onClose }: { onAdd: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v) onAdd(v);
        setValue("");
      }}
      className="flex items-center gap-1.5 py-0.5"
    >
      <Plus className="size-3.5 shrink-0 text-faint" />
      <input
        autoFocus
        value={value}
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value.trim() && onClose()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Новая подзадача — Enter"
        aria-label="Новая подзадача"
        className="h-6 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-line-strong focus:ring-[3px] focus:ring-accent/30"
      />
    </form>
  );
}

export function SubtaskList({
  subtasks,
  adding,
  setAdding,
  ...actions
}: { subtasks: Subtask[]; adding: boolean; setAdding: (v: boolean) => void } & SubtaskActions) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = subtasks.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    actions.onReorder(arrayMove(ids, from, to).filter((id) => !isTemp(id)));
  };

  return (
    <div className="mt-2 border-l border-line pl-3">
      {subtasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {subtasks.map((s) => (
                <SubtaskItem key={s.id} s={s} actions={actions} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {adding ? (
        <AddSubtaskInput onAdd={actions.onAdd} onClose={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-0.5 inline-flex items-center gap-1 rounded-md py-0.5 text-[12px] font-medium text-muted hover:text-accent"
        >
          <Plus className="size-3.5" /> Добавить подзадачу
        </button>
      )}
    </div>
  );
}
