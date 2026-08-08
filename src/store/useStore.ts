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

/** Interval (days) at which a verse is considered memorized. */
const MEMORIZED_INTERVAL = 21;

interface StoreState {
  verses: Record<string, Verse>;
  stats: Stats;
  settings: Settings;
  hydrated: boolean;

  addFetchedVerse: (fetched: FetchedVerse, packId?: string) => Verse;
  removeVerse: (id: string) => void;
  hasVerse: (id: string) => boolean;

  /** Record a practice drill result (0..100 accuracy). Does not force a review. */
  practiceResult: (id: string, accuracy: number) => void;
  /** Grade a verse during a spaced-repetition review. */
  gradeReview: (id: string, rating: RecallRating) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setDailyGoal: (goal: number) => void;
  resetAll: () => void;
}

const defaultStats: Stats = {
  streak: 0,
  lastActiveDay: null,
  dailyGoal: 5,
  reviewsToday: 0,
  bestStreak: 0,
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

/** Update streak/reviewsToday for an activity happening at `now`. */
function touchActivity(stats: Stats, now: number): Stats {
  const today = dayKey(now);
  if (stats.lastActiveDay === today) {
    return { ...stats, reviewsToday: stats.reviewsToday + 1 };
  }
  const gap =
    stats.lastActiveDay == null
      ? Infinity
      : daysBetweenKeys(stats.lastActiveDay, today);
  const streak = gap === 1 ? stats.streak + 1 : 1;
  return {
    ...stats,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastActiveDay: today,
    reviewsToday: 1,
  };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      verses: {},
      stats: defaultStats,
      settings: defaultSettings,
      hydrated: false,

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
        set((state) => ({ verses: { ...state.verses, [id]: verse } }));
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
          let stats = state.stats;
          const now = Date.now();

          // A near-perfect recitation also advances the schedule like a review.
          if (accuracy >= 95) {
            srs = sm2Review(v.srs, 5, now);
            status = statusFromSrs(srs.interval, v.status);
            stats = touchActivity(state.stats, now);
          }

          const mastery = Math.max(
            blended,
            accuracy >= 95 ? masteryFromInterval(srs.interval) : 0,
          );
          return {
            verses: {
              ...state.verses,
              [id]: { ...v, srs, status, mastery: Math.min(100, mastery) },
            },
            stats,
          };
        }),

      gradeReview: (id, rating) =>
        set((state) => {
          const v = state.verses[id];
          if (!v) return {};
          const now = Date.now();
          const srs = sm2Review(v.srs, RATING_TO_QUALITY[rating], now);
          const status = statusFromSrs(srs.interval, v.status);
          const mastery =
            rating === 'again'
              ? Math.round(v.mastery * 0.5)
              : Math.max(v.mastery, masteryFromInterval(srs.interval));
          return {
            verses: {
              ...state.verses,
              [id]: { ...v, srs, status, mastery: Math.min(100, mastery) },
            },
            stats: touchActivity(state.stats, now),
          };
        }),

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

/** All verses as an array, newest first. */
export function useVerseList(): Verse[] {
  return useStore((state) =>
    Object.values(state.verses).sort((a, b) => b.dateAdded - a.dateAdded),
  );
}

export function useVerse(id: string | undefined): Verse | undefined {
  return useStore((state) => (id ? state.verses[id] : undefined));
}

export function memorizedCount(verses: Record<string, Verse>): number {
  return Object.values(verses).filter((v) => v.status === 'memorized').length;
}
