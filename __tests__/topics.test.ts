import {
  addEntry,
  removeEntry,
  topicHasRef,
  sortedEntries,
  topicsForRef,
  composeTopic,
  genTopicId,
} from '../src/utils/topics';
import type { Topic } from '../src/types';

const topic = (over: Partial<Topic> = {}): Topic => ({
  id: 't_1',
  title: 'Grace',
  entries: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('tagging verses into a topic', () => {
  test('adds a verse, newest first, and stamps updatedAt', () => {
    const t = addEntry(topic(), 'John 3:16', 100);
    expect(t.entries).toEqual([{ ref: 'John 3:16', addedAt: 100 }]);
    expect(t.updatedAt).toBe(100);

    const t2 = addEntry(t, 'Romans 8:28', 200);
    expect(t2.entries.map((e) => e.ref)).toEqual(['Romans 8:28', 'John 3:16']);
  });

  test('the same verse is never tagged twice, however it is written', () => {
    const t = addEntry(topic(), 'John 3:16', 100);
    for (const variant of ['John 3:16', 'john 3:16', ' JOHN  3:16 ']) {
      expect(addEntry(t, variant, 300)).toBe(t); // unchanged, same object
    }
  });

  test('removing a verse is reference-normalized and a miss is a no-op', () => {
    const t = addEntry(addEntry(topic(), 'John 3:16', 100), 'Romans 8:28', 200);
    expect(removeEntry(t, 'john 3:16', 300).entries.map((e) => e.ref)).toEqual(['Romans 8:28']);
    expect(removeEntry(t, 'Genesis 1:1', 300)).toBe(t);
  });

  test('topicHasRef matches regardless of spacing or case', () => {
    const t = addEntry(topic(), '1 Thessalonians 4:16', 1);
    expect(topicHasRef(t, '1 thessalonians 4:16')).toBe(true);
    expect(topicHasRef(t, 'Psalm 23:1')).toBe(false);
  });
});

describe('ordering', () => {
  const t = topic({
    entries: [
      { ref: 'Romans 8:28', addedAt: 300 },
      { ref: 'Genesis 1:1', addedAt: 100 },
      { ref: 'John 3:16', addedAt: 200 },
    ],
  });

  test('canonical order reads in Bible order', () => {
    expect(sortedEntries(t, 'canonical').map((e) => e.ref)).toEqual([
      'Genesis 1:1',
      'John 3:16',
      'Romans 8:28',
    ]);
  });

  test('added order is newest first', () => {
    expect(sortedEntries(t, 'added').map((e) => e.ref)).toEqual([
      'Romans 8:28',
      'John 3:16',
      'Genesis 1:1',
    ]);
  });

  test('unparseable references sink to the bottom instead of throwing', () => {
    const messy = topic({ entries: [{ ref: 'Not A Book 9:9', addedAt: 1 }, { ref: 'John 3:16', addedAt: 2 }] });
    expect(sortedEntries(messy, 'canonical')[0].ref).toBe('John 3:16');
  });

  test('sorting never mutates the topic', () => {
    const before = [...t.entries];
    sortedEntries(t, 'canonical');
    expect(t.entries).toEqual(before);
  });
});

describe('topicsForRef', () => {
  test('finds every topic a verse is tagged into', () => {
    const topics = {
      t_1: topic({ id: 't_1', title: 'Grace', entries: [{ ref: 'Ephesians 2:8', addedAt: 1 }] }),
      t_2: topic({ id: 't_2', title: 'Salvation', entries: [{ ref: 'ephesians 2:8', addedAt: 1 }] }),
      t_3: topic({ id: 't_3', title: 'Creation', entries: [{ ref: 'Genesis 1:1', addedAt: 1 }] }),
    };
    expect(topicsForRef(topics, 'Ephesians 2:8').sort()).toEqual(['t_1', 't_2']);
    expect(topicsForRef(topics, 'Psalm 1:1')).toEqual([]);
  });
});

describe('composeTopic', () => {
  const hydrate = (ref: string) => (ref === 'John 3:16' ? 'For God so loved the world' : null);

  test('flattens to title + verses with text where we have it', () => {
    const t = topic({ entries: [{ ref: 'John 3:16', addedAt: 1 }, { ref: 'Romans 8:28', addedAt: 2 }] });
    const out = composeTopic(t, hydrate);
    expect(out).toContain('Grace');
    expect(out).toContain('John 3:16');
    expect(out).toContain('"For God so loved the world"');
    expect(out).toContain('Romans 8:28');
    expect(out).not.toMatch(/\n{3,}/); // no runs of blank lines
  });

  test('an empty topic still produces its title', () => {
    expect(composeTopic(topic({ title: 'Untitled' }), hydrate)).toBe('Untitled');
  });
});

describe('genTopicId', () => {
  test('is deterministic for a given seed', () => {
    expect(genTopicId('abc')).toBe('t_abc');
  });
});
