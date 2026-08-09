import { getLocalChapter, getLocalRange, hasLocal } from '@/data/localBible';

describe('localBible (offline KJV)', () => {
  test('hasLocal only for bundled translations', () => {
    expect(hasLocal('kjv')).toBe(true);
    expect(hasLocal('web')).toBe(false);
    expect(hasLocal('tamil')).toBe(false);
  });

  test('reads a full chapter with correct verse numbering', () => {
    const john3 = getLocalChapter(43, 3); // John 3
    expect(john3).not.toBeNull();
    expect(john3!).toHaveLength(36);
    expect(john3![0].verse).toBe(1);
    expect(john3![15].verse).toBe(16);
    expect(john3![15].text).toMatch(/For God so loved the world/);
  });

  test('reads a single verse and a range', () => {
    expect(getLocalRange(43, 3, 16, 16)).toMatch(/^For God so loved the world/);
    expect(getLocalRange(19, 23, 1, 1)).toMatch(/The LORD is my shepherd/);
    const range = getLocalRange(45, 12, 1, 2); // Romans 12:1-2
    expect(range).toMatch(/beseech you therefore/);
    expect(range).toMatch(/renewing of your mind/);
  });

  test('braces stripped, no leftover markup', () => {
    const ps23 = getLocalChapter(19, 23);
    expect(ps23!.some((v) => v.text.includes('{') || v.text.includes('}'))).toBe(false);
  });

  test('unknown book/chapter returns null', () => {
    expect(getLocalChapter(999, 1)).toBeNull();
    expect(getLocalChapter(43, 999)).toBeNull();
    expect(getLocalRange(43, 3, 900, 999)).toBeNull();
  });
});
