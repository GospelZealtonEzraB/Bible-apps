/**
 * Static Bible structure — chapter counts per canonical book (KJV/Protestant),
 * so the reader can build book→chapter navigation with no network round-trip.
 * These are public-domain facts (just counts), not Scripture text.
 *
 * Keyed by canonical book number (1..66) from `books.ts`. Testasble & pure.
 */
import { BOOKS, type BookInfo } from './books';

/** Number of chapters in each book, by canonical book number (1..66). */
export const CHAPTER_COUNTS: Record<number, number> = {
  1: 50, 2: 40, 3: 27, 4: 36, 5: 34, 6: 24, 7: 21, 8: 4, 9: 31, 10: 24,
  11: 22, 12: 25, 13: 29, 14: 36, 15: 10, 16: 13, 17: 10, 18: 42, 19: 150, 20: 31,
  21: 12, 22: 8, 23: 66, 24: 52, 25: 5, 26: 48, 27: 12, 28: 14, 29: 3, 30: 9,
  31: 1, 32: 4, 33: 7, 34: 3, 35: 3, 36: 3, 37: 2, 38: 14, 39: 4, 40: 28,
  41: 16, 42: 24, 43: 21, 44: 28, 45: 16, 46: 16, 47: 13, 48: 6, 49: 6, 50: 4,
  51: 4, 52: 5, 53: 3, 54: 6, 55: 4, 56: 3, 57: 1, 58: 13, 59: 5, 60: 5,
  61: 3, 62: 5, 63: 1, 64: 1, 65: 1, 66: 22,
};

/** Highest book number in the Old Testament (Malachi). NT is 40..66. */
export const LAST_OT_BOOK = 39;

/** Chapter count for a book number, or 0 if unknown. */
export function chapterCount(bookNumber: number): number {
  return CHAPTER_COUNTS[bookNumber] ?? 0;
}

/** True when a book number is in the Old Testament. */
export function isOldTestament(bookNumber: number): boolean {
  return bookNumber >= 1 && bookNumber <= LAST_OT_BOOK;
}

/** Look up a book by its canonical number (1..66). */
export function bookByNumber(bookNumber: number): BookInfo | undefined {
  return BOOKS.find((b) => b.n === bookNumber);
}

/** The two canonical testament groupings, for a sectioned book list. */
export function booksByTestament(): { ot: BookInfo[]; nt: BookInfo[] } {
  return {
    ot: BOOKS.filter((b) => isOldTestament(b.n)),
    nt: BOOKS.filter((b) => !isOldTestament(b.n)),
  };
}

/** Total chapters across the whole Bible (1189 in the Protestant canon). */
export function totalChapters(): number {
  return Object.values(CHAPTER_COUNTS).reduce((a, b) => a + b, 0);
}
