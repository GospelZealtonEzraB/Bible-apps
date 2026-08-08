import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Activity,
  ChallengeKind,
  Circle,
  CircleGoal,
  CircleSnapshot,
  LocalNote,
  NoteScope,
  Profile,
  Settings,
  Stats,
  StudyApplication,
  StudySession,
  Verse,
  VerseStatus,
} from '@/types';
import { newMemberId, isValidMemberId } from '@/utils/identity';
import { getExpoPushToken } from '@/notifications';
import * as circleApi from '@/data/circleClient';
import type { MemberSnapshotInput } from '@/data/circleClient';
import { initialSRS, review as sm2Review, RATING_TO_QUALITY } from '@/srs/sm2';
import type { RecallRating } from '@/srs/sm2';
import {
  displayReference,
  translationName,
  verseId,
  type FetchedVerse,
} from '@/data/bibleApi';
import { versesDoneFrom, memorizedReferences, learningReferences } from '@/utils/circleProgress';
import { dayKey, daysBetweenKeys } from '@/utils/date';
import {
  xpForPractice,
  xpForReview,
  newlyEarnedBadges,
  type BadgeContext,
} from '@/gamification';
import { allQuestsDone, QUEST_BONUS_XP } from '@/quests';
import type { DailyProgress } from '@/types';

/** Interval (days) at which a verse is considered memorized. */
const MEMORIZED_INTERVAL = 21;

interface StoreState {
  verses: Record<string, Verse>;
  stats: Stats;
  settings: Settings;
  profile: Profile;
  /** Growing Together circles, cached by invite code. */
  circles: Record<string, Circle>;
  /** Cached AI study briefs, keyed by normalized passage. */
  studySessions: Record<string, StudySession>;
  /** "One thing I'll live out" applications, keyed by passage. */
  applications: Record<string, StudyApplication>;
  /** Private notes kept only on this device. */
  notes: Record<string, LocalNote>;
  /** Session memory for the welcome-back recap. */
  session: { lastOpenedDay: string | null };
  /** Rolling log of recent activity, shared to circles for the feed. */
  activityLog: Activity[];
  /** Expo push token for partner-activity notifications (null until registered). */
  pushToken: string | null;
  hydrated: boolean;
  /** Id of a badge just earned, for the celebration overlay (transient). */
  recentBadgeId: string | null;
  /** XP just awarded, for inline feedback (transient). */
  recentXp: number | null;
  /** True right after finishing all daily quests, for a celebration (transient). */
  recentQuestComplete: boolean;

  addFetchedVerse: (fetched: FetchedVerse, packId?: string) => Verse;
  removeVerse: (id: string) => void;
  hasVerse: (id: string) => boolean;

  /** Record a practice drill result (0..100 accuracy). Does not force a review. */
  practiceResult: (id: string, accuracy: number) => void;
  /** Grade a verse during a spaced-repetition review. */
  gradeReview: (id: string, rating: RecallRating) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setDailyGoal: (goal: number) => void;

  /** Ensure a stable memberId exists (minted once). Idempotent. */
  ensureProfile: () => void;
  /** Set the display name shown to circle partners. */
  setDisplayName: (name: string) => void;
  /** Adopt a transfer code from another device; returns false if malformed. */
  restoreFromBackup: (code: string) => boolean;

  /** Create a new circle; resolves to the new invite code. */
  createCircle: (name?: string) => Promise<string>;
  /** Join an existing circle by code. */
  joinCircle: (code: string) => Promise<void>;
  /** Pull the latest snapshot for a circle (read-only). */
  refreshCircle: (code: string) => Promise<void>;
  /** Push my progress + pull the board for a circle. */
  syncCircle: (code: string) => Promise<void>;
  /** Add a verse reference to a circle's shared list (optionally "for" a member). */
  addSharedVerse: (code: string, reference: string, forMemberId?: string) => Promise<void>;
  /** Set the circle's shared goal (or clear it with null). */
  setCircleGoal: (code: string, goal: CircleGoal | null) => Promise<void>;
  /** Assign a memorization/study challenge to a partner. */
  assignChallenge: (code: string, toMemberId: string, toName: string, reference: string, kind: ChallengeKind) => Promise<void>;
  /** Submit my attempt at a challenge (text + optional accuracy). */
  submitChallenge: (code: string, chalId: string, text: string, accuracy?: number) => Promise<void>;
  /** Review a partner's submission with an encouraging note. */
  reviewChallenge: (code: string, chalId: string, note: string, meaningPrompt?: string) => Promise<void>;

