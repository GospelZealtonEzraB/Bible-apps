export type VerseStatus = 'new' | 'learning' | 'memorized' | 'reviewing';

export type DrillMode = 'flashcard' | 'vanish' | 'firstletter' | 'blank';

/** SM-2 spaced-repetition scheduling state for a single verse. */
export interface SRSState {
  /** Number of consecutive successful recalls. */
  repetitions: number;
  /** Current interval in days until the next review. */
  interval: number;
  /** Ease factor (>= 1.3); higher means the verse is easier to recall. */
  easeFactor: number;
  /** Epoch ms when the verse is next due for review. */
  dueDate: number;
  /** Epoch ms of the last review, if any. */
  lastReviewed?: number;
}

export interface Verse {
  /** Stable id: `${translation}:${normalizedReference}`. */
  id: string;
  reference: string;
  text: string;
  translation: string;
  translationName?: string;
  dateAdded: number;
  status: VerseStatus;
  /** Id of the starter pack this verse came from, if any. */
  packId?: string;
  srs: SRSState;
  /** 0..100 confidence derived from drills and reviews. */
  mastery: number;
  /** Cached AI memory hook for this verse (generated once, on demand). */
  memoryHook?: string;
  /** Cached AI plain-English meaning + context. */
  explanation?: string;
}

export interface Stats {
  /** Consecutive days with at least one review/drill. */
  streak: number;
  /** Day key (YYYY-MM-DD) of the most recent active day. */
  lastActiveDay: string | null;
  /** Target number of reviews per day. */
  dailyGoal: number;
  /** Reviews completed on `lastActiveDay`. */
  reviewsToday: number;
  /** Longest streak ever reached. */
  bestStreak: number;
  /** Total experience points earned. */
  xp: number;
  /** "Streak freeze" tokens that protect a streak across a missed day. */
  graceTokens: number;
  /** Ids of badges the user has earned. */
  earnedBadges: string[];
  /** Count of 100%-accuracy recitations (drives the Word-Perfect badge). */
  perfectRecitations: number;
  /** Count of reviews completed before 7am (drives the Early Light badge). */
  earlyReviews: number;
  /** Today's quest counters (reset when the day changes). */
  daily: DailyProgress;
}

export interface DailyProgress {
  /** Day key (YYYY-MM-DD) these counters belong to. */
  day: string;
  reviews: number;
  drills: number;
  /** Drills scored 90%+ today. */
  perfect: number;
  added: number;
  /** Whether the all-quests-complete bonus was already awarded today. */
  questBonusClaimed: boolean;
}

/** Local anonymous identity for Growing Together (no accounts — see identity seam). */
export interface Profile {
  /** Stable device-minted id; the authoritative writer id for shared data. */
  memberId: string;
  /** Chosen name shown to circle partners. */
  displayName: string;
  /** Portable transfer code (equals memberId) to restore identity on a new phone. */
  backupCode: string;
}

// ---- Growing Together -----------------------------------------------------

export type ChallengeKind =
  | 'recite'
  | 'type'
  | 'fill'
  | 'reflection'
  | 'application'
  | 'study';

export interface CircleGoal {
  kind: 'memorizeCount' | 'sharedVerses' | 'streak';
  target: number;
  label?: string;
}

/** A partnership agreement: an agreed rhythm + goal both hold each other to. */
export interface Covenant {
  cadenceLabel: string;
  goalText: string;
  /** memberIds who have agreed to it. */
  agreedBy: string[];
}

export interface CircleMeta {
  code: string;
  name: string;
  goal: CircleGoal | null;
  covenant: Covenant | null;
  createdAt: number;
  ownerMemberId: string;
  version: number;
  /** Consecutive days every member was active (server-computed). */
  togetherStreak: number;
  lastTogetherDay: string | null;
}

export type ActivityType =
  | 'memorized'
  | 'reviewed'
  | 'added'
  | 'studied'
  | 'prayed'
  | 'challenge'
  | 'read'
  | 'noted';

export interface Activity {
  type: ActivityType;
  ref?: string;
  at: number;
}

/** Back-compat alias for a single recent activity. */
export type MemberActivity = Activity;

/** A transient milestone shown in the full-screen celebration overlay. */
export interface CelebrationEvent {
  /** Small uppercase eyebrow, e.g. "VERSE MEMORIZED". */
  eyebrow: string;
  title: string;
  subtitle: string;
  emoji: string;
}

