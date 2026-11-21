"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, ChevronDown, GripVertical, ListTree, Loader2, Sparkles, Trash2, X } from "lucide-react";
import type { Task } from "@/lib/types";
import { parseDateKey } from "@/lib/date";
import { Checkbox } from "./Checkbox";
import { SubtaskList } from "./SubtaskList";

export interface TaskActions {
  onToggle: (id: string, done: boolean) => void;
  onDeadline: (id: string, deadline: string | null) => void;
  onDelete: (id: string) => void;
  onBreakdown: (id: string) => Promise<void>;
  onToggleSubtask: (taskId: string, subId: string, done: boolean) => void;
  onRemoveSubtask: (taskId: string, subId: string) => void;
}

function deadlineLabel(key: string) {
  const d = parseDateKey(key);
  if (isToday(d)) return "Сегодня";
  if (isTomorrow(d)) return "Завтра";
  return format(d, "d MMM", { locale: ru });
}

export function DraggableTaskCard({ task, ...actions }: { task: Task } & TaskActions) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { quadrant: task.quadrant },
  });
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-30" : undefined}>
      <TaskCard
        task={task}
        {...actions}
        handle={
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label="Перетащить задачу"
            className="-ml-1 cursor-grab touch-none rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-muted focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}

export function TaskCard({
  task,
  handle,
  overlay,
  onToggle,
  onDeadline,
  onDelete,
  onBreakdown,
  onToggleSubtask,
  onRemoveSubtask,
}: { task: Task; handle?: React.ReactNode; overlay?: boolean } & TaskActions) {
  const [editingDate, setEditingDate] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [open, setOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const overdue = !!task.deadline && !task.done && isPast(parseDateKey(task.deadline)) && !isToday(parseDateKey(task.deadline));
  const subDone = task.subtasks.filter((s) => s.done).length;

  const breakdown = async () => {
    setBreaking(true);
    await onBreakdown(task.id);
    setBreaking(false);
    setOpen(true);
  };

  return (
    <article
      className={`group rounded-lg border bg-surface-2 px-3 py-2.5 transition-colors ${
        overlay ? "rotate-1 border-line-strong shadow-2xl shadow-black/60" : "border-line hover:border-line-strong"
      } ${task.done ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        {handle}
        <div className="pt-[3px]">
          <Checkbox checked={task.done} onChange={(v) => onToggle(task.id, v)} label={task.title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${task.done ? "text-muted line-through" : "text-fg"}`}>{task.title}</p>

          {task.priorityReason && (
            <p className="mt-1 flex items-start gap-1 text-xs leading-snug text-muted">
              <Sparkles className="mt-px size-3 shrink-0 text-accent" />
              <span>{task.priorityReason}</span>
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-line px-1.5 py-px text-[11px] text-muted">{task.category}</span>

            {editingDate ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="date"
                  autoFocus
                  defaultValue={task.deadline ?? ""}
                  onChange={(e) => e.target.value && onDeadline(task.id, e.target.value)}
                  onBlur={() => setEditingDate(false)}
                  onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setEditingDate(false)}
                  className="h-[22px] rounded border border-line-strong bg-surface-3 px-1 text-[11px] text-fg outline-none"
                />
                {task.deadline && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onDeadline(task.id, null);
                      setEditingDate(false);
                    }}
                    className="text-faint hover:text-fg"
                    aria-label="Убрать дедлайн"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            ) : (
              <button
                onClick={() => setEditingDate(true)}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] transition-colors ${
                  overdue
                    ? "border-q-do/40 text-q-do"
                    : task.deadline
                      ? "border-line text-muted hover:text-fg"
                      : "border-dashed border-line text-faint hover:text-muted"
                }`}
                title="Изменить дедлайн"
              >
                <CalendarDays className="size-3" />
                {task.deadline ? deadlineLabel(task.deadline) : "Дедлайн"}
              </button>
            )}

            {task.subtasks.length > 0 && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[11px] tabular-nums text-muted hover:text-fg"
              >
                <ChevronDown className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`} />
                {subDone}/{task.subtasks.length}
              </button>
            )}

            <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              <button
                onClick={breakdown}
                disabled={breaking}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-60"
                title={task.subtasks.length ? "Пересобрать подзадачи с помощью ИИ" : "Разбить на подзадачи с помощью ИИ"}
              >
                {breaking ? <Loader2 className="size-3 animate-spin" /> : <ListTree className="size-3" />}
                {breaking ? "Думаю…" : "Подзадачи"}
              </button>
              {confirmDelete ? (
                <button
                  onClick={() => onDelete(task.id)}
                  onBlur={() => setConfirmDelete(false)}
                  autoFocus
                  className="rounded bg-q-do/15 px-1.5 py-0.5 text-[11px] text-q-do hover:bg-q-do/25"
                >
                  Удалить?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1 text-faint hover:bg-surface-3 hover:text-q-do"
                  aria-label="Удалить задачу"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {open && task.subtasks.length > 0 && (
            <SubtaskList
              subtasks={task.subtasks}
              onToggle={(sid, v) => onToggleSubtask(task.id, sid, v)}
              onRemove={(sid) => onRemoveSubtask(task.id, sid)}
            />
          )}
        </div>
      </div>
    </article>
  );
}
