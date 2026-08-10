/**
 * Public-domain hymnal. Lyrics are ChordPro-style (chords in [brackets]); the
 * hymn view parses + transposes them (see src/utils/chords.ts). Every hymn links
 * to the Scripture behind it. All hymns here are public domain (authors d. 70+
 * years ago). Modern/copyrighted songs are never bundled — they're deep-linked
 * out (source: 'link'), and a licensed source (CCLI) can be added later.
 *
 * Chords are shown on the first stanza (the pattern repeats); more verses can be
 * added over time. Grow this from a public-domain source (e.g. openhymnal).
 */
export interface HymnStanza {
  kind: 'verse' | 'chorus' | 'refrain';
  label?: string;
  /** ChordPro lines: "A-[G]mazing [G7]grace". Plain lines (no brackets) are fine. */
  lines: string[];
}

export interface Hymn {
  id: string;
  title: string;
  author?: string;
  year?: string;
  /** Default key the chords are written in. */
  key: string;
  /** The Scripture behind the hymn (tappable → VersePeek/reader/memorize). */
  scriptureRefs: string[];
  /** "Listen" deep-link (YouTube search) — playback happens outside the app. */
  listenUrl?: string;
  /** External lyrics page for link-only (copyrighted, un-bundled) songs. */
  lyricsUrl?: string;
  language?: 'en' | 'ta';
  /** 'pd' public-domain; 'personal' privately-owned (bundled, non-commercial);
   * 'link' metadata + deep-link only; 'ccli' licensed (future). */
  source: 'pd' | 'personal' | 'link' | 'ccli';
  stanzas: HymnStanza[];
}

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' hymn')}`;

/** Hand-authored classics with chords + the Scripture behind them. */
const CURATED: Hymn[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    author: 'John Newton',
    year: '1779',
    key: 'G',
    scriptureRefs: ['Ephesians 2:8', 'John 9:25', '1 Chronicles 17:16'],
    listenUrl: yt('Amazing Grace'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        'A-[G]mazing grace! how [C]sweet the [G]sound',
        'That saved a wretch like [D]me!',
        'I [G]once was lost, but [C]now am [G]found,',
        'Was blind, but [D]now I [G]see.',
      ] },
      { kind: 'verse', label: '2', lines: [
        '’Twas grace that taught my heart to fear,',
        'And grace my fears relieved;',
        'How precious did that grace appear',
        'The hour I first believed!',
      ] },
      { kind: 'verse', label: '3', lines: [
        'Through many dangers, toils, and snares,',
        'I have already come;',
        '’Tis grace hath brought me safe thus far,',
        'And grace will lead me home.',
      ] },
    ],
  },
  {
    id: 'it-is-well',
    title: 'It Is Well With My Soul',
    author: 'Horatio Spafford',
    year: '1873',
    key: 'C',
    scriptureRefs: ['Isaiah 26:3', 'Romans 5:1', '2 Kings 4:26'],
    listenUrl: yt('It Is Well With My Soul'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        'When [C]peace like a river at-[F]tendeth my [C]way,',
        'When [G]sorrows like sea billows [G7]roll;',
        'What-[C]ever my lot, Thou hast [F]taught me to [C]say,',
        'It is [G]well, it is [C]well with my soul.',
      ] },
      { kind: 'refrain', lines: [
        'It is [C]well ([F]well) with my [C]soul ([G]with my soul),',
        'It is [C]well, it is [G]well with my [C]soul.',
      ] },
    ],
  },
  {
    id: 'holy-holy-holy',
    title: 'Holy, Holy, Holy',
    author: 'Reginald Heber',
    year: '1826',
    key: 'D',
    scriptureRefs: ['Revelation 4:8', 'Isaiah 6:3'],
    listenUrl: yt('Holy Holy Holy'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        '[D]Holy, holy, [A]holy! [D]Lord God Al-[A]mighty!',
        '[D]Early in the [G]morning our [D]song shall rise to [A]Thee;',
        '[D]Holy, holy, [A]holy! [D]merciful and [A]mighty!',
        '[G]God in [D]three [A]Persons, [D]blessed [A]Tri-[D]nity!',
      ] },
    ],
  },
  {
    id: 'come-thou-fount',
    title: 'Come Thou Fount of Every Blessing',
    author: 'Robert Robinson',
    year: '1758',
    key: 'D',
    scriptureRefs: ['1 Samuel 7:12', 'Psalms 86:12'],
    listenUrl: yt('Come Thou Fount of Every Blessing'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        '[D]Come, Thou Fount of [G]every [D]blessing,',
        'Tune my heart to [A]sing Thy [A7]grace;',
        '[D]Streams of mercy, [G]never [D]ceasing,',
        'Call for songs of [A]loudest [D]praise.',
      ] },
    ],
  },
  {
    id: 'when-i-survey',
    title: 'When I Survey the Wondrous Cross',
    author: 'Isaac Watts',
    year: '1707',
    key: 'D',
    scriptureRefs: ['Galatians 6:14', 'Philippians 3:7'],
    listenUrl: yt('When I Survey the Wondrous Cross'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        'When [D]I survey the [G]wondrous [D]cross',
        'On which the [A]Prince of [A7]glory [D]died,',
        'My richest gain I [G]count but [D]loss,',
        'And pour con-[A]tempt on [A7]all my [D]pride.',
      ] },
    ],
  },
  {
    id: 'rock-of-ages',
    title: 'Rock of Ages',
    author: 'Augustus Toplady',
    year: '1763',
    key: 'G',
    scriptureRefs: ['Exodus 33:22', '1 Corinthians 10:4', 'Isaiah 26:4'],
    listenUrl: yt('Rock of Ages'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        '[G]Rock of Ages, [C]cleft for [G]me,',
        'Let me [D]hide myself in [G]Thee;',
        'Let the water and the [C]blood,',
        'From Thy [D]wounded side which [G]flowed,',
        'Be of [C]sin the [G]double [D]cure,',
        'Save from [G]wrath and [D]make me [G]pure.',
      ] },
    ],
  },
  {
    id: 'blessed-assurance',
    title: 'Blessed Assurance',
    author: 'Fanny Crosby',
    year: '1873',
    key: 'D',
    scriptureRefs: ['Hebrews 10:22', '2 Timothy 1:12', 'Romans 8:16'],
    listenUrl: yt('Blessed Assurance'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        '[D]Blessed assurance, [A]Jesus is [D]mine!',
        'Oh, what a [G]foretaste of [D]glory di-[A]vine!',
        '[D]Heir of sal-[A]vation, [D]purchase of [G]God,',
        '[D]Born of His [A]Spirit, [D]washed in His [A]blood.',
      ] },
      { kind: 'chorus', lines: [
        'This is my [G]story, this is my [D]song,',
        'Praising my [A]Savior all the day [D]long;',
      ] },
    ],
  },
  {
    id: 'what-a-friend',
    title: 'What a Friend We Have in Jesus',
    author: 'Joseph Scriven',
    year: '1855',
    key: 'G',
    scriptureRefs: ['Proverbs 18:24', 'John 15:15', '1 Peter 5:7'],
    listenUrl: yt('What a Friend We Have in Jesus'),
    source: 'pd',
    stanzas: [
      { kind: 'verse', label: '1', lines: [
        '[G]What a friend we [C]have in [G]Jesus,',
        'All our sins and [D]griefs to [D7]bear!',
        '[G]What a privilege to [C]carry',
        'Everything to [D]God in [G]prayer!',
      ] },
    ],
  },
];

// Bulk public-domain library (Believers Hymn Book, lyrics-only) merged under the
// hand-authored, chorded classics. Deduped by title so the chorded version wins.
const BULK = require('../../assets/hymns/hymns.json') as Hymn[];
// The user's personal songbook (Tamil + English), built from assets/songs/*.songbook.txt.
const USER_SONGS = require('../../assets/songs/songs.json') as Hymn[];
const curatedTitles = new Set(CURATED.map((h) => h.title.toLowerCase()));
// User songs win over the bulk PD library on a title clash; curated chorded win over all.
const seenTitles = new Set(curatedTitles);
const merged: Hymn[] = [...CURATED];
for (const h of [...USER_SONGS, ...BULK]) {
  const key = h.title.toLowerCase();
  if (seenTitles.has(key)) continue;
  seenTitles.add(key);
  merged.push(h);
}
export const HYMNS: Hymn[] = merged;

/** True when a hymn has any chords (so the view can show transpose controls). */
export function hymnHasChords(h: Hymn): boolean {
  return h.stanzas.some((s) => s.lines.some((l) => l.includes('[')));
}

export function getHymn(id: string | undefined): Hymn | undefined {
  return id ? HYMNS.find((h) => h.id === id) : undefined;
}

/** Plain lyric text of a hymn (chords stripped) — for searching. */
function hymnText(h: Hymn): string {
  return h.stanzas
    .flatMap((s) => s.lines)
    .join(' ')
    .replace(/\[[^\]]*\]/g, '')
    .toLowerCase();
}

/** Search hymns by title, author, or a line of lyrics (all query words must match). */
export function searchHymns(query: string): Hymn[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return HYMNS;
  return HYMNS.filter((h) => {
    const hay = `${h.title} ${h.author ?? ''} ${hymnText(h)}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

