export type Quadrant = "do" | "schedule" | "delegate" | "eliminate";

export const QUADRANTS: Quadrant[] = ["do", "schedule", "delegate", "eliminate"];

export const CATEGORIES = [
  "Работа",
  "Личное",
  "Здоровье",
  "Учёба",
  "Финансы",
  "Дом",
  "Религия",
  "Другое",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  /** Дата в формате YYYY-MM-DD или null */
  deadline: string | null;
  quadrant: Quadrant;
  priorityReason: string;
  done: boolean;
  /** ms timestamp */
  completedAt: number | null;
  /** ms timestamp */
  createdAt: number;
  /** Порядок внутри квадранта (меньше — выше) */
  position: number;
  subtasks: Subtask[];
}

export type TaskPatch = Partial<Pick<Task, "title" | "deadline" | "quadrant" | "done" | "category" | "position">>;

export function toQuadrant(isUrgent: boolean, isImportant: boolean): Quadrant {
  if (isUrgent && isImportant) return "do";
  if (!isUrgent && isImportant) return "schedule";
  if (isUrgent && !isImportant) return "delegate";
  return "eliminate";
}
