import { pickEmberLine, emberLines } from '@/data/emberLines';

describe('pickEmberLine', () => {
  it('is deterministic by seed', () => {
    expect(pickEmberLine('greeting', 0)).toBe(pickEmberLine('greeting', 0));
    expect(pickEmberLine('celebrate', 3)).toBe(pickEmberLine('celebrate', 3));
  });

  it('rotates through the pool with the seed', () => {
    const pool = emberLines('greeting');
    for (let i = 0; i < pool.length; i++) {
      expect(pickEmberLine('greeting', i)).toBe(pool[i % pool.length]);
    }
    // wraps around
    expect(pickEmberLine('greeting', pool.length)).toBe(pool[0]);
  });

  it('handles negative and fractional seeds safely', () => {
    expect(typeof pickEmberLine('study', -5)).toBe('string');
    expect(pickEmberLine('study', -5)).not.toBe('');
    expect(pickEmberLine('study', 2.7)).toBe(pickEmberLine('study', 2));
  });

  it('every category has non-empty lines', () => {
    const cats = ['greeting', 'streakNudge', 'celebrate', 'study', 'prayerReverent', 'partnerActive', 'allCaughtUp', 'encourage'] as const;
    for (const c of cats) {
      expect(emberLines(c).length).toBeGreaterThan(0);
      expect(pickEmberLine(c, 0).length).toBeGreaterThan(0);
    }
  });
});