export interface CircleMember {
  id: string;
  displayName: string;
  memorizedCount: number;
  streak: number;
  versesDone: string[];
  planDone: string[];
  /** Deduped references this member has memorized (empty if they opt out). */
  memorizedRefs?: string[];
  /** References currently in progress (learning/reviewing). */
  learningRefs?: string[];
  bestStreak?: number;
  xp?: number;
  /** Rolling last-10 events for the shared activity feed. */
  recentActivity?: Activity[];
  lastActiveDay: string | null;
  lastActivity?: Activity | null;
  updatedAt: number;
}

export interface SharedVerseRef {
  reference: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
  /** memberId this verse was picked for, if any ("I chose this for you"). */
  forMemberId?: string;
}

export interface StudyPlan {
  planId: string;
  title: string;
  items: string[];
  createdBy: string;
  createdAt: number;
}

export interface Prayer {
  prayerId: string;
  text: string;
  by: string;
  byName: string;
  createdAt: number;
  status: 'active' | 'answered';
  answeredAt?: number;
  answerNote?: string;
  prayedByCount: number;
  prayedByIds?: string[];
  didIPray?: boolean;
}

export type NoteScope = 'verse' | 'passage' | 'free';

/** A note shared into a circle (visible to all members). */
export interface Note {
  noteId: string;
  by: string;
  byName: string;
  scope: NoteScope;
  ref?: string;
  text: string;
  updatedAt: number;
}

/** A private note kept only on this device. */
export interface LocalNote {
  noteId: string;
  scope: NoteScope;
  ref?: string;
  text: string;
  updatedAt: number;
}

export interface ChallengeSubmission {
  by: string;
  text: string;
  accuracy?: number;
  submittedAt: number;
}

export interface ChallengeReview {
  by: string;
  note: string;
  meaningPrompt?: string;
  at: number;
}

export interface Challenge {
  chalId: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  reference: string;
  kind: ChallengeKind;
  createdAt: number;
  status: 'pending' | 'submitted' | 'reviewed';
  submission?: ChallengeSubmission;
  review?: ChallengeReview;
}

// ---- AI study ----

export interface StudyCharacter {
  name: string;
  insight: string;
}
export interface StudyWord {
  term: string;
  language: string;
  insight: string;
}
export interface StudyBrief {
  summaryBefore: string;
  setting: string;
  characters: StudyCharacter[];
  speakerAudience: string;
  location: string;
  background: string;
  discussionQuestions: string[];
  wordStudy: StudyWord[];
  crossReferences: string[];
}
export interface StudySession {
  passage: string;
  passageKey: string;
  brief: StudyBrief;
  fetchedAt: number;
}
/** Where the reader left off, so "Continue reading" can resume. */
export interface ReadingPosition {
  /** Canonical book number (1..66). */
  book: number;
  chapter: number;
  /** Optional verse the reader last focused. */
  verse?: number;
  updatedAt: number;
}

/** "One thing I'll live out this week" captured after a study. */
export interface StudyApplication {
  passageKey: string;
  passage: string;
  text: string;
  createdAt: number;
  revisitedAt?: number;
  outcome?: string;
}

/** The full shared state of a circle, as returned by the server. */
export interface CircleSnapshot {
  /** Server API version (for stale-server detection). */
  apiVersion?: number;
  meta: CircleMeta;
  members: CircleMember[];
  sharedVerses: SharedVerseRef[];
  plans: StudyPlan[];
  notes: Note[];
  prayers: Prayer[];
  challenges: Challenge[];
  cheersFor: Record<string, number>;
}

/** A circle cached on the device (snapshot + local bookkeeping). */
export type Circle = CircleSnapshot & {
  joinedAt: number;
  lastSyncedAt: number | null;
};

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  translation: string;
  /** Translation used in the Bible reader (defaults to the offline KJV core). */
  readerTranslation: string;
  /** 'HH:MM' 24h local time for the daily reminder, or null if disabled. */
  reminderTime: string | null;
  theme: ThemePreference;
  /** Deployed Worker URL that powers AI features + ESV, or null if unset. */
  serverUrl: string | null;
  /** Share which verses I've memorized/am learning with my circles. */
  shareLibrary: boolean;
  /** Has the first-run onboarding flow been completed (or skipped)? */
  onboarded: boolean;
}
