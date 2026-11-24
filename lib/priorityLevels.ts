import type { Priority } from "./types";

export const PRIORITY_META: Record<Priority, { label: string; color: string; rank: number }> = {
  high: { label: "Высокий приоритет", color: "var(--color-q-do)", rank: 0 },
  medium: { label: "Средний приоритет", color: "var(--color-q-delegate)", rank: 1 },
  low: { label: "Низкий приоритет", color: "var(--color-faint)", rank: 2 },
};

const CYCLE: Record<Priority, Priority> = { medium: "high", high: "low", low: "medium" };

/** medium → high → low → medium */
export function nextPriority(p: Priority): Priority {
  return CYCLE[p];
}

/**
 * Новая позиция при смене приоритета: высокий — в начало списка, низкий — в конец,
 * средний — на месте. `positions` — позиции остальных элементов списка.
 */
export function positionForPriority(p: Priority, current: number, positions: number[]): number {
  if (positions.length === 0) return current;
  if (p === "high") return Math.min(current, Math.min(...positions) - 1);
  if (p === "low") return Math.max(current, Math.max(...positions) + 1);
  return current;
}
