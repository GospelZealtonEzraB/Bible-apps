export type VerseStatus = 'new' | 'learning' | 'memorized' | 'reviewing';

export type DrillMode = 'flashcard' | 'vanish' | 'firstletter' | 'blank' | 'choice' | 'speed';

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
  /** Day key (YYYY-MM-DD) of the most recent day a verse was reviewed. */
  lastActiveDay: string | null;
  /** Target number of reviews per day. */
  dailyGoal: number;
  /** Reviews completed on `lastActiveDay`. */
  reviewsToday: number;
}

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
  | 'recite'      // say it back from memory
  | 'meaning'     // put it in your own words
  | 'study';      // share one insight from studying it

/** One member's score in a duel (both players recite the same verse). */
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
  /** The circle's shared reading plan id (auto-advances by date), if chosen. */
  readingPlanId?: string | null;
  /** When the shared reading plan was started (ms) — day-for-today derives from it. */
  readingPlanStartedAt?: number | null;
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
  versesDone: string[];
  planDone: string[];
  /** Deduped references this member has memorized (empty if they opt out). */
  memorizedRefs?: string[];
  /** References currently in progress (learning/reviewing). */
  learningRefs?: string[];
  lastActiveDay: string | null;
  updatedAt: number;
}

/**
 * What a partner publishes for the other to look through: their notes, the
 * songs they've starred, and the topics they're gathering. Private items never
 * make it into a shelf — it is built from public items only.
 */
export interface MemberShelf {
  memberId: string;
  displayName: string;
  notes: Doc[];
  songs: { id: string; title: string; author?: string }[];
  topics: { id: string; title: string; refs: string[] }[];
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
  // Atomic "at a glance" fields (scannable law) — optional for back-compat with
  // briefs cached before these were added.
  speaker?: string;
  audience?: string;
  where?: string;
  when?: string;
  occasion?: string;
  genre?: string;
  oneLine?: string;
}
/** A cited history/geography/culture item for a passage (from Wikipedia). */
export interface StudyContextItem {
  title: string;
  kind: 'person' | 'place' | 'event' | 'concept';
  extract: string;
  url: string;
  thumbnail?: string;
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

/** A discussion message in a circle. */
/**
 * A rich attachment on a chat message — the "Bible-study palette": a verse (with
 * its text snapshot), one of my notes (title + preview), or a song. Rendered as
 * a card in the bubble; a partner can peek/adopt it.
 */
export interface MessageAttachment {
  kind: 'verse' | 'note' | 'song';
  /** verse: the reference. note: an anchor ref if the note has one. */
  ref?: string;
  /** note/song: the title. */
  title?: string;
  /** verse: the verse text; note: a short preview. Capped server-side. */
  text?: string;
}

export interface Message {
  msgId: string;
  by: string;
  byName: string;
  text: string;
  /** Optional anchor (a verse/passage reference), or undefined for the general board. */
  context?: string;
  /** Rich attachments (verses, notes, songs) sent with the message. */
  attachments?: MessageAttachment[];
  at: number;
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
  messages?: Message[];
  /** Reactions grouped by "{targetType}:{targetId}" (prayer/note/message). */
  reactions?: Record<string, Reaction[]>;
  /** Each member's recent daily-log entries, keyed by memberId then entry id. */
  logs?: Record<string, Log>;
  /** Each member's published shelf (notes, favourite songs, topics), by memberId. */
  shelves?: Record<string, MemberShelf>;
}

/** One member's shared reflection on a circle's daily. */
export interface DailyReflection {
  by: string;
  byName: string;
  text: string;
  updatedAt: number;
}

/** The editable fields of a circle's shared devotional for a day. */
export interface CircleDaily {
  /** A hymn/song id for the day (from the songbook). */
  song?: string;
  /** The day's reading (a passage reference). */
  reading?: string;
  /** A shared prayer prompt for the day. */
  prayer?: string;
  /** A verse to carry (a reference). */
  verse?: string;
  /** A short note/theme from whoever set the day. */
  note?: string;
}

/** A day's shared devotional as returned in the snapshot (record + who's done + reflections). */
export interface CircleDailyDay extends CircleDaily {
  day: string;
  setBy?: string;
  setByName?: string;
  updatedAt?: number;
  /** Member ids who marked the day complete. */
  doneByIds: string[];
  /** Shared reflections for the day (newest first). */
  reflections: DailyReflection[];
  /** Per-member shared verses/songs for the day (the "Our devotions" window). */
  shares?: DailyShare[];
}

/** A member's shared verses/songs for a day. */
export interface DailyShare {
  by: string;
  byName: string;
  verses: string[];
  songs: string[];
  updatedAt: number;
}

/** A lightweight reaction (amen/💡/❤️) on a prayer, note, or message. */
export interface Reaction {
  emoji: string;
  by: string;
  byName: string;
}

/** A circle cached on the device (snapshot + local bookkeeping). */
export type Circle = CircleSnapshot & {
  joinedAt: number;
  lastSyncedAt: number | null;
};

// ===========================================================================
// Notes / Writing — the block-document model (the Notion/Evernote pillar).
// One document type unifies journal, study notes, verse notes, topics, and
// long-form (sermon/article). Everything is a Doc of Blocks; inline Scripture
// references stay linkable (rendered via linkifyReferences); blocks carry the
// structure (headings, lists, todo, quote, callout, toggle, divider).
// ===========================================================================

export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'toggle'
  | 'divider';

/**
 * One block in a document. `text` is plain text with two rendered layers on top:
 * inline Scripture references (auto-linked → peekable) and lightweight inline
 * marks (`**bold**`, `*italic*`) rendered in read mode. Block-type props:
 * `checked` (todo), `collapsed` + `detail` (toggle body).
 */
export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** todo: whether it's checked. */
  checked?: boolean;
  /** toggle: whether the detail is hidden. */
  collapsed?: boolean;
  /** toggle: the collapsible body text (rendered like a paragraph). */
  detail?: string;
}

