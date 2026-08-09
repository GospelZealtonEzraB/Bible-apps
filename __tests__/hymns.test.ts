import { HYMNS, hymnsForRef, matchHymnByTitle, hymnHasChords, searchHymns } from '../src/data/hymns';

describe('hymn library invariants', () => {
  test('every hymn is public domain (bundled) or a deep-link', () => {
    for (const h of HYMNS) {
      expect(['pd', 'link', 'ccli']).toContain(h.source);
    }
  });

  test('curated chorded classics carry scripture links', () => {
    const chorded = HYMNS.filter(hymnHasChords);
    expect(chorded.length).toBeGreaterThan(0);
    for (const h of chorded) {
      expect((h.scriptureRefs ?? []).length).toBeGreaterThan(0);
    }
  });
});

describe('hymnsForRef (grounded verse → hymn)', () => {
  test('finds the hymn whose scriptureRefs list the exact verse', () => {
    const matches = hymnsForRef('Ephesians 2:8');
    const titles = matches.map((m) => m.hymn.title);
    expect(titles).toContain('Amazing Grace');
    const amazing = matches.find((m) => m.hymn.title === 'Amazing Grace');
    expect(amazing?.precision).toBe('exact');
  });

  test('matches case- and space-insensitively', () => {
    expect(hymnsForRef('  ephesians   2:8 ').some((m) => m.hymn.title === 'Amazing Grace')).toBe(true);
  });

  test('same-chapter (different verse) is a chapter-precision match', () => {
    const matches = hymnsForRef('Ephesians 2:10'); // not listed, but chapter 2 is (via 2:8)
    const amazing = matches.find((m) => m.hymn.title === 'Amazing Grace');
    expect(amazing?.precision).toBe('chapter');
  });

  test('exact matches sort before chapter matches', () => {
    const matches = hymnsForRef('Isaiah 26:3'); // exact in It Is Well; chapter also in Rock of Ages (26:4)
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].precision).toBe('exact');
  });

  test('an unrelated verse returns nothing', () => {
    expect(hymnsForRef('Obadiah 1:1')).toHaveLength(0);
  });
});

describe('matchHymnByTitle (AI suggestion → in-app link)', () => {
  test('matches a real bundled hymn ignoring punctuation/filler', () => {
    expect(matchHymnByTitle('Amazing Grace')?.id).toBe('amazing-grace');
    expect(matchHymnByTitle('It Is Well With My Soul')?.id).toBe('it-is-well');
    expect(matchHymnByTitle('when i survey the wondrous cross')?.id).toBe('when-i-survey');
  });

  test('returns undefined for a song not in the library', () => {
    expect(matchHymnByTitle('Oceans (Where Feet May Fail)')).toBeUndefined();
    expect(matchHymnByTitle('')).toBeUndefined();
  });
});

describe('searchHymns', () => {
  test('finds by title token', () => {
    expect(searchHymns('amazing').some((h) => h.title === 'Amazing Grace')).toBe(true);
  });
});
