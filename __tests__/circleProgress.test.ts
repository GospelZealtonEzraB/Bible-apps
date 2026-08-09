import {
  versesDoneFrom,
  memorizedReferences,
  learningReferences,
  unionMemorized,
  commonMemorized,
  coverage,
  togetherTotals,
  mergeActivity,
  presenceToday,
  weeklyRecap,
} from '@/utils/circleProgress';
import type { Verse, CircleMember, Activity } from '@/types';

function member(id: string, memorizedRefs: string[], extra: Partial<CircleMember> = {}): CircleMember {
  return {
    id,
    displayName: id.toUpperCase(),
    memorizedCount: memorizedRefs.length,
    streak: 0,
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

  test('coverage sorts by how many know each verse', () => {
    const rows = coverage(members);
    expect(rows[0].display).toBe('John 3:16');
    expect(rows[0].byMemberIds.sort()).toEqual(['a', 'b', 'c']);
    // a solo verse is known by exactly one
    const romans = rows.find((r) => r.display === 'Romans 8:28');
    expect(romans?.byMemberIds).toEqual(['a']);
  });

  test('togetherTotals reports combined + common counts', () => {
    const t = togetherTotals(members);
    expect(t.combinedUnique).toBe(4);
    expect(t.common).toBe(1);
    expect(t.perMember.find((p) => p.id === 'a')?.memorized).toBe(3);
  });

  test('mergeActivity flattens + sorts newest first', () => {
    const withActivity = [
      member('a', [], { recentActivity: [{ type: 'memorized', ref: 'John 3:16', at: 100 }] }),
      member('b', [], { recentActivity: [{ type: 'reviewed', ref: 'Psalm 23:1', at: 300 }, { type: 'added', ref: 'X', at: 200 }] }),
    ];
    const feed = mergeActivity(withActivity);
    expect(feed.map((f) => f.at)).toEqual([300, 200, 100]);
    expect(feed[0]).toMatchObject({ name: 'B', type: 'reviewed' });
  });
});

import { rankMembers } from '@/utils/circleProgress';

describe('rankMembers', () => {
  const mk = (id: string, displayName: string, memorizedCount: number, streak: number) =>
    ({ id, displayName, memorizedCount, streak } as any);
  test('sorts by memorized, then streak', () => {
    const r = rankMembers([mk('a', 'Ana', 5, 2), mk('b', 'Ben', 9, 1), mk('c', 'Cy', 5, 7)]);
    expect(r.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });
  test('does not mutate the input', () => {
    const input = [mk('a', 'Ana', 1, 1), mk('b', 'Ben', 2, 1)];
    rankMembers(input);
    expect(input.map((m) => m.id)).toEqual(['a', 'b']);
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

describe('weeklyRecap', () => {
  const now = 1_000_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const act = (type: Activity['type'], at: number): Activity => ({ type, at });
  const mk = (id: string, name: string, acts: Activity[]): CircleMember =>
    member(id, [], { displayName: name, recentActivity: acts });

  test('counts memorized/reviewed/studied within the last 7 days', () => {
    const members = [
      mk('a', 'Ana', [act('memorized', now - day), act('memorized', now - 2 * day), act('reviewed', now - day)]),
      mk('b', 'Ben', [act('memorized', now - day), act('studied', now - 3 * day)]),
    ];
    const r = weeklyRecap(members, now);
    expect(r.memorized).toBe(3);
    expect(r.reviewed).toBe(1);
    expect(r.studied).toBe(1);
    expect(r.activeMembers).toBe(2);
    expect(r.topMemberName).toBe('Ana');
    expect(r.empty).toBe(false);
  });

  test('ignores activity older than 7 days', () => {
    const r = weeklyRecap([mk('a', 'Ana', [act('memorized', now - 10 * day)])], now);
    expect(r.memorized).toBe(0);
    expect(r.empty).toBe(true);
  });
});

import { circleMilestones, goalProgress } from '@/utils/circleProgress';
import type { CircleGoal } from '@/types';

describe('goalProgress', () => {
  const m = (id: string, memorizedCount: number, streak = 0, versesDone: string[] = []): CircleMember =>
    member(id, [], { memorizedCount, streak, versesDone });

  test('memorizeCount: fraction averages capped per-member, reached when all hit target', () => {
    const goal: CircleGoal = { kind: 'memorizeCount', target: 10 };
    const p = goalProgress([m('a', 10), m('b', 5)], goal, 0);
    expect(p.fraction).toBeCloseTo(0.75); // (1 + 0.5) / 2
    expect(p.membersThere).toBe(1);
    expect(p.reached).toBe(false);
    expect(goalProgress([m('a', 10), m('b', 12)], goal, 0).reached).toBe(true);
  });

  test('streak goal tracks the together streak', () => {
    const goal: CircleGoal = { kind: 'streak', target: 7 };
    expect(goalProgress([m('a', 0, 3)], goal, 7).reached).toBe(true);
    expect(goalProgress([m('a', 0, 3)], goal, 4).fraction).toBeCloseTo(4 / 7);
  });
});

describe('circleMilestones', () => {
  test('flags a verse everyone memorized, a reached goal, and a streak milestone', () => {
    const members = [member('a', ['John 3:16']), member('b', ['John 3:16'])];
    const ms = circleMilestones(members, { kind: 'memorizeCount', target: 1 }, 7);
    expect(ms.allKnow.map((r) => r.display)).toEqual(['John 3:16']);
    expect(ms.goalReached).toBe(true);
    expect(ms.streakMilestone).toBe(7);
    expect(ms.any).toBe(true);
  });

  test('nothing to celebrate for a fresh circle', () => {
    const ms = circleMilestones([member('a', [])], null, 2);
    expect(ms.any).toBe(false);
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
