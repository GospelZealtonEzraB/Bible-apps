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

export interface CoverageRow extends RefEntry {
  byMemberIds: string[];
}

/** Who-knows-what: each memorized reference with the members who know it,
 * sorted by how many know it (everyone first), then alphabetically. */
export function coverage(members: CircleMember[]): CoverageRow[] {
  const map = new Map<string, CoverageRow>();
  for (const m of members) {
    for (const r of m.memorizedRefs ?? []) {
      const k = normalizeKey(r);
      const row = map.get(k) ?? { key: k, display: r, byMemberIds: [] };
      if (!row.byMemberIds.includes(m.id)) row.byMemberIds.push(m.id);
      map.set(k, row);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.byMemberIds.length - a.byMemberIds.length || a.display.localeCompare(b.display),
  );
}

export interface TogetherTotals {
  combinedUnique: number;
  common: number;
  perMember: { id: string; name: string; memorized: number }[];
}

export function togetherTotals(members: CircleMember[]): TogetherTotals {
  return {
    combinedUnique: unionMemorized(members).length,
    common: commonMemorized(members).length,
    perMember: members.map((m) => ({
      id: m.id,
      name: m.displayName,
      memorized: m.memorizedRefs && m.memorizedRefs.length ? m.memorizedRefs.length : m.memorizedCount,
    })),
  };
}

/** Rank circle members for the leaderboard: memorized, then streak, then xp. */
export function rankMembers(members: CircleMember[]): CircleMember[] {
  return [...members].sort(
    (a, b) =>
      (b.memorizedCount ?? 0) - (a.memorizedCount ?? 0) ||
      (b.streak ?? 0) - (a.streak ?? 0) ||
      (b.xp ?? 0) - (a.xp ?? 0) ||
      (a.displayName ?? '').localeCompare(b.displayName ?? ''),
  );
}

export interface FeedItem {
  memberId: string;
  name: string;
  type: string;
  ref?: string;
  at: number;
}

/** Merge every member's recent-activity buffers into one sorted feed. */
export function mergeActivity(members: CircleMember[], limit = 20): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of members) {
    for (const a of m.recentActivity ?? []) {
      items.push({ memberId: m.id, name: m.displayName, type: a.type, ref: a.ref, at: a.at });
    }
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

// ---- Presence & weekly recap (the "alive" layer) --------------------------

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

export interface WeeklyRecap {
  memorized: number;
  reviewed: number;
  studied: number;
  /** Distinct members with any activity in the window. */
  activeMembers: number;
  /** Member (name) with the most `memorized` events this week, if any. */
  topMemberName?: string;
  /** True when no activity fell in the window (hide the card). */
  empty: boolean;
}

/**
 * A "how we grew together this week" summary from members' recent-activity
 * buffers within the last 7 days. Approximate — buffers are capped per member —
 * so it's framed as recent highlights, not an audit.
 */
export function weeklyRecap(members: CircleMember[], now: number): WeeklyRecap {
  const since = now - 7 * 24 * 60 * 60 * 1000;
  let memorized = 0;
  let reviewed = 0;
  let studied = 0;
  const activeIds = new Set<string>();
  const memorizedByMember = new Map<string, { name: string; count: number }>();

  for (const m of members) {
    for (const a of m.recentActivity ?? []) {
      if (a.at < since) continue;
      activeIds.add(m.id);
      if (a.type === 'memorized') {
        memorized++;
        const cur = memorizedByMember.get(m.id) ?? { name: m.displayName, count: 0 };
        cur.count++;
        memorizedByMember.set(m.id, cur);
      } else if (a.type === 'reviewed') {
        reviewed++;
      } else if (a.type === 'studied') {
        studied++;
      }
    }
  }

  let topMemberName: string | undefined;
  let topCount = 0;
  for (const { name, count } of memorizedByMember.values()) {
    if (count > topCount) { topCount = count; topMemberName = name; }
  }

  return {
    memorized,
    reviewed,
    studied,
    activeMembers: activeIds.size,
    topMemberName,
    empty: memorized + reviewed + studied === 0,
  };
}
