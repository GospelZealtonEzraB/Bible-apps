import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Activity,
  CelebrationEvent,
  ChallengeKind,
  Circle,
  CircleGoal,
  CirclePref,
  CircleSnapshot,
  LocalNote,
  NoteScope,
  Prayer,
  Profile,
  ReadingPosition,
  Settings,
  Stats,
  StudyApplication,
  StudySession,
  Topic,
  JournalEntry,
  CircleDaily,
  Doc,
  DocType,
  Folder,
  Verse,
  VerseStatus,
} from '@/types';
import {
  addEntry as addTopicEntry,
  removeEntry as removeTopicEntry,
  updateEntryNote,
  addReflection as addTopicReflection,
  updateReflection as updateTopicReflection,
  removeReflection as removeTopicReflection,
  moveReflection as moveTopicReflection,
} from '@/utils/topics';
import {
  patchEntry as patchJournalEntry,
  addNote as addJournalNoteReducer,
  removeNote as removeJournalNoteReducer,
} from '@/utils/journal';
import { emptyDoc, extractRefs, genId as genBlockId } from '@/utils/blocks';
import { newMemberId, isValidMemberId } from '@/utils/identity';
import { getExpoPushToken } from '@/notifications';
import * as circleApi from '@/data/circleClient';
import type { MemberSnapshotInput } from '@/data/circleClient';
import { initialSRS, review as sm2Review, RATING_TO_QUALITY } from '@/srs/sm2';
import type { RecallRating } from '@/srs/sm2';
import {
  displayReference,
  normalizeKey,
  translationName,
  verseId,
  type FetchedVerse,
} from '@/data/bibleApi';
import { versesDoneFrom, memorizedReferences, learningReferences } from '@/utils/circleProgress';
import { bookByNumber } from '@/data/structure';
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
  /** Per-circle personalization + control, keyed by invite code. */
  circlePrefs: Record<string, CirclePref>;
  /** Cached AI study briefs, keyed by normalized passage. */
  studySessions: Record<string, StudySession>;
  /** "One thing I'll live out" applications, keyed by passage. */
  applications: Record<string, StudyApplication>;
  /** Private notes kept only on this device. */
  notes: Record<string, LocalNote>;
  /** Custom study topics (tag-as-you-read collections), private to this device. */
  topics: Record<string, Topic>;
  /** Daily journal entries, keyed by local day (YYYY-MM-DD). Private to this device. */
  journal: Record<string, JournalEntry>;
  /** Unified notes/writing documents (journal, study, verse, topic, sermon, article). */
  documents: Record<string, Doc>;
  /** Notebooks/folders that group documents. */
  folders: Record<string, Folder>;
  /** Session memory for the welcome-back recap. */
  session: { lastOpenedDay: string | null };
  /** Where the Bible reader left off (null until they've read something). */
  reading: ReadingPosition | null;
  /** Reading-plan progress by plan id: which day-indices are done. */
  readingPlanProgress: Record<string, { startedAt: number; completed: number[] }>;
  /** The plan the user is currently following (null if none started). */
  activeReadingPlanId: string | null;
  /** Ids of Ember first-run tips the user has already dismissed. */
  seenTips: string[];
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
  /** A generic milestone to celebrate (memorized verse, streak, plan) — transient. */
  recentCelebration: CelebrationEvent | null;

  addFetchedVerse: (fetched: FetchedVerse, packId?: string) => Verse;
  removeVerse: (id: string) => void;
  hasVerse: (id: string) => boolean;

  /** Record a practice drill result (0..100 accuracy). Does not force a review. */
  practiceResult: (id: string, accuracy: number) => void;
  /** Grade a verse during a spaced-repetition review. */
  gradeReview: (id: string, rating: RecallRating) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setDailyGoal: (goal: number) => void;

  /** Remember where the reader is, for "Continue reading". */
  setReadingPosition: (book: number, chapter: number, verse?: number) => void;

  /** Start (or resume) following a reading plan. */
  startReadingPlan: (planId: string) => void;
  /** Mark a plan day done/undone. */
  toggleReadingDay: (planId: string, dayIndex: number) => void;

  /** Mark an Ember first-run tip as seen so it won't show again. */
  markTipSeen: (id: string) => void;

  /** Ensure a stable memberId exists (minted once). Idempotent. */
  ensureProfile: () => void;
  /** Set the display name shown to circle partners. */
  setDisplayName: (name: string) => void;
  /** Update this circle's personalization/control prefs (merged). */
  setCirclePref: (code: string, patch: Partial<CirclePref>) => void;
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
  /** Rename a circle. */
  setCircleName: (code: string, name: string) => Promise<void>;
  /** Remove a verse from a circle's shared list. */
  removeSharedVerse: (code: string, reference: string) => Promise<void>;
  /** Delete a study plan from a circle. */
  deleteCirclePlan: (code: string, planId: string) => Promise<void>;
  /** Assign a memorization/study challenge to a partner. */
  assignChallenge: (code: string, toMemberId: string, toName: string, reference: string, kind: ChallengeKind) => Promise<void>;
  /** Submit my attempt at a challenge (text + optional accuracy). */
  submitChallenge: (code: string, chalId: string, text: string, accuracy?: number) => Promise<void>;
  /** Submit my recite score for a duel challenge. */
  submitDuel: (code: string, chalId: string, accuracy: number) => Promise<void>;
  /** Review a partner's submission with an encouraging note. */
  reviewChallenge: (code: string, chalId: string, note: string, meaningPrompt?: string) => Promise<void>;

  /** Cache a fetched study brief. */
  setStudySession: (session: StudySession) => void;
  /** Capture "one thing I'll live out this week" for a studied passage. */
  addApplication: (passageKey: string, passage: string, text: string) => void;
  /** Mark an application revisited, optionally recording how it went. */
  revisitApplication: (passageKey: string, outcome?: string) => void;
  /** Edit the text of a saved application. */
  editApplication: (passageKey: string, text: string) => void;
  /** Delete a saved application. */
  deleteApplication: (passageKey: string) => void;

  // Growing Together — plans, notes, prayer, cheers
  createCirclePlan: (code: string, title: string, items: string[]) => Promise<void>;
  updateCirclePlan: (code: string, planId: string, title: string, items: string[]) => Promise<void>;
  shareNote: (code: string, text: string, scope?: NoteScope, ref?: string, noteId?: string) => Promise<void>;
  editSharedNote: (code: string, noteId: string, text: string, scope?: NoteScope, ref?: string) => Promise<void>;
  deleteSharedNote: (code: string, noteId: string) => Promise<void>;
  addPrivateNote: (scope: NoteScope, text: string, ref?: string) => void;
  editPrivateNote: (noteId: string, text: string) => void;
  deletePrivateNote: (noteId: string) => void;

  // Custom study topics (tag-as-you-read)
  /** Create a new topic; returns its id. */
  createTopic: (title: string, description?: string) => string;
  /** Rename / re-describe a topic. */
  updateTopic: (id: string, title: string, description?: string) => void;
  /** Delete a topic (and all its tagged verses). */
  deleteTopic: (id: string) => void;
  /** Tag a verse into a topic (deduped); optional "why this fits" note. */
  addToTopic: (id: string, ref: string, note?: string) => void;
  /** Remove a verse from a topic. */
  removeFromTopic: (id: string, ref: string) => void;
  /** Edit the note on an already-tagged verse. */
  setTopicEntryNote: (id: string, ref: string, note: string) => void;
  /** Add a free-form thought/journal block to a topic workspace. */
  addTopicThought: (id: string, text: string) => void;
  /** Edit a thought block (empty text removes it). */
  editTopicThought: (id: string, reflectionId: string, text: string) => void;
  /** Remove a thought block. */
  removeTopicThought: (id: string, reflectionId: string) => void;
  /** Reorder a thought block up (-1) or down (+1). */
  moveTopicThought: (id: string, reflectionId: string, dir: -1 | 1) => void;

  // Daily journal (the journaling core — private to this device)
  /** Set/replace a day's reflection ("what He showed me"). Empty clears it. */
  setJournalReflection: (day: string, text: string) => void;
  /** Set the verse/passage carried on a day (a reference). Empty clears it. */
  setJournalVerse: (day: string, ref: string) => void;
  /** Set a day's gratitude line. Empty clears it. */
  setJournalGratitude: (day: string, text: string) => void;
  /** Append a note to a day (optionally about a reference). Defaults to today. */
  addJournalNote: (note: { ref?: string; text: string }, day?: string) => void;
  /** Remove a note from a day. */
  removeJournalNote: (day: string, noteId: string) => void;

  // Notes / writing documents (the unified block-based system)
  /** Create a document; returns its id. */
  createDoc: (type: DocType, opts?: Partial<Doc>) => string;
  /** Patch a document (title/blocks/tags/etc.); refs + updatedAt are recomputed. */
  updateDoc: (id: string, patch: Partial<Doc>) => void;
  /** Delete a document. */
  deleteDoc: (id: string) => void;
  /** Get (or create) the journal document for a given day; returns its id. */
  journalDocForDay: (day: string) => string;
  /** Create a notebook/folder; returns its id. */
  createFolder: (name: string, emoji?: string) => string;
  /** Rename/re-emoji a folder. */
  updateFolder: (id: string, patch: Partial<Folder>) => void;
  /** Delete a folder (its documents become unfiled). */
  deleteFolder: (id: string) => void;
  /** Post a message to a circle's discussion (optionally anchored to a reference). */
  postCircleMessage: (code: string, text: string, context?: string) => Promise<void>;
  /** Delete one of my own circle messages. */
  deleteCircleMessage: (code: string, msgId: string) => Promise<void>;
  /** Toggle a reaction on a prayer/note/message (same emoji clears it). */
  reactTo: (code: string, targetType: 'prayer' | 'note' | 'message', targetId: string, emoji: string) => Promise<void>;
  /** Set/patch a day's shared devotional (song/reading/prayer/verse/note). Open to anyone. */
  setCircleDaily: (code: string, day: string, patch: Partial<CircleDaily>) => Promise<void>;
  /** Toggle my "did today's devotional" completion mark. */
  completeCircleDaily: (code: string, day: string) => Promise<void>;
  /** Share (or, with empty text, unshare) my reflection for a day. */
  shareCircleReflection: (code: string, day: string, text: string) => Promise<void>;
  /** Set the circle's shared reading plan (auto-advances by date); null clears it. */
  setCircleReadingPlan: (code: string, readingPlanId: string | null) => Promise<void>;
  addPrayer: (code: string, text: string) => Promise<void>;
  prayForRequest: (code: string, prayerId: string) => Promise<void>;
  answerPrayer: (code: string, prayerId: string, answerNote?: string) => Promise<void>;
  reopenPrayer: (code: string, prayerId: string) => Promise<void>;
  editPrayer: (code: string, prayerId: string, text: string) => Promise<void>;
  deletePrayer: (code: string, prayerId: string) => Promise<void>;
  togglePrayed: (code: string, prayer: Prayer) => Promise<void>;
  deleteChallenge: (code: string, chalId: string) => Promise<void>;
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
  /** Serialize all saved data to a JSON string the user can save as a backup. */
  exportBackup: () => string;
  /** Restore all data from a backup string. Returns ok/error; never throws. */
  importBackup: (json: string) => { ok: boolean; error?: string };
  /** Push a full backup to the server, keyed by this device's transfer id. Best-effort. */
  cloudBackup: (force?: boolean) => Promise<void>;
  /** Pull + restore the server backup for a transfer id (defaults to mine). */
  cloudRestore: (memberId?: string) => Promise<{ ok: boolean; error?: string }>;
  /** When the last successful cloud backup happened (ms), or null. */
  lastCloudBackupAt: number | null;
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
  readerTranslation: 'kjv',
  reminderTime: null,
  theme: 'system',
  serverUrl: null,
  shareLibrary: true,
  onboarded: false,
  abideRhythm: ['come', 'worship', 'word', 'deeper', 'respond', 'close'],
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
  shareRefsOverride?: boolean,
  muted?: boolean,
): MemberSnapshotInput {
  // Per-circle sharing overrides the global toggle when set.
  const share = shareRefsOverride ?? state.settings.shareLibrary;
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
    muted,
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

/**
 * Run a circle mutation optimistically: patch the cached snapshot immediately
 * so the UI updates with no network wait, then persist in the background. If the
 * server rejects, roll this circle back. The focus-sync (screen focus /
 * pull-to-refresh) reconciles authoritative state — real server ids and other
 * members' changes — so KV's eventual consistency never blocks the UI.
 */
async function optimisticCircle(
  set: (u: (s: StoreState) => Partial<StoreState>) => void,
  get: () => StoreState,
  code: string,
  patch: (c: Circle) => Circle,
  server: () => Promise<unknown>,
): Promise<void> {
  const before = get().circles[code];
  if (before) set((s) => ({ circles: { ...s.circles, [code]: patch(before) } }));
  try {
    await server();
  } catch (e) {
    if (before) set((s) => ({ circles: { ...s.circles, [code]: before } }));
    throw e;
  }
}

/** A stable client-side id for optimistic items (reconciled on the next sync). */
function genLocalId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

/** Streak lengths worth a full-screen celebration. */
const STREAK_MILESTONES = [7, 30, 100, 365];

/**
 * Choose the most exciting milestone to celebrate from a scoring event.
 * A crossed streak milestone outranks a freshly memorized verse.
 */
function pickCelebration(opts: {
  becameMemorized: boolean;
  reference: string;
  prevStreak: number;
  nextStreak: number;
}): CelebrationEvent | null {
  const crossed =
    opts.nextStreak > opts.prevStreak && STREAK_MILESTONES.includes(opts.nextStreak);
  if (crossed) {
    return {
      eyebrow: 'STREAK MILESTONE',
      title: `${opts.nextStreak}-day streak!`,
      subtitle: 'Faithful, day after day. Keep going!',
      emoji: '🔥',
    };
  }
  if (opts.becameMemorized) {
    return {
      eyebrow: 'VERSE MEMORIZED',
      title: opts.reference,
      subtitle: 'You’ve hidden it in your heart! 🎉',
      emoji: '💛',
    };
  }
  return null;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      verses: {},
      stats: defaultStats,
      settings: defaultSettings,
      profile: defaultProfile,
      circles: {},
      circlePrefs: {},
      studySessions: {},
      applications: {},
      notes: {},
      topics: {},
      journal: {},
      documents: {},
      folders: {},
      session: { lastOpenedDay: null },
      reading: null,
      readingPlanProgress: {},
      activeReadingPlanId: null,
      seenTips: [],
      activityLog: [],
      pushToken: null,
      hydrated: false,
      recentBadgeId: null,
      recentXp: null,
      recentQuestComplete: false,
      recentCelebration: null,
      lastCloudBackupAt: null,

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
          const celebration = pickCelebration({
            becameMemorized,
            reference: v.reference,
            prevStreak: state.stats.streak,
            nextStreak: progress.stats.streak,
          });
          return {
            verses,
            recentBadgeId: progress.recentBadgeId,
            recentXp: (progress.recentXp ?? 0) + d.xpBonus,
            recentQuestComplete: d.questJustCompleted,
            recentCelebration: celebration ?? state.recentCelebration,
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
          const celebration = pickCelebration({
            becameMemorized,
            reference: v.reference,
            prevStreak: state.stats.streak,
            nextStreak: progress.stats.streak,
          });
          return {
            verses,
            recentBadgeId: progress.recentBadgeId,
            recentXp: (progress.recentXp ?? 0) + d.xpBonus,
            recentQuestComplete: d.questJustCompleted,
            recentCelebration: celebration ?? state.recentCelebration,
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
        set({ recentBadgeId: null, recentXp: null, recentQuestComplete: false, recentCelebration: null }),

      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      setDailyGoal: (goal) =>
        set((state) => ({
          stats: { ...state.stats, dailyGoal: Math.max(1, Math.min(50, Math.round(goal))) },
        })),

      markTipSeen: (id) =>
        set((state) => (state.seenTips.includes(id) ? {} : { seenTips: [...state.seenTips, id] })),

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

      setCirclePref: (code, patch) =>
        set((state) => ({
          circlePrefs: { ...state.circlePrefs, [code]: { ...(state.circlePrefs[code] ?? {}), ...patch } },
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
        const pref = s.circlePrefs[code]?.sharing;
        const shareOverride = pref ? pref === 'full' : undefined; // undefined → fall back to global
        const snap = await circleApi.syncCircle(s.settings.serverUrl, code, myMemberSnapshot(s, sharedRefs, planRefs, shareOverride, s.circlePrefs[code]?.muted));
        set((state) => ({ circles: withSnapshot(state.circles, snap) }));
      },

      addSharedVerse: async (code, reference, forMemberId) => {
        const s = get();
        const ref = reference.trim();
        const optimistic = { reference: ref, addedBy: s.profile.memberId, addedByName: s.profile.displayName, addedAt: Date.now(), forMemberId };
        await optimisticCircle(set, get, code,
          (c) => c.sharedVerses.some((v) => normalizeKey(v.reference) === normalizeKey(ref))
            ? c
            : { ...c, sharedVerses: [optimistic, ...c.sharedVerses] },
          () => circleApi.addSharedVerse(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, ref, forMemberId),
        );
      },

      setCircleGoal: async (code, goal) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, meta: { ...c.meta, goal: goal ?? null } }),
          () => circleApi.setGoal(s.settings.serverUrl, code, s.profile.memberId, goal),
        );
      },

      setCircleName: async (code, name) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, meta: { ...c.meta, name: name.trim() || c.meta.name } }),
          () => circleApi.renameCircle(s.settings.serverUrl, code, s.profile.memberId, name.trim()),
        );
      },

      removeSharedVerse: async (code, reference) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, sharedVerses: c.sharedVerses.filter((v) => normalizeKey(v.reference) !== normalizeKey(reference)) }),
          () => circleApi.removeVerse(s.settings.serverUrl, code, s.profile.memberId, reference),
        );
      },

      deleteCirclePlan: async (code, planId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, plans: c.plans.filter((p) => p.planId !== planId) }),
          () => circleApi.deletePlan(s.settings.serverUrl, code, s.profile.memberId, planId),
        );
      },

      assignChallenge: async (code, toMemberId, toName, reference, kind) => {
        const s = get();
        const ref = reference.trim();
        const chalId = genLocalId();
        const optimistic = { chalId, from: s.profile.memberId, fromName: s.profile.displayName, to: toMemberId, toName, reference: ref, kind, createdAt: Date.now(), status: 'pending' as const };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, challenges: [optimistic, ...c.challenges] }),
          () => circleApi.assignChallenge(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, toMemberId, toName, ref, kind, chalId),
        );
      },

      submitChallenge: async (code, chalId, text, accuracy) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, challenges: c.challenges.map((ch) => ch.chalId === chalId ? { ...ch, status: 'submitted', submission: { by: s.profile.memberId, text, accuracy, submittedAt: Date.now() } } : ch) }),
          () => circleApi.submitChallenge(s.settings.serverUrl, code, s.profile.memberId, chalId, text, accuracy),
        );
        const chal = get().circles[code]?.challenges.find((ch) => ch.chalId === chalId);
        if (chal?.reference) set((state) => ({ activityLog: pushActivity(state.activityLog, { type: 'challenge', ref: chal.reference, at: Date.now() }) }));
      },

      submitDuel: async (code, chalId, accuracy) => {
        const s = get();
        const mine = { by: s.profile.memberId, byName: s.profile.displayName, accuracy, at: Date.now() };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, challenges: c.challenges.map((ch) => ch.chalId === chalId ? { ...ch, duel: [...(ch.duel ?? []).filter((d) => d.by !== s.profile.memberId), mine].sort((a, b) => b.accuracy - a.accuracy) } : ch) }),
          () => circleApi.submitDuel(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, chalId, accuracy),
        );
      },

      reviewChallenge: async (code, chalId, note, meaningPrompt) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, challenges: c.challenges.map((ch) => ch.chalId === chalId ? { ...ch, status: 'reviewed', review: { by: s.profile.memberId, note, meaningPrompt, at: Date.now() } } : ch) }),
          () => circleApi.reviewChallenge(s.settings.serverUrl, code, s.profile.memberId, chalId, note, meaningPrompt),
        );
      },

      setStudySession: (session) =>
        set((state) => ({
          studySessions: { ...state.studySessions, [session.passageKey]: session },
          activityLog: pushActivity(state.activityLog, { type: 'studied', ref: session.passage, at: Date.now() }),
        })),

      setReadingPosition: (book, chapter, verse) =>
        set((state) => {
          const ref = `${bookByNumber(book)?.name ?? `Book ${book}`} ${chapter}`;
          const last = state.activityLog[state.activityLog.length - 1];
          // Dedupe: don't log the same chapter twice in a row (re-mounts, translation switches).
          const log = last && last.type === 'read' && last.ref === ref
            ? state.activityLog
            : pushActivity(state.activityLog, { type: 'read', ref, at: Date.now() });
          return { reading: { book, chapter, verse, updatedAt: Date.now() }, activityLog: log };
        }),

      startReadingPlan: (planId) =>
        set((state) => ({
          activeReadingPlanId: planId,
          readingPlanProgress: state.readingPlanProgress[planId]
            ? state.readingPlanProgress
            : { ...state.readingPlanProgress, [planId]: { startedAt: Date.now(), completed: [] } },
        })),

      toggleReadingDay: (planId, dayIndex) =>
        set((state) => {
          const prev = state.readingPlanProgress[planId] ?? { startedAt: Date.now(), completed: [] };
          const has = prev.completed.includes(dayIndex);
          const completed = has
            ? prev.completed.filter((d) => d !== dayIndex)
            : [...prev.completed, dayIndex].sort((a, b) => a - b);
          return {
            activeReadingPlanId: planId,
            readingPlanProgress: { ...state.readingPlanProgress, [planId]: { ...prev, completed } },
          };
        }),

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

      editApplication: (passageKey, text) =>
        set((state) => {
          const a = state.applications[passageKey];
          if (!a) return {};
          return {
            applications: {
              ...state.applications,
              [passageKey]: { ...a, text: text.trim() },
            },
          };
        }),

      deleteApplication: (passageKey) =>
        set((state) => {
          const next = { ...state.applications };
          delete next[passageKey];
          return { applications: next };
        }),

      createCirclePlan: async (code, title, items) => {
        const s = get();
        const planId = genLocalId();
        const optimistic = { planId, title: title.trim(), items, createdBy: s.profile.memberId, createdAt: Date.now() };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, plans: [optimistic, ...c.plans] }),
          () => circleApi.createPlan(s.settings.serverUrl, code, s.profile.memberId, title, items, planId),
        );
      },

      updateCirclePlan: async (code, planId, title, items) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, plans: c.plans.map((p) => p.planId === planId ? { ...p, title: title.trim(), items } : p) }),
          () => circleApi.updatePlan(s.settings.serverUrl, code, s.profile.memberId, planId, title, items),
        );
      },

      shareNote: async (code, text, scope = 'free', ref, noteId) => {
        const s = get();
        const id = noteId ?? genLocalId();
        const optimistic = { noteId: id, by: s.profile.memberId, byName: s.profile.displayName, scope, ref, text: text.trim(), updatedAt: Date.now() };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, notes: [optimistic, ...c.notes.filter((n) => n.noteId !== id)] }),
          () => circleApi.saveNote(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, { noteId: id, scope, ref, text: text.trim() }),
        );
        // Surface the shared note in the activity feed (shared notes only — private stay private).
        if (ref) set((state) => ({ activityLog: pushActivity(state.activityLog, { type: 'noted', ref, at: Date.now() }) }));
      },

      editSharedNote: async (code, noteId, text, scope = 'free', ref) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, notes: c.notes.map((n) => n.noteId === noteId ? { ...n, text: text.trim(), scope, ref, updatedAt: Date.now() } : n) }),
          () => circleApi.saveNote(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, { noteId, scope, ref, text: text.trim() }),
        );
      },

      deleteSharedNote: async (code, noteId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, notes: c.notes.filter((n) => n.noteId !== noteId) }),
          () => circleApi.deleteNote(s.settings.serverUrl, code, s.profile.memberId, noteId),
        );
      },

      postCircleMessage: async (code, text, context) => {
        const s = get();
        const msgId = genLocalId();
        const optimistic = { msgId, by: s.profile.memberId, byName: s.profile.displayName, text: text.trim(), context, at: Date.now() };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, messages: [...(c.messages ?? []), optimistic] }),
          () => circleApi.postMessage(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, { msgId, text: text.trim(), context }),
        );
      },

      deleteCircleMessage: async (code, msgId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, messages: (c.messages ?? []).filter((m) => m.msgId !== msgId) }),
          () => circleApi.deleteMessage(s.settings.serverUrl, code, s.profile.memberId, msgId),
        );
      },

      reactTo: async (code, targetType, targetId, emoji) => {
        const s = get();
        const me = s.profile.memberId;
        const k = `${targetType}:${targetId}`;
        await optimisticCircle(set, get, code,
          (c) => {
            const reactions = { ...(c.reactions ?? {}) };
            const list = (reactions[k] ?? []).filter((r) => r.by !== me);
            const had = (c.reactions?.[k] ?? []).find((r) => r.by === me);
            // Toggle off if same emoji; otherwise set my reaction to the new emoji.
            if (!(had && had.emoji === emoji)) list.push({ emoji, by: me, byName: s.profile.displayName });
            reactions[k] = list;
            return { ...c, reactions };
          },
          () => circleApi.react(s.settings.serverUrl, code, { memberId: me, displayName: s.profile.displayName }, targetType, targetId, emoji),
        );
      },

      // ---- Circle daily devotional (the shared "today") ----
      setCircleDaily: async (code, day, patch) => {
        const s = get();
        const me = { memberId: s.profile.memberId, displayName: s.profile.displayName };
        await optimisticCircle(set, get, code,
          (c) => {
            const daily = { ...(c.daily ?? {}) };
            const prev = daily[day] ?? { day, doneByIds: [], reflections: [] };
            const next = { ...prev };
            for (const [k, v] of Object.entries(patch)) {
              if (v && String(v).trim()) (next as any)[k] = String(v).trim();
              else delete (next as any)[k];
            }
            next.setBy = me.memberId;
            next.setByName = me.displayName;
            next.updatedAt = Date.now();
            daily[day] = next;
            return { ...c, daily };
          },
          () => circleApi.setDaily(s.settings.serverUrl, code, me, day, patch),
        );
      },

      completeCircleDaily: async (code, day) => {
        const s = get();
        const me = { memberId: s.profile.memberId, displayName: s.profile.displayName };
        await optimisticCircle(set, get, code,
          (c) => {
            const daily = { ...(c.daily ?? {}) };
            const prev = daily[day] ?? { day, doneByIds: [], reflections: [] };
            const has = (prev.doneByIds ?? []).includes(me.memberId);
            daily[day] = { ...prev, doneByIds: has ? prev.doneByIds.filter((id) => id !== me.memberId) : [...(prev.doneByIds ?? []), me.memberId] };
            return { ...c, daily };
          },
          () => circleApi.completeDaily(s.settings.serverUrl, code, me, day),
        );
      },

      shareCircleReflection: async (code, day, text) => {
        const s = get();
        const me = { memberId: s.profile.memberId, displayName: s.profile.displayName };
        const trimmed = text.trim();
        await optimisticCircle(set, get, code,
          (c) => {
            const daily = { ...(c.daily ?? {}) };
            const prev = daily[day] ?? { day, doneByIds: [], reflections: [] };
            const others = (prev.reflections ?? []).filter((r) => r.by !== me.memberId);
            const reflections = trimmed
              ? [{ by: me.memberId, byName: me.displayName, text: trimmed, updatedAt: Date.now() }, ...others]
              : others;
            daily[day] = { ...prev, reflections };
            return { ...c, daily };
          },
          () => circleApi.shareReflection(s.settings.serverUrl, code, me, day, trimmed),
        );
      },

      setCircleReadingPlan: async (code, readingPlanId) => {
        const s = get();
        const me = { memberId: s.profile.memberId, displayName: s.profile.displayName };
        const startedAt = Date.now();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, meta: { ...c.meta, readingPlanId, readingPlanStartedAt: readingPlanId ? startedAt : null } }),
          () => circleApi.setCircleReadingPlan(s.settings.serverUrl, code, me, readingPlanId, startedAt),
        );
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

      editPrivateNote: (noteId, text) =>
        set((state) => {
          const n = state.notes[noteId];
          if (!n) return {};
          return { notes: { ...state.notes, [noteId]: { ...n, text: text.trim(), updatedAt: Date.now() } } };
        }),

      deletePrivateNote: (noteId) =>
        set((state) => {
          const next = { ...state.notes };
          delete next[noteId];
          return { notes: next };
        }),

      createTopic: (title, description) => {
        const now = Date.now();
        const id = 't_' + now.toString(36) + Math.random().toString(36).slice(2, 8);
        const topic: Topic = {
          id,
          title: title.trim().slice(0, 80) || 'Untitled topic',
          description: description?.trim() || undefined,
          entries: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ topics: { ...state.topics, [id]: topic } }));
        return id;
      },

      updateTopic: (id, title, description) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return {
            topics: {
              ...state.topics,
              [id]: { ...t, title: title.trim().slice(0, 80) || t.title, description: description?.trim() || undefined, updatedAt: Date.now() },
            },
          };
        }),

      deleteTopic: (id) =>
        set((state) => {
          const next = { ...state.topics };
          delete next[id];
          return { topics: next };
        }),

      addToTopic: (id, ref, note) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: addTopicEntry(t, ref, note, Date.now()) } };
        }),

      removeFromTopic: (id, ref) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: removeTopicEntry(t, ref, Date.now()) } };
        }),

      setTopicEntryNote: (id, ref, note) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: updateEntryNote(t, ref, note, Date.now()) } };
        }),

      addTopicThought: (id, text) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          const rid = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          return { topics: { ...state.topics, [id]: addTopicReflection(t, rid, text, Date.now()) } };
        }),

      editTopicThought: (id, reflectionId, text) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: updateTopicReflection(t, reflectionId, text, Date.now()) } };
        }),

      removeTopicThought: (id, reflectionId) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: removeTopicReflection(t, reflectionId, Date.now()) } };
        }),

      moveTopicThought: (id, reflectionId, dir) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: moveTopicReflection(t, reflectionId, dir, Date.now()) } };
        }),

      // ---- Daily journal (private) ----
      setJournalReflection: (day, text) =>
        set((state) => ({ journal: patchJournalEntry(state.journal, day, { reflection: text.trim() }, Date.now()) })),

      setJournalVerse: (day, ref) =>
        set((state) => ({ journal: patchJournalEntry(state.journal, day, { verse: ref.trim() }, Date.now()) })),

      setJournalGratitude: (day, text) =>
        set((state) => ({ journal: patchJournalEntry(state.journal, day, { gratitude: text.trim() }, Date.now()) })),

      addJournalNote: (note, day) =>
        set((state) => {
          if (!note.text.trim()) return {};
          return { journal: addJournalNoteReducer(state.journal, day ?? dayKey(), note, Date.now()) };
        }),

      removeJournalNote: (day, noteId) =>
        set((state) => ({ journal: removeJournalNoteReducer(state.journal, day, noteId, Date.now()) })),

      // ---- Notes / writing documents ----
      createDoc: (type, opts) => {
        const d = emptyDoc(type, opts);
        set((state) => ({ documents: { ...state.documents, [d.id]: d } }));
        return d.id;
      },

      updateDoc: (id, patch) =>
        set((state) => {
          const prev = state.documents[id];
          if (!prev) return {};
          const next: Doc = { ...prev, ...patch, updatedAt: Date.now() };
          next.refs = extractRefs(next);
          return { documents: { ...state.documents, [id]: next } };
        }),

      deleteDoc: (id) =>
        set((state) => {
          const next = { ...state.documents };
          delete next[id];
          return { documents: next };
        }),

      journalDocForDay: (day) => {
        const existing = Object.values(get().documents).find((d) => d.type === 'journal' && d.day === day);
        if (existing) return existing.id;
        const d = emptyDoc('journal', { day, title: '' });
        set((state) => ({ documents: { ...state.documents, [d.id]: d } }));
        return d.id;
      },

      createFolder: (name, emoji) => {
        const id = genBlockId('f');
        const folder: Folder = { id, name: name.trim() || 'Notebook', emoji, createdAt: Date.now() };
        set((state) => ({ folders: { ...state.folders, [id]: folder } }));
        return id;
      },

      updateFolder: (id, patch) =>
        set((state) => {
          const f = state.folders[id];
          if (!f) return {};
          return { folders: { ...state.folders, [id]: { ...f, ...patch } } };
        }),

      deleteFolder: (id) =>
        set((state) => {
          const folders = { ...state.folders };
          delete folders[id];
          // Unfile any documents that were in this folder.
          const documents = { ...state.documents };
          for (const d of Object.values(documents)) {
            if (d.folderId === id) documents[d.id] = { ...d, folderId: null };
          }
          return { folders, documents };
        }),

      addPrayer: async (code, text) => {
        const s = get();
        const prayerId = genLocalId();
        const optimistic = { prayerId, text: text.trim(), by: s.profile.memberId, byName: s.profile.displayName, createdAt: Date.now(), status: 'active' as const, prayedByCount: 0, prayedByIds: [] as string[] };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: [optimistic, ...c.prayers] }),
          () => circleApi.addPrayer(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, text.trim(), prayerId),
        );
        set((state) => ({ activityLog: pushActivity(state.activityLog, { type: 'prayed', at: Date.now() }) }));
      },

      prayForRequest: async (code, prayerId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.map((p) => p.prayerId === prayerId && !p.prayedByIds?.includes(s.profile.memberId) ? { ...p, prayedByCount: p.prayedByCount + 1, prayedByIds: [...(p.prayedByIds ?? []), s.profile.memberId] } : p) }),
          () => circleApi.prayFor(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, prayerId),
        );
      },

      answerPrayer: async (code, prayerId, answerNote) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.map((p) => p.prayerId === prayerId ? { ...p, status: 'answered', answeredAt: Date.now(), answerNote } : p) }),
          () => circleApi.answerPrayer(s.settings.serverUrl, code, s.profile.memberId, prayerId, answerNote),
        );
      },

      reopenPrayer: async (code, prayerId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.map((p) => p.prayerId === prayerId ? { ...p, status: 'active', answeredAt: undefined, answerNote: undefined } : p) }),
          () => circleApi.reopenPrayer(s.settings.serverUrl, code, s.profile.memberId, prayerId),
        );
      },

      editPrayer: async (code, prayerId, text) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.map((p) => p.prayerId === prayerId ? { ...p, text: text.trim() } : p) }),
          () => circleApi.editPrayer(s.settings.serverUrl, code, s.profile.memberId, prayerId, text.trim()),
        );
      },

      deletePrayer: async (code, prayerId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.filter((p) => p.prayerId !== prayerId) }),
          () => circleApi.deletePrayer(s.settings.serverUrl, code, s.profile.memberId, prayerId),
        );
      },

      togglePrayed: async (code, prayer) => {
        const s = get();
        const me = s.profile.memberId;
        const iPrayed = prayer.didIPray || prayer.prayedByIds?.includes(me);
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: c.prayers.map((p) => {
            if (p.prayerId !== prayer.prayerId) return p;
            return iPrayed
              ? { ...p, prayedByCount: Math.max(0, p.prayedByCount - 1), prayedByIds: (p.prayedByIds ?? []).filter((id) => id !== me) }
              : { ...p, prayedByCount: p.prayedByCount + 1, prayedByIds: [...(p.prayedByIds ?? []), me] };
          }) }),
          () => iPrayed
            ? circleApi.unpray(s.settings.serverUrl, code, me, prayer.prayerId)
            : circleApi.prayFor(s.settings.serverUrl, code, { memberId: me, displayName: s.profile.displayName }, prayer.prayerId),
        );
      },

      deleteChallenge: async (code, chalId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, challenges: c.challenges.filter((ch) => ch.chalId !== chalId) }),
          () => circleApi.deleteChallenge(s.settings.serverUrl, code, s.profile.memberId, chalId),
        );
      },

      cheerMember: async (code, toMemberId) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, cheersFor: { ...c.cheersFor, [toMemberId]: (c.cheersFor?.[toMemberId] ?? 0) + 1 } }),
          () => circleApi.cheer(s.settings.serverUrl, code, s.profile.memberId, toMemberId),
        );
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
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, meta: { ...c.meta, covenant: { ...(c.meta.covenant ?? { agreedBy: [] }), cadenceLabel, goalText } } }),
          () => circleApi.setCovenant(s.settings.serverUrl, code, s.profile.memberId, cadenceLabel, goalText),
        );
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

      exportBackup: () => {
        const s = get();
        return JSON.stringify({
          app: 'versed',
          schema: 2,
          exportedAt: Date.now(),
          data: {
            verses: s.verses,
            stats: s.stats,
            settings: s.settings,
            profile: s.profile,
            circles: s.circles,
            circlePrefs: s.circlePrefs,
            studySessions: s.studySessions,
            applications: s.applications,
            notes: s.notes,
            topics: s.topics,
            journal: s.journal,
            documents: s.documents,
            folders: s.folders,
            session: s.session,
            reading: s.reading,
            readingPlanProgress: s.readingPlanProgress,
            activeReadingPlanId: s.activeReadingPlanId,
            seenTips: s.seenTips,
            activityLog: s.activityLog,
          },
        });
      },

      importBackup: (json) => {
        let parsed: any;
        try {
          parsed = JSON.parse(json.trim());
        } catch {
          return { ok: false, error: 'Couldn’t read that backup — the text looks incomplete or invalid.' };
        }
        const d = parsed?.data ?? parsed;
        if (!d || typeof d !== 'object' || (!('verses' in d) && !('profile' in d))) {
          return { ok: false, error: 'That doesn’t look like a Versed backup.' };
        }
        set((state) => ({
          verses: d.verses ?? state.verses,
          stats: { ...defaultStats, ...(d.stats ?? {}) },
          settings: { ...defaultSettings, ...(d.settings ?? {}) },
          profile: { ...defaultProfile, ...(d.profile ?? {}) },
          circles: d.circles ?? state.circles,
          circlePrefs: d.circlePrefs ?? state.circlePrefs,
          studySessions: d.studySessions ?? state.studySessions,
          applications: d.applications ?? state.applications,
          notes: d.notes ?? state.notes,
          topics: d.topics ?? state.topics,
          journal: d.journal ?? state.journal,
          documents: d.documents ?? state.documents,
          folders: d.folders ?? state.folders,
          session: d.session ?? state.session,
          reading: d.reading ?? state.reading,
          readingPlanProgress: d.readingPlanProgress ?? state.readingPlanProgress,
          activeReadingPlanId: d.activeReadingPlanId ?? state.activeReadingPlanId,
          seenTips: Array.isArray(d.seenTips) ? d.seenTips : state.seenTips,
          activityLog: Array.isArray(d.activityLog) ? d.activityLog : state.activityLog,
        }));
        return { ok: true };
      },

      cloudBackup: async (force = false) => {
        const s = get();
        if (!s.profile.memberId) return; // no identity yet — nothing to key on
        // Throttle automatic backups so rapid backgrounding doesn't re-upload.
        if (!force && s.lastCloudBackupAt && Date.now() - s.lastCloudBackupAt < 90_000) return;
        try {
          await circleApi.pushBackup(s.settings.serverUrl, s.profile.memberId, s.exportBackup());
          set({ lastCloudBackupAt: Date.now() });
        } catch {
          // best-effort — a stale/absent server must never surface an error here
        }
      },

      cloudRestore: async (memberId) => {
        const s = get();
        const id = memberId ?? s.profile.memberId;
        if (!id) return { ok: false, error: 'No transfer code to restore from.' };
        try {
          const rec = await circleApi.pullBackup(s.settings.serverUrl, id);
          if (!rec?.blob) return { ok: false, error: 'No cloud backup found for that transfer code.' };
          return get().importBackup(rec.blob);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Couldn’t reach the server.' };
        }
      },
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
        circlePrefs: state.circlePrefs,
        studySessions: state.studySessions,
        applications: state.applications,
        notes: state.notes,
        topics: state.topics,
        journal: state.journal,
        documents: state.documents,
        folders: state.folders,
        session: state.session,
        reading: state.reading,
        readingPlanProgress: state.readingPlanProgress,
        activeReadingPlanId: state.activeReadingPlanId,
        seenTips: state.seenTips,
        activityLog: state.activityLog,
        pushToken: state.pushToken,
        lastCloudBackupAt: state.lastCloudBackupAt,
      }),
      // Merge persisted data over current defaults so state saved by an older
      // version (missing newer fields like stats.earnedBadges) is always
      // backfilled — otherwise those undefined fields crash the UI.
      // Never discard saved state on a version bump — pass it straight to merge,
      // which backfills any missing fields. (Default zustand behavior can drop
      // state on version mismatch when no migrate is supplied.)
      migrate: (persisted) => persisted as StoreState,
      merge: (persisted, current) => {
        // Hydration must NEVER throw — a corrupt or partial persisted blob
        // (including one auto-restored from a different app version) would
        // otherwise crash the app on launch. On any problem, fall back to
        // defaults rather than crash.
        try {
          const p = (persisted ?? {}) as Partial<StoreState>;
          const verses = p.verses && typeof p.verses === 'object' ? p.verses : {};
          // Existing users (they already have a profile or saved verses) should
          // NOT be sent back through first-run onboarding after this update.
          const isReturningUser = !!(p.profile?.memberId || Object.keys(verses).length > 0);
          return {
            ...current,
            ...p,
            stats: { ...defaultStats, ...(p.stats ?? {}) },
            settings: { ...defaultSettings, onboarded: isReturningUser, ...(p.settings ?? {}) },
            profile: { ...defaultProfile, ...(p.profile ?? {}) },
            circles: p.circles ?? {},
            circlePrefs: p.circlePrefs ?? {},
            studySessions: p.studySessions ?? {},
            applications: p.applications ?? {},
            notes: p.notes ?? {},
            topics: p.topics ?? {},
            journal: p.journal ?? {},
            documents: p.documents ?? {},
            folders: p.folders ?? {},
            session: { lastOpenedDay: null, ...(p.session ?? {}) },
            reading: p.reading ?? null,
            readingPlanProgress: p.readingPlanProgress ?? {},
            activeReadingPlanId: p.activeReadingPlanId ?? null,
            seenTips: Array.isArray(p.seenTips) ? p.seenTips : [],
            activityLog: Array.isArray(p.activityLog) ? p.activityLog : [],
            pushToken: p.pushToken ?? null,
            lastCloudBackupAt: p.lastCloudBackupAt ?? null,
            verses,
          };
        } catch {
          return current;
        }
      },
      onRehydrateStorage: () => () => {
        try {
          useStore.setState({ hydrated: true });
          // Mint a stable identity on first run (idempotent thereafter).
          useStore.getState().ensureProfile();
        } catch {
          useStore.setState({ hydrated: true });
        }
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

export function useCirclePref(code: string | undefined): CirclePref {
  return useStore((state) => (code ? state.circlePrefs[code] ?? EMPTY_PREF : EMPTY_PREF));
}
const EMPTY_PREF: CirclePref = {};

export function useStudySession(passageKey: string | undefined): StudySession | undefined {
  return useStore((state) => (passageKey ? state.studySessions[passageKey] : undefined));
}

export function useReadingPosition() {
  return useStore((state) => state.reading);
}

export function useReadingPlanProgress(planId: string | undefined) {
  return useStore((state) => (planId ? state.readingPlanProgress[planId] : undefined));
}

export function useActiveReadingPlanId() {
  return useStore((state) => state.activeReadingPlanId);
}

/** Private notes attached to a given verse reference, newest first. */
export function useVerseNotes(reference: string | undefined): LocalNote[] {
  const notes = useStore((state) => state.notes);
  return useMemo(() => {
    if (!reference) return [];
    const key = normalizeKey(reference);
    return Object.values(notes)
      .filter((n) => n.ref && normalizeKey(n.ref) === key)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, reference]);
}

export function useApplication(passageKey: string | undefined): StudyApplication | undefined {
  return useStore((state) => (passageKey ? state.applications[passageKey] : undefined));
}

/** The whole journal map (day → entry). */
export function useJournal(): Record<string, JournalEntry> {
  return useStore((state) => state.journal);
}

/** A single day's journal entry (undefined until something is written). */
export function useJournalEntry(day: string | undefined): JournalEntry | undefined {
  return useStore((state) => (day ? state.journal[day] : undefined));
}

/** A single writing document by id. */
export function useDoc(id: string | undefined): Doc | undefined {
  return useStore((state) => (id ? state.documents[id] : undefined));
}

/** All documents, most-recently-updated first, optionally filtered by type/folder. */
export function useDocList(filter?: { type?: DocType; folderId?: string | null }): Doc[] {
  const documents = useStore((state) => state.documents);
  return useMemo(() => {
    let list = Object.values(documents);
    if (filter?.type) list = list.filter((d) => d.type === filter.type);
    if (filter?.folderId !== undefined) list = list.filter((d) => (d.folderId ?? null) === filter.folderId);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, filter?.type, filter?.folderId]);
}

/** Documents that reference a given verse (backlinks — "notes on this verse"). */
export function useDocsForRef(reference: string | undefined): Doc[] {
  const documents = useStore((state) => state.documents);
  return useMemo(() => {
    if (!reference) return [];
    const key = normalizeKey(reference);
    return Object.values(documents)
      .filter((d) => (d.refs ?? []).some((r) => normalizeKey(r) === key))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, reference]);
}

/** All notebooks/folders. */
export function useFolders(): Folder[] {
  const folders = useStore((state) => state.folders);
  return useMemo(() => Object.values(folders).sort((a, b) => a.createdAt - b.createdAt), [folders]);
}

/** All custom study topics, most-recently-updated first. */
export function useTopicList(): Topic[] {
  const topics = useStore((state) => state.topics);
  return useMemo(
    () => Object.values(topics).sort((a, b) => b.updatedAt - a.updatedAt),
    [topics],
  );
}

export function useTopic(id: string | undefined): Topic | undefined {
  return useStore((state) => (id ? state.topics[id] : undefined));
}

/** Ids of topics that already contain a given reference (for picker checkmarks). */
export function useTopicsForRef(reference: string | undefined): string[] {
  const topics = useStore((state) => state.topics);
  return useMemo(() => {
    if (!reference) return [];
    const key = normalizeKey(reference);
    return Object.values(topics)
      .filter((t) => (t.entries ?? []).some((e) => normalizeKey(e.ref) === key))
      .map((t) => t.id);
  }, [topics, reference]);
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

export function useRecentCelebration(): CelebrationEvent | null {
  return useStore((state) => state.recentCelebration);
}
