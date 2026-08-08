import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Settings, Stats, Verse, VerseStatus } from '@/types';
import { initialSRS, review as sm2Review, RATING_TO_QUALITY } from '@/srs/sm2';
import type { RecallRating } from '@/srs/sm2';
import {
  displayReference,
  translationName,
  verseId,
  type FetchedVerse,
} from '@/data/bibleApi';
import { dayKey, daysBetweenKeys } from '@/utils/date';
import {
  xpForPractice,
  xpForReview,
  newlyEarnedBadges,
  type BadgeContext,
} from '@/gamification';

/** Interval (days) at which a verse is considered memorized. */
const MEMORIZED_INTERVAL = 21;

interface StoreState {
  verses: Record<string, Verse>;
  stats: Stats;
  settings: Settings;
  hydrated: boolean;
  /** Id of a badge just earned, for the celebration overlay (transient). */
  recentBadgeId: string | null;
  /** XP just awarded, for inline feedback (transient). */
  recentXp: number | null;

  addFetchedVerse: (fetched: FetchedVerse, packId?: string) => Verse;
  removeVerse: (id: string) => void;
  hasVerse: (id: string) => boolean;

  /** Record a practice drill result (0..100 accuracy). Does not force a review. */
  practiceResult: (id: string, accuracy: number) => void;
  /** Grade a verse during a spaced-repetition review. */
  gradeReview: (id: string, rating: RecallRating) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setDailyGoal: (goal: number) => void;
  clearCelebration: () => void;
  resetAll: () => void;
}

const defaultStats: Stats = {
  streak: 0,
  lastActiveDay: null,
  dailyGoal: 5,
  reviewsToday: 0,
  bestStreak: 0,
  xp: 0,
  graceTokens: 1,
  earnedBadges: [],
  perfectRecitations: 0,
  earlyReviews: 0,
};

const defaultSettings: Settings = {
  translation: 'web',
  reminderTime: null,
  theme: 'system',
};

function statusFromSrs(
  interval: number,
  previous: VerseStatus,
): VerseStatus {
  if (interval >= MEMORIZED_INTERVAL) return 'memorized';
  if (previous === 'memorized') return 'reviewing';
  return 'learning';
}

function masteryFromInterval(interval: number): number {
  return Math.max(0, Math.min(100, Math.round((interval / MEMORIZED_INTERVAL) * 100)));
}

/**
 * Update streak/reviewsToday for an activity happening at `now`, spending
 * "grace" tokens to protect the streak across missed days, and refilling one
 * token at each 7-day milestone (capped at 3).
 */
function touchActivity(stats: Stats, now: number): Stats {
  const today = dayKey(now);
  if (stats.lastActiveDay === today) {
    return { ...stats, reviewsToday: stats.reviewsToday + 1 };
  }
  const gap =
    stats.lastActiveDay == null
      ? Infinity
      : daysBetweenKeys(stats.lastActiveDay, today);

  let streak: number;
  let graceTokens = stats.graceTokens;
  if (gap === 1) {
    streak = stats.streak + 1;
  } else if (gap !== Infinity && gap > 1) {
    const missed = gap - 1;
    if (graceTokens >= missed) {
      graceTokens -= missed; // grace covered the gap — streak survives
      streak = stats.streak + 1;
    } else {
      streak = 1;
    }
  } else {
    streak = 1; // first ever activity
  }

  if (streak > 0 && streak % 7 === 0) {
    graceTokens = Math.min(3, graceTokens + 1);
  }

  return {
    ...stats,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastActiveDay: today,
    reviewsToday: 1,
    graceTokens,
  };
}

interface ProgressResult {
  stats: Stats;
  recentBadgeId: string | null;
  recentXp: number | null;
}

/**
 * Apply XP, activity, and badge evaluation in one step. `versesOverride` lets
 * callers pass the post-update verse map so badge checks see fresh statuses.
 */
