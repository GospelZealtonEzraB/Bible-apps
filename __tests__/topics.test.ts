import {
  addEntry,
  removeEntry,
  updateEntryNote,
  sortedEntries,
  topicHasRef,
  topicsForRef,
} from '../src/utils/topics';
import type { Topic } from '../src/types';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't_1',
    title: 'The Rapture',
    entries: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('topic reducers', () => {
  test('addEntry prepends a new verse and stamps updatedAt', () => {
    const t = addEntry(makeTopic(), 'John 3:16', 'the gospel', 2000);
    expect(t.entries).toHaveLength(1);
    expect(t.entries[0]).toMatchObject({ ref: 'John 3:16', note: 'the gospel', addedAt: 2000 });
    expect(t.updatedAt).toBe(2000);
  });

  test('addEntry dedupes by normalized reference (case/space-insensitive)', () => {
    let t = addEntry(makeTopic(), 'John 3:16', undefined, 2000);
    t = addEntry(t, '  john   3:16 ', undefined, 3000);
    expect(t.entries).toHaveLength(1);
  });

  test('re-adding an existing verse with a note updates the note, not the count', () => {
    let t = addEntry(makeTopic(), 'John 3:16', undefined, 2000);
    t = addEntry(t, 'John 3:16', 'God so loved', 3000);
    expect(t.entries).toHaveLength(1);
    expect(t.entries[0].note).toBe('God so loved');
    expect(t.updatedAt).toBe(3000);
  });

  test('re-adding an existing verse with no note is a no-op (same object)', () => {
    const t1 = addEntry(makeTopic(), 'John 3:16', 'note', 2000);
    const t2 = addEntry(t1, 'John 3:16', '   ', 3000);
    expect(t2).toBe(t1);
  });

  test('removeEntry drops the verse and is a no-op when absent', () => {
    const t1 = addEntry(makeTopic(), 'John 3:16', undefined, 2000);
    const t2 = removeEntry(t1, 'John 3:16', 3000);
    expect(t2.entries).toHaveLength(0);
    const t3 = removeEntry(t2, 'Romans 8:28', 4000);
    expect(t3).toBe(t2);
  });

  test('updateEntryNote sets and clears the note', () => {
    let t = addEntry(makeTopic(), 'John 3:16', 'a', 2000);
    t = updateEntryNote(t, 'John 3:16', 'b', 3000);
    expect(t.entries[0].note).toBe('b');
    t = updateEntryNote(t, 'John 3:16', '   ', 4000);
    expect(t.entries[0].note).toBeUndefined();
  });

  test('topicHasRef matches regardless of spacing/case', () => {
    const t = addEntry(makeTopic(), 'Romans 8:28', undefined, 2000);
    expect(topicHasRef(t, 'romans 8:28')).toBe(true);
    expect(topicHasRef(t, 'Romans 8:29')).toBe(false);
  });
});

describe('sortedEntries', () => {
  test('canonical order sorts by book, chapter, verse', () => {
    let t = makeTopic();
    t = addEntry(t, 'Revelation 3:10', undefined, 5000);
    t = addEntry(t, 'John 3:16', undefined, 4000);
    t = addEntry(t, 'Genesis 1:1', undefined, 3000);
    t = addEntry(t, 'John 1:1', undefined, 2000);
    const refs = sortedEntries(t, 'canonical').map((e) => e.ref);
    expect(refs).toEqual(['Genesis 1:1', 'John 1:1', 'John 3:16', 'Revelation 3:10']);
  });

  test('added order sorts newest-added first', () => {
    let t = makeTopic();
    t = addEntry(t, 'Genesis 1:1', undefined, 3000);
    t = addEntry(t, 'Revelation 3:10', undefined, 5000);
    t = addEntry(t, 'John 3:16', undefined, 4000);
    const refs = sortedEntries(t, 'added').map((e) => e.ref);
    expect(refs).toEqual(['Revelation 3:10', 'John 3:16', 'Genesis 1:1']);
  });

  test('does not mutate the topic', () => {
    const t = addEntry(addEntry(makeTopic(), 'John 3:16', undefined, 2000), 'Genesis 1:1', undefined, 3000);
    const before = t.entries.map((e) => e.ref);
    sortedEntries(t, 'canonical');
    expect(t.entries.map((e) => e.ref)).toEqual(before);
  });
});

describe('topicsForRef', () => {
  test('returns the ids of topics containing the reference', () => {
    const a = addEntry(makeTopic({ id: 't_a' }), 'John 3:16', undefined, 2000);
    const b = addEntry(makeTopic({ id: 't_b' }), 'Romans 8:28', undefined, 2000);
    const c = addEntry(makeTopic({ id: 't_c' }), 'John 3:16', undefined, 2000);
    const ids = topicsForRef({ t_a: a, t_b: b, t_c: c }, 'john 3:16').sort();
    expect(ids).toEqual(['t_a', 't_c']);
  });
});
