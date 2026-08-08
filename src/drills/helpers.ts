/**
 * Pure text-processing helpers shared by the memorization drills.
 * These are intentionally free of React / React Native imports so they can be
 * unit-tested in isolation.
 */

export interface Token {
  /** The raw word as it appears (may include trailing punctuation). */
  raw: string;
  /** Leading letters/digits used for first-letter mode and comparisons. */
  word: string;
  /** True when this token contains at least one alphanumeric character. */
  isWord: boolean;
}

const WORD_CORE = /[A-Za-z0-9À-ɏ']+/;

/** Split a verse into whitespace-separated tokens, preserving punctuation. */
export function tokenize(text: string): Token[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0)
    .map((raw) => {
      const m = raw.match(WORD_CORE);
      return {
        raw,
        word: m ? m[0] : '',
        isWord: !!m,
      };
    });
}

/** Normalize a word for forgiving comparison (lowercase, strip punctuation). */
export function normalizeWord(w: string): string {
  const m = w.match(WORD_CORE);
  return (m ? m[0] : w).toLowerCase();
}

/**
 * Collapse each word to its first letter, keeping punctuation and word count.
 * "In the beginning God" -> "I t b G".
 */
export function toFirstLetters(text: string): string {
  return tokenize(text)
    .map((t) => {
      if (!t.isWord) return t.raw;
      const first = t.word[0];
      // Preserve trailing punctuation (e.g. a comma) for rhythm cues.
      const trailing = t.raw.slice(t.raw.indexOf(t.word) + t.word.length);
      return first + trailing;
    })
    .join(' ');
}

/**
 * Deterministically pick which word-token indices to hide for a given
 * "fade level" (0 = none hidden, higher = more hidden). Words fade in a fixed
 * pseudo-random order so repeated passes reveal a stable, escalating pattern.
 */
export function maskOrder(tokenCount: number): number[] {
  // A simple stable shuffle seeded by index — no randomness so drills are
  // reproducible across renders.
  const idx = Array.from({ length: tokenCount }, (_, i) => i);
  return idx.sort((a, b) => {
    const ha = (a * 2654435761) % 2147483647;
    const hb = (b * 2654435761) % 2147483647;
    return ha - hb;
  });
}

/**
 * Given tokens and a fade level 0..maxLevel, return the set of token indices
 * that should be hidden. Only word tokens are ever hidden.
 */
export function hiddenIndicesForLevel(
  tokens: Token[],
  level: number,
  maxLevel: number,
): Set<number> {
  const wordIdx = tokens
    .map((t, i) => (t.isWord ? i : -1))
    .filter((i) => i >= 0);
  if (level <= 0 || wordIdx.length === 0) return new Set();

  const order = maskOrder(wordIdx.length).map((i) => wordIdx[i]);
  const frac = Math.min(1, level / Math.max(1, maxLevel));
  const count = Math.round(order.length * frac);
  return new Set(order.slice(0, count));
}

/**
 * Choose which content-word indices to blank out for fill-in-the-blank.
 * Skips very short words so blanks land on meaningful words.
 */
export function pickBlankIndices(tokens: Token[], fraction = 0.35): number[] {
  const candidates = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.isWord && t.word.length >= 3)
    .map(({ i }) => i);
  if (candidates.length === 0) return [];

  const target = Math.max(1, Math.round(candidates.length * fraction));
  const order = maskOrder(candidates.length).map((i) => candidates[i]);
  return order.slice(0, target).sort((a, b) => a - b);
}

export type WordVerdict = 'correct' | 'wrong' | 'missing' | 'extra';

export interface WordDiff {
  expected?: string;
  typed?: string;
  verdict: WordVerdict;
}

export interface DiffResult {
  diffs: WordDiff[];
  correct: number;
  total: number;
  /** 0..100 word-level accuracy against the expected verse. */
  accuracy: number;
}

/**
 * Word-by-word comparison of a typed attempt against the expected verse.
 * Uses positional alignment with forgiving normalization (case/punctuation
 * insensitive). Good enough for recitation feedback without a full LCS.
 */
export function diffWords(expected: string, typed: string): DiffResult {
  const exp = tokenize(expected).filter((t) => t.isWord);
  const got = tokenize(typed).filter((t) => t.isWord);
  const diffs: WordDiff[] = [];
  let correct = 0;

  const max = Math.max(exp.length, got.length);
  for (let i = 0; i < max; i++) {
    const e = exp[i];
    const g = got[i];
    if (e && g) {
      const ok = normalizeWord(e.word) === normalizeWord(g.word);
      if (ok) correct++;
      diffs.push({
        expected: e.raw,
        typed: g.raw,
        verdict: ok ? 'correct' : 'wrong',
      });
    } else if (e && !g) {
      diffs.push({ expected: e.raw, verdict: 'missing' });
    } else if (!e && g) {
      diffs.push({ typed: g.raw, verdict: 'extra' });
    }
  }

  const total = exp.length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { diffs, correct, total, accuracy };
}