function withProgress(
  state: { stats: Stats; verses: Record<string, Verse> },
  opts: {
    xpDelta: number;
    touch: boolean;
    perfect?: boolean;
    now: number;
    versesOverride?: Record<string, Verse>;
  },
): ProgressResult {
  let stats = opts.touch ? touchActivity(state.stats, opts.now) : state.stats;
  const early = opts.touch && new Date(opts.now).getHours() < 7 ? 1 : 0;
  stats = {
    ...stats,
    xp: stats.xp + opts.xpDelta,
    perfectRecitations: stats.perfectRecitations + (opts.perfect ? 1 : 0),
    earlyReviews: stats.earlyReviews + early,
  };

  const verses = opts.versesOverride ?? state.verses;
  const ctx: BadgeContext = {
    memorizedCount: memorizedCount(verses),
    verseCount: Object.keys(verses).length,
    bestStreak: stats.bestStreak,
    perfectRecitations: stats.perfectRecitations,
    earlyReviews: stats.earlyReviews,
  };
  const newBadges = newlyEarnedBadges(ctx, stats.earnedBadges);
  if (newBadges.length) {
    stats = { ...stats, earnedBadges: [...stats.earnedBadges, ...newBadges] };
  }
  return { stats, recentBadgeId: newBadges[0] ?? null, recentXp: opts.xpDelta };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      verses: {},
      stats: defaultStats,
      settings: defaultSettings,
      hydrated: false,
      recentBadgeId: null,
      recentXp: null,

      hasVerse: (id) => !!get().verses[id],

      addFetchedVerse: (fetched, packId) => {
        const id = verseId(fetched.reference, fetched.translation);
        const existing = get().verses[id];
        if (existing) return existing;
        const now = Date.now();
        const verse: Verse = {
          id,
          reference: displayReference(fetched.reference),
          text: fetched.text,
          translation: fetched.translation,
          translationName:
            fetched.translationName ?? translationName(fetched.translation),
          dateAdded: now,
          status: 'new',
          packId,
          srs: initialSRS(now),
          mastery: 0,
        };
        set((state) => {
          const verses = { ...state.verses, [id]: verse };
          const ctx: BadgeContext = {
            memorizedCount: memorizedCount(verses),
            verseCount: Object.keys(verses).length,
            bestStreak: state.stats.bestStreak,
            perfectRecitations: state.stats.perfectRecitations,
            earlyReviews: state.stats.earlyReviews,
          };
          const newBadges = newlyEarnedBadges(ctx, state.stats.earnedBadges);
          const stats = newBadges.length
            ? { ...state.stats, earnedBadges: [...state.stats.earnedBadges, ...newBadges] }
            : state.stats;
          return {
            verses,
            stats,
            recentBadgeId: newBadges[0] ?? state.recentBadgeId,
          };
        });
        return verse;
      },

      removeVerse: (id) =>
        set((state) => {
          const next = { ...state.verses };
          delete next[id];
          return { verses: next };
        }),

      practiceResult: (id, accuracy) =>
        set((state) => {
          const v = state.verses[id];
          if (!v) return {};
          const blended = Math.round(v.mastery * 0.4 + accuracy * 0.6);
          let srs = v.srs;
          let status: VerseStatus = v.status === 'new' ? 'learning' : v.status;
          const now = Date.now();

          // A near-perfect recitation also advances the schedule like a review.
          if (accuracy >= 95) {
            srs = sm2Review(v.srs, 5, now);
            status = statusFromSrs(srs.interval, v.status);
          }

          const mastery = Math.min(
            100,
            Math.max(blended, accuracy >= 95 ? masteryFromInterval(srs.interval) : 0),
          );
          const verses = { ...state.verses, [id]: { ...v, srs, status, mastery } };
          const progress = withProgress(state, {
            xpDelta: xpForPractice(accuracy),
            touch: accuracy >= 95,
            perfect: accuracy >= 100,
            now,
            versesOverride: verses,
          });
          return { verses, ...progress };
        }),

      gradeReview: (id, rating) =>
        set((state) => {
          const v = state.verses[id];
          if (!v) return {};
          const now = Date.now();
          const srs = sm2Review(v.srs, RATING_TO_QUALITY[rating], now);
          const status = statusFromSrs(srs.interval, v.status);
          const mastery = Math.min(
            100,
            rating === 'again'
              ? Math.round(v.mastery * 0.5)
              : Math.max(v.mastery, masteryFromInterval(srs.interval)),
          );
          const verses = { ...state.verses, [id]: { ...v, srs, status, mastery } };
          const progress = withProgress(state, {
            xpDelta: xpForReview(rating),
            touch: true,
            now,
            versesOverride: verses,
          });
          return { verses, ...progress };
        }),

      clearCelebration: () => set({ recentBadgeId: null, recentXp: null }),

      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      setDailyGoal: (goal) =>
        set((state) => ({
          stats: { ...state.stats, dailyGoal: Math.max(1, Math.min(50, Math.round(goal))) },
        })),

      resetAll: () =>
        set({
          verses: {},
          stats: defaultStats,
          settings: defaultSettings,
        }),
    }),
    {
      name: 'engraved-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        verses: state.verses,
        stats: state.stats,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

// ---- Selector hooks -------------------------------------------------------

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useStore((state) => selector(state.settings));
}

export function useStats(): Stats {
  return useStore((state) => state.stats);
}

/**
 * All verses as an array, newest first. Selects the stable `verses` record and
 * derives the sorted array with useMemo — returning a fresh array straight from
 * the selector would change the snapshot every render and loop forever.
 */
export function useVerseList(): Verse[] {
  const verses = useStore((state) => state.verses);
  return useMemo(
    () => Object.values(verses).sort((a, b) => b.dateAdded - a.dateAdded),
    [verses],
  );
}

export function useVerse(id: string | undefined): Verse | undefined {
  return useStore((state) => (id ? state.verses[id] : undefined));
}

export function memorizedCount(verses: Record<string, Verse>): number {
  return Object.values(verses).filter((v) => v.status === 'memorized').length;
}

export function useMemorizedCount(): number {
  const verses = useStore((state) => state.verses);
  return useMemo(() => memorizedCount(verses), [verses]);
}

export function useRecentBadgeId(): string | null {
  return useStore((state) => state.recentBadgeId);
}
