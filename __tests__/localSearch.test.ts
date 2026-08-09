import { searchLocalKjv } from '@/data/localSearch';

describe('searchLocalKjv (offline keyword search)', () => {
  test('finds a distinctive phrase', () => {
    const r = searchLocalKjv('shepherd');
    expect(r.some((x) => x.reference === 'Psalms 23:1')).toBe(true);
  });

  test('AND-matches all query words', () => {
    const r = searchLocalKjv('faith without works');
    expect(r.length).toBeGreaterThan(0);
    // James 2 talks about faith without works being dead
    expect(r.some((x) => x.bookNumber === 59 && x.chapter === 2)).toBe(true);
    for (const x of r) {
      const t = x.text.toLowerCase();
      expect(t.includes('faith') && t.includes('without') && t.includes('works')).toBe(true);
    }
  });

  test('exact phrase ranks first', () => {
    const r = searchLocalKjv('fear not');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].text.toLowerCase()).toContain('fear not');
  });

  test('short/empty queries return nothing', () => {
    expect(searchLocalKjv('')).toEqual([]);
    expect(searchLocalKjv('a')).toEqual([]);
  });

  test('respects the result cap', () => {
    expect(searchLocalKjv('the', 10)).toHaveLength(10);
  });
});
