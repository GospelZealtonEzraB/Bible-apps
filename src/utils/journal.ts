/**
 * Pure reducers + derivations for the daily journal (the journaling product's
 * private core). Keyed by local day (YYYY-MM-DD). No store/UI imports so it's
 * cheap to unit-test and reuse. The store wraps these; the Journal screen renders
 * their output.
 */
import type { JournalEntry, JournalNote } from '@/types';
import { dayKey, daysBetweenKeys } from '@/utils/date';

export type Journal = Record<string, JournalEntry>;

/** A day entry is "empty" when it holds nothing worth keeping. */
export function entryIsEmpty(e: JournalEntry | undefined): boolean {
  if (!e) return true;
  return !e.reflection?.trim() && !e.verse?.trim() && !e.gratitude?.trim() && (e.notes?.length ?? 0) === 0;
}

/** Get an existing entry or a fresh blank one for `day` (not yet stored). */
export function blankEntry(day: string, now: number): JournalEntry {
  return { day, notes: [], createdAt: now, updatedAt: now };
}

/** Immutably patch a day's entry (creating it if absent), dropping it if it ends up empty. */
export function patchEntry(
  journal: Journal,
  day: string,
  patch: Partial<Pick<JournalEntry, 'reflection' | 'verse' | 'gratitude'>>,
  now: number,
): Journal {
  const base = journal[day] ?? blankEntry(day, now);
  const next: JournalEntry = { ...base, ...patch, updatedAt: now };
  if (entryIsEmpty(next)) {
    const { [day]: _drop, ...rest } = journal;
    return rest;
  }
  return { ...journal, [day]: next };
}

/** Append a note to a day's entry. */
export function addNote(journal: Journal, day: string, note: { ref?: string; text: string }, now: number): Journal {
  const base = journal[day] ?? blankEntry(day, now);
  const entry: JournalNote = {
    id: `jn_${now.toString(36)}_${Math.round(now % 100000).toString(36)}`,
    ref: note.ref?.trim() || undefined,
    text: note.text.trim(),
    createdAt: now,
  };
  return { ...journal, [day]: { ...base, notes: [...(base.notes ?? []), entry], updatedAt: now } };
}

/** Remove a note; if the day becomes empty it's dropped entirely. */
export function removeNote(journal: Journal, day: string, noteId: string, now: number): Journal {
  const base = journal[day];
  if (!base) return journal;
  const next: JournalEntry = { ...base, notes: (base.notes ?? []).filter((n) => n.id !== noteId), updatedAt: now };
  if (entryIsEmpty(next)) {
    const { [day]: _drop, ...rest } = journal;
    return rest;
  }
  return { ...journal, [day]: next };
}

/** All non-empty entries, most-recent day first. */
export function journalDays(journal: Journal): JournalEntry[] {
  return Object.values(journal)
    .filter((e) => !entryIsEmpty(e))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/**
 * Consecutive-day streak of journaling ending at today (or yesterday — so the
 * streak survives until end of the next day, matching the memory streak's grace).
 * A day counts if it has a non-empty entry.
 */
export function journalStreak(journal: Journal, todayKey: string = dayKey()): number {
  const days = new Set(journalDays(journal).map((e) => e.day));
  if (days.size === 0) return 0;
  // Anchor: today if present, else yesterday (grace), else no active streak.
  let anchor: string;
  if (days.has(todayKey)) anchor = todayKey;
  else {
    const yesterday = shiftDay(todayKey, -1);
    if (days.has(yesterday)) anchor = yesterday;
    else return 0;
  }
  let streak = 0;
  let cursor = anchor;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** Entries from earlier years/months that fall on the same month+day as today ("On this day"). */
export function onThisDay(journal: Journal, todayKey: string = dayKey()): JournalEntry[] {
  const md = todayKey.slice(5); // MM-DD
  return journalDays(journal).filter((e) => e.day !== todayKey && e.day.slice(5) === md);
}

/** Shift a YYYY-MM-DD key by whole days. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d).getTime();
  return dayKey(t + delta * 24 * 60 * 60 * 1000);
}

/** Human "3-day streak", "12 days with Him", etc. — small helper for the UI. */
export function streakLabel(n: number): string {
  if (n <= 0) return 'Start your streak today';
  if (n === 1) return '1 day with Him';
  return `${n} days with Him`;
}

/** True when a day key is exactly `daysBetweenKeys`-adjacent (used by tests/host). */
export function isConsecutive(a: string, b: string): boolean {
  return Math.abs(daysBetweenKeys(a, b)) === 1;
}
