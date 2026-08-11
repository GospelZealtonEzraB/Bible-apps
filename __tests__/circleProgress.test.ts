import {
  versesDoneFrom,
  memorizedReferences,
  learningReferences,
  unionMemorized,
  commonMemorized,
  presenceToday,
} from '@/utils/circleProgress';
import type { Verse, CircleMember } from '@/types';

function member(id: string, memorizedRefs: string[], extra: Partial<CircleMember> = {}): CircleMember {
  return {
    id,
    displayName: id.toUpperCase(),
    memorizedCount: memorizedRefs.length,
    versesDone: [],
    planDone: [],
    memorizedRefs,
    lastActiveDay: null,
    updatedAt: 0,
    ...extra,
  };
}

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

describe('memorized / learning references', () => {
  const verses: Record<string, Verse> = {
    a: verse('John 3:16', 'web', 'memorized'),
    b: verse('John 3:16', 'tamil', 'memorized'), // dupe by normalized ref
    c: verse('Romans 8:28', 'web', 'learning'),
    d: verse('Psalm 23:1', 'web', 'reviewing'),
    e: verse('Genesis 1:1', 'web', 'new'),
  };
  test('memorizedReferences dedupes across translations', () => {
    expect(memorizedReferences(verses)).toEqual(['John 3:16']);
  });
  test('learningReferences includes learning + reviewing, not new/memorized', () => {
    expect(learningReferences(verses).sort()).toEqual(['Psalm 23:1', 'Romans 8:28']);
  });
});

describe('circle-wide shared progress', () => {
  const members = [
    member('a', ['John 3:16', 'Psalm 23:1', 'Romans 8:28']),
    member('b', ['John 3:16', 'Psalm 23:1']),
    member('c', ['John 3:16', 'Philippians 4:13']),
  ];

  test('unionMemorized collects every unique reference', () => {
    expect(unionMemorized(members).map((r) => r.display).sort()).toEqual([
      'John 3:16', 'Philippians 4:13', 'Psalm 23:1', 'Romans 8:28',
    ]);
  });

  test('commonMemorized is what everyone knows', () => {
    expect(commonMemorized(members).map((r) => r.display)).toEqual(['John 3:16']);
  });



});


describe('presenceToday', () => {
  const today = '2026-08-09';
  const mk = (id: string, day: string | null): CircleMember => member(id, [], { lastActiveDay: day });
  test('flags members whose last active day is today', () => {
    const members = [mk('a', today), mk('b', '2026-08-08'), mk('c', today)];
    const p = presenceToday(members, today);
    expect(p.total).toBe(3);
    expect(p.activeIds.sort()).toEqual(['a', 'c']);
  });
  test('nobody active → empty active list', () => {
    expect(presenceToday([mk('a', null)], today).activeIds).toEqual([]);
  });
});

import { learnFromThem } from '@/utils/circleProgress';

describe('learnFromThem', () => {
  test('returns their verses I do not already have (normalized)', () => {
    const theirs = ['John 3:16', 'Romans 8:28', 'Psalm 23:1'];
    const myKeys = new Set(['john 3:16']);
    expect(learnFromThem(theirs, myKeys)).toEqual(['Romans 8:28', 'Psalm 23:1']);
  });
  test('empty when I have everything they know', () => {
    expect(learnFromThem(['John 3:16'], new Set(['john 3:16']))).toEqual([]);
  });
});
