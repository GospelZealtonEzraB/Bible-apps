import { transposeChord, transposeLine, transposeKey, parseChordLine } from '@/utils/chords';

describe('transposeChord', () => {
  test('shifts roots and keeps suffixes', () => {
    expect(transposeChord('G', 2)).toBe('A');
    expect(transposeChord('G7', 2)).toBe('A7');
    expect(transposeChord('Em', 3)).toBe('Gm');
    expect(transposeChord('C', -1)).toBe('B');
  });
  test('wraps around the octave', () => {
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('A', 3)).toBe('C');
  });
  test('handles flats and slash chords', () => {
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('G/B', 2)).toBe('A/C#');
  });
  test('leaves non-chords alone', () => {
    expect(transposeChord('', 2)).toBe('');
    expect(transposeChord('N.C.', 2)).toBe('N.C.');
  });
});

describe('transposeLine / transposeKey', () => {
  test('transposes every bracketed chord', () => {
    expect(transposeLine('A-[G]mazing [G7]grace how [C]sweet', 2)).toBe('A-[A]mazing [A7]grace how [D]sweet');
  });
  test('transposes a key name', () => {
    expect(transposeKey('G', 2)).toBe('A');
  });
});

describe('parseChordLine', () => {
  test('splits into chord/text segments', () => {
    expect(parseChordLine('A-[G]mazing [C]grace')).toEqual([
      { text: 'A-' },
      { chord: 'G', text: 'mazing ' },
      { chord: 'C', text: 'grace' },
    ]);
  });
  test('applies transposition when asked', () => {
    expect(parseChordLine('[G]grace', 2)).toEqual([{ chord: 'A', text: 'grace' }]);
  });
  test('plain line with no chords', () => {
    expect(parseChordLine('just words')).toEqual([{ text: 'just words' }]);
  });
});

import { searchHymns, getHymn } from '@/data/hymns';

describe('hymns', () => {
  test('search by title, author, and lyric line', () => {
    expect(searchHymns('amazing').map((h) => h.id)).toContain('amazing-grace');
    expect(searchHymns('spafford').map((h) => h.id)).toContain('it-is-well');
    expect(searchHymns('wretch').map((h) => h.id)).toContain('amazing-grace');
  });
  test('empty query returns all; no match returns none', () => {
    expect(searchHymns('').length).toBeGreaterThan(0);
    expect(searchHymns('zzzzzz')).toEqual([]);
  });
  test('every hymn is public-domain and scripture-linked', () => {
    for (const h of searchHymns('')) {
      expect(h.source).toBe('pd');
      expect(h.scriptureRefs.length).toBeGreaterThan(0);
    }
    expect(getHymn('amazing-grace')?.key).toBe('G');
  });
});
