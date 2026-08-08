/**
 * Canonical 66-book table (Protestant order, Genesis=1 … Revelation=66) plus a
 * reference parser. Used by providers that need a structured reference (book
 * number + chapter + verse), such as getbible, and reusable for API.Bible/ESV
 * range handling later.
 */

export interface BookInfo {
  /** Canonical book number, 1..66. */
  n: number;
  /** Canonical display name. */
  name: string;
  /** Common abbreviations / alternate spellings. */
  aliases: string[];
}

export const BOOKS: BookInfo[] = [
  { n: 1, name: 'Genesis', aliases: ['Gen', 'Ge', 'Gn'] },
  { n: 2, name: 'Exodus', aliases: ['Exod', 'Exo', 'Ex'] },
  { n: 3, name: 'Leviticus', aliases: ['Lev', 'Le', 'Lv'] },
  { n: 4, name: 'Numbers', aliases: ['Num', 'Nu', 'Nm', 'Nb'] },
  { n: 5, name: 'Deuteronomy', aliases: ['Deut', 'De', 'Dt'] },
  { n: 6, name: 'Joshua', aliases: ['Josh', 'Jos', 'Jsh'] },
  { n: 7, name: 'Judges', aliases: ['Judg', 'Jdg', 'Jg', 'Jdgs'] },
  { n: 8, name: 'Ruth', aliases: ['Rth', 'Ru'] },
  { n: 9, name: '1 Samuel', aliases: ['1Sam', '1Sa', '1S', 'ISam'] },
  { n: 10, name: '2 Samuel', aliases: ['2Sam', '2Sa', '2S', 'IISam'] },
  { n: 11, name: '1 Kings', aliases: ['1Kgs', '1Ki', '1K', 'IKgs'] },
  { n: 12, name: '2 Kings', aliases: ['2Kgs', '2Ki', '2K', 'IIKgs'] },
  { n: 13, name: '1 Chronicles', aliases: ['1Chr', '1Ch', 'IChr'] },
  { n: 14, name: '2 Chronicles', aliases: ['2Chr', '2Ch', 'IIChr'] },
  { n: 15, name: 'Ezra', aliases: ['Ezr', 'Ez'] },
  { n: 16, name: 'Nehemiah', aliases: ['Neh', 'Ne'] },
  { n: 17, name: 'Esther', aliases: ['Esth', 'Est', 'Es'] },
  { n: 18, name: 'Job', aliases: ['Jb'] },
  { n: 19, name: 'Psalms', aliases: ['Psalm', 'Ps', 'Psa', 'Pss', 'Pslm'] },
  { n: 20, name: 'Proverbs', aliases: ['Prov', 'Pr', 'Prv', 'Pro'] },
  { n: 21, name: 'Ecclesiastes', aliases: ['Eccl', 'Ec', 'Qoh', 'Eccles'] },
  {
    n: 22,
    name: 'Song of Solomon',
    aliases: ['Song', 'SoS', 'Song of Songs', 'Canticles', 'Cant'],
  },
  { n: 23, name: 'Isaiah', aliases: ['Isa', 'Is'] },
  { n: 24, name: 'Jeremiah', aliases: ['Jer', 'Je', 'Jr'] },
  { n: 25, name: 'Lamentations', aliases: ['Lam', 'La'] },
  { n: 26, name: 'Ezekiel', aliases: ['Ezek', 'Eze', 'Ezk'] },
  { n: 27, name: 'Daniel', aliases: ['Dan', 'Da', 'Dn'] },
  { n: 28, name: 'Hosea', aliases: ['Hos', 'Ho'] },
  { n: 29, name: 'Joel', aliases: ['Jl', 'Joe'] },
  { n: 30, name: 'Amos', aliases: ['Am', 'Amo'] },
  { n: 31, name: 'Obadiah', aliases: ['Obad', 'Ob'] },
  { n: 32, name: 'Jonah', aliases: ['Jon', 'Jnh'] },
  { n: 33, name: 'Micah', aliases: ['Mic', 'Mc'] },
  { n: 34, name: 'Nahum', aliases: ['Nah', 'Na'] },
  { n: 35, name: 'Habakkuk', aliases: ['Hab', 'Hb'] },
  { n: 36, name: 'Zephaniah', aliases: ['Zeph', 'Zep', 'Zp'] },
  { n: 37, name: 'Haggai', aliases: ['Hag', 'Hg'] },
  { n: 38, name: 'Zechariah', aliases: ['Zech', 'Zec', 'Zc'] },
  { n: 39, name: 'Malachi', aliases: ['Mal', 'Ml'] },
  { n: 40, name: 'Matthew', aliases: ['Matt', 'Mt'] },
  { n: 41, name: 'Mark', aliases: ['Mk', 'Mrk', 'Mr'] },
  { n: 42, name: 'Luke', aliases: ['Lk', 'Luk', 'Lu'] },
  { n: 43, name: 'John', aliases: ['Jn', 'Jhn', 'Joh'] },
  { n: 44, name: 'Acts', aliases: ['Ac', 'Act'] },
  { n: 45, name: 'Romans', aliases: ['Rom', 'Ro', 'Rm'] },
  { n: 46, name: '1 Corinthians', aliases: ['1Cor', '1Co', 'ICor'] },
  { n: 47, name: '2 Corinthians', aliases: ['2Cor', '2Co', 'IICor'] },
  { n: 48, name: 'Galatians', aliases: ['Gal', 'Ga'] },
  { n: 49, name: 'Ephesians', aliases: ['Eph', 'Ephes'] },
  { n: 50, name: 'Philippians', aliases: ['Phil', 'Php', 'Pp'] },
  { n: 51, name: 'Colossians', aliases: ['Col', 'Co'] },
  { n: 52, name: '1 Thessalonians', aliases: ['1Thess', '1Th', '1Thes', 'IThess'] },
  { n: 53, name: '2 Thessalonians', aliases: ['2Thess', '2Th', '2Thes', 'IIThess'] },
  { n: 54, name: '1 Timothy', aliases: ['1Tim', '1Ti', 'ITim'] },
  { n: 55, name: '2 Timothy', aliases: ['2Tim', '2Ti', 'IITim'] },
  { n: 56, name: 'Titus', aliases: ['Tit', 'Ti'] },
  { n: 57, name: 'Philemon', aliases: ['Phlm', 'Phm', 'Pm'] },
  { n: 58, name: 'Hebrews', aliases: ['Heb', 'Hb'] },
  { n: 59, name: 'James', aliases: ['Jas', 'Jm', 'Jam'] },
  { n: 60, name: '1 Peter', aliases: ['1Pet', '1Pe', '1P', 'IPet'] },
  { n: 61, name: '2 Peter', aliases: ['2Pet', '2Pe', '2P', 'IIPet'] },
  { n: 62, name: '1 John', aliases: ['1Jn', '1Jo', '1J', 'IJn'] },
  { n: 63, name: '2 John', aliases: ['2Jn', '2Jo', '2J', 'IIJn'] },
  { n: 64, name: '3 John', aliases: ['3Jn', '3Jo', '3J', 'IIIJn'] },
  { n: 65, name: 'Jude', aliases: ['Jud', 'Jd'] },
  { n: 66, name: 'Revelation', aliases: ['Rev', 'Re', 'Rv', 'Apocalypse'] },
];

