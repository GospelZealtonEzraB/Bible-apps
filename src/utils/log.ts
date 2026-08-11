/**
 * The daily log — the one record of a believer's walk.
 *
 * Everything the app can do (read a passage, save a verse, write a note, sing a
 * song, take notes on a message, gather verses under a topic) can be added to
 * the day's log with one tap. The log replaces the journal, the habit engine,
 * the shared devotional and the streak stack: it is simply *what you did with
 * God today*, kept by day, and visible to your covenant partner unless you mark
 * an entry private.
 *
 * Pure — no store, no React, no dates beyond what's passed in.
 */
import type { LogEntry, LogKind, Log } from '@/types';

let __seq = 0;

/** A unique-ish log id. Not crypto; stable within a device. */
export function newLogId(now = Date.now()): string {
  __seq = (__seq + 1) % 1_000_000;
  return `l_${now.toString(36)}${__seq.toString(36)}`;
}

/**
 * What makes two entries "the same thing on the same day" — so logging a verse
 * twice doesn't stack up duplicates. Free-text lines are never deduped.
 */
function identity(e: Pick<LogEntry, 'kind' | 'ref' | 'assetId'>): string | null {
  const key = e.assetId ?? e.ref;
  return key ? `${e.kind}:${key.trim().toLowerCase()}` : null;
}

/** True when this asset is already in the given day's log. */
export function isLogged(log: Log, day: string, kind: LogKind, key: string | undefined): boolean {
  if (!key) return false;
  const want = identity({ kind, assetId: key });
  return Object.values(log).some(
    (e) => e.day === day && identity({ kind: e.kind, ref: e.ref, assetId: e.assetId }) === want,
  );
}

/**
 * Add an entry. Re-adding the same asset on the same day is a no-op (the log
 * returns unchanged), so the "＋ Add to my log" button is safely idempotent.
 */
export function addEntry(log: Log, entry: Omit<LogEntry, 'id' | 'createdAt'> & Partial<Pick<LogEntry, 'id' | 'createdAt'>>): Log {
  const id = entry.id ?? newLogId();
  const createdAt = entry.createdAt ?? Date.now();
  const ident = identity(entry);
  if (ident) {
    const dup = Object.values(log).find(
      (e) => e.day === entry.day && identity({ kind: e.kind, ref: e.ref, assetId: e.assetId }) === ident,
    );
    if (dup) return log;
  }
  return { ...log, [id]: { ...entry, id, createdAt } as LogEntry };
}

export function removeEntry(log: Log, id: string): Log {
  if (!log[id]) return log;
  const next = { ...log };
  delete next[id];
  return next;
}

/** Mark an entry private (hidden from your partner) or public again. */
export function setEntryPrivate(log: Log, id: string, isPrivate: boolean): Log {
  const e = log[id];
  if (!e) return log;
  return { ...log, [id]: { ...e, private: isPrivate } };
}

/** Edit the free-text note on an entry (used by the "＋ a line" composer). */
export function setEntryText(log: Log, id: string, text: string): Log {
  const e = log[id];
  if (!e) return log;
  return { ...log, [id]: { ...e, text } };
}

/** One day's entries, oldest first — the order they happened. */
export function entriesForDay(log: Log, day: string): LogEntry[] {
  return Object.values(log)
    .filter((e) => e.day === day)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Every day that has at least one entry, newest day first. */
export function logDays(log: Log): string[] {
  return Array.from(new Set(Object.values(log).map((e) => e.day))).sort((a, b) => b.localeCompare(a));
}

/** The entries a partner may see — private ones never leave the device. */
export function publicEntriesForDay(log: Log, day: string): LogEntry[] {
  return entriesForDay(log, day).filter((e) => !e.private);
}

/** Count per kind for a day — used for the compact "today" line. */
export function daySummary(log: Log, day: string): Record<LogKind, number> {
  const out = {} as Record<LogKind, number>;
  for (const e of entriesForDay(log, day)) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}
