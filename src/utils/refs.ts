/**
 * Inline Scripture-reference detection for free text (notes, discussion, later
 * commentary). Finds references like "John 3:16", "Romans 12:1-2", "Psalm 23",
 * validates each against the canonical book table, and returns render segments
 * so a component can make the references tappable (→ VersePeek).
 *
 * Pure + unit-tested. To limit false positives from short abbreviations that are
 * also common English words ("Am", "Is", "So"), a ≤2-char book token only counts
 * as a reference when the match includes a chapter:verse (a colon).
 */
import { BOOKS, parsePassage, formatPassage } from '@/data/books';

export type RefSegment =
  | { type: 'text'; value: string }
  | { type: 'ref'; value: string; reference: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// All book names + aliases, longest first so "Song of Solomon" beats "Song".
const BOOK_TOKENS: string[] = (() => {
  const toks: string[] = [];
  for (const b of BOOKS) {
    toks.push(b.name);
    for (const a of b.aliases) toks.push(a);
  }
  return toks.sort((a, b) => b.length - a.length);
})();

// e.g.  John 3:16 | Romans 12:1-2 | Ps 23 | 1 John 1:9
const REF_RE = new RegExp(
  '\\b(' + BOOK_TOKENS.map(escapeRe).join('|') + ')\\.?\\s+(\\d+)(?::\\d+(?:\\s*-\\s*\\d+)?)?',
  'gi',
);

/** Split text into plain-text and validated-reference segments. */
export function linkifyReferences(text: string): RefSegment[] {
  const out: RefSegment[] = [];
  let last = 0;
  REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(text)) !== null) {
    const matched = m[0];
    const bookLen = m[1].replace(/[\s.]/g, '').length;
    const hasVerse = matched.includes(':');
    // Skip ambiguous 1–2 char abbreviations unless a chapter:verse is present.
    if (bookLen <= 2 && !hasVerse) continue;
    const parsed = parsePassage(matched);
    if (!parsed) continue;
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'ref', value: matched, reference: formatPassage(parsed) });
    last = m.index + matched.length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/** True if the text contains at least one detectable reference. */
export function hasReference(text: string): boolean {
  return linkifyReferences(text).some((s) => s.type === 'ref');
}
