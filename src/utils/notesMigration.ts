/**
 * One-way migration of the orphaned legacy note silos into the unified Doc model.
 * Only the surfaces that had *no* rich home move here — private per-verse/free
 * notes (`LocalNote`) and "living it out" commitments (`StudyApplication`). The
 * journal and topics keep their specialized screens for now (Doc-backed later).
 *
 * Deterministic Doc ids (`d_note_{id}` / `d_app_{key}`) make it idempotent and
 * safe to re-run after a backup import: an item already migrated is skipped.
 * Pure — the store calls `migrateDocs` and clears the legacy slices.
 */
import type { Doc, LocalNote, StudyApplication } from '@/types';
import { markdownToBlocks, extractRefs } from '@/utils/blocks';

export function noteToDoc(n: LocalNote): Doc {
  const anchor = n.ref?.trim() || undefined;
  const doc: Doc = {
    id: `d_note_${n.noteId}`,
    type: anchor ? 'verse' : 'note',
    title: anchor ?? '',
    blocks: markdownToBlocks(n.text ?? ''),
    tags: [],
    refs: [],
    folderId: null,
    anchorRef: anchor,
    shared: false,
    createdAt: n.updatedAt ?? Date.now(),
    updatedAt: n.updatedAt ?? Date.now(),
  };
  doc.refs = extractRefs(doc);
  return doc;
}

export function applicationToDoc(a: StudyApplication): Doc {
  const doc: Doc = {
    id: `d_app_${a.passageKey}`,
    type: 'study',
    title: a.passage,
    blocks: [
      { id: `b_${a.passageKey}_h`, type: 'h3', text: 'Living it out' },
      { id: `b_${a.passageKey}_t`, type: 'todo', text: a.text, checked: !!a.outcome },
      ...(a.outcome ? [{ id: `b_${a.passageKey}_o`, type: 'paragraph' as const, text: a.outcome }] : []),
    ],
    tags: ['living-it-out'],
    refs: [],
    folderId: null,
    anchorRef: a.passage,
    shared: false,
    createdAt: a.createdAt ?? Date.now(),
    updatedAt: a.revisitedAt ?? a.createdAt ?? Date.now(),
  };
  doc.refs = extractRefs(doc);
  return doc;
}

/**
 * Merge legacy notes + applications into the documents map. Returns the new map
 * and whether anything changed (so the store can skip a no-op write). Existing
 * docs (by deterministic id) are never overwritten.
 */
export function migrateDocs(
  documents: Record<string, Doc>,
  notes: Record<string, LocalNote>,
  applications: Record<string, StudyApplication>,
): { documents: Record<string, Doc>; changed: boolean } {
  const out = { ...documents };
  let changed = false;
  for (const n of Object.values(notes)) {
    const id = `d_note_${n.noteId}`;
    if (!out[id] && (n.text ?? '').trim()) { out[id] = noteToDoc(n); changed = true; }
  }
  for (const a of Object.values(applications)) {
    const id = `d_app_${a.passageKey}`;
    if (!out[id] && (a.text ?? '').trim()) { out[id] = applicationToDoc(a); changed = true; }
  }
  return { documents: out, changed };
}
