/**
 * Pure reducers + derivations for Custom Study Topics (tag-as-you-read).
 * Kept UI-free and side-effect-free so they can be unit-tested; the store's
 * topic actions are thin wrappers over these.
 */
import type { Topic, TopicEntry } from '@/types';
import { normalizeKey } from '@/data/bibleApi';
import { parseReference } from '@/data/books';

/** Stable-ish local id for a topic. Uniqueness comes from the seed the caller
 * passes (Date.now()+random in the store); pure so tests can pass a fixed seed. */
export function genTopicId(seed: string): string {
  return 't_' + seed;
}

/** Sort order for a topic's verse list. */
export type TopicOrder = 'canonical' | 'added';

/** Does this topic already contain the given reference? */
export function topicHasRef(topic: Topic, ref: string): boolean {
  const key = normalizeKey(ref);
  return (topic.entries ?? []).some((e) => normalizeKey(e.ref) === key);
}

/**
 * Add a verse to a topic (deduped by normalized reference). If it's already
 * present, only the note is updated (when a non-empty note is supplied) — never
 * a duplicate row. Returns a new Topic (immutable); stamps `updatedAt`.
 */
export function addEntry(topic: Topic, ref: string, note: string | undefined, now: number): Topic {
  const key = normalizeKey(ref);
  const trimmedNote = note?.trim() || undefined;
  const entries = topic.entries ?? [];
  const exists = entries.some((e) => normalizeKey(e.ref) === key);
  if (exists) {
    if (!trimmedNote) return topic; // nothing to change
    return {
      ...topic,
      entries: entries.map((e) => (normalizeKey(e.ref) === key ? { ...e, note: trimmedNote } : e)),
      updatedAt: now,
    };
  }
  const entry: TopicEntry = { ref: ref.trim(), note: trimmedNote, addedAt: now };
  return { ...topic, entries: [entry, ...entries], updatedAt: now };
}

/** Remove a verse from a topic (by normalized reference). */
export function removeEntry(topic: Topic, ref: string, now: number): Topic {
  const key = normalizeKey(ref);
  const entries = (topic.entries ?? []).filter((e) => normalizeKey(e.ref) !== key);
  if (entries.length === (topic.entries ?? []).length) return topic;
  return { ...topic, entries, updatedAt: now };
}

/** Update just the "why this fits" note on an existing entry. */
export function updateEntryNote(topic: Topic, ref: string, note: string, now: number): Topic {
  const key = normalizeKey(ref);
  const trimmed = note.trim() || undefined;
  return {
    ...topic,
    entries: (topic.entries ?? []).map((e) => (normalizeKey(e.ref) === key ? { ...e, note: trimmed } : e)),
    updatedAt: now,
  };
}

/** Canonical sort key: [book, chapter, verse] so entries read in Bible order. */
function canonicalKey(ref: string): [number, number, number] {
  const p = parseReference(ref);
  if (!p) return [999, 999, 999]; // unparseable refs sink to the bottom
  return [p.bookNumber, p.chapter, p.verseStart];
}

/** Return a topic's entries in the requested order (non-mutating). */
export function sortedEntries(topic: Topic, order: TopicOrder): TopicEntry[] {
  const entries = [...(topic.entries ?? [])];
  if (order === 'added') {
    // Newest-added first (entries are stored newest-first, but sort defensively).
    return entries.sort((a, b) => b.addedAt - a.addedAt);
  }
  return entries.sort((a, b) => {
    const ka = canonicalKey(a.ref);
    const kb = canonicalKey(b.ref);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
}

/** Which topics (ids) currently contain a given reference. */
export function topicsForRef(topics: Record<string, Topic>, ref: string): string[] {
  const key = normalizeKey(ref);
  return Object.values(topics)
    .filter((t) => (t.entries ?? []).some((e) => normalizeKey(e.ref) === key))
    .map((t) => t.id);
}
