import { eligibleQuizVerses, sampleVerses, QUIZ_MIN } from '@/utils/quiz';
import type { Verse } from '@/types';

const mk = (id: string, status: Verse['status'], text = 'some text'): Verse =>
  ({ id, reference: id, text, translation: 'kjv', status, srs: {} as any, mastery: 0, dateAdded: 0 } as Verse);

describe('quiz helpers', () => {
  test('eligible = has text and past "new"', () => {
    const verses = [mk('a', 'new'), mk('b', 'learning'), mk('c', 'memorized'), mk('d', 'learning', '')];
    expect(eligibleQuizVerses(verses).map((v) => v.id)).toEqual(['b', 'c']);
  });

  test('sampleVerses caps and returns a subset', () => {
    const verses = [mk('a', 'learning'), mk('b', 'learning'), mk('c', 'learning')];
    const s = sampleVerses(verses, 2);
    expect(s).toHaveLength(2);
    for (const v of s) expect(verses).toContain(v);
    expect(sampleVerses(verses, 10)).toHaveLength(3);
  });

  test('QUIZ_MIN is sensible', () => {
    expect(QUIZ_MIN).toBeGreaterThanOrEqual(4);
  });
});
