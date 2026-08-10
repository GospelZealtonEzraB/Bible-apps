import { noteToDoc, applicationToDoc, migrateDocs } from '@/utils/notesMigration';
import type { LocalNote, StudyApplication, Doc } from '@/types';

const note = (over: Partial<LocalNote> = {}): LocalNote => ({ noteId: 'n1', scope: 'verse', ref: 'John 3:16', text: 'God so loved', updatedAt: 100, ...over });
const app = (over: Partial<StudyApplication> = {}): StudyApplication => ({ passageKey: 'romans 8', passage: 'Romans 8', text: 'trust in trials', createdAt: 200, ...over });

describe('noteToDoc', () => {
  test('a verse note → a verse doc anchored to the ref', () => {
    const d = noteToDoc(note());
    expect(d.id).toBe('d_note_n1');
    expect(d.type).toBe('verse');
    expect(d.title).toBe('John 3:16');
    expect(d.anchorRef).toBe('John 3:16');
    expect(d.refs).toContain('John 3:16');
    expect(d.blocks[0].text).toBe('God so loved');
  });

  test('a free note → a note doc with no anchor', () => {
    const d = noteToDoc(note({ noteId: 'n2', scope: 'free', ref: undefined, text: 'a thought' }));
    expect(d.type).toBe('note');
    expect(d.anchorRef).toBeUndefined();
    expect(d.title).toBe('');
  });

  test('multi-line text becomes multiple blocks', () => {
    const d = noteToDoc(note({ text: '# Heading\n- one\n- two' }));
    expect(d.blocks.map((b) => b.type)).toEqual(['h1', 'bulleted', 'bulleted']);
  });
});

describe('applicationToDoc', () => {
  test('a commitment → a study doc with a to-do', () => {
    const d = applicationToDoc(app());
    expect(d.id).toBe('d_app_romans 8');
    expect(d.type).toBe('study');
    expect(d.title).toBe('Romans 8');
    expect(d.blocks.find((b) => b.type === 'todo')?.text).toBe('trust in trials');
    expect(d.tags).toContain('living-it-out');
  });

  test('an outcome marks the to-do done and adds a paragraph', () => {
    const d = applicationToDoc(app({ outcome: 'it went well' }));
    expect(d.blocks.find((b) => b.type === 'todo')?.checked).toBe(true);
    expect(d.blocks.some((b) => b.text === 'it went well')).toBe(true);
  });
});

describe('migrateDocs (idempotent)', () => {
  test('migrates notes + applications and reports change', () => {
    const r = migrateDocs({}, { n1: note() }, { 'romans 8': app() });
    expect(r.changed).toBe(true);
    expect(Object.keys(r.documents).sort()).toEqual(['d_app_romans 8', 'd_note_n1']);
  });

  test('re-running does not duplicate or overwrite', () => {
    const first = migrateDocs({}, { n1: note() }, {});
    const second = migrateDocs(first.documents, { n1: note({ text: 'edited elsewhere' }) }, {});
    expect(second.changed).toBe(false);
    expect(second.documents['d_note_n1'].blocks[0].text).toBe('God so loved'); // untouched
  });

  test('skips empty items', () => {
    const r = migrateDocs({}, { n1: note({ text: '  ' }) }, {});
    expect(r.changed).toBe(false);
    expect(Object.keys(r.documents)).toHaveLength(0);
  });
});
