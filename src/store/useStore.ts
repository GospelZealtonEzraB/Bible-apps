import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ChallengeKind,
  Circle,
  CircleSnapshot,
  LogEntry,
  LogKind,
  Prayer,
  Profile,
  ReadingPosition,
  Settings,
  Stats,
  StudySession,
  Topic,
  Doc,
  DocType,
  MessageAttachment,
  Verse,
  VerseStatus,
} from '@/types';
import { addEntry as addTopicEntry, removeEntry as removeTopicEntry } from '@/utils/topics';
import {
  addEntry as addLog,
  removeEntry as removeLog,
  setEntryPrivate as setLogPrivate,
  setEntryText as setLogText,
  entriesForDay as logEntriesForDay,
} from '@/utils/log';
import { emptyDoc, extractRefs, markdownToBlocks, normalizeDocType } from '@/utils/blocks';
import { migrateDocs } from '@/utils/notesMigration';
import { toUserSong, newSongId, isMine, toggleFavorite, type Hymn, type HymnStanza, type SongbookState } from '@/data/songbook';
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
  getVerse,
  type FetchedVerse,
} from '@/data/bibleApi';
import { versesDoneFrom, memorizedReferences, learningReferences } from '@/utils/circleProgress';
import { bookByNumber } from '@/data/structure';
import { dayKey, daysBetweenKeys } from '@/utils/date';

/** Interval (days) at which a verse is considered memorized. */
const MEMORIZED_INTERVAL = 21;

interface StoreState {
  verses: Record<string, Verse>;
  stats: Stats;
  settings: Settings;
  profile: Profile;
  /** The covenant partnership, cached by invite code. */
  circles: Record<string, Circle>;
  /** Cached AI study briefs, keyed by normalized passage. */
  studySessions: Record<string, StudySession>;
  /** Named tags over verses ("Grace", "Names of God"), by id. */
  topics: Record<string, Topic>;
  /** Everything you write — one notes system, by doc id. */
  documents: Record<string, Doc>;
  /** The daily log: what you did with God, by entry id. THE record of the walk. */
  log: Record<string, LogEntry>;
  /** Songs the family added in-app (Tamil included), by id. Full lyrics + chords. */
  songs: Record<string, Hymn>;
  /** Chords written onto a bundled (lyrics-only) song, by that song's id. */
  songChords: Record<string, HymnStanza[]>;
  /** Favourite song ids, in the order they were starred. */
  favoriteSongs: string[];
  /** Session memory for the welcome-back recap. */
  session: { lastOpenedDay: string | null };
  /** Where the Bible reader left off (null until they've read something). */
  reading: ReadingPosition | null;
  /** Ids of Ember first-run tips the user has already dismissed. */
  seenTips: string[];
  /** Expo push token for partner-activity notifications (null until registered). */
  pushToken: string | null;
  hydrated: boolean;
  /** An attachment waiting to be sent in chat (transient — set by "Share to chat"). */
  pendingChatAttachment: MessageAttachment | null;

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


  /** Mark an Ember first-run tip as seen so it won't show again. */
  markTipSeen: (id: string) => void;

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
  /** Rename a circle. */
  setCircleName: (code: string, name: string) => Promise<void>;
  /** Assign a memorization/study challenge to a partner. */
  assignChallenge: (code: string, toMemberId: string, toName: string, reference: string, kind: ChallengeKind) => Promise<void>;
  /** Submit my attempt at a challenge (text + optional accuracy). */
  submitChallenge: (code: string, chalId: string, text: string, accuracy?: number) => Promise<void>;
  /** Review a partner's submission with an encouraging note. */
  reviewChallenge: (code: string, chalId: string, note: string, meaningPrompt?: string) => Promise<void>;

  /** Cache a fetched study brief. */
  setStudySession: (session: StudySession) => void;


  // Custom study topics (tag-as-you-read)
  /** Create a new topic; returns its id. */
  createTopic: (title: string) => string;
  /** Rename / re-describe a topic. */
  updateTopic: (id: string, title: string) => void;
  /** Delete a topic (and all its tagged verses). */
  deleteTopic: (id: string) => void;
  /** Tag a verse into a topic (deduped); optional "why this fits" note. */
  addToTopic: (id: string, ref: string) => void;
  /** Remove a verse from a topic. */
  removeFromTopic: (id: string, ref: string) => void;