/** Normalize a book token for matching: lowercase, drop spaces and periods. */
function normBook(s: string): string {
  return s.toLowerCase().replace(/[\s.]/g, '');
}

const BOOK_LOOKUP: Record<string, BookInfo> = (() => {
  const map: Record<string, BookInfo> = {};
  for (const b of BOOKS) {
    map[normBook(b.name)] = b;
    for (const a of b.aliases) map[normBook(a)] = b;
  }
  return map;
})();

export interface ParsedReference {
  bookNumber: number;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

/**
 * Parse a human reference like "John 3:16", "Romans 12:1-2", "1 John 1:9",
 * "Song of Solomon 2:1", "Ps 23:1" into a structured form. Returns null if it
 * can't be parsed or the book is unknown.
 */
export function parseReference(input: string): ParsedReference | null {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  const m = cleaned.match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;

  const book = BOOK_LOOKUP[normBook(m[1])];
  if (!book) return null;

  const chapter = Number(m[2]);
  const verseStart = Number(m[3]);
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseEnd < verseStart) return null;

  return {
    bookNumber: book.n,
    bookName: book.name,
    chapter,
    verseStart,
    verseEnd,
  };
}

/** Rebuild a canonical display reference from parsed parts. */
export function formatReference(p: ParsedReference): string {
  const range = p.verseEnd > p.verseStart ? `${p.verseStart}-${p.verseEnd}` : `${p.verseStart}`;
  return `${p.bookName} ${p.chapter}:${range}`;
}

/**
 * A passage that may be a whole chapter ("John 3") or a verse range
 * ("John 3:1-21"). Unlike `parseReference`, the verse part is optional.
 */
export interface PassageRef {
  bookNumber: number;
  bookName: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  /** True when no verse was given (the whole chapter). */
  whole: boolean;
}

/**
 * Parse a passage like "John 3" (whole chapter) or "John 3:1-21" (range).
 * Returns null if unparseable or the book is unknown. `parseReference` is left
 * untouched because the structured Bible providers depend on its stricter
 * chapter:verse contract.
 */
export function parsePassage(input: string): PassageRef | null {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  const m = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;

  const book = BOOK_LOOKUP[normBook(m[1])];
  if (!book) return null;

  const chapter = Number(m[2]);
  if (m[3] == null) {
    return { bookNumber: book.n, bookName: book.name, chapter, whole: true };
  }
  const verseStart = Number(m[3]);
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseEnd < verseStart) return null;

  return { bookNumber: book.n, bookName: book.name, chapter, verseStart, verseEnd, whole: false };
}

/** Canonical display string for a passage ("John 3" or "John 3:1-21"). */
export function formatPassage(p: PassageRef): string {
  if (p.whole || p.verseStart == null) return `${p.bookName} ${p.chapter}`;
  const range = p.verseEnd && p.verseEnd > p.verseStart ? `${p.verseStart}-${p.verseEnd}` : `${p.verseStart}`;
  return `${p.bookName} ${p.chapter}:${range}`;
}
