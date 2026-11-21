/**
 * Намаз всегда в приоритете: такие задачи всегда «Срочно и важно» и стоят на первом месте.
 */
const PRAYER_STEMS = /(намаз|молитв|салят|салах|джума|таравих|фаджр|зухр|магриб|witr|витр)/i;
// Короткие названия намазов — только целым словом (чтобы «Миша» или «пиша» не совпали)
const PRAYER_WORDS = /(^|[^а-яёa-z])(аср|иша|ишa|фаджр|зухр)([^а-яёa-z]|$)/i;

export const PRAYER_REASON = "Намаз — всегда на первом месте";
export const PRAYER_CATEGORY = "Религия";

export function isPrayerTask(title: string): boolean {
  return PRAYER_STEMS.test(title) || PRAYER_WORDS.test(title);
}
