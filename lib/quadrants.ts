import type { Quadrant } from "./types";

export const QUADRANT_META: Record<
  Quadrant,
  { title: string; subtitle: string; color: string; hint: string }
> = {
  do: {
    title: "Срочно и важно",
    subtitle: "Сделать сейчас",
    color: "var(--color-q-do)",
    hint: "Кризисы, дедлайны, горящие дела",
  },
  schedule: {
    title: "Не срочно, но важно",
    subtitle: "Запланировать",
    color: "var(--color-q-schedule)",
    hint: "Цели, развитие, здоровье",
  },
  delegate: {
    title: "Срочно, но не важно",
    subtitle: "Делегировать",
    color: "var(--color-q-delegate)",
    hint: "Отвлечения, чужие запросы",
  },
  eliminate: {
    title: "Не срочно и не важно",
    subtitle: "Убрать",
    color: "var(--color-q-eliminate)",
    hint: "Можно не делать вовсе",
  },
};
