/**
 * The daily walk — the ONE habit engine. A day "counts" when you did anything
 * with God that day: checked off an Abide movement, wrote your journal, or
 * reviewed your verses (callers record those acts here). One streak derives
 * from it — "days with God" — replacing the three uncoordinated streaks
 * (memory / journal / together) as the number the app leads with.
 *
 * Pure + unit-tested; the store wraps these, screens render them.
 */
import { dayKey } from '@/utils/date';
import { shiftDay } from '@/utils/journal';

export interface WalkDay {
  /** Local day key, YYYY-MM-DD. */
  day: string;
  /** Movement keys completed this day ('come', 'word', … or recorded acts like 'reflect'/'respond'). */
  movements: string[];
  updatedAt: number;
}

export type Walk = Record<string, WalkDay>;

/** Record a completed movement/act for a day (idempotent). */
export function completeMovement(walk: Walk, day: string, movement: string, now: number): Walk {
  const prev = walk[day] ?? { day, movements: [], updatedAt: now };
  if (prev.movements.includes(movement)) return walk;
  return { ...walk, [day]: { ...prev, movements: [...prev.movements, movement], updatedAt: now } };
}

/** Un-check a movement; a day with no movements left is dropped. */
export function uncompleteMovement(walk: Walk, day: string, movement: string, now: number): Walk {
  const prev = walk[day];
  if (!prev) return walk;
  const movements = prev.movements.filter((m) => m !== movement);
  if (movements.length === 0) {
    const { [day]: _drop, ...rest } = walk;
    return rest;
  }
  return { ...walk, [day]: { ...prev, movements, updatedAt: now } };
}

/** A day "counts" when anything was done with God that day. */
export function dayIsMet(walk: Walk, day: string): boolean {
  return (walk[day]?.movements.length ?? 0) > 0;
}

/** How much of a given rhythm is done today (for the walk progress ring/bar). */
export function rhythmProgress(walk: Walk, day: string, rhythm: string[]): { done: number; total: number; doneKeys: string[] } {
  const completed = new Set(walk[day]?.movements ?? []);
  const doneKeys = rhythm.filter((k) => completed.has(k));
  return { done: doneKeys.length, total: rhythm.length, doneKeys };
}

/**
 * The ONE streak — consecutive "met" days ending today (or yesterday, grace, so
 * the streak survives until the end of the next day — same rule as the journal).
 */
export function walkStreak(walk: Walk, todayKey: string = dayKey()): number {
  const met = new Set(Object.values(walk).filter((d) => d.movements.length > 0).map((d) => d.day));
  if (met.size === 0) return 0;
  let anchor: string;
  if (met.has(todayKey)) anchor = todayKey;
  else {
    const y = shiftDay(todayKey, -1);
    if (met.has(y)) anchor = y;
    else return 0;
  }
  let streak = 0;
  let cursor = anchor;
  while (met.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** Days met in the trailing N days (for a small week strip: M T W T F S S). */
export function weekStrip(walk: Walk, todayKey: string = dayKey(), n = 7): { day: string; met: boolean }[] {
  const out: { day: string; met: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = shiftDay(todayKey, -i);
    out.push({ day: d, met: dayIsMet(walk, d) });
  }
  return out;
}
