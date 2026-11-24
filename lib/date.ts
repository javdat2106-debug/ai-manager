/** Локальная дата в формате YYYY-MM-DD */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS: [RegExp, number][] = [
  [/^(пн|пон|понедельник)$/, 1],
  [/^(вт|вто|вторник)$/, 2],
  [/^(ср|сре|среда|среду)$/, 3],
  [/^(чт|чет|четверг)$/, 4],
  [/^(пт|пят|пятница|пятницу)$/, 5],
  [/^(сб|суб|суббота|субботу)$/, 6],
  [/^(вс|вос|воскресенье)$/, 0],
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Ближайший (сегодня или позже) день недели: 0 — вс, 1 — пн, … */
export function nextWeekday(day: number, from: Date = new Date()): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return addDays(base, (day - base.getDay() + 7) % 7);
}

/**
 * Разбор введённой вручную даты: «25.11», «25.11.2026», «25/11», «2026-11-25»,
 * «пт», «пятница», «в пятницу», «сегодня», «завтра», «послезавтра», «через 3 дня»,
 * «через неделю», «+3». Возвращает YYYY-MM-DD или null.
 */
export function parseDateInput(raw: string, now: Date = new Date()): string | null {
  const s = raw.trim().toLowerCase().replace(/ё/g, "е").replace(/^(в|во|на|до)\s+/, "");
  if (!s) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (s === "сегодня") return toDateKey(today);
  if (s === "завтра") return toDateKey(addDays(today, 1));
  if (s === "послезавтра") return toDateKey(addDays(today, 2));

  let m = s.match(/^(?:через\s+)?\+?(\d{1,3})\s*(д|дн|дня|дней|день)?$/);
  if (m && (s.startsWith("через") || s.startsWith("+") || m[2])) return toDateKey(addDays(today, Number(m[1])));
  if (/^через\s+неделю$/.test(s)) return toDateKey(addDays(today, 7));
  m = s.match(/^через\s+(\d{1,2})\s+недел/);
  if (m) return toDateKey(addDays(today, 7 * Number(m[1])));

  for (const [re, day] of WEEKDAYS) if (re.test(s)) return toDateKey(nextWeekday(day, today));

  m = s.match(/^(\d{1,2})(?:-?е|-?го)?(?:\s*числа)?$/);
  if (m) {
    // только число: ближайшее такое число (в этом или следующих месяцах)
    for (let i = 0; i < 3; i++) {
      const first = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const k = valid(first.getFullYear(), first.getMonth() + 1, Number(m[1]));
      if (k && parseDateKey(k) >= today) return k;
    }
    return null;
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[./\-\s](\d{1,2})(?:[./\-\s](\d{2}|\d{4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (m[3]) return valid(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), month, day);
    // без года: ближайшая будущая дата
    const thisYear = valid(today.getFullYear(), month, day);
    if (thisYear && parseDateKey(thisYear) < today) return valid(today.getFullYear() + 1, month, day);
    return thisYear;
  }
  return null;
}

function valid(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toDateKey(date);
}
