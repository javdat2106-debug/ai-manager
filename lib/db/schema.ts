import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Другое"),
  deadline: text("deadline"),
  quadrant: text("quadrant", { enum: ["do", "schedule", "delegate", "eliminate"] }).notNull(),
  priorityReason: text("priority_reason").notNull().default(""),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  position: real("position").notNull().default(0),
});

export const subtasks = sqliteTable(
  "subtasks",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("subtasks_task_idx").on(t.taskId)],
);

export type TaskRow = typeof tasks.$inferSelect;
export type SubtaskRow = typeof subtasks.$inferSelect;
