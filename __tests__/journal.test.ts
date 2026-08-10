import {
  patchEntry,
  addNote,
  removeNote,
  journalDays,
  journalStreak,
  onThisDay,
  entryIsEmpty,
  shiftDay,
  streakLabel,
  type Journal,
} from '@/utils/journal';

const NOW = 1_700_000_000_000;

describe('journal reducers', () => {
  test('patchEntry creates, updates, and drops empty days', () => {
    let j: Journal = {};
    j = patchEntry(j, '2026-08-10', { reflection: 'He is faithful' }, NOW);
    expect(j['2026-08-10'].reflection).toBe('He is faithful');
    // Clearing the only field drops the day entirely.
    j = patchEntry(j, '2026-08-10', { reflection: '' }, NOW + 1);
    expect(j['2026-08-10']).toBeUndefined();
  });

  test('addNote / removeNote and empty-day cleanup', () => {
    let j: Journal = {};
    j = addNote(j, '2026-08-10', { ref: 'John 3:16', text: 'love' }, NOW);
    expect(j['2026-08-10'].notes).toHaveLength(1);
    expect(j['2026-08-10'].notes[0].ref).toBe('John 3:16');
    const id = j['2026-08-10'].notes[0].id;
    j = removeNote(j, '2026-08-10', id, NOW + 1);
    // No other content → the day is dropped.
    expect(j['2026-08-10']).toBeUndefined();
  });

  test('a note survives when the day also has a reflection', () => {
    let j: Journal = {};
    j = patchEntry(j, '2026-08-10', { reflection: 'grace' }, NOW);
    j = addNote(j, '2026-08-10', { text: 'a thought' }, NOW);
    const id = j['2026-08-10'].notes[0].id;
    j = removeNote(j, '2026-08-10', id, NOW + 1);
    expect(j['2026-08-10']).toBeDefined();
    expect(j['2026-08-10'].notes).toHaveLength(0);
  });

  test('entryIsEmpty', () => {
    expect(entryIsEmpty(undefined)).toBe(true);
    expect(entryIsEmpty({ day: 'x', notes: [], createdAt: 0, updatedAt: 0 })).toBe(true);
    expect(entryIsEmpty({ day: 'x', reflection: 'hi', notes: [], createdAt: 0, updatedAt: 0 })).toBe(false);
  });

  test('journalDays sorts most-recent first', () => {
    let j: Journal = {};
    j = patchEntry(j, '2026-08-08', { reflection: 'a' }, NOW);
    j = patchEntry(j, '2026-08-10', { reflection: 'b' }, NOW);
    j = patchEntry(j, '2026-08-09', { reflection: 'c' }, NOW);
    expect(journalDays(j).map((e) => e.day)).toEqual(['2026-08-10', '2026-08-09', '2026-08-08']);
  });
});

describe('journalStreak', () => {
  test('counts consecutive days ending today', () => {
    let j: Journal = {};
    for (const d of ['2026-08-08', '2026-08-09', '2026-08-10']) j = patchEntry(j, d, { reflection: 'x' }, NOW);
    expect(journalStreak(j, '2026-08-10')).toBe(3);
  });

  test('grace: a streak ending yesterday still counts today', () => {
    let j: Journal = {};
    for (const d of ['2026-08-08', '2026-08-09']) j = patchEntry(j, d, { reflection: 'x' }, NOW);
    expect(journalStreak(j, '2026-08-10')).toBe(2);
  });

  test('a gap breaks the streak', () => {
    let j: Journal = {};
    for (const d of ['2026-08-05', '2026-08-06']) j = patchEntry(j, d, { reflection: 'x' }, NOW);
    expect(journalStreak(j, '2026-08-10')).toBe(0);
  });

  test('empty journal has no streak', () => {
    expect(journalStreak({}, '2026-08-10')).toBe(0);
  });
});

describe('onThisDay', () => {
  test('surfaces prior-year entries on the same month+day', () => {
    let j: Journal = {};
    j = patchEntry(j, '2025-08-10', { reflection: 'last year' }, NOW);
    j = patchEntry(j, '2024-08-10', { reflection: 'two years ago' }, NOW);
    j = patchEntry(j, '2026-08-11', { reflection: 'not today' }, NOW);
    const hits = onThisDay(j, '2026-08-10').map((e) => e.day);
    expect(hits).toEqual(['2025-08-10', '2024-08-10']);
  });
});

describe('helpers', () => {
  test('shiftDay handles month boundaries', () => {
    expect(shiftDay('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDay('2026-08-31', 1)).toBe('2026-09-01');
  });
  test('streakLabel', () => {
    expect(streakLabel(0)).toMatch(/Start/);
    expect(streakLabel(1)).toBe('1 day with Him');
    expect(streakLabel(12)).toBe('12 days with Him');
  });
});
