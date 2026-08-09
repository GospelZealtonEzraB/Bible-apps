/**
 * Offline KJV access — reads the bundled per-book JSON (see scripts/build-kjv.mjs
 * + kjvAssets.ts). No network. This is the local-first source for the reader and
 * for memorizing verses; other translations still fetch online via bibleApi.
 */
import type { ChapterVerse } from './bibleApi';
import { KJV_LOADERS } from './kjvAssets';

/** Translations that are bundled offline today. */
export function hasLocal(translation: string): boolean {
  return translation === 'kjv';
}

// Cache the parsed book arrays so repeated reads don't re-run the require map.
const bookCache = new Map<number, string[][]>();

function loadBook(bookNumber: number): string[][] | null {
  if (bookCache.has(bookNumber)) return bookCache.get(bookNumber)!;
  const loader = KJV_LOADERS[bookNumber];
  if (!loader) return null;
  try {
    const book = loader();
    bookCache.set(bookNumber, book);
    return book;
  } catch {
    return null;
  }
}

/** All verses of a chapter (KJV), or null if the book/chapter isn't bundled. */
export function getLocalChapter(bookNumber: number, chapter: number): ChapterVerse[] | null {
  const book = loadBook(bookNumber);
  const verses = book?.[chapter - 1];
  if (!verses) return null;
  return verses.map((text, i) => ({ verse: i + 1, text }));
}

/** A verse range (KJV) as joined text, or null if unavailable. */
export function getLocalRange(
  bookNumber: number,
  chapter: number,
  verseStart: number,
  verseEnd: number,
): string | null {
  const verses = getLocalChapter(bookNumber, chapter);
  if (!verses) return null;
  const picked = verses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd).map((v) => v.text);
  return picked.length ? picked.join(' ') : null;
}
