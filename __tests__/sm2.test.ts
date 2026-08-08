import {
  review,
  initialSRS,
  isDue,
  DAY_MS,
  MIN_EASE,
  DEFAULT_EASE,
} from '@/srs/sm2';

const T0 = 1_700_000_000_000; // fixed reference time

describe('sm2', () => {
  test('initial state is due immediately', () => {
    const s = initialSRS(T0);
    expect(s.dueDate).toBe(T0);
    expect(s.repetitions).toBe(0);
    expect(s.easeFactor).toBe(DEFAULT_EASE);
    expect(isDue(s, T0)).toBe(true);
  });

  test('successful recalls grow the interval 1 -> 6 -> interval*ease', () => {
    let s = initialSRS(T0);
    s = review(s, 4, T0); // first success
    expect(s.repetitions).toBe(1);
    expect(s.interval).toBe(1);
    expect(s.dueDate).toBe(T0 + 1 * DAY_MS);

    s = review(s, 4, T0);
    expect(s.repetitions).toBe(2);
    expect(s.interval).toBe(6);

    const prevInterval = s.interval;
    s = review(s, 4, T0);
    expect(s.repetitions).toBe(3);
    expect(s.interval).toBe(Math.round(prevInterval * s.easeFactor));
  });

  test('a lapse (quality < 3) resets repetitions and interval', () => {
    let s = initialSRS(T0);
    s = review(s, 5, T0);
    s = review(s, 5, T0);
    expect(s.repetitions).toBe(2);

    s = review(s, 1, T0); // forgot
    expect(s.repetitions).toBe(0);
    expect(s.interval).toBe(1);
    expect(s.dueDate).toBe(T0 + DAY_MS);
  });

  test('ease factor decreases on hard recalls but never below the floor', () => {
    let s = initialSRS(T0);
    for (let i = 0; i < 20; i++) {
      s = review(s, 0, T0);
    }
    expect(s.easeFactor).toBeGreaterThanOrEqual(MIN_EASE);
    expect(s.easeFactor).toBeCloseTo(MIN_EASE, 5);
  });

  test('easy recalls keep ease at or above default', () => {
    let s = initialSRS(T0);
    s = review(s, 5, T0);
    expect(s.easeFactor).toBeGreaterThanOrEqual(DEFAULT_EASE);
  });

  test('isDue reflects the scheduled due date', () => {
    let s = initialSRS(T0);
    s = review(s, 4, T0);
    expect(isDue(s, T0)).toBe(false);
    expect(isDue(s, s.dueDate)).toBe(true);
    expect(isDue(s, s.dueDate + 1)).toBe(true);
  });
});