  // Notes / writing documents (the unified block-based system)
  /** Create a document; returns its id. */
  createDoc: (type: DocType, opts?: Partial<Doc>) => string;
  /** Patch a document (title/blocks/tags/etc.); refs + updatedAt are recomputed. */
  updateDoc: (id: string, patch: Partial<Doc>) => void;
  /** Delete a document. */
  deleteDoc: (id: string) => void;
  /** One-time move of legacy private notes into documents (idempotent). */
  runNotesMigration: () => void;

  // The daily log — the one record of the walk
  /** Add something you did today to your log. Re-adding the same asset is a no-op. */
  addLogEntry: (entry: { kind: LogKind; ref?: string; assetId?: string; title?: string; text?: string; day?: string; private?: boolean }) => void;
  /** Remove an entry from the log. */
  removeLogEntry: (id: string) => void;
  /** Hide an entry from your partner (or show it again). */
  setLogEntryPrivate: (id: string, isPrivate: boolean) => void;
  /** Edit the free line on an entry. */
  setLogEntryText: (id: string, text: string) => void;
  /** Park an asset for the chat composer ("Share to chat"); cleared once sent. */
  setPendingChatAttachment: (attachment: MessageAttachment | null) => void;

  // The songbook
  /** Add or replace one of the family's own songs; returns its id. */
  saveSong: (song: Hymn, id?: string) => string;
  /** Remove one of the family's own songs (bundled songs can't be deleted). */
  deleteSong: (id: string) => void;
  /** Star / unstar any song. */
  toggleFavoriteSong: (id: string) => void;
  /** Write chords onto a bundled song (pass null to drop back to the original). */
  setSongChords: (id: string, stanzas: HymnStanza[] | null) => void;

  /** Post a message to a circle's discussion (optionally anchored to a reference, with rich attachments). */
  postCircleMessage: (code: string, text: string, context?: string, attachments?: MessageAttachment[]) => Promise<void>;
  /** Delete one of my own circle messages. */
  deleteCircleMessage: (code: string, msgId: string) => Promise<void>;
  /** Toggle a reaction on a prayer/note/message (same emoji clears it). */
  reactTo: (code: string, targetType: 'prayer' | 'note' | 'message', targetId: string, emoji: string) => Promise<void>;
  /** Adopt a partner's reflection into your own notes (attributed). Returns the new doc id. */
  adoptReflection: (text: string, byName: string, ref?: string) => string;
  /** Adopt a partner's verse into your library (hydrated); optionally into today's journal. */
  adoptVerse: (ref: string, toJournal?: boolean) => Promise<void>;
  addPrayer: (code: string, text: string) => Promise<void>;
  prayForRequest: (code: string, prayerId: string) => Promise<void>;
  answerPrayer: (code: string, prayerId: string, answerNote?: string) => Promise<void>;
  reopenPrayer: (code: string, prayerId: string) => Promise<void>;
  editPrayer: (code: string, prayerId: string, text: string) => Promise<void>;
  deletePrayer: (code: string, prayerId: string) => Promise<void>;
  togglePrayed: (code: string, prayer: Prayer) => Promise<void>;
  deleteChallenge: (code: string, chalId: string) => Promise<void>;
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
  lastActiveDay: null,
  dailyGoal: 5,
  reviewsToday: 0,
};

const defaultSettings: Settings = {
  translation: 'web',
  readerTranslation: 'kjv',
  reminderTime: null,
  theme: 'system',
  serverUrl: null,
  shareLibrary: true,
  onboarded: false,
};

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
    versesDone: versesDoneFrom(state.verses, sharedRefs),
    planDone: versesDoneFrom(state.verses, planRefs),
    memorizedRefs: share ? memorizedReferences(state.verses).slice(0, 400) : [],
    learningRefs: share ? learningReferences(state.verses).slice(0, 200) : [],
    lastActiveDay: state.stats.lastActiveDay,
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

/** Count today's review toward the daily goal (no streaks, no XP). */
function countReview(stats: Stats, now: number): Stats {
  const today = dayKey(now);
  return stats.lastActiveDay === today
    ? { ...stats, reviewsToday: stats.reviewsToday + 1 }
    : { ...stats, lastActiveDay: today, reviewsToday: 1 };
}

/**
 * Coerce stored documents to the current shape: retired doc types become plain
 * notes, and the dropped `folderId`/`shared` fields fall away. Never throws —
 * it runs inside `merge`.
 */
