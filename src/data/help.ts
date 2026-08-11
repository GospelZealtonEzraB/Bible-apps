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
    title: 'Your day',
    tip: 'This is your log — what you actually did with God today, kept in your own words.',
    what: 'Anything in the app can be added to the day with one tap: a passage you read, a verse you saved, a note you wrote, a song you sang, a message you sat under. Today shows that, plus anything due for review.',
    example: 'Read Psalm 23, tap “Add to my log”, and it’s there. Add a line of your own about what He showed you.',
    tips: [
      'Your partner sees your log unless you long-press an entry and keep it private.',
      'There’s no streak to protect — the log is a record, not a score.',
    ],
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
    title: 'Gather a theme',
    tip: 'A topic is a tag over verses — “Grace”, “Names of God”, “Waiting on Him”.',
    what: 'Tag any verse into a topic as you read, and the topic collects them in Bible order. Writing lives in Notes; a topic only gathers Scripture.',
    example: 'Studying grace? Tag Ephesians 2:8 and Titus 2:11 into “Grace”, then share the whole set to your partner.',
    tips: ['Add to a topic from any verse’s action menu.', 'Long-press a verse in a topic to take it back out.'],
    mood: 'content',
  },
  hymns: {
    title: 'Sing the Word',
    tip: 'One songbook: classic hymns, the songs your family sings, and the web — with chords, transpose, and the Scripture behind each one.',
    what: 'Hundreds of public-domain hymns come bundled. Add your own songs (Tamil too) and they are searchable, singable, and shareable like any other.',
    example: '“It Is Well” links to Isaiah 26:3 — tap the reference to peek at it without leaving the song.',
    tips: [
      'Use –/+ to transpose to your key.',
      'No chords on a hymn? Write your own — the original is always one tap away.',
      '“Sing this today” ticks your walk and shares the song with your partner.',
    ],
    mood: 'love',
  },
  sermon: {
    title: 'Turn a message into study',
    tip: 'Paste a YouTube/article link or a transcript — I’ll take notes on the whole message and pull out every verse it cites.',
    what: 'Teaching notes gives you the message’s outline, the points worth remembering, every Scripture reference, and one way to live it out. Save it to Notes and it’s yours to edit and keep.',
    example: 'Paste a sermon link → an outline, key points, chips like “Romans 12:1”, and a “Living it out” line → Save to Notes.',
    tips: [
      'A long message is read in sections, so a full sermon isn’t cut short.',
      'Articles read best; YouTube needs captions — if it can’t read a video, paste the transcript.',
      'The notes are Ember’s words, never a copy of the message.',
    ],
    mood: 'thinking',
  },
  practice: {
    title: 'Practise what you’re learning',
    tip: 'One place to review: what’s due comes first, then practise anything you like.',
    what: 'Practice runs the verses spaced repetition says are ready, so each one comes back just as you’d start to forget it.',
    example: 'Two verses due? Practice walks you through them in a minute or two.',
    tips: ['Six drill modes live on each verse’s screen.', 'Nothing due is fine — you can still practise anything.'],
    mood: 'excited',
  },
  together: {
    title: 'One partner, walking with you',
    tip: 'Two are better than one. Invite one person and you’ll see each other’s days.',
    what: 'You each keep your own reading, notes and songs — and each other’s log and shelf are open to look through, unless something is marked private.',
    example: 'Start a partnership, send them the six-character code, and their walk appears beside yours.',
    tips: ['Tap their name at the top of the chat to see their log and shelf.', 'Anything of theirs can be taken into your own library with one tap.'],
    mood: 'proud',
  },
  discussion: {
    title: 'Where you talk',
    tip: 'Everything together happens here — talk, pray, share a verse, set a challenge.',
    what: 'The chat is the whole partnership. Tap ＋ to bring in a verse, a note, a song, a prayer request or a challenge; type a reference like John 3:16 and it becomes tappable.',
    example: 'Share the passage that struck you this morning, and talk about it right there.',
    tips: [
      'Your covenant stays pinned at the top — tap it to edit.',
      'Long-press your own message to delete it.',
      'Keep it reverent — it’s Scripture you’re handling together.',
    ],
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
  'practice',
  'topics',
  'hymns',
  'sermon',
  'together',
  'discussion',
];