/** The kinds of thing that can land in a daily log. */
export type LogKind = 'verse' | 'passage' | 'note' | 'song' | 'teaching' | 'topic' | 'text';

/**
 * One entry in the daily log — a dated pointer to something you did with God.
 * `ref` carries Scripture kinds; `assetId` carries note/song/teaching/topic ids;
 * `text` is either a free line (kind 'text') or an optional aside on any entry.
 * Entries are visible to your covenant partner unless `private` is set.
 */
export interface LogEntry {
  id: string;
  /** Local day key, YYYY-MM-DD. */
  day: string;
  kind: LogKind;
  /** Scripture reference, for 'verse' and 'passage' entries. */
  ref?: string;
  /** Id of the note / song / teaching / topic this points at. */
  assetId?: string;
  /** Display title captured at log time, so the entry reads well even if the asset changes. */
  title?: string;
  /** A free line, or a short aside on an asset entry. */
  text?: string;
  /** Kept off your partner's view. */
  private?: boolean;
  createdAt: number;
}

export type Log = Record<string, LogEntry>;

/**
 * What a document *is*. Three kinds only — the journal / verse-note / topic /
 * article silos were folded into plain notes by the simplification, and any
 * legacy value is coerced to 'note' on hydration (`normalizeDocType`).
 */
export type DocType =
  | 'note'      // anything you write (optionally anchored to a reference)
  | 'study'     // saved output of a passage study
  | 'sermon';   // teaching notes from a message

/**
 * A single document — the one unit that replaces the old journal-entry,
 * topic-reflection, per-verse-note, and application silos. Holds a title, an
 * ordered list of blocks, tags, and a derived list of referenced verses (for
 * backlinks / "notes on this verse").
 */
export interface Doc {
  id: string;
  type: DocType;
  title: string;
  blocks: Block[];
  /** Free-form tags for organization/search. */
  tags: string[];
  /** Scripture references this doc links to (derived from blocks + anchor). */
  refs: string[];
  /** The reference/passage this doc is anchored to, when it has one. */
  anchorRef?: string;
  /** Kept off your partner's shelf when true. */
  private?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A notebook/folder for grouping documents. */

// ---- Custom study topics (tag-as-you-read) --------------------------------

/** One verse tagged into a topic, with an optional "why this fits" note. */
export interface TopicEntry {
  /** Canonical display reference, e.g. "1 Thessalonians 4:16". */
  ref: string;
  addedAt: number;
}

/**
 * A named tag over verses — "The Rapture", "Grace", "Names of God". Nothing but
 * a title and the references gathered under it; writing lives in Notes.
 */
export interface Topic {
  /** Stable local id (`t_…`). */
  id: string;
  title: string;
  /** Verses tagged into this topic (newest first as stored). */
  entries: TopicEntry[];
  createdAt: number;
  updatedAt: number;
}

/** LEGACY (migration only — the journal was retired). A note captured during the day (often while reading), attached to a journal day. */
export interface JournalNote {
  /** Stable local id (`jn_…`). */
  id: string;
  /** Optional Scripture reference this note is about (tappable in the timeline). */
  ref?: string;
  text: string;
  createdAt: number;
}

/**
 * One day's private journal entry — the heart of the journaling product. Keyed by
 * local day (YYYY-MM-DD). Holds the day's reflection ("what He showed me"), the
 * verse carried, a gratitude line, and the notes taken while reading. Local-only
 * (Personal Space); a member may separately *share* the reflection to a circle's
 * daily, but this record never leaves the device.
 */
export interface JournalEntry {
  /** Local day key, YYYY-MM-DD. */
  day: string;
  /** Free reflection on the day — "what He showed me". */
  reflection?: string;
  /** The verse/passage carried through the day (a reference). */
  verse?: string;
  /** Optional thanksgiving line. */
  gratitude?: string;
  /** Notes captured during the day (e.g. while reading). */
  notes: JournalNote[];
  createdAt: number;
  updatedAt: number;
}

/** Per-circle personalization + control (client-side, keyed by circle code). */
export interface CirclePref {
  /** Accent color (hex) that personalizes this circle's screens. */
  accent?: string;
  /** A one/two-emoji identity shown in the home header + tiles. */
  emoji?: string;
  /** Drill-in tiles hidden from this circle's home grid. */
  hiddenTiles?: string[];
  /** Sharing level for THIS circle, overriding the global setting.
   * 'full' shares memorized/learning ref lists; 'counts' shares counts only. */
  sharing?: 'full' | 'counts';
  /** Silence this circle's push notifications (enforced server-side later). */
  muted?: boolean;
}

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