function normalizeDocs(docs: Record<string, Doc> | undefined): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (const [id, d] of Object.entries(docs ?? {})) {
    if (!d || typeof d !== 'object') continue;
    const legacy = d as Doc & { shared?: boolean };
    out[id] = {
      ...d,
      type: normalizeDocType(d.type),
      tags: Array.isArray(d.tags) ? d.tags : [],
      refs: Array.isArray(d.refs) ? d.refs : [],
      blocks: Array.isArray(d.blocks) ? d.blocks : [],
      // A doc that was explicitly shared stays visible; everything else keeps
      // whatever privacy flag it already had.
      private: d.private ?? (legacy.shared === true ? false : undefined),
    };
  }
  return out;
}

/** Topics are plain tags now — drop the retired description/reflections. */
function normalizeTopics(topics: Record<string, Topic> | undefined): Record<string, Topic> {
  const out: Record<string, Topic> = {};
  for (const [id, t] of Object.entries(topics ?? {})) {
    if (!t || typeof t !== 'object') continue;
    out[id] = {
      id: t.id ?? id,
      title: t.title ?? 'Untitled topic',
      entries: (Array.isArray(t.entries) ? t.entries : [])
        .filter((e) => e && typeof e.ref === 'string')
        .map((e) => ({ ref: e.ref, addedAt: e.addedAt ?? 0 })),
      createdAt: t.createdAt ?? 0,
      updatedAt: t.updatedAt ?? 0,
    };
  }
  return out;
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
      topics: {},
      documents: {},
      log: {},
      songs: {},
      songChords: {},
      favoriteSongs: [],
      session: { lastOpenedDay: null },
      reading: null,
      seenTips: [],
      pushToken: null,
      hydrated: false,
      pendingChatAttachment: null,
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
          // A near-perfect drill also counts as a review against the daily goal.
          return { verses, stats: accuracy >= 95 ? countReview(state.stats, now) : state.stats };
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
          return { verses, stats: countReview(state.stats, now) };
        }),

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

      setCircleName: async (code, name) => {
        const s = get();
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, meta: { ...c.meta, name: name.trim() || c.meta.name } }),
          () => circleApi.renameCircle(s.settings.serverUrl, code, s.profile.memberId, name.trim()),
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
        })),

      setReadingPosition: (book, chapter, verse) =>
        set({ reading: { book, chapter, verse, updatedAt: Date.now() } }),

      postCircleMessage: async (code, text, context, attachments) => {
        const s = get();
        const msgId = genLocalId();
        const atts = attachments?.length ? attachments.slice(0, 5) : undefined;
        const optimistic = { msgId, by: s.profile.memberId, byName: s.profile.displayName, text: text.trim(), context, attachments: atts, at: Date.now() };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, messages: [...(c.messages ?? []), optimistic] }),
          () => circleApi.postMessage(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, { msgId, text: text.trim(), context, attachments: atts }),
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

      adoptReflection: (text, byName, ref) => {
        const md = `${text}\n\n— ${byName || 'a partner'}`;
        const doc = emptyDoc('note', {
          title: ref ?? `From ${byName || 'a partner'}`,
          blocks: markdownToBlocks(md),
          anchorRef: ref,
          tags: ['adopted'],
        });
        doc.refs = extractRefs(doc);
        set((state) => ({ documents: { ...state.documents, [doc.id]: doc } }));
        return doc.id;
      },

      adoptVerse: async (ref, toLog = false) => {
        let text = '';
        try { text = (await getVerse(ref, 'kjv')).text; } catch { /* keep going with empty text */ }
        const fetched: FetchedVerse = { reference: ref, text, translation: 'kjv', translationName: translationName('kjv'), offline: false };
        get().addFetchedVerse(fetched);
        if (toLog) get().addLogEntry({ kind: 'verse', ref, title: ref });
      },

      createTopic: (title) => {
        const now = Date.now();
        const id = 't_' + now.toString(36) + Math.random().toString(36).slice(2, 8);
        const topic: Topic = {
          id,
          title: title.trim().slice(0, 80) || 'Untitled topic',
          entries: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ topics: { ...state.topics, [id]: topic } }));
        return id;
      },

      updateTopic: (id, title) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return {
            topics: {
              ...state.topics,
              [id]: { ...t, title: title.trim().slice(0, 80) || t.title, updatedAt: Date.now() },
            },
          };
        }),

      deleteTopic: (id) =>
        set((state) => {
          const next = { ...state.topics };
          delete next[id];
          return { topics: next };
        }),

      addToTopic: (id, ref) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: addTopicEntry(t, ref, Date.now()) } };
        }),

      removeFromTopic: (id, ref) =>
        set((state) => {
          const t = state.topics[id];
          if (!t) return {};
          return { topics: { ...state.topics, [id]: removeTopicEntry(t, ref, Date.now()) } };
        }),

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

      saveSong: (song, id) => {
        const stored = toUserSong(song, id && isMine(id) ? id : newSongId());
        set((state) => ({ songs: { ...state.songs, [stored.id]: stored } }));
        return stored.id;
      },

      deleteSong: (id) =>
        set((state) => {
          if (!isMine(id)) return {};
          const songs = { ...state.songs };
          delete songs[id];
          return { songs, favoriteSongs: state.favoriteSongs.filter((f) => f !== id) };
        }),

      toggleFavoriteSong: (id) =>
        set((state) => ({ favoriteSongs: toggleFavorite(state.favoriteSongs, id) })),

      setSongChords: (id, stanzas) =>
        set((state) => {
          const songChords = { ...state.songChords };
          if (stanzas && stanzas.length) songChords[id] = stanzas;
          else delete songChords[id];
          return { songChords };
        }),

      addLogEntry: (entry) => {
        const day = entry.day ?? dayKey();
        set((state) => ({ log: addLog(state.log, { ...entry, day }) }));
      },

      removeLogEntry: (id) => set((state) => ({ log: removeLog(state.log, id) })),

      setLogEntryPrivate: (id, isPrivate) =>
        set((state) => ({ log: setLogPrivate(state.log, id, isPrivate) })),

      setLogEntryText: (id, text) => set((state) => ({ log: setLogText(state.log, id, text) })),

      setPendingChatAttachment: (attachment) => set({ pendingChatAttachment: attachment }),

      runNotesMigration: () =>
        set((state) => {
          // The retired writing silos (journal, per-verse notes, "living it out",
          // topic reflections) were carried into `documents` on hydration; this
          // is the idempotent belt-and-braces pass for a restored backup.
          const legacy = (state as unknown as { __legacyWriting?: object }).__legacyWriting;
          if (!legacy) return {};
          const { documents, changed } = migrateDocs(state.documents, legacy);
          return changed ? { documents } : {};
        }),

      addPrayer: async (code, text) => {
        const s = get();
        const prayerId = genLocalId();
        const optimistic = { prayerId, text: text.trim(), by: s.profile.memberId, byName: s.profile.displayName, createdAt: Date.now(), status: 'active' as const, prayedByCount: 0, prayedByIds: [] as string[] };
        await optimisticCircle(set, get, code,
          (c) => ({ ...c, prayers: [optimistic, ...c.prayers] }),
          () => circleApi.addPrayer(s.settings.serverUrl, code, { memberId: s.profile.memberId, displayName: s.profile.displayName }, text.trim(), prayerId),
        );
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
          schema: 3,
          exportedAt: Date.now(),
          data: {
            verses: s.verses,
            stats: s.stats,
            settings: s.settings,
            profile: s.profile,
            circles: s.circles,
            studySessions: s.studySessions,
            topics: s.topics,
            documents: s.documents,
            log: s.log,
            songs: s.songs,
            songChords: s.songChords,
            favoriteSongs: s.favoriteSongs,
            session: s.session,
            reading: s.reading,
            seenTips: s.seenTips,
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
        set((state) => {
          // A backup written before the simplification still carries the retired
          // writing silos — carry them into documents rather than dropping them.
          const { documents } = migrateDocs(d.documents ?? state.documents, {
            notes: d.notes,
            applications: d.applications,
            journal: d.journal,
            topics: d.topics,
          });
          return {
            verses: d.verses ?? state.verses,
            stats: { ...defaultStats, ...(d.stats ?? {}) },
            settings: { ...defaultSettings, ...(d.settings ?? {}) },
            profile: { ...defaultProfile, ...(d.profile ?? {}) },
            circles: d.circles ?? state.circles,
            studySessions: d.studySessions ?? state.studySessions,
            topics: normalizeTopics(d.topics) ?? state.topics,
            documents: normalizeDocs(documents),
            log: d.log ?? state.log,
            songs: d.songs ?? state.songs,
            songChords: d.songChords ?? state.songChords,
            favoriteSongs: Array.isArray(d.favoriteSongs) ? d.favoriteSongs : state.favoriteSongs,
            session: d.session ?? state.session,
            reading: d.reading ?? state.reading,
            seenTips: Array.isArray(d.seenTips) ? d.seenTips : state.seenTips,
          };
        });
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
        studySessions: state.studySessions,
        topics: state.topics,
        documents: state.documents,
        log: state.log,
        songs: state.songs,
        songChords: state.songChords,
        favoriteSongs: state.favoriteSongs,
        session: state.session,
        reading: state.reading,
        seenTips: state.seenTips,
        pushToken: state.pushToken,
        lastCloudBackupAt: state.lastCloudBackupAt,
      }),
      // Never discard saved state on a version bump — pass it straight to merge,
      // which backfills any missing fields and carries retired slices forward.
      migrate: (persisted) => persisted as StoreState,
      merge: (persisted, current) => {
        // Hydration must NEVER throw — a corrupt or partial persisted blob
        // (including one written by a much older version) would otherwise crash
        // the app on launch. On any problem, fall back to defaults.
        try {
          const p = (persisted ?? {}) as Partial<StoreState> & Record<string, any>;
          const verses = p.verses && typeof p.verses === 'object' ? p.verses : {};
          // Existing users (they already have a profile or saved verses) should
          // NOT be sent back through first-run onboarding after this update.
          const isReturningUser = !!(p.profile?.memberId || Object.keys(verses).length > 0);
          // The simplification retired the journal, per-verse notes, topic
          // reflections and "living it out" as places to write. Nothing written
          // is lost: each is carried into `documents` here, once, before the
          // legacy slices are dropped on the next save.
          const { documents } = migrateDocs(
            (p.documents ?? {}) as Record<string, Doc>,
            { notes: p.notes, applications: p.applications, journal: p.journal, topics: p.topics },
          );
          return {
            ...current,
            ...p,
            stats: { ...defaultStats, ...(p.stats ?? {}) },
            settings: { ...defaultSettings, onboarded: isReturningUser, ...(p.settings ?? {}) },
            profile: { ...defaultProfile, ...(p.profile ?? {}) },
            circles: p.circles ?? {},
            studySessions: p.studySessions ?? {},
            topics: normalizeTopics(p.topics) ?? {},
            documents: normalizeDocs(documents),
            log: p.log ?? {},
            songs: p.songs ?? {},
            songChords: p.songChords ?? {},
            favoriteSongs: Array.isArray(p.favoriteSongs) ? p.favoriteSongs : [],
            session: { lastOpenedDay: null, ...(p.session ?? {}) },
            reading: p.reading ?? null,
            seenTips: Array.isArray(p.seenTips) ? p.seenTips : [],
            pushToken: p.pushToken ?? null,
            lastCloudBackupAt: p.lastCloudBackupAt ?? null,
            pendingChatAttachment: null,
            verses,
          } as StoreState;
        } catch {
          return current;
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

/**
 * The songbook slices, as one object for `src/data/songbook.ts`'s pure helpers.
 * Memoized so the identity is stable while nothing about the songbook changes.
 */
export function useSongbook(): SongbookState {
  const songs = useStore((state) => state.songs);
  const songChords = useStore((state) => state.songChords);
  const favoriteSongs = useStore((state) => state.favoriteSongs);
  return useMemo(() => ({ songs, songChords, favoriteSongs }), [songs, songChords, favoriteSongs]);
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

export function useReadingPosition() {
  return useStore((state) => state.reading);
}

/** The whole daily log (entry id → entry). */
export function useLog(): Record<string, LogEntry> {
  return useStore((state) => state.log);
}

/** One day's log entries, oldest first. */
export function useLogDay(day: string): LogEntry[] {
  const log = useLog();
  return useMemo(() => logEntriesForDay(log, day), [log, day]);
}

/** A single writing document by id. */
export function useDoc(id: string | undefined): Doc | undefined {
  return useStore((state) => (id ? state.documents[id] : undefined));
}

/** All documents, most-recently-updated first, optionally filtered by type. */
export function useDocList(filter?: { type?: DocType }): Doc[] {
  const documents = useStore((state) => state.documents);
  return useMemo(() => {
    const list = filter?.type
      ? Object.values(documents).filter((d) => d.type === filter.type)
      : Object.values(documents);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, filter?.type]);
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

