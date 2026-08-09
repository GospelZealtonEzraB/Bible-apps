/**
 * Pure helpers for surfacing circle (shared) notes against a specific verse —
 * the "learn from others" seam. Given the cached circles and a reference, return
 * every shared note on that verse (with the circle code it belongs to).
 */
import type { Circle, Note } from '@/types';
import { normalizeKey } from '@/data/bibleApi';

export interface CircleNoteRef {
  code: string;
  note: Note;
}

/** All shared notes across the user's circles that are attached to `reference`. */
export function circleNotesForRef(circles: Record<string, Circle>, reference: string): CircleNoteRef[] {
  const key = normalizeKey(reference);
  const out: CircleNoteRef[] = [];
  for (const [code, c] of Object.entries(circles)) {
    for (const n of c.notes ?? []) {
      if (n.ref && normalizeKey(n.ref) === key) out.push({ code, note: n });
    }
  }
  return out.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
}