  /** Cache a fetched study brief. */
  setStudySession: (session: StudySession) => void;
  /** Capture "one thing I'll live out this week" for a studied passage. */
  addApplication: (passageKey: string, passage: string, text: string) => void;
  /** Mark an application revisited, optionally recording how it went. */
  revisitApplication: (passageKey: string, outcome?: string) => void;

  // Growing Together — plans, notes, prayer, cheers
  createCirclePlan: (code: string, title: string, items: string[]) => Promise<void>;
  shareNote: (code: string, text: string, scope?: NoteScope, ref?: string) => Promise<void>;
  deleteSharedNote: (code: string, noteId: string) => Promise<void>;
  addPrivateNote: (scope: NoteScope, text: string, ref?: string) => void;
  deletePrivateNote: (noteId: string) => void;
  addPrayer: (code: string, text: string) => Promise<void>;
  prayForRequest: (code: string, prayerId: string) => Promise<void>;
  answerPrayer: (code: string, prayerId: string, answerNote?: string) => Promise<void>;
  cheerMember: (code: string, toMemberId: string) => Promise<void>;
  /** Record that the app was opened today (for the welcome-back recap). */
  markOpened: () => void;
  /** Register this device for partner-activity push notifications (real builds only). */
  registerPush: () => Promise<void>;
  /** Leave a circle (removes my member record + local cache). */
  leaveCircle: (code: string) => Promise<void>;
  /** Set the partnership covenant (agreed rhythm + goal). */
  setCircleCovenant: (code: string, cadenceLabel: string, goalText: string) => Promise<void>;
  /** Cache AI-generated content (memory hook / explanation) on a verse. */
  setVerseAi: (id: string, patch: { memoryHook?: string; explanation?: string }) => void;
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
  daily: { day: '', reviews: 0, drills: 0, perfect: 0, added: 0, questBonusClaimed: false },
};

/** Today's quest counters, resetting to zero when the stored day isn't today. */
export function todaysDaily(stats: Stats, now: number = Date.now()): DailyProgress {
  const today = dayKey(now);
  if (stats.daily && stats.daily.day === today) return stats.daily;
  return { day: today, reviews: 0, drills: 0, perfect: 0, added: 0, questBonusClaimed: false };
}

interface DailyResult {
  daily: DailyProgress;
  xpBonus: number;
  questJustCompleted: boolean;
}

/** Apply per-metric increments to today's quest counters, awarding the bonus
 * once when every quest is complete. */
function advanceDaily(
  stats: Stats,
  now: number,
  inc: Partial<Pick<DailyProgress, 'reviews' | 'drills' | 'perfect' | 'added'>>,
): DailyResult {
  const base = todaysDaily(stats, now);
  let daily: DailyProgress = {
    ...base,
    reviews: base.reviews + (inc.reviews ?? 0),
    drills: base.drills + (inc.drills ?? 0),
    perfect: base.perfect + (inc.perfect ?? 0),
    added: base.added + (inc.added ?? 0),
  };
  let xpBonus = 0;
  let questJustCompleted = false;
  if (!daily.questBonusClaimed && allQuestsDone(daily)) {
    daily = { ...daily, questBonusClaimed: true };
    xpBonus = QUEST_BONUS_XP;
    questJustCompleted = true;
  }
  return { daily, xpBonus, questJustCompleted };
}

const defaultSettings: Settings = {
  translation: 'web',
  reminderTime: null,
  theme: 'system',
  serverUrl: null,
  shareLibrary: true,
};

/** Append an event to a rolling activity log, keeping the most recent `cap`. */
function pushActivity(log: Activity[], evt: Activity, cap = 15): Activity[] {
  return [...(log ?? []), evt].slice(-cap);
}

const defaultProfile: Profile = { memberId: '', displayName: '', backupCode: '' };

