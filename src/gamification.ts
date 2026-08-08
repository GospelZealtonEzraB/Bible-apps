/**
 * Pure gamification helpers: XP/levels, per-verse mastery tiers, and badge
 * evaluation. No React / React Native imports so this can be unit-tested.
 */

export const XP_PER_LEVEL = 100;

export interface LevelInfo {
  level: number;
  /** XP accumulated within the current level (0..XP_PER_LEVEL). */
  inLevel: number;
  /** XP needed to fill the current level. */
  perLevel: number;
  /** 0..100 progress toward the next level. */
  progress: number;
}

/** Level 1 starts at 0 XP; each level takes XP_PER_LEVEL more. */
export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const inLevel = safe % XP_PER_LEVEL;
  return {
    level,
    inLevel,
    perLevel: XP_PER_LEVEL,
    progress: Math.round((inLevel / XP_PER_LEVEL) * 100),
  };
}

/** XP awarded for a practice drill result (0..100 accuracy). */
export function xpForPractice(accuracy: number): number {
  const a = Math.max(0, Math.min(100, accuracy));
  // 5 base + up to 10 for accuracy, with a bonus for a perfect pass.
  return 5 + Math.round((a / 100) * 10) + (a >= 100 ? 5 : 0);
}

/** XP awarded for a spaced-repetition review, by recall rating. */
export function xpForReview(rating: 'again' | 'hard' | 'good' | 'easy'): number {
  switch (rating) {
    case 'again':
      return 3;
    case 'hard':
      return 8;
    case 'good':
      return 12;
    case 'easy':
      return 15;
  }
}

export type MasteryTierKey = 'seed' | 'bronze' | 'silver' | 'gold';

export interface MasteryTier {
  key: MasteryTierKey;
  label: string;
  emoji: string;
}

const TIERS: { min: number; tier: MasteryTier }[] = [
  { min: 90, tier: { key: 'gold', label: 'Gold', emoji: '🥇' } },
  { min: 60, tier: { key: 'silver', label: 'Silver', emoji: '🥈' } },
  { min: 25, tier: { key: 'bronze', label: 'Bronze', emoji: '🥉' } },
  { min: 0, tier: { key: 'seed', label: 'Seedling', emoji: '🌱' } },
];

/** Map a 0..100 mastery score to a display tier. */
export function masteryTier(mastery: number): MasteryTier {
  const m = Math.max(0, Math.min(100, mastery));
  return TIERS.find((t) => m >= t.min)!.tier;
}

// ---- Badges ---------------------------------------------------------------

export interface BadgeContext {
  memorizedCount: number;
  verseCount: number;
  bestStreak: number;
  perfectRecitations: number;
  earlyReviews: number;
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  check: (c: BadgeContext) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: 'first-seed',
    emoji: '🌱',
    name: 'First Seed',
    description: 'Memorize your first verse.',
    check: (c) => c.memorizedCount >= 1,
  },
  {
    id: 'kindling',
    emoji: '🔥',
    name: 'Kindling',
    description: 'Reach a 7-day streak.',
    check: (c) => c.bestStreak >= 7,
  },
  {
    id: 'word-perfect',
    emoji: '⌨️',
    name: 'Word-Perfect',
    description: 'Recite a verse at 100%.',
    check: (c) => c.perfectRecitations >= 1,
  },
  {
    id: 'early-light',
    emoji: '🌅',
    name: 'Early Light',
    description: 'Review before 7am five times.',
    check: (c) => c.earlyReviews >= 5,
  },
  {
    id: 'faithful',
    emoji: '📖',
    name: 'Faithful',
    description: 'Save 15 verses to your library.',
    check: (c) => c.verseCount >= 15,
  },
  {
    id: 'scholar',
    emoji: '📚',
    name: 'Scholar',
    description: 'Memorize 10 verses.',
    check: (c) => c.memorizedCount >= 10,
  },
];

export function badgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Return badge ids newly satisfied by `ctx` that aren't already in `earned`. */
export function newlyEarnedBadges(ctx: BadgeContext, earned: string[]): string[] {
  const have = new Set(earned);
  return BADGES.filter((b) => !have.has(b.id) && b.check(ctx)).map((b) => b.id);
}
