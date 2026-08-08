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

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  translation: string;
  /** 'HH:MM' 24h local time for the daily reminder, or null if disabled. */
  reminderTime: string | null;
  theme: ThemePreference;
}
