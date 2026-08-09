import { parseScope, segmentReference } from '../src/data/scope';

describe('parseScope', () => {
  test('single verse', () => {
    const s = parseScope('John 3:16')!;
    expect(s.kind).toBe('verse');
    expect(s.display).toBe('John 3:16');
    expect(s.segments).toHaveLength(1);
    expect(segmentReference(s.segments[0])).toBe('John 3:16');
  });

  test('in-chapter range', () => {
    const s = parseScope('John 3:1-21')!;
    expect(s.kind).toBe('range');
    expect(s.segments).toHaveLength(1);
    expect(segmentReference(s.segments[0])).toBe('John 3:1-21');
  });

  test('whole chapter', () => {
    const s = parseScope('John 3')!;
    expect(s.kind).toBe('chapter');
    expect(segmentReference(s.segments[0])).toBe('John 3');
  });

  test('multi-chapter range expands to one segment per chapter', () => {
    const s = parseScope('John 3-5')!;
    expect(s.kind).toBe('chapters');
    expect(s.display).toBe('John 3-5');
    expect(s.segments.map((seg) => seg.chapter)).toEqual([3, 4, 5]);
    expect(s.segments.every((seg) => seg.verseStart == null)).toBe(true);
  });

  test('multi-chapter range is clamped to the book length', () => {
    const s = parseScope('Jude 1-5')!; // Jude has 1 chapter
    expect(s.segments.map((seg) => seg.chapter)).toEqual([1]);
  });

  test('whole book expands to every chapter', () => {
    const s = parseScope('Jude')!;
    expect(s.kind).toBe('book');
    expect(s.segments).toHaveLength(1); // Jude: 1 chapter
    const john = parseScope('John')!;
    expect(john.segments).toHaveLength(21); // John: 21 chapters
  });

  test('multi-word / numbered book names as whole book', () => {
    expect(parseScope('1 John')!.kind).toBe('book');
    expect(parseScope('Song of Solomon')!.kind).toBe('book');
    expect(parseScope('Psalms')!.segments.length).toBeGreaterThan(100);
  });

  test('a semicolon list keeps every part in order', () => {
    const s = parseScope('Romans 8:28; John 3:16; Genesis 1')!;
    expect(s.kind).toBe('list');
    expect(s.display).toBe('Romans 8:28; John 3:16; Genesis 1');
    expect(s.segments).toHaveLength(3);
  });

  test('aliases resolve (Rom, Ps)', () => {
    expect(parseScope('Rom 8:28')!.display).toBe('Romans 8:28');
    expect(parseScope('Ps 23')!.display).toBe('Psalms 23');
  });

  test('gibberish and unknown books return null', () => {
    expect(parseScope('Hesitations 3:16')).toBeNull();
    expect(parseScope('   ')).toBeNull();
    expect(parseScope('Romans 8:28; nonsense')).toBeNull();
  });
});
