"use client";

import { Flag } from "lucide-react";
import type { Priority } from "@/lib/types";
import { nextPriority, PRIORITY_META } from "@/lib/priorityLevels";

/** Флажок приоритета: клик переключает Средний → Высокий → Низкий → Средний */
export function PriorityToggle({
  value,
  onChange,
  size = "md",
  className = "",
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = PRIORITY_META[value];
  const next = PRIORITY_META[nextPriority(value)];
  return (
    <button
      type="button"
      onClick={() => onChange(nextPriority(value))}
      title={`${meta.label} · нажмите → ${next.label.toLowerCase()}`}
      aria-label={`${meta.label}. Изменить`}
      className={`inline-flex shrink-0 items-center gap-1 rounded transition-colors hover:bg-surface-3 ${
        size === "sm" ? "p-0.5" : "px-1.5 py-px text-[11px]"
      } ${className}`}
      style={{ color: meta.color }}
    >
      <Flag className={size === "sm" ? "size-3" : "size-3"} fill={value === "low" ? "none" : "currentColor"} />
      {size === "md" && value !== "medium" && <span>{value === "high" ? "Высокий" : "Низкий"}</span>}
    </button>
  );
}
