import {
  completeMovement,
  uncompleteMovement,
  dayIsMet,
  rhythmProgress,
  walkStreak,
  weekStrip,
  type Walk,
} from '@/utils/dailyWalk';

const NOW = 1_700_000_000_000;

describe('dailyWalk reducers', () => {
  test('completeMovement records once (idempotent)', () => {
    let w: Walk = {};
    w = completeMovement(w, '2026-08-10', 'come', NOW);
    w = completeMovement(w, '2026-08-10', 'come', NOW + 1);
    expect(w['2026-08-10'].movements).toEqual(['come']);
    expect(dayIsMet(w, '2026-08-10')).toBe(true);
  });

  test('uncompleteMovement removes; empty day is dropped', () => {
    let w: Walk = {};
    w = completeMovement(w, '2026-08-10', 'come', NOW);
    w = completeMovement(w, '2026-08-10', 'word', NOW);
    w = uncompleteMovement(w, '2026-08-10', 'come', NOW + 1);
    expect(w['2026-08-10'].movements).toEqual(['word']);
    w = uncompleteMovement(w, '2026-08-10', 'word', NOW + 2);
    expect(w['2026-08-10']).toBeUndefined();
    expect(dayIsMet(w, '2026-08-10')).toBe(false);
  });

  test('rhythmProgress counts only movements in the rhythm', () => {
    let w: Walk = {};
    w = completeMovement(w, '2026-08-10', 'come', NOW);
    w = completeMovement(w, '2026-08-10', 'respond', NOW);
    w = completeMovement(w, '2026-08-10', 'reflect', NOW); // recorded act, not in the rhythm
    const p = rhythmProgress(w, '2026-08-10', ['come', 'word', 'respond']);
    expect(p.done).toBe(2);
    expect(p.total).toBe(3);
    expect(p.doneKeys).toEqual(['come', 'respond']);
  });
});

describe('walkStreak (the one streak)', () => {
  const met = (days: string[]): Walk => {
    let w: Walk = {};
    for (const d of days) w = completeMovement(w, d, 'come', NOW);
    return w;
  };

  test('consecutive days ending today', () => {
    expect(walkStreak(met(['2026-08-08', '2026-08-09', '2026-08-10']), '2026-08-10')).toBe(3);
  });

  test('grace: ending yesterday still counts', () => {
    expect(walkStreak(met(['2026-08-08', '2026-08-09']), '2026-08-10')).toBe(2);
  });

  test('a gap breaks it; empty is 0', () => {
    expect(walkStreak(met(['2026-08-05', '2026-08-06']), '2026-08-10')).toBe(0);
    expect(walkStreak({}, '2026-08-10')).toBe(0);
  });
});

describe('weekStrip', () => {
  test('trailing 7 days, oldest first, met flags', () => {
    let w: Walk = {};
    w = completeMovement(w, '2026-08-09', 'come', NOW);
    w = completeMovement(w, '2026-08-10', 'come', NOW);
    const strip = weekStrip(w, '2026-08-10');
    expect(strip).toHaveLength(7);
    expect(strip[0].day).toBe('2026-08-04');
    expect(strip[6]).toEqual({ day: '2026-08-10', met: true });
    expect(strip[5]).toEqual({ day: '2026-08-09', met: true });
    expect(strip[4].met).toBe(false);
  });
});
