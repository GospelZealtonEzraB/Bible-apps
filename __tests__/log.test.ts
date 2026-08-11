import {
  addEntry,
  removeEntry,
  setEntryPrivate,
  setEntryText,
  entriesForDay,
  publicEntriesForDay,
  logDays,
  daySummary,
  isLogged,
  newLogId,
} from '../src/utils/log';
import type { Log } from '../src/types';

const build = (...entries: Parameters<typeof addEntry>[1][]): Log =>
  entries.reduce<Log>((log, e, i) => addEntry(log, { ...e, createdAt: 1000 + i }), {});

describe('adding to the log', () => {
  test('records an asset against a day', () => {
    const log = addEntry({}, { day: '2026-08-11', kind: 'verse', ref: 'John 3:16', title: 'John 3:16' });
    const [entry] = Object.values(log);
    expect(entry).toMatchObject({ day: '2026-08-11', kind: 'verse', ref: 'John 3:16' });
    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeGreaterThan(0);
  });

  test('logging the same asset twice on one day is a no-op', () => {
    const log = addEntry({}, { day: '2026-08-11', kind: 'verse', ref: 'John 3:16' });
    expect(addEntry(log, { day: '2026-08-11', kind: 'verse', ref: 'john 3:16 ' })).toBe(log);
    expect(Object.keys(addEntry(log, { day: '2026-08-11', kind: 'verse', ref: 'John 3:16' }))).toHaveLength(1);
  });

  test('the same asset on a different day is a separate entry', () => {
    let log = addEntry({}, { day: '2026-08-11', kind: 'verse', ref: 'John 3:16' });
    log = addEntry(log, { day: '2026-08-12', kind: 'verse', ref: 'John 3:16' });
    expect(Object.keys(log)).toHaveLength(2);
  });

  test('the same reference under a different kind is a separate entry', () => {
    let log = addEntry({}, { day: '2026-08-11', kind: 'verse', ref: 'John 3' });
    log = addEntry(log, { day: '2026-08-11', kind: 'passage', ref: 'John 3' });
    expect(Object.keys(log)).toHaveLength(2);
  });

  test('free-text lines are never deduped — you can write as many as you like', () => {
    let log = addEntry({}, { day: '2026-08-11', kind: 'text', text: 'He met me today' });
    log = addEntry(log, { day: '2026-08-11', kind: 'text', text: 'He met me today' });
    expect(Object.keys(log)).toHaveLength(2);
  });

  test('assets are deduped by id as well as by reference', () => {
    let log = addEntry({}, { day: '2026-08-11', kind: 'song', assetId: 's_1', title: 'It Is Well' });
    log = addEntry(log, { day: '2026-08-11', kind: 'song', assetId: 's_1', title: 'It Is Well' });
    expect(Object.keys(log)).toHaveLength(1);
  });
});

describe('isLogged', () => {
  const log = addEntry({}, { day: '2026-08-11', kind: 'song', assetId: 's_1' });

  test('reports whether an asset is already in a day', () => {
    expect(isLogged(log, '2026-08-11', 'song', 's_1')).toBe(true);
    expect(isLogged(log, '2026-08-12', 'song', 's_1')).toBe(false);
    expect(isLogged(log, '2026-08-11', 'note', 's_1')).toBe(false);
    expect(isLogged(log, '2026-08-11', 'song', undefined)).toBe(false);
  });
});

describe('reading the log', () => {
  const log = build(
    { day: '2026-08-11', kind: 'verse', ref: 'John 3:16' },
    { day: '2026-08-11', kind: 'song', assetId: 's_1' },
    { day: '2026-08-10', kind: 'note', assetId: 'd_1' },
    { day: '2026-08-12', kind: 'teaching', assetId: 'd_2' },
  );

  test('a day reads oldest first — the order it happened', () => {
    expect(entriesForDay(log, '2026-08-11').map((e) => e.kind)).toEqual(['verse', 'song']);
  });

  test('days list newest first', () => {
    expect(logDays(log)).toEqual(['2026-08-12', '2026-08-11', '2026-08-10']);
  });

  test('an empty day is simply empty', () => {
    expect(entriesForDay(log, '2026-01-01')).toEqual([]);
    expect(logDays({})).toEqual([]);
  });

  test('daySummary counts per kind', () => {
    expect(daySummary(log, '2026-08-11')).toEqual({ verse: 1, song: 1 });
  });
});

describe('privacy', () => {
  test('a private entry stays out of what the partner sees', () => {
    const log = build(
      { day: '2026-08-11', kind: 'verse', ref: 'John 3:16' },
      { day: '2026-08-11', kind: 'text', text: 'something tender' },
    );
    const [, secretId] = Object.keys(log);
    const guarded = setEntryPrivate(log, secretId, true);

    expect(entriesForDay(guarded, '2026-08-11')).toHaveLength(2);
    expect(publicEntriesForDay(guarded, '2026-08-11')).toHaveLength(1);
    expect(publicEntriesForDay(guarded, '2026-08-11')[0].kind).toBe('verse');
  });

  test('privacy can be taken back off', () => {
    const log = build({ day: '2026-08-11', kind: 'text', text: 'x' });
    const [id] = Object.keys(log);
    const shown = setEntryPrivate(setEntryPrivate(log, id, true), id, false);
    expect(publicEntriesForDay(shown, '2026-08-11')).toHaveLength(1);
  });
});

describe('editing and removing', () => {
  test('the free line can be edited', () => {
    const log = build({ day: '2026-08-11', kind: 'verse', ref: 'John 3:16' });
    const [id] = Object.keys(log);
    expect(setEntryText(log, id, 'this carried me')[id].text).toBe('this carried me');
  });

  test('an entry can be removed; a missing id is a no-op', () => {
    const log = build({ day: '2026-08-11', kind: 'verse', ref: 'John 3:16' });
    const [id] = Object.keys(log);
    expect(Object.keys(removeEntry(log, id))).toHaveLength(0);
    expect(removeEntry(log, 'nope')).toBe(log);
    expect(setEntryPrivate(log, 'nope', true)).toBe(log);
    expect(setEntryText(log, 'nope', 'x')).toBe(log);
  });
});

describe('newLogId', () => {
  test('ids are unique even within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newLogId(1700000000000)));
    expect(ids.size).toBe(200);
  });
});
