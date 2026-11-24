"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react";
import { nextWeekday, parseDateInput, parseDateKey, toDateKey } from "@/lib/date";

const WEEK_OPTS = { weekStartsOn: 1 as const };
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WIDTH = 288;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DatePicker({
  anchor,
  value,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  value: string | null;
  onChange: (key: string | null) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = value ? parseDateKey(value) : null;
  const [month, setMonth] = useState(() => startOfMonth(selected ?? today));
  const [focus, setFocus] = useState<Date>(selected ?? today);
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = text.trim() ? parseDateInput(text) : null;

  // Позиционирование под якорем, не выходя за края экрана
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 380;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.min(Math.max(8, r.left), vw - WIDTH - 8);
      const below = r.bottom + 6;
      let top = below;
      if (below + h > vh - 8) top = r.top - h - 6 > 8 ? r.top - h - 6 : Math.max(8, vh - h - 8);
      setPos({ top, left });
    };
    place();
    // повторно — когда известна реальная высота поповера
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  // Закрытие по клику снаружи
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchor, onClose]);

  const pick = (d: Date | null) => {
    onChange(d ? toDateKey(d) : null);
    onClose();
  };

  const moveFocus = (d: Date) => {
    setFocus(d);
    if (!isSameMonth(d, month)) setMonth(startOfMonth(d));
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(addDays(focus, step[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      moveFocus(addMonths(focus, e.key === "PageUp" ? -1 : 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    }
  };

  // фокус следует за выбранной клавишами датой (не при открытии — там фокус в поле ввода)
  const focusMoved = useRef(false);
  useEffect(() => {
    if (!focusMoved.current) {
      focusMoved.current = true;
      return;
    }
    ref.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateKey(focus)}"]`)?.focus({ preventScroll: true });
  }, [focus]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), WEEK_OPTS);
    const end = endOfWeek(endOfMonth(month), WEEK_OPTS);
    const out: Date[] = [];
    for (let d = start; !isBefore(end, d); d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  // Ближайшие 7 дней начиная с сегодня
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return { label: WEEKDAY_SHORT[(date.getDay() + 6) % 7], date };
  });

  const quick = [
    { label: "Сегодня", date: today },
    { label: "Завтра", date: addDays(today, 1) },
    { label: "Выходные", date: nextWeekday(6, today) },
    { label: "След. неделя", date: nextWeekday(1, addDays(today, 1)) },
  ];

  const chip = (active: boolean) =>
    `rounded-md border px-2 py-1 text-xs transition-colors ${
      active ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg"
    }`;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Выбор даты"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
      className="fixed z-50 animate-fade-in rounded-xl border border-line-strong bg-surface-2 p-3 shadow-2xl shadow-black/60"
    >
      {/* Ввод вручную */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) pick(parseDateKey(parsed));
        }}
        className="relative"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ввести: 28.11, пт, через 3 дня…"
          aria-label="Ввести дату"
          className={`h-8 w-full rounded-md border bg-surface-3 pl-2.5 pr-8 text-[13px] text-fg outline-none placeholder:text-faint ${
            text.trim() && !parsed ? "border-q-do/50" : "border-line focus:border-line-strong"
          }`}
        />
        <CornerDownLeft className="pointer-events-none absolute right-2.5 top-2 size-4 text-faint" />
      </form>
      <p className="mt-1 h-4 text-[11px] text-muted">
        {text.trim()
          ? parsed
            ? `→ ${capitalize(format(parseDateKey(parsed), "EEEE, d MMMM yyyy", { locale: ru }))}`
            : "Не понял дату"
          : ""}
      </p>

      {/* Быстрый выбор */}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={() => pick(q.date)} className={chip(!!selected && isSameDay(q.date, selected))}>
            {q.label}
            <span className="ml-1 text-faint">{format(q.date, "EEEEEE", { locale: ru })}</span>
          </button>
        ))}
      </div>

      {/* Дни ближайшей недели */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {week.map(({ label, date }) => {
          const active = !!selected && isSameDay(date, selected);
          const isTodayDay = isSameDay(date, today);
          return (
            <button
              key={label}
              type="button"
              onClick={() => pick(date)}
              title={capitalize(format(date, "EEEE, d MMMM", { locale: ru }))}
              className={`flex flex-col items-center rounded-md border py-1 transition-colors ${
                active
                  ? "border-accent bg-accent text-bg"
                  : isTodayDay
                    ? "border-accent/50 text-fg hover:bg-surface-3"
                    : "border-line text-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              <span className={`text-[11px] font-medium ${label === "Сб" || label === "Вс" ? (active ? "" : "text-q-do/80") : ""}`}>
                {label}
              </span>
              <span className="text-[10px] tabular-nums opacity-80">{format(date, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* Календарь месяца */}
      <div className="mt-3 border-t border-line pt-2.5">
        <div className="mb-1.5 flex items-center">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded p-1 text-muted hover:bg-surface-3 hover:text-fg"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth(startOfMonth(today));
              setFocus(today);
            }}
            className="flex-1 text-center text-[13px] font-medium text-fg"
            title="К текущему месяцу"
          >
            {capitalize(format(month, "LLLL yyyy", { locale: ru }))}
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded p-1 text-muted hover:bg-surface-3 hover:text-fg"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] text-faint">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="py-0.5">
              {d}
            </span>
          ))}
        </div>
        <div role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
          {days.map((d) => {
            const key = toDateKey(d);
            const active = !!selected && isSameDay(d, selected);
            const isTodayDay = isSameDay(d, today);
            const past = isBefore(d, today);
            const outside = !isSameMonth(d, month);
            return (
              <button
                key={key}
                type="button"
                data-day={key}
                tabIndex={isSameDay(d, focus) ? 0 : -1}
                onClick={() => pick(d)}
                aria-label={capitalize(format(d, "EEEE, d MMMM yyyy", { locale: ru }))}
                aria-pressed={active}
                className={`h-8 rounded-md text-xs tabular-nums outline-none transition-colors focus-visible:ring-1 focus-visible:ring-accent ${
                  active
                    ? "bg-accent font-medium text-bg"
                    : isTodayDay
                      ? "font-medium text-accent ring-1 ring-inset ring-accent/40 hover:bg-surface-3"
                      : outside || past
                        ? "text-faint/70 hover:bg-surface-3"
                        : "text-fg hover:bg-surface-3"
                }`}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
        <span className="text-[11px] text-faint">
          {selected ? capitalize(format(selected, "EEEEEE, d MMM", { locale: ru })) : "Без срока"}
        </span>
        {value && (
          <button type="button" onClick={() => pick(null)} className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-surface-3 hover:text-q-do">
            Убрать срок
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
