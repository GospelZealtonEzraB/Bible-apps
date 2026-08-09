import {
  CHAPTER_COUNTS,
  chapterCount,
  isOldTestament,
  bookByNumber,
  booksByTestament,
  totalChapters,
} from '@/data/structure';

describe('structure', () => {
  test('every canonical book (1..66) has a positive chapter count', () => {
    for (let n = 1; n <= 66; n++) {
      expect(CHAPTER_COUNTS[n]).toBeGreaterThan(0);
    }
    expect(Object.keys(CHAPTER_COUNTS)).toHaveLength(66);
  });

  test('known chapter counts', () => {
    expect(chapterCount(1)).toBe(50); // Genesis
    expect(chapterCount(19)).toBe(150); // Psalms
    expect(chapterCount(43)).toBe(21); // John
    expect(chapterCount(66)).toBe(22); // Revelation
    expect(chapterCount(999)).toBe(0); // unknown
  });

  test('total chapters is the Protestant 1189', () => {
    expect(totalChapters()).toBe(1189);
  });

  test('testament split at Malachi/Matthew', () => {
    expect(isOldTestament(39)).toBe(true); // Malachi
    expect(isOldTestament(40)).toBe(false); // Matthew
    const { ot, nt } = booksByTestament();
    expect(ot).toHaveLength(39);
    expect(nt).toHaveLength(27);
  });

  test('bookByNumber resolves canonical names', () => {
    expect(bookByNumber(43)?.name).toBe('John');
    expect(bookByNumber(1)?.name).toBe('Genesis');
    expect(bookByNumber(0)).toBeUndefined();
  });
});
