/**
 * One-way migration of every retired writing silo into the unified Doc model.
 *
 * The simplification removes the journal, Personal Space, per-verse local notes,
 * topic reflections and "living it out" commitments as *places to write* — but
 * nothing the user ever wrote is lost. Each is rewritten as a Doc before its
 * slice is dropped.
 *
 * Deterministic Doc ids (`d_note_{id}`, `d_app_{key}`, `d_journal_{day}`,
 * `d_topic_{id}`) make the pass idempotent and safe to re-run after a backup
 * import: anything already migrated is skipped, and an existing doc is never
 * overwritten. Pure — the store calls `migrateDocs` and clears the legacy slices.
 */
import type { Doc, JournalEntry, LocalNote, StudyApplication, Topic } from '@/types';

/** A topic as it was stored before it became a plain tag (writing included). */
export interface LegacyTopic extends Topic {
  description?: string;
  reflections?: { id: string; text: string; updatedAt: number }[];
}
import { markdownToBlocks, extractRefs, makeBlock } from '@/utils/blocks';

function finish(doc: Doc): Doc {
  doc.refs = extractRefs(doc);
  return doc;
}

export function noteToDoc(n: LocalNote): Doc {
  const anchor = n.ref?.trim() || undefined;
  return finish({
    id: `d_note_${n.noteId}`,
    type: 'note',
    title: anchor ?? '',
    blocks: markdownToBlocks(n.text ?? ''),
    tags: [],
    refs: [],
    anchorRef: anchor,
    createdAt: n.updatedAt ?? Date.now(),
    updatedAt: n.updatedAt ?? Date.now(),
  });
}

export function applicationToDoc(a: StudyApplication): Doc {
  return finish({
    id: `d_app_${a.passageKey}`,
    type: 'note',
    title: a.passage,
    blocks: [
      makeBlock('h3', 'Living it out'),
      { ...makeBlock('todo', a.text), checked: !!a.outcome },
      ...(a.outcome ? [makeBlock('paragraph', a.outcome)] : []),
    ],
    tags: ['living-it-out'],
    refs: [],
    anchorRef: a.passage,
    createdAt: a.createdAt ?? Date.now(),
    updatedAt: a.revisitedAt ?? a.createdAt ?? Date.now(),
  });
}

/**
 * A day's journal becomes one dated note: the reflection, the verse carried, the
 * thanksgiving line, and every note captured that day.
 */
export function journalToDoc(j: JournalEntry): Doc {
  const blocks = [];
  if (j.reflection?.trim()) blocks.push(...markdownToBlocks(j.reflection));
  if (j.gratitude?.trim()) {
    blocks.push(makeBlock('h3', 'Thankful for'));
    blocks.push(makeBlock('paragraph', j.gratitude));
  }
  const notes = (j.notes ?? []).filter((n) => (n.text ?? '').trim());
  if (notes.length) {
    blocks.push(makeBlock('h3', 'Notes from the day'));
    for (const n of notes) {
      blocks.push(makeBlock('bulleted', n.ref ? `${n.ref} — ${n.text}` : n.text));
    }
  }
  return finish({
    id: `d_journal_${j.day}`,
    type: 'note',
    title: j.day,
    blocks: blocks.length ? blocks : [makeBlock('paragraph', '')],
    tags: ['journal'],
    refs: [],
    anchorRef: j.verse?.trim() || undefined,
    createdAt: j.createdAt ?? Date.now(),
    updatedAt: j.updatedAt ?? j.createdAt ?? Date.now(),
  });
}

/**
 * A topic's free-form reflections become one note tagged with the topic. The
 * topic itself survives as a pure tag over verses — only the writing moves here.
 */
export function topicReflectionsToDoc(t: LegacyTopic): Doc | null {
  const reflections = (t.reflections ?? []).filter((r) => (r.text ?? '').trim());
  if (!reflections.length && !t.description?.trim()) return null;
  const blocks = [];
  if (t.description?.trim()) blocks.push(...markdownToBlocks(t.description));
  for (const r of reflections) blocks.push(...markdownToBlocks(r.text));
  return finish({
    id: `d_topic_${t.id}`,
    type: 'note',
    title: t.title,
    blocks: blocks.length ? blocks : [makeBlock('paragraph', '')],
    tags: ['topic', t.title.toLowerCase().replace(/\s+/g, '-')],
    refs: [],
    createdAt: t.createdAt ?? Date.now(),
    updatedAt: t.updatedAt ?? Date.now(),
  });
}

export interface LegacyWriting {
  notes?: Record<string, LocalNote>;
  applications?: Record<string, StudyApplication>;
  journal?: Record<string, JournalEntry>;
  topics?: Record<string, LegacyTopic>;
}

/**
 * Merge every legacy writing surface into the documents map. Returns the new map
 * and whether anything changed (so the store can skip a no-op write). Existing
 * docs (by deterministic id) are never overwritten.
 */
export function migrateDocs(
  documents: Record<string, Doc>,
  legacy: LegacyWriting = {},
): { documents: Record<string, Doc>; changed: boolean } {
  const out = { ...documents };
  let changed = false;
  const put = (id: string, make: () => Doc | null) => {
    if (out[id]) return;
    const doc = make();
    if (!doc) return;
    out[id] = doc;
    changed = true;
  };

  for (const n of Object.values(legacy.notes ?? {})) {
    if ((n.text ?? '').trim()) put(`d_note_${n.noteId}`, () => noteToDoc(n));
  }
  for (const a of Object.values(legacy.applications ?? {})) {
    if ((a.text ?? '').trim()) put(`d_app_${a.passageKey}`, () => applicationToDoc(a));
  }
  for (const j of Object.values(legacy.journal ?? {})) {
    const hasContent =
      (j.reflection ?? '').trim() ||
      (j.gratitude ?? '').trim() ||
      (j.notes ?? []).some((n) => (n.text ?? '').trim());
    if (hasContent) put(`d_journal_${j.day}`, () => journalToDoc(j));
  }
  for (const t of Object.values(legacy.topics ?? {})) {
    put(`d_topic_${t.id}`, () => topicReflectionsToDoc(t));
  }

  return { documents: out, changed };
}