// ---- Bidirectional verse ↔ hymn index ------------------------------------

/** Normalize a reference to `book chapter:verse` (lowercased, single-spaced). */
function normRef(ref: string): string {
  return ref.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The `book chapter` prefix of a reference (for same-chapter matching). */
function chapterOf(ref: string): string {
  const n = normRef(ref);
  const colon = n.indexOf(':');
  return colon === -1 ? n : n.slice(0, colon);
}

export interface HymnRefMatch {
  hymn: Hymn;
  /** 'exact' when the verse itself is listed; 'chapter' when only the chapter matches. */
  precision: 'exact' | 'chapter';
}

/**
 * The GROUNDED tier of "songs from this verse": bundled public-domain hymns whose
 * declared `scriptureRefs` include this reference (exact) or its chapter. These
 * are real, in-app, and tappable — no AI, no guessing. Exact matches first.
 */
export function hymnsForRef(reference: string): HymnRefMatch[] {
  const target = normRef(reference);
  const targetChapter = chapterOf(reference);
  const out: HymnRefMatch[] = [];
  for (const h of HYMNS) {
    let precision: 'exact' | 'chapter' | null = null;
    for (const r of h.scriptureRefs ?? []) {
      const nr = normRef(r);
      if (nr === target) { precision = 'exact'; break; }
      if (chapterOf(r) === targetChapter) precision = 'chapter';
    }
    if (precision) out.push({ hymn: h, precision });
  }
  return out.sort((a, b) => (a.precision === b.precision ? 0 : a.precision === 'exact' ? -1 : 1));
}

/** Loose comparison key for a hymn/song title (drops punctuation + filler words). */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|o|of|and|my|thy|thou|is|with|to|in)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Link an AI-suggested song title back to a bundled hymn, so a suggestion the
 * library actually contains opens in-app instead of a web search. Exact-ish
 * title match only (no fuzzy false-positives).
 */
export function matchHymnByTitle(title: string): Hymn | undefined {
  const key = titleKey(title);
  if (!key) return undefined;
  return (
    HYMNS.find((h) => titleKey(h.title) === key) ??
    HYMNS.find((h) => {
      const hk = titleKey(h.title);
      return hk.length > 6 && (hk.includes(key) || key.includes(hk));
    })
  );
}
