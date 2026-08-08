import { dayKey, daysBetweenKeys, endOfDay, startOfDay, relativeTimeAgo } from '@/utils/date';

describe('date utils', () => {
  test('dayKey formats local YYYY-MM-DD', () => {
    const ts = new Date(2024, 0, 5, 13, 30).getTime(); // Jan 5 2024 local
    expect(dayKey(ts)).toBe('2024-01-05');
  });

  test('startOfDay <= ts <= endOfDay', () => {
    const ts = new Date(2024, 5, 15, 9, 0).getTime();
    expect(startOfDay(ts)).toBeLessThanOrEqual(ts);
    expect(endOfDay(ts)).toBeGreaterThanOrEqual(ts);
    expect(endOfDay(ts) - startOfDay(ts)).toBeLessThan(24 * 60 * 60 * 1000);
  });

  test('daysBetweenKeys counts whole days', () => {
    expect(daysBetweenKeys('2024-01-01', '2024-01-01')).toBe(0);
    expect(daysBetweenKeys('2024-01-01', '2024-01-02')).toBe(1);
    expect(daysBetweenKeys('2024-02-28', '2024-03-01')).toBe(2); // 2024 leap year
    expect(daysBetweenKeys('2024-01-10', '2024-01-01')).toBe(-9);
  });

  test('relativeTimeAgo gives compact labels', () => {
    const now = 1_000_000_000_000;
    expect(relativeTimeAgo(now - 5_000, now)).toBe('just now');
    expect(relativeTimeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relativeTimeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relativeTimeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
    expect(relativeTimeAgo(now - 21 * 86_400_000, now)).toBe('3w ago');
  });
});
