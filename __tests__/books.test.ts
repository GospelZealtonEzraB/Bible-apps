import { parseReference, formatReference } from '@/data/books';

describe('parseReference', () => {
  test('single verse', () => {
    expect(parseReference('John 3:16')).toEqual({
      bookNumber: 43,
      bookName: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    });
  });

  test('verse range', () => {
    const r = parseReference('Romans 12:1-2');
    expect(r).toMatchObject({ bookNumber: 45, chapter: 12, verseStart: 1, verseEnd: 2 });
  });

  test('numbered book', () => {
    expect(parseReference('1 John 1:9')).toMatchObject({ bookNumber: 62, bookName: '1 John' });
    expect(parseReference('1 Cor 13:4-7')).toMatchObject({
      bookNumber: 46,
      verseStart: 4,
      verseEnd: 7,
    });
  });

  test('multi-word book name', () => {
    expect(parseReference('Song of Solomon 2:1')).toMatchObject({ bookNumber: 22, chapter: 2 });
  });

  test('abbreviations and Psalm alias', () => {
    expect(parseReference('Ps 23:1')).toMatchObject({ bookNumber: 19, bookName: 'Psalms' });
    expect(parseReference('Jn 3:16')).toMatchObject({ bookNumber: 43 });
    expect(parseReference('phil 4:13')).toMatchObject({ bookNumber: 50 });
  });

  test('rejects malformed or verseless references', () => {
    expect(parseReference('Hello world')).toBeNull();
    expect(parseReference('John 3')).toBeNull();
    expect(parseReference('Notabook 1:1')).toBeNull();
    expect(parseReference('John 3:5-3')).toBeNull(); // end < start
  });

  test('formatReference round-trips single and range', () => {
    expect(formatReference(parseReference('John 3:16')!)).toBe('John 3:16');
    expect(formatReference(parseReference('Romans 12:1-2')!)).toBe('Romans 12:1-2');
  });
});
