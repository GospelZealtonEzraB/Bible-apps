/**
 * "Ember Guide" content — a plain-language explainer for each feature, shown in
 * the HelpSheet (an ⓘ button) and as first-run EmberTip coach cards. Keep the
 * tone warm and reverent (Ember never flippant about Scripture). Content only —
 * no components — so it's easy to grow and could be localized later.
 */
import type { EmberMood } from '@/components/Ember';

export interface HelpEntry {
  /** Short title shown at the top of the sheet. */
  title: string;
  /** One warm line, in Ember's voice, for the first-run tip + sheet intro. */
  tip: string;
  /** What this feature is (1–2 sentences). */
  what: string;
  /** A concrete example the believer can picture. */
  example?: string;
  /** A few quick "how to use it" pointers. */
  tips?: string[];
  mood?: EmberMood;
}

export const HELP: Record<string, HelpEntry> = {
  today: {
    title: 'Your day, at a glance',
    tip: 'Welcome back! This is home base — your reviews, your streak, and where you left off.',
    what: 'The Today screen gathers what matters now: verses due for review, your streak, and quick ways back into reading and study.',
    example: 'Tap "Review" to run today’s due verses, or pick up reading right where you stopped.',
    tips: ['Reviewing daily keeps your streak alive.', 'A grace token quietly protects your streak if you miss a day.'],
    mood: 'waving',
  },
  reader: {
    title: 'Read the Word',
    tip: 'Tap any verse to memorize, study, note it, or add it to a topic. Long-press to select several.',
    what: 'The Bible reader is offline-first (KJV bundled). Tap a verse for its action menu; switch translations up top.',
    example: 'Reading John 3? Tap verse 16 → “Memorize this verse,” or long-press verses 16–17 → “Add to a topic.”',
    tips: ['Long-press a verse to start a multi-select, then tag the whole passage to a topic.', 'The offline badge means you can read with no connection.'],
    mood: 'reading',
  },
  search: {
    title: 'Find it by meaning',
    tip: 'Search by idea, not just words — try “anxiety” or “God’s faithfulness.”',
    what: 'Search finds verses by concept (online) and falls back to keyword search (offline), so meaning-based questions still land.',
    example: 'Type “worry” and you’ll get Philippians 4:6–7 and Matthew 6 — even without those exact words.',
    tips: ['Tap a result to read, memorize, study, or share it.', 'Offline, search matches keywords in the bundled KJV.'],
    mood: 'thinking',
  },
  study: {
    title: 'Set the scene',
    tip: 'Give me any scope — a verse, a range, a chapter, several chapters, a book, or a list.',
    what: 'Study builds a grounded brief for a passage: what came before, the setting, who’s speaking to whom, key words, and questions. It never quotes Scripture — the text comes from your Bible.',
    example: 'Enter “Romans 8” for a chapter, “John 3:1-21” for a range, or “Philippians” for the whole book.',
    tips: ['Use a semicolon for a list: “Romans 8:28; John 3:16.”', 'AI insight is a study aid — always weigh it against the Word.'],
    mood: 'reading',
  },
  topics: {
    title: 'Gather a study',
    tip: 'Collect verses on a theme as you read, add your thoughts, and compose it into a message or journal.',
    what: 'Topics are your study threads — tag verses from anywhere, write free-form thoughts, then Compose & share the whole thing.',
    example: 'Studying “grace”? Tag verses as you read, jot reflections, then “Compose & share” to draft a devotional or journal entry.',
    tips: ['Add to a topic from any verse’s action menu.', '“Memorize all” drops a whole topic into your library.'],
    mood: 'content',
  },
  hymns: {
    title: 'Sing the Word',
    tip: 'Public-domain hymns with lyrics, chords, and transpose — and the Scripture behind each one.',
    what: 'The hymnal is classic, public-domain songs. Tap a hymn for lyrics + chords you can transpose, and the verses that inspired it.',
    example: '“It Is Well” links to Isaiah 26:3 — tap the reference to peek at it without leaving the song.',
    tips: ['Use –/+ to transpose to your key.', 'From a verse, try “Songs from this verse” to find hymns it inspired.'],
    mood: 'love',
  },
  sermon: {
    title: 'Turn a message into study',
    tip: 'Paste a YouTube/article link or a transcript — I’ll summarize it and pull out every verse it cites.',
    what: 'Sermon notes gives an original summary and extracts the Scripture references, so you can study or memorize what the message covered.',
    example: 'Paste a sermon link → get a summary + chips like “Romans 12:1” you can tap to study or memorize.',
    tips: ['Articles read best; YouTube needs captions — if it can’t read a video, paste the transcript.', 'The summary is Ember’s words, never a copy of the message.'],
    mood: 'thinking',
  },
  quiz: {
    title: 'Test your memory',
    tip: 'Quiz across your verses — the reference is hidden, so you recall from the words.',
    what: 'Quiz mode pulls random verses from your library (or beyond) and challenges your recall in different ways.',
    example: 'See a verse with its reference hidden and name it, or fill in the blanks against the clock.',
    tips: ['Turn on Timed for a challenge.', 'Duel a circle partner on the same verse to compare scores.'],
    mood: 'excited',
  },
  together: {
    title: 'Grow together',
    tip: 'This is the heart of Versed — a circle of believers who keep each other in the Word.',
    what: 'A circle shares progress, verses, plans, prayers, notes, challenges, and discussion. Anyone with the 6-character code can join.',
    example: 'Create a circle, share the code with a friend, and you’ll each see the other’s streak, memorized verses, and encouragements.',
    tips: ['Tap a tile to open that area — People, Study, Prayer, Challenges, Discussion.', 'In Settings you can personalize the circle and choose what you share.'],
    mood: 'proud',
  },
  circleHome: {
    title: 'Your circle',
    tip: 'Tap a tile to dive in. The home shows presence, this week, and what’s happening.',
    what: 'The circle home is a compact overview; each tile opens its area full-screen so nothing feels overwhelming.',
    example: '“Prayer” shows a 2 when two requests are active; “Challenges” badges when something’s waiting on you.',
    tips: ['“Personalize this circle” (Settings) sets an accent, emoji, and what you share here.', 'Presence shows who’s had their time today.'],
    mood: 'content',
  },
  discussion: {
    title: 'Talk it through',
    tip: 'Type a reference like John 3:16 and it becomes a tappable link for everyone.',
    what: 'Discussion is your circle’s room to talk about what you’re studying. References auto-link so anyone can peek the verse.',
    example: 'Write “this connects to Romans 5:1” — the reference turns into a link the whole circle can tap.',
    tips: ['Long-press your own message to delete it.', 'Keep it reverent — it’s Scripture you’re handling together.'],
    mood: 'love',
  },
  memorize: {
    title: 'Hide it in your heart',
    tip: 'Every verse you save enters a gentle review schedule so it truly sticks.',
    what: 'Your library holds the verses you’re learning. Spaced review (SM-2) resurfaces each one just as you’re about to forget it.',
    example: 'Add Psalm 23:1 today; it’ll come back for review tomorrow, then in a few days, then weeks — until it’s memorized.',
    tips: ['Drills (flashcard, vanish, first-letter…) make practice stick.', 'A verse becomes “memorized” once its interval is long enough.'],
    mood: 'proud',
  },
};

export function getHelp(topic: string): HelpEntry | undefined {
  return HELP[topic];
}

/** Display order for the Help hub, grouped roughly by daily flow. */
export const HELP_ORDER: string[] = [
  'today',
  'reader',
  'search',
  'study',
  'memorize',
  'quiz',
  'topics',
  'hymns',
  'sermon',
  'together',
  'circleHome',
  'discussion',
];
