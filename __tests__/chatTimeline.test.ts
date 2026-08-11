import { buildTimeline, clockTime, countSince } from '../src/utils/chatTimeline';
import type { Challenge, Message, Prayer } from '../src/types';

// Fixed local timestamps so day boundaries are deterministic.
const day1 = new Date(2026, 7, 10, 9, 0).getTime();
const day2 = new Date(2026, 7, 11, 9, 0).getTime();
const MIN = 60_000;

const msg = (id: string, by: string, at: number, over: Partial<Message> = {}): Message => ({
  msgId: id,
  by,
  byName: by === 'me' ? 'Me' : 'Ana',
  text: `message ${id}`,
  at,
  ...over,
});

const prayer = (id: string, at: number): Prayer => ({
  prayerId: id,
  text: 'pray for me',
  by: 'ana',
  byName: 'Ana',
  createdAt: at,
  status: 'active',
  prayedByCount: 0,
});

const challenge = (id: string, at: number): Challenge => ({
  chalId: id,
  from: 'ana',
  fromName: 'Ana',
  to: 'me',
  toName: 'Me',
  reference: 'John 3:16',
  kind: 'recite',
  createdAt: at,
  status: 'pending',
});

describe('one merged stream', () => {
  test('messages, prayers and challenges interleave by time', () => {
    const items = buildTimeline({
      messages: [msg('m1', 'me', day1 + MIN), msg('m2', 'ana', day1 + 3 * MIN)],
      prayers: [prayer('p1', day1 + 2 * MIN)],
      challenges: [challenge('c1', day1 + 4 * MIN)],
    });
    expect(items.map((i) => i.kind)).toEqual(['day', 'message', 'prayer', 'message', 'challenge']);
  });

  test('a day separator opens each new day', () => {
    const items = buildTimeline({ messages: [msg('m1', 'me', day1), msg('m2', 'me', day2)] });
    const days = items.filter((i) => i.kind === 'day');
    expect(days).toHaveLength(2);
    expect(items[0].kind).toBe('day');
  });

  test('an empty conversation is an empty stream', () => {
    expect(buildTimeline({})).toEqual([]);
  });
});

describe('grouping consecutive messages', () => {
  test('a run from the same person groups, and only the last carries the tail', () => {
    const items = buildTimeline({
      messages: [msg('m1', 'me', day1), msg('m2', 'me', day1 + MIN), msg('m3', 'me', day1 + 2 * MIN)],
    });
    const msgs = items.filter((i) => i.kind === 'message') as Extract<
      ReturnType<typeof buildTimeline>[number],
      { kind: 'message' }
    >[];
    expect(msgs.map((m) => m.grouped)).toEqual([false, true, true]);
    expect(msgs.map((m) => m.lastOfGroup)).toEqual([false, false, true]);
  });

  test('a different sender breaks the group', () => {
    const items = buildTimeline({ messages: [msg('m1', 'me', day1), msg('m2', 'ana', day1 + MIN)] });
    const msgs = items.filter((i) => i.kind === 'message') as any[];
    expect(msgs[1].grouped).toBe(false);
    expect(msgs[0].lastOfGroup).toBe(true);
  });

  test('a long gap breaks the group even for the same sender', () => {
    const items = buildTimeline({ messages: [msg('m1', 'me', day1), msg('m2', 'me', day1 + 30 * MIN)] });
    const msgs = items.filter((i) => i.kind === 'message') as any[];
    expect(msgs[1].grouped).toBe(false);
  });

  test('crossing midnight breaks the group', () => {
    const items = buildTimeline({ messages: [msg('m1', 'me', day1), msg('m2', 'me', day2)] });
    const msgs = items.filter((i) => i.kind === 'message') as any[];
    expect(msgs[1].grouped).toBe(false);
  });
});

describe('anchored threads', () => {
  const input = {
    messages: [
      msg('m1', 'me', day1, { context: 'John 3:16' }),
      msg('m2', 'ana', day1 + MIN, { context: 'john  3:16 ' }),
      msg('m3', 'me', day1 + 2 * MIN),
    ],
    prayers: [prayer('p1', day1 + 3 * MIN)],
    challenges: [challenge('c1', day1 + 4 * MIN)],
  };

  test('anchoring keeps only that verse’s messages, whatever the spacing or case', () => {
    const items = buildTimeline({ ...input, context: 'John 3:16' });
    expect(items.filter((i) => i.kind === 'message')).toHaveLength(2);
  });

  test('prayer and challenge cards belong to the whole conversation, not one verse', () => {
    const anchored = buildTimeline({ ...input, context: 'John 3:16' });
    expect(anchored.some((i) => i.kind === 'prayer' || i.kind === 'challenge')).toBe(false);
    const whole = buildTimeline(input);
    expect(whole.some((i) => i.kind === 'prayer')).toBe(true);
  });
});

describe('clockTime', () => {
  test('renders a 12-hour clock', () => {
    expect(clockTime(new Date(2026, 7, 10, 9, 4).getTime())).toBe('9:04 am');
    expect(clockTime(new Date(2026, 7, 10, 13, 0).getTime())).toBe('1:00 pm');
    expect(clockTime(new Date(2026, 7, 10, 0, 30).getTime())).toBe('12:30 am');
    expect(clockTime(new Date(2026, 7, 10, 12, 5).getTime())).toBe('12:05 pm');
  });
});

describe('countSince', () => {
  test('counts what arrived from the other person', () => {
    const items = buildTimeline({
      messages: [msg('m1', 'ana', day1 + MIN), msg('m2', 'me', day1 + 2 * MIN)],
      prayers: [prayer('p1', day1 + 3 * MIN)],
    });
    expect(countSince(items, day1, 'me')).toBe(2); // their message + the prayer
    expect(countSince(items, day1 + 10 * MIN, 'me')).toBe(0);
  });
});