/** Build the progress snapshot this device pushes up to a circle. */
function myMemberSnapshot(
  state: StoreState,
  sharedRefs: string[] = [],
  planRefs: string[] = [],
): MemberSnapshotInput {
  const share = state.settings.shareLibrary;
  return {
    memberId: state.profile.memberId,
    displayName: state.profile.displayName,
    memorizedCount: memorizedCount(state.verses),
    streak: state.stats.streak,
    versesDone: versesDoneFrom(state.verses, sharedRefs),
    planDone: versesDoneFrom(state.verses, planRefs),
    memorizedRefs: share ? memorizedReferences(state.verses).slice(0, 400) : [],
    learningRefs: share ? learningReferences(state.verses).slice(0, 200) : [],
    bestStreak: state.stats.bestStreak,
    xp: state.stats.xp,
    recentActivity: (state.activityLog ?? []).slice(-10),
    lastActiveDay: state.stats.lastActiveDay,
    lastActivity: (state.activityLog ?? []).slice(-1)[0] ?? null,
    pushToken: state.pushToken,
  };
}

/** Cache a fresh snapshot, preserving the local joinedAt and stamping lastSyncedAt. */
function withSnapshot(
  circles: Record<string, Circle>,
  snap: CircleSnapshot,
): Record<string, Circle> {
  const existing = circles[snap.meta.code];
  const now = Date.now();
  return {
    ...circles,
    [snap.meta.code]: { ...snap, joinedAt: existing?.joinedAt ?? now, lastSyncedAt: now },
  };
}

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
      profile: defaultProfile,
      circles: {},
      studySessions: {},
      applications: {},
      notes: {},
      session: { lastOpenedDay: null },
      activityLog: [],
      pushToken: null,
      hydrated: false,
      recentBadgeId: null,
      recentXp: null,
      recentQuestComplete: false,

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
          const withBadges = newBadges.length
            ? { ...state.stats, earnedBadges: [...state.stats.earnedBadges, ...newBadges] }
            : state.stats;
          const d = advanceDaily(withBadges, now, { added: 1 });
          return {
            verses,
            stats: { ...withBadges, daily: d.daily, xp: withBadges.xp + d.xpBonus },
            recentBadgeId: newBadges[0] ?? state.recentBadgeId,
            recentQuestComplete: d.questJustCompleted,
            activityLog: pushActivity(state.activityLog, { type: 'added', ref: verse.reference, at: now }),
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
          const becameMemorized = v.status !== 'memorized' && status === 'memorized';
          const verses = { ...state.verses, [id]: { ...v, srs, status, mastery } };
          const progress = withProgress(state, {
            xpDelta: xpForPractice(accuracy),
            touch: accuracy >= 95,
            perfect: accuracy >= 100,
            now,
            versesOverride: verses,
          });
          const d = advanceDaily(progress.stats, now, {
            drills: 1,
            perfect: accuracy >= 90 ? 1 : 0,
          });
          return {
            verses,
            recentBadgeId: progress.recentBadgeId,
            recentXp: (progress.recentXp ?? 0) + d.xpBonus,
            recentQuestComplete: d.questJustCompleted,
            stats: { ...progress.stats, daily: d.daily, xp: progress.stats.xp + d.xpBonus },
            activityLog: becameMemorized
              ? pushActivity(state.activityLog, { type: 'memorized', ref: v.reference, at: now })
              : state.activityLog,
          };
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
          const becameMemorized = v.status !== 'memorized' && status === 'memorized';
          const verses = { ...state.verses, [id]: { ...v, srs, status, mastery } };
          const progress = withProgress(state, {
            xpDelta: xpForReview(rating),
            touch: true,
            now,
            versesOverride: verses,
          });
          const d = advanceDaily(progress.stats, now, { reviews: 1 });
          return {
            verses,
            recentBadgeId: progress.recentBadgeId,
            recentXp: (progress.recentXp ?? 0) + d.xpBonus,
            recentQuestComplete: d.questJustCompleted,
            stats: { ...progress.stats, daily: d.daily, xp: progress.stats.xp + d.xpBonus },
            activityLog: pushActivity(
              state.activityLog,
              becameMemorized
                ? { type: 'memorized', ref: v.reference, at: now }
                : { type: 'reviewed', ref: v.reference, at: now },
            ),
          };
        }),

      clearCelebration: () =>
        set({ recentBadgeId: null, recentXp: null, recentQuestComplete: false }),

      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      setDailyGoal: (goal) =>
        set((state) => ({
          stats: { ...state.stats, dailyGoal: Math.max(1, Math.min(50, Math.round(goal))) },
        })),

      ensureProfile: () =>
        set((state) => {
          if (state.profile.memberId) return {};
          const id = newMemberId();
          return { profile: { ...state.profile, memberId: id, backupCode: id } };
        }),

      setDisplayName: (name) =>
        set((state) => ({
          profile: { ...state.profile, displayName: name.trim().slice(0, 40) },
        })),

      restoreFromBackup: (code) => {
        const c = code.trim();
        if (!isValidMemberId(c)) return false;
        set((state) => ({ profile: { ...state.profile, memberId: c, backupCode: c } }));
        return true;
      },

      createCircle: async (name) => {
        get().registerPush().catch(() => {});
        const s = get();
        const snap = await circleApi.createCircle(s.settings.serverUrl, myMemberSnapshot(s), { name });
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
        return snap.meta.code;
      },

      joinCircle: async (code) => {
        get().registerPush().catch(() => {});
        const s = get();
        const snap = await circleApi.joinCircle(s.settings.serverUrl, code.trim().toUpperCase(), myMemberSnapshot(s));
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      refreshCircle: async (code) => {
        const s = get();
        const snap = await circleApi.getCircle(s.settings.serverUrl, code);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      syncCircle: async (code) => {
        const s = get();
        const circle = s.circles[code];
        const sharedRefs = (circle?.sharedVerses ?? []).map((v) => v.reference);
        const planRefs = (circle?.plans ?? []).flatMap((p) => p.items);
        const snap = await circleApi.syncCircle(s.settings.serverUrl, code, myMemberSnapshot(s, sharedRefs, planRefs));
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      addSharedVerse: async (code, reference, forMemberId) => {
        const s = get();
        const snap = await circleApi.addSharedVerse(
          s.settings.serverUrl,
          code,
          { memberId: s.profile.memberId, displayName: s.profile.displayName },
          reference.trim(),
          forMemberId,
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      setCircleGoal: async (code, goal) => {
        const s = get();
        const snap = await circleApi.setGoal(s.settings.serverUrl, code, s.profile.memberId, goal);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      assignChallenge: async (code, toMemberId, toName, reference, kind) => {
        const s = get();
        const snap = await circleApi.assignChallenge(
          s.settings.serverUrl,
          code,
          { memberId: s.profile.memberId, displayName: s.profile.displayName },
          toMemberId,
          toName,
          reference.trim(),
          kind,
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      submitChallenge: async (code, chalId, text, accuracy) => {
        const s = get();
        const snap = await circleApi.submitChallenge(s.settings.serverUrl, code, s.profile.memberId, chalId, text, accuracy);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      reviewChallenge: async (code, chalId, note, meaningPrompt) => {
        const s = get();
        const snap = await circleApi.reviewChallenge(s.settings.serverUrl, code, s.profile.memberId, chalId, note, meaningPrompt);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      setStudySession: (session) =>
        set((state) => ({
          studySessions: { ...state.studySessions, [session.passageKey]: session },
          activityLog: pushActivity(state.activityLog, { type: 'studied', ref: session.passage, at: Date.now() }),
        })),

      addApplication: (passageKey, passage, text) =>
        set((state) => ({
          applications: {
            ...state.applications,
            [passageKey]: { passageKey, passage, text: text.trim(), createdAt: Date.now() },
          },
        })),

      revisitApplication: (passageKey, outcome) =>
        set((state) => {
          const a = state.applications[passageKey];
          if (!a) return {};
          return {
            applications: {
              ...state.applications,
              [passageKey]: { ...a, revisitedAt: Date.now(), outcome: outcome?.trim() || a.outcome },
            },
          };
        }),

      createCirclePlan: async (code, title, items) => {
        const s = get();
        const snap = await circleApi.createPlan(s.settings.serverUrl, code, s.profile.memberId, title, items);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      shareNote: async (code, text, scope = 'free', ref) => {
        const s = get();
        const snap = await circleApi.saveNote(
          s.settings.serverUrl,
          code,
          { memberId: s.profile.memberId, displayName: s.profile.displayName },
          { scope, ref, text: text.trim() },
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      deleteSharedNote: async (code, noteId) => {
        const s = get();
        const snap = await circleApi.deleteNote(s.settings.serverUrl, code, s.profile.memberId, noteId);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      addPrivateNote: (scope, text, ref) =>
        set((state) => {
          const noteId = newMemberId().replace('m_', 'n_');
          return {
            notes: {
              ...state.notes,
              [noteId]: { noteId, scope, ref, text: text.trim(), updatedAt: Date.now() },
            },
          };
        }),

      deletePrivateNote: (noteId) =>
        set((state) => {
          const next = { ...state.notes };
          delete next[noteId];
          return { notes: next };
        }),

      addPrayer: async (code, text) => {
        const s = get();
        const snap = await circleApi.addPrayer(
          s.settings.serverUrl,
          code,
          { memberId: s.profile.memberId, displayName: s.profile.displayName },
          text.trim(),
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      prayForRequest: async (code, prayerId) => {
        const s = get();
        const snap = await circleApi.prayFor(
          s.settings.serverUrl,
          code,
          { memberId: s.profile.memberId, displayName: s.profile.displayName },
          prayerId,
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      answerPrayer: async (code, prayerId, answerNote) => {
        const s = get();
        const snap = await circleApi.answerPrayer(s.settings.serverUrl, code, s.profile.memberId, prayerId, answerNote);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      cheerMember: async (code, toMemberId) => {
        const s = get();
        const snap = await circleApi.cheer(s.settings.serverUrl, code, s.profile.memberId, toMemberId);
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      markOpened: () => set({ session: { lastOpenedDay: dayKey() } }),

      registerPush: async () => {
        if (get().pushToken) return; // already registered
        const token = await getExpoPushToken();
        if (token) set({ pushToken: token });
      },

      leaveCircle: async (code) => {
        const s = get();
        try {
          await circleApi.leaveCircle(s.settings.serverUrl, code, s.profile.memberId);
        } catch {
          // Even if the server call fails, drop the local cache.
        }
        set((state) => {
          const next = { ...state.circles };
          delete next[code];
          return { circles: next };
        });
      },

      setCircleCovenant: async (code, cadenceLabel, goalText) => {
        const s = get();
        const snap = await circleApi.setCovenant(
          s.settings.serverUrl,
          code,
          s.profile.memberId,
          cadenceLabel,
          goalText,
        );
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      setVerseAi: (id, patch) =>
        set((state) => {
          const v = state.verses[id];
          if (!v) return {};
          return { verses: { ...state.verses, [id]: { ...v, ...patch } } };
        }),

      resetAll: () =>
        set({
          verses: {},
          stats: defaultStats,
          settings: defaultSettings,
        }),
    }),
    {
      name: 'engraved-store-v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        verses: state.verses,
        stats: state.stats,
        settings: state.settings,
        profile: state.profile,
        circles: state.circles,
        studySessions: state.studySessions,
        applications: state.applications,
        notes: state.notes,
        session: state.session,
        activityLog: state.activityLog,
        pushToken: state.pushToken,
      }),
      // Merge persisted data over current defaults so state saved by an older
      // version (missing newer fields like stats.earnedBadges) is always
      // backfilled — otherwise those undefined fields crash the UI.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StoreState>;
        return {
          ...current,
          ...p,
          stats: { ...defaultStats, ...(p.stats ?? {}) },
          settings: { ...defaultSettings, ...(p.settings ?? {}) },
          profile: { ...defaultProfile, ...(p.profile ?? {}) },
          circles: p.circles ?? {},
          studySessions: p.studySessions ?? {},
          applications: p.applications ?? {},
          notes: p.notes ?? {},
          session: { lastOpenedDay: null, ...(p.session ?? {}) },
          activityLog: p.activityLog ?? [],
          pushToken: p.pushToken ?? null,
          verses: p.verses ?? {},
        };
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
        // Mint a stable identity on first run (idempotent thereafter).
        useStore.getState().ensureProfile();
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

export function useProfile(): Profile {
  return useStore((state) => state.profile);
}

export function useCircleList(): Circle[] {
  const circles = useStore((state) => state.circles);
  return useMemo(
    () => Object.values(circles).sort((a, b) => b.joinedAt - a.joinedAt),
    [circles],
  );
}

export function useCircle(code: string | undefined): Circle | undefined {
  return useStore((state) => (code ? state.circles[code] : undefined));
}

export function useStudySession(passageKey: string | undefined): StudySession | undefined {
  return useStore((state) => (passageKey ? state.studySessions[passageKey] : undefined));
}

export function useApplication(passageKey: string | undefined): StudyApplication | undefined {
  return useStore((state) => (passageKey ? state.applications[passageKey] : undefined));
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
