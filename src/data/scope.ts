/**
 * Study "scope" — a flexible reference range for study/summary. Where
 * `parsePassage` handles only a single chapter or an in-chapter verse range,
 * a scope also accepts a whole book, a multi-chapter range, and a
 * semicolon-separated list. It expands to an ordered list of chapter segments
 * (each maps to one `getChapterVerses` call) so the reader can render any scope.
 */
import type { BookInfo } from './books';
import { parsePassage, formatPassage, lookupBook } from './books';
import { chapterCount } from './structure';

/** One chapter (or an in-chapter range) that can be fetched from a provider. */
export interface ChapterSegment {
  bookNumber: number;
  bookName: string;
  chapter: number;
  /** undefined = whole chapter. */
  verseStart?: number;
  verseEnd?: number;
}

export type ScopeKind = 'verse' | 'range' | 'chapter' | 'chapters' | 'book' | 'list';

export interface StudyScope {
  /** Canonical display string, e.g. "John 3-4" or "Romans 8:28; John 3:16". */
  display: string;
  kind: ScopeKind;
  /** Expanded chapters, in order. */
  segments: ChapterSegment[];
}

/** Build the fetchable reference string for a single segment. */
export function segmentReference(seg: ChapterSegment): string {
  if (seg.verseStart == null) return `${seg.bookName} ${seg.chapter}`;
  const range = seg.verseEnd && seg.verseEnd > seg.verseStart ? `${seg.verseStart}-${seg.verseEnd}` : `${seg.verseStart}`;
  return `${seg.bookName} ${seg.chapter}:${range}`;
}

function bookSegments(book: BookInfo): ChapterSegment[] {
  const count = chapterCount(book.n) || 0;
  const segs: ChapterSegment[] = [];
  for (let c = 1; c <= count; c++) segs.push({ bookNumber: book.n, bookName: book.name, chapter: c });
  return segs;
}

/** Parse a single (non-list) scope part. */
function parseSingle(part: string): StudyScope | null {
  const cleaned = part.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  // Whole book — the entire token is a book name/alias ("John", "1 John", "Psalms").
  const wholeBook = lookupBook(cleaned);
  if (wholeBook) {
    const segments = bookSegments(wholeBook);
    if (segments.length) return { display: wholeBook.name, kind: 'book', segments };
  }

  // Book + chapter range, no colon: "John 3-4", "Romans 1-3".
  const m = cleaned.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)$/);
  if (m) {
    const b = lookupBook(m[1]);
    if (b) {
      const max = chapterCount(b.n) || Number(m[3]);
      const c1 = Number(m[2]);
      const c2 = Math.min(Number(m[3]), max);
      if (c1 >= 1 && c2 >= c1) {
        const segments: ChapterSegment[] = [];
        for (let c = c1; c <= c2; c++) segments.push({ bookNumber: b.n, bookName: b.name, chapter: c });
        return { display: `${b.name} ${c1}-${c2}`, kind: 'chapters', segments };
      }
    }
  }

  // Fallback: a single passage (verse / in-chapter range / whole chapter).
  const p = parsePassage(cleaned);
  if (p) {
    const seg: ChapterSegment = {
      bookNumber: p.bookNumber,
      bookName: p.bookName,
      chapter: p.chapter,
      verseStart: p.whole ? undefined : p.verseStart,
      verseEnd: p.whole ? undefined : p.verseEnd,
    };
    const kind: ScopeKind = p.whole ? 'chapter' : p.verseEnd != null && p.verseStart != null && p.verseEnd > p.verseStart ? 'range' : 'verse';
    return { display: formatPassage(p), kind, segments: [seg] };
  }

  return null;
}

/**
 * Parse a flexible study scope: a verse, an in-chapter range, a whole chapter,
 * a multi-chapter range, a whole book, or a `;`-separated list of these.
 * Returns null if any part is unparseable.
 */
export function parseScope(input: string): StudyScope | null {
  const parts = input.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parseSingle(parts[0]);

  const parsed = parts.map(parseSingle);
  if (parsed.some((p) => !p)) return null;
  const list = parsed as StudyScope[];
  return {
    display: list.map((p) => p.display).join('; '),
    kind: 'list',
    segments: list.flatMap((p) => p.segments),
  };
}

/** A human label for how big a scope is (for UI hints). */
export function scopeSizeLabel(scope: StudyScope): string {
  const chapters = scope.segments.length;
  if (scope.kind === 'verse' || scope.kind === 'range') return chapters === 1 ? '' : `${chapters} chapters`;
  return chapters === 1 ? '1 chapter' : `${chapters} chapters`;
}
