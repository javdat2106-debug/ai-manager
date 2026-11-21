"use client";

import { X } from "lucide-react";
import type { Subtask } from "@/lib/types";
import { Checkbox } from "./Checkbox";

export function SubtaskList({
  subtasks,
  onToggle,
  onRemove,
}: {
  subtasks: Subtask[];
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ul className="mt-2 space-y-0.5 border-l border-line pl-3">
      {subtasks.map((s) => (
        <li key={s.id} className="group/sub flex items-center gap-2 py-0.5">
          <Checkbox size="sm" checked={s.done} onChange={(v) => onToggle(s.id, v)} label={s.title} />
          <span className={`flex-1 text-[13px] leading-snug ${s.done ? "text-faint line-through" : "text-muted"}`}>
            {s.title}
          </span>
          <button
            onClick={() => onRemove(s.id)}
            className="text-faint opacity-0 transition-opacity hover:text-q-do focus:opacity-100 group-hover/sub:opacity-100"
            aria-label="Удалить подзадачу"
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
