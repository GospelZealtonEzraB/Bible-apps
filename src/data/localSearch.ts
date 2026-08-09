/**
 * Offline keyword search over the bundled KJV. Builds a lowercased index once
 * (lazily) and does an AND-match over query words — instant, no network. This is
 * the offline tier; semantic/meaning search (server-side) layers on top later
 * via src/data/search.ts.
 */
import { KJV_LOADERS } from './kjvAssets';
import { bookByNumber } from './structure';
import { parseReference } from './books';
import { getLocalChapter } from './localBible';

export interface SearchResult {
  reference: string;
  text: string;
  bookNumber: number;
  chapter: number;
  verse: number;
}

interface IndexEntry {
  bookNumber: number;
  chapter: number;
  verse: number;
  text: string;
  lower: string;
}

let INDEX: IndexEntry[] | null = null;

/** Build the flat verse index once (parses every book; ~31k entries). */
function getIndex(): IndexEntry[] {
  if (INDEX) return INDEX;
  const out: IndexEntry[] = [];
  for (let n = 1; n <= 66; n++) {
    const loader = KJV_LOADERS[n];
    if (!loader) continue;
    const book = loader();
    for (let c = 0; c < book.length; c++) {
      const verses = book[c];
      for (let v = 0; v < verses.length; v++) {
        const text = verses[v];
        out.push({ bookNumber: n, chapter: c + 1, verse: v + 1, text, lower: text.toLowerCase() });
      }
    }
  }
  INDEX = out;
  return out;
}

function toResult(e: IndexEntry): SearchResult {
  const name = bookByNumber(e.bookNumber)?.name ?? `Book ${e.bookNumber}`;
  return { reference: `${name} ${e.chapter}:${e.verse}`, text: e.text, bookNumber: e.bookNumber, chapter: e.chapter, verse: e.verse };
}

/** Build a SearchResult for a single-verse reference from the local KJV. */
export function hydrateReference(reference: string): SearchResult | null {
  const p = parseReference(reference);
  if (!p) return null;
  const ch = getLocalChapter(p.bookNumber, p.chapter);
  const v = ch?.[p.verseStart - 1];
  if (!v) return null;
  const name = bookByNumber(p.bookNumber)?.name ?? `Book ${p.bookNumber}`;
  return { reference: `${name} ${p.chapter}:${p.verseStart}`, text: v.text, bookNumber: p.bookNumber, chapter: p.chapter, verse: p.verseStart };
}

/**
 * Keyword search: every query word must appear in the verse (case-insensitive).
 * Ranked by an exact-phrase bonus then shorter verses (tighter matches first).
 */
export function searchLocalKjv(query: string, limit = 100): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const scored: { e: IndexEntry; score: number }[] = [];
  for (const e of getIndex()) {
    if (!tokens.every((t) => e.lower.includes(t))) continue;
    let score = 0;
    if (e.lower.includes(q)) score += 100; // exact phrase
    score += Math.max(0, 40 - e.lower.length / 8); // prefer tighter verses
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => toResult(s.e));
}
