import { getCrossRefs } from '@/data/crossRefs';

describe('getCrossRefs (offline TSK)', () => {
  test('returns top related references for a verse', () => {
    const refs = getCrossRefs('John 3:16');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs).toContain('Romans 5:8');
    expect(refs).toContain('John 3:15');
  });

  test('references are well-formed and de-duplicated', () => {
    const refs = getCrossRefs('Psalms 23:1');
    expect(new Set(refs).size).toBe(refs.length);
    for (const r of refs) expect(r).toMatch(/^.+ \d+:\d+(-\d+)?$/);
  });

  test('caps results and handles unknown/bad refs', () => {
    expect(getCrossRefs('John 3:16').length).toBeLessThanOrEqual(10);
    expect(getCrossRefs('not a reference')).toEqual([]);
    expect(getCrossRefs('John 3')).toEqual([]); // no verse -> parseReference fails
  });
});
