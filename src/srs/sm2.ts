import type { SRSState } from '@/types';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Recall quality buckets exposed in the UI, mapped to SM-2 grades 0..5. */
export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

export const RATING_TO_QUALITY: Record<RecallRating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

/** A fresh scheduling state for a newly added verse: due immediately. */
export function initialSRS(now: number = Date.now()): SRSState {
  return {
    repetitions: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    dueDate: now,
    lastReviewed: undefined,
  };
}

/**
 * Advance a verse's schedule after a review, using the SM-2 algorithm.
 *
 * @param srs      current scheduling state
 * @param quality  recall grade 0..5 (>= 3 counts as a successful recall)
 * @param now      epoch ms of the review (injectable for tests)
 */
export function review(
  srs: SRSState,
  quality: number,
  now: number = Date.now(),
): SRSState {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  // Update the ease factor. Poorer recall lowers it; it never drops below 1.3.
  const nextEase = Math.max(
    MIN_EASE,
    srs.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  let repetitions: number;
  let interval: number;

  if (q < 3) {
    // Lapse: relearn from the start, but keep the adjusted ease.
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = srs.repetitions + 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(srs.interval * nextEase);
    }
  }

  return {
    repetitions,
    interval,
    easeFactor: nextEase,
    dueDate: now + interval * DAY_MS,
    lastReviewed: now,
  };
}

/** True when the verse is due for review at `now`. */
export function isDue(srs: SRSState, now: number = Date.now()): boolean {
  return srs.dueDate <= now;
}
