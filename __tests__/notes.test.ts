import { circleNotesForRef } from '@/utils/notes';
import type { Circle, Note } from '@/types';

function note(noteId: string, ref: string, text: string, updatedAt: number): Note {
  return { noteId, by: 'm_1', byName: 'Ana', scope: 'verse', ref, text, updatedAt };
}

function circle(code: string, notes: Note[]): Circle {
  return {
    meta: { code, name: `Circle ${code}` } as any,
    members: [], sharedVerses: [], plans: [], notes, prayers: [], challenges: [], cheersFor: {},
    joinedAt: 0, lastSyncedAt: null,
  };
}

describe('circleNotesForRef', () => {
  test('collects notes for a verse across circles, newest first', () => {
    const circles: Record<string, Circle> = {
      AAA: circle('AAA', [note('n1', 'John 3:16', 'older', 100), note('n2', 'Romans 8:28', 'other verse', 200)]),
      BBB: circle('BBB', [note('n3', 'John 3:16', 'newer', 300)]),
    };
    const found = circleNotesForRef(circles, 'John 3:16');
    expect(found.map((f) => f.note.noteId)).toEqual(['n3', 'n1']);
    expect(found.map((f) => f.code)).toEqual(['BBB', 'AAA']);
  });

  test('matches references regardless of spacing/case', () => {
    const circles = { AAA: circle('AAA', [note('n1', 'john 3:16', 'x', 1)]) };
    expect(circleNotesForRef(circles, 'John 3:16')).toHaveLength(1);
  });

  test('empty when no circles or no matches', () => {
    expect(circleNotesForRef({}, 'John 3:16')).toEqual([]);
    expect(circleNotesForRef({ AAA: circle('AAA', []) }, 'John 3:16')).toEqual([]);
  });
});
