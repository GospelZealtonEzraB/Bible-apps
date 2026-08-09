/**
 * Helpers for the library-wide quiz (identify a verse by its text). You can only
 * be quizzed on verses you've actually begun learning — and the point is that the
 * reference is hidden, so the quiz never runs on a single verse you're viewing.
 */
import type { Verse } from '@/types';

/** Minimum library size for a meaningful multiple-choice quiz (needs distractors). */
export const QUIZ_MIN = 4;

/** Verses eligible to be quizzed: have text and are past 'new'. */
export function eligibleQuizVerses(verses: Verse[]): Verse[] {
  return verses.filter((v) => !!v.text && v.status !== 'new');
}

/** Shuffle a copy and take the first `count` (runtime randomness is fine here). */
export function sampleVerses(verses: Verse[], count: number): Verse[] {
  const arr = [...verses];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}
