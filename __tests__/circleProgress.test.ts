import { versesDoneFrom } from '@/utils/circleProgress';
import type { Verse } from '@/types';

function verse(reference: string, translation: string, status: Verse['status']): Verse {
  return {
    id: `${translation}:${reference.toLowerCase()}`,
    reference,
    text: '…',
    translation,
    dateAdded: 0,
    status,
    srs: { repetitions: 0, interval: 0, easeFactor: 2.5, dueDate: 0 },
    mastery: status === 'memorized' ? 100 : 0,
  };
}

describe('versesDoneFrom', () => {
  const verses: Record<string, Verse> = {
    a: verse('John 3:16', 'web', 'memorized'),
    b: verse('Romans 8:28', 'web', 'learning'), // owned but not memorized
    c: verse('John 3:16', 'tamil', 'memorized'), // same ref, other translation
  };

  test('counts only shared refs that are memorized', () => {
    const done = versesDoneFrom(verses, ['John 3:16', 'Romans 8:28', 'Psalm 23:1']);
    expect(done).toEqual(['John 3:16']);
  });

  test('matches by normalized reference (case/spacing/translation-agnostic)', () => {
    expect(versesDoneFrom(verses, ['  john   3:16 '])).toEqual(['  john   3:16 ']);
  });

  test('returns empty when nothing shared is memorized', () => {
    expect(versesDoneFrom(verses, ['Romans 8:28'])).toEqual([]);
    expect(versesDoneFrom(verses, [])).toEqual([]);
  });
});
