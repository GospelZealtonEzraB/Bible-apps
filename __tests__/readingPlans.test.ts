import { READING_PLANS, getReadingPlan, planPortionForDate } from '@/data/readingPlans';
import { totalChapters } from '@/data/structure';
import { dayKey } from '@/utils/date';

describe('readingPlans', () => {
  test('plans exist with the right lengths', () => {
    expect(getReadingPlan('bible-parallel')!.days).toHaveLength(260);
    expect(getReadingPlan('nt-90')!.days).toHaveLength(90);
    expect(getReadingPlan('gospels-30')!.days).toHaveLength(30);
    expect(getReadingPlan('nope')).toBeUndefined();
  });

  test('whole-Bible plan covers all 1189 chapters exactly once', () => {
    const all = getReadingPlan('bible-parallel')!.days.flat();
    expect(all).toHaveLength(totalChapters()); // 1189
    expect(new Set(all).size).toBe(all.length); // no duplicates
    expect(all).toContain('Genesis 1');
    expect(all).toContain('Revelation 22');
  });

  test('parallel plan reads from each Testament every day', () => {
    const plan = getReadingPlan('bible-parallel')!;
    for (const day of plan.days) {
      // exactly one NT chapter (book 40-66) and at least one OT chapter each day
      const ntCount = day.filter((r) => /^(Matthew|Mark|Luke|John|Acts|Romans|.*Corinthians|Galatians|Ephesians|Philippians|Colossians|.*Thessalonians|.*Timothy|Titus|Philemon|Hebrews|James|.*Peter|.*John|Jude|Revelation) /.test(r)).length;
      expect(ntCount).toBeGreaterThanOrEqual(1);
      expect(day.length).toBeGreaterThan(ntCount); // has OT too
    }
    expect(plan.days[0].some((r) => r.startsWith('Genesis'))).toBe(true);
    expect(plan.days[0].some((r) => r.startsWith('Matthew'))).toBe(true);
  });

  test('every passage is a parseable chapter reference', () => {
    for (const plan of READING_PLANS) {
      for (const day of plan.days) {
        for (const ref of day) {
          expect(ref).toMatch(/^.+ \d+$/);
        }
      }
    }
  });

  describe('planPortionForDate (shared-plan auto-advance)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const start = Date.parse('2026-08-10T09:00:00'); // local start

    test('day 1 on the start day', () => {
      const p = planPortionForDate('gospels-30', start, dayKey(start));
      expect(p).not.toBeNull();
      expect(p!.dayNumber).toBe(1);
      expect(p!.total).toBe(30);
      expect(p!.refs).toEqual(getReadingPlan('gospels-30')!.days[0]);
    });

    test('advances one day per calendar day', () => {
      const p = planPortionForDate('gospels-30', start, dayKey(start + 4 * DAY));
      expect(p!.dayNumber).toBe(5);
      expect(p!.refs).toEqual(getReadingPlan('gospels-30')!.days[4]);
    });

    test('loops gently after the plan ends', () => {
      const p = planPortionForDate('gospels-30', start, dayKey(start + 30 * DAY));
      expect(p!.dayNumber).toBe(31); // human day count keeps climbing
      expect(p!.refs).toEqual(getReadingPlan('gospels-30')!.days[0]); // wrapped
    });

    test('null before the start, or with no plan/start', () => {
      expect(planPortionForDate('gospels-30', start, dayKey(start - DAY))).toBeNull();
      expect(planPortionForDate(null, start, dayKey(start))).toBeNull();
      expect(planPortionForDate('gospels-30', null, dayKey(start))).toBeNull();
    });
  });
});
