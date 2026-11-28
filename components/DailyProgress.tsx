"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Task } from "@/lib/types";
import { toDateKey } from "@/lib/date";

/**
 * Задача относится к дню, если:
 *  - её дедлайн в этот день (или без дедлайна — создана в этот день), либо
 *  - она выполнена в этот день.
 * Для сегодняшнего дня дополнительно учитываются просроченные невыполненные задачи.
 */
function dayStats(tasks: Task[], day: string, isToday: boolean) {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const home = t.deadline ?? toDateKey(new Date(t.createdAt));
    const completedDay = t.completedAt ? toDateKey(new Date(t.completedAt)) : null;
    const overdue = isToday && !t.done && t.deadline !== null && t.deadline < day;
    const belongs = home === day || completedDay === day || overdue;
    if (!belongs) continue;
    total++;
    if (t.done && (completedDay === day || home === day)) done++;
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function DailyProgress({ tasks }: { tasks: Task[] }) {
  const { today, week } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const key = toDateKey(d);
      return { key, date: d, ...dayStats(tasks, key, key === todayKey) };
    });
    return { today: week[6], week };
  }, [tasks]);

  return (
    <section className="material flex flex-col gap-4 rounded-panel p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] leading-none font-bold tabular-nums tracking-tight">{today.pct}%</span>
            <span className="text-sm text-muted">
              сегодня · {format(today.date, "d MMMM, EEEE", { locale: ru })}
            </span>
          </div>
          <span className="text-sm tabular-nums text-muted">
            {today.done} из {today.total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${today.pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-end gap-1.5" aria-label="Прогресс за 7 дней">
        {week.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1" title={`${d.key}: ${d.pct}% (${d.done}/${d.total})`}>
            <div className="relative h-9 w-5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500 ${
                  d.key === today.key ? "bg-accent" : "bg-accent/45"
                }`}
                style={{ height: `${d.pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium uppercase ${d.key === today.key ? "text-fg" : "text-muted"}`}>
              {format(d.date, "EEEEEE", { locale: ru })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
