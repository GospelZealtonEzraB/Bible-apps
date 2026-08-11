import {
  migrateDocs,
  noteToDoc,
  applicationToDoc,
  journalToDoc,
  topicReflectionsToDoc,
  type LegacyTopic,
} from '../src/utils/notesMigration';
import { docPlainText } from '../src/utils/blocks';
import type { Doc, JournalEntry, LocalNote, StudyApplication } from '../src/types';

const note = (over: Partial<LocalNote> = {}): LocalNote => ({
  noteId: 'n1',
  scope: 'verse',
  ref: 'John 3:16',
  text: 'God loved first.',
  updatedAt: 500,
  ...over,
});

const application = (over: Partial<StudyApplication> = {}): StudyApplication => ({
  passageKey: 'romans-12',
  passage: 'Romans 12',
  text: 'Serve someone this week.',
  createdAt: 600,
  ...over,
});

const journal = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  day: '2026-08-11',
  reflection: 'He steadied me.',
  verse: 'Isaiah 40:31',
  gratitude: 'For quiet mornings.',
  notes: [{ id: 'jn1', ref: 'Isaiah 40:28', text: 'He does not grow weary.', createdAt: 700 }],
  createdAt: 700,
  updatedAt: 800,
  ...over,
});

const topic = (over: Partial<LegacyTopic> = {}): LegacyTopic => ({
  id: 't1',
  title: 'Waiting',
  entries: [{ ref: 'Isaiah 40:31', addedAt: 1 }],
  description: 'What it means to wait.',
  reflections: [{ id: 'r1', text: 'Waiting is active.', updatedAt: 900 }],
  createdAt: 900,
  updatedAt: 900,
  ...over,
});

describe('each retired silo becomes a note', () => {
  test('a per-verse note keeps its text and its anchor', () => {
    const d = noteToDoc(note());
    expect(d).toMatchObject({ id: 'd_note_n1', type: 'note', anchorRef: 'John 3:16' });
    expect(docPlainText(d)).toContain('God loved first.');
    expect(d.refs).toContain('John 3:16');
  });

  test('a "living it out" commitment becomes a checkable note', () => {
    const d = applicationToDoc(application({ outcome: 'Took a meal over.' }));
    expect(d).toMatchObject({ id: 'd_app_romans-12', type: 'note', title: 'Romans 12' });
    expect(d.tags).toContain('living-it-out');
    expect(d.blocks.find((b) => b.type === 'todo')).toMatchObject({ checked: true });
    expect(docPlainText(d)).toContain('Took a meal over.');
  });

  test('a journal day keeps the reflection, the thanks and every note', () => {
    const d = journalToDoc(journal());
    expect(d).toMatchObject({ id: 'd_journal_2026-08-11', type: 'note', anchorRef: 'Isaiah 40:31' });
    const text = docPlainText(d);
    expect(text).toContain('He steadied me.');
    expect(text).toContain('For quiet mornings.');
    expect(text).toContain('He does not grow weary.');
    expect(d.tags).toContain('journal');
  });

  test('topic writing moves out; the topic itself stays a tag', () => {
    const d = topicReflectionsToDoc(topic())!;
    expect(d).toMatchObject({ id: 'd_topic_t1', type: 'note', title: 'Waiting' });
    const text = docPlainText(d);
    expect(text).toContain('What it means to wait.');
    expect(text).toContain('Waiting is active.');
  });

  test('a topic with no writing produces no note', () => {
    expect(topicReflectionsToDoc(topic({ description: undefined, reflections: [] }))).toBeNull();
  });
});

describe('migrateDocs', () => {
  const legacy = {
    notes: { n1: note() },
    applications: { 'romans-12': application() },
    journal: { '2026-08-11': journal() },
    topics: { t1: topic() },
  };

  test('nothing written is lost — every silo lands in documents', () => {
    const { documents, changed } = migrateDocs({}, legacy);
    expect(changed).toBe(true);
    expect(Object.keys(documents).sort()).toEqual([
      'd_app_romans-12',
      'd_journal_2026-08-11',
      'd_note_n1',
      'd_topic_t1',
    ]);
  });

  test('running it twice changes nothing (safe after a backup import)', () => {
    const first = migrateDocs({}, legacy);
    const second = migrateDocs(first.documents, legacy);
    expect(second.changed).toBe(false);
    expect(second.documents).toEqual(first.documents);
  });

  test('an existing doc is never overwritten', () => {
    const mine: Doc = {
      id: 'd_note_n1',
      type: 'note',
      title: 'I edited this',
      blocks: [],
      tags: [],
      refs: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const { documents } = migrateDocs({ d_note_n1: mine }, legacy);
    expect(documents.d_note_n1.title).toBe('I edited this');
  });

  test('empty writing is skipped rather than creating blank notes', () => {
    const { documents, changed } = migrateDocs({}, {
      notes: { n1: note({ text: '   ' }) },
      applications: { a: application({ text: '' }) },
      journal: { d: journal({ reflection: '', gratitude: '', notes: [] }) },
    });
    expect(changed).toBe(false);
    expect(documents).toEqual({});
  });

  test('nothing to migrate is a clean no-op', () => {
    expect(migrateDocs({})).toEqual({ documents: {}, changed: false });
  });
});
