import { parsePassage, formatPassage } from '@/data/books';

describe('parsePassage', () => {
  test('parses a whole chapter (no verse)', () => {
    const p = parsePassage('John 3');
    expect(p).toMatchObject({ bookName: 'John', chapter: 3, whole: true });
    expect(p?.verseStart).toBeUndefined();
  });

  test('parses a single verse', () => {
    expect(parsePassage('John 3:16')).toMatchObject({ bookName: 'John', chapter: 3, verseStart: 16, verseEnd: 16, whole: false });
  });

  test('parses a verse range', () => {
    expect(parsePassage('John 3:1-21')).toMatchObject({ bookName: 'John', chapter: 3, verseStart: 1, verseEnd: 21, whole: false });
  });

  test('parses numbered books as a whole chapter', () => {
    expect(parsePassage('1 John 1')).toMatchObject({ bookName: '1 John', chapter: 1, whole: true });
  });

  test('rejects junk, a bare book, and reversed ranges', () => {
    expect(parsePassage('nonsense')).toBeNull();
    expect(parsePassage('John')).toBeNull();
    expect(parsePassage('John 3:5-2')).toBeNull();
  });
});

describe('formatPassage', () => {
  test('formats whole chapter, single, and range', () => {
    expect(formatPassage(parsePassage('John 3')!)).toBe('John 3');
    expect(formatPassage(parsePassage('John 3:16')!)).toBe('John 3:16');
    expect(formatPassage(parsePassage('John 3:1-21')!)).toBe('John 3:1-21');
  });
});
