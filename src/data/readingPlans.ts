/**
 * Bundled reading plans. A plan is a fixed sequence of days, each day a list of
 * chapter references ("Genesis 1", "Matthew 1") that deep-link into the reader.
 * Generated deterministically from the canonical chapter structure — no dates,
 * no randomness (safe for tests and OTA).
 *
 * The flagship walks the OT and NT **in parallel** (both advance each day),
 * matching the believer's daily rhythm.
 */
import { CHAPTER_COUNTS, bookByNumber } from './structure';
import { dayKey, daysBetweenKeys } from '@/utils/date';

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  days: string[][]; // days -> chapter references
}

/** All chapter references for a book-number range, in canonical order. */
function chaptersForBooks(fromBook: number, toBook: number): string[] {
  const out: string[] = [];
  for (let n = fromBook; n <= toBook; n++) {
    const name = bookByNumber(n)?.name;
    const count = CHAPTER_COUNTS[n] ?? 0;
    if (!name) continue;
    for (let c = 1; c <= count; c++) out.push(`${name} ${c}`);
  }
  return out;
}

/** Split a list into `days` contiguous slices as evenly as possible. */
function distribute(list: string[], days: number): string[][] {
  const out: string[][] = [];
  const L = list.length;
  for (let d = 0; d < days; d++) {
    const start = Math.floor((d * L) / days);
    const end = Math.floor(((d + 1) * L) / days);
    out.push(list.slice(start, end));
  }
  return out;
}

/**
 * Whole Bible with a portion from **each** Testament every day. Anchored to one
 * NT chapter/day (260 days); the OT (929 chapters) is spread across those days
 * (~3–4/day). Both testaments advance every single day.
 */
function parallelWholeBible(): string[][] {
  const ot = chaptersForBooks(1, 39); // 929 chapters
  const nt = chaptersForBooks(40, 66); // 260 chapters
  const days = nt.length; // one NT chapter per day
  const otSlices = distribute(ot, days);
  return Array.from({ length: days }, (_, d) => [...otSlices[d], nt[d]]);
}

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'bible-parallel',
    title: 'Old & New Testament Together',
    description: 'A portion from each Testament every day — the whole Bible in about 260 days.',
    days: parallelWholeBible(),
  },
  {
    id: 'nt-90',
    title: 'New Testament in 90 Days',
    description: 'Matthew through Revelation, about three chapters a day.',
    days: distribute(chaptersForBooks(40, 66), 90),
  },
  {
    id: 'gospels-30',
    title: 'The Gospels in 30 Days',
    description: 'Walk through Matthew, Mark, Luke & John in a month.',
    days: distribute(chaptersForBooks(40, 43), 30),
  },
];

export function getReadingPlan(id: string | null | undefined): ReadingPlan | undefined {
  return id ? READING_PLANS.find((p) => p.id === id) : undefined;
}

/**
 * The reading portion for a circle's shared plan on a given date — the plan
 * "auto-advances" by counting whole days from its start. Loops gently once the
 * plan is finished. Returns null when there's no plan/start or the date precedes
 * the start. Kept pure (date passed in) for testability.
 */
export function planPortionForDate(
  planId: string | null | undefined,
  startedAt: number | null | undefined,
  todayKey: string,
): { refs: string[]; dayNumber: number; total: number } | null {
  const plan = getReadingPlan(planId);
  if (!plan || !startedAt || plan.days.length === 0) return null;
  const offset = daysBetweenKeys(dayKey(startedAt), todayKey);
  if (offset < 0) return null;
  const idx = offset % plan.days.length;
  return { refs: plan.days[idx] ?? [], dayNumber: offset + 1, total: plan.days.length };
}
