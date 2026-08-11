import { normalizeKey } from '@/data/bibleApi';
import type { Verse, CircleMember } from '@/types';

/**
 * Which references from a circle's shared list this device has *memorized*.
 * Matching is by normalized reference, so it works across translations
 * (e.g. an English and a Tamil "John 3:16" both count).
 */
export function versesDoneFrom(
  verses: Record<string, Verse>,
  sharedRefs: string[],
): string[] {
  const memorized = new Set(
    Object.values(verses)
      .filter((v) => v.status === 'memorized')
      .map((v) => normalizeKey(v.reference)),
  );
  return sharedRefs.filter((ref) => memorized.has(normalizeKey(ref)));
}

/** Deduped display references this device has memorized (translation-agnostic). */
export function memorizedReferences(verses: Record<string, Verse>): string[] {
  return dedupeRefs(Object.values(verses).filter((v) => v.status === 'memorized').map((v) => v.reference));
}

/** Deduped display references currently in progress (learning/reviewing). */
export function learningReferences(verses: Record<string, Verse>): string[] {
  return dedupeRefs(
    Object.values(verses)
      .filter((v) => v.status === 'learning' || v.status === 'reviewing')
      .map((v) => v.reference),
  );
}

function dedupeRefs(refs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of refs) {
    const k = normalizeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

// ---- Circle-wide shared progress ------------------------------------------

export interface RefEntry {
  key: string;
  display: string;
}

/** Every unique reference memorized by anyone in the circle. */
export function unionMemorized(members: CircleMember[]): RefEntry[] {
  const map = new Map<string, string>();
  for (const m of members) {
    for (const r of m.memorizedRefs ?? []) {
      const k = normalizeKey(r);
      if (!map.has(k)) map.set(k, r);
    }
  }
  return [...map.entries()].map(([key, display]) => ({ key, display }));
}

/** References memorized by *every* member (the "we all know these" set). */
export function commonMemorized(members: CircleMember[]): RefEntry[] {
  if (members.length === 0) return [];
  const sets = members.map((m) => new Set((m.memorizedRefs ?? []).map(normalizeKey)));
  const [first, ...rest] = sets;
  if (!first) return [];
  const commonKeys = [...first].filter((k) => rest.every((s) => s.has(k)));
  const displayOf = (k: string): string => {
    for (const m of members) for (const r of m.memorizedRefs ?? []) if (normalizeKey(r) === k) return r;
    return k;
  };
  return commonKeys.map((k) => ({ key: k, display: displayOf(k) }));
}

export interface Presence {
  /** memberIds active on `todayKey`. */
  activeIds: string[];
  total: number;
}

/** Who has "had their time" today — members whose last active day is today. */
export function presenceToday(members: CircleMember[], todayKey: string): Presence {
  return {
    activeIds: members.filter((m) => m.lastActiveDay === todayKey).map((m) => m.id),
    total: members.length,
  };
}

/**
 * "Learn from them": references a partner has memorized that you don't have in
 * your library yet — turns visible progress into a growth path. `myKeys` is the
 * set of normalized references already in your library (any status).
 */
export function learnFromThem(memberMemorizedRefs: string[], myKeys: Set<string>): string[] {
  return dedupeRefs(memberMemorizedRefs ?? []).filter((r) => !myKeys.has(normalizeKey(r)));
}

