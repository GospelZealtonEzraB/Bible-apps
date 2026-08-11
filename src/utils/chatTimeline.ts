/**
 * One conversation stream.
 *
 * Prayer requests and challenges aren't separate screens any more — they're
 * cards that live in the chat, the way a poll or an event lives in a WhatsApp
 * thread. This merges all three into a single time-ordered list, inserts day
 * separators, and works out which messages should visually group together
 * (same sender, close in time) so the thread breathes like a real chat.
 *
 * Pure — no store, no React, no `Date.now()` unless passed in.
 */
import type { Challenge, Message, Prayer } from '@/types';
import { dayKey } from '@/utils/date';

export type TimelineItem =
  | { kind: 'day'; id: string; day: string; at: number }
  | { kind: 'message'; id: string; at: number; message: Message; grouped: boolean; lastOfGroup: boolean }
  | { kind: 'prayer'; id: string; at: number; prayer: Prayer }
  | { kind: 'challenge'; id: string; at: number; challenge: Challenge };

/** Messages closer together than this from the same person read as one turn. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface TimelineInput {
  messages?: Message[];
  prayers?: Prayer[];
  challenges?: Challenge[];
  /** When set, only messages anchored to this reference are included. */
  context?: string | null;
}

function normContext(s: string | undefined | null): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Build the stream, oldest first. Anchoring to a `context` narrows it to that
 * verse's thread — and drops the prayer/challenge cards, which belong to the
 * whole conversation rather than to one passage.
 */
export function buildTimeline(input: TimelineInput): TimelineItem[] {
  const anchored = !!input.context;
  const key = normContext(input.context);

  const messages = (input.messages ?? []).filter((m) =>
    anchored ? normContext(m.context) === key : true,
  );

  const items: TimelineItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, id: `m_${m.msgId}`, at: m.at, message: m, grouped: false, lastOfGroup: true })),
  ];

  if (!anchored) {
    for (const p of input.prayers ?? []) {
      items.push({ kind: 'prayer', id: `p_${p.prayerId}`, at: p.createdAt, prayer: p });
    }
    for (const c of input.challenges ?? []) {
      items.push({ kind: 'challenge', id: `c_${c.chalId}`, at: c.createdAt, challenge: c });
    }
  }

  items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

  // Group consecutive messages from the same person, and insert day separators.
  const out: TimelineItem[] = [];
  let lastDay: string | null = null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const day = dayKey(item.at);
    if (day !== lastDay) {
      out.push({ kind: 'day', id: `d_${day}`, day, at: item.at });
      lastDay = day;
    }

    if (item.kind !== 'message') {
      out.push(item);
      continue;
    }

    const prev = items[i - 1];
    const next = items[i + 1];
    const sameDayAsPrev = prev ? dayKey(prev.at) === day : false;
    const grouped =
      !!prev &&
      prev.kind === 'message' &&
      sameDayAsPrev &&
      prev.message.by === item.message.by &&
      item.at - prev.at < GROUP_WINDOW_MS;
    const lastOfGroup = !(
      next &&
      next.kind === 'message' &&
      dayKey(next.at) === day &&
      next.message.by === item.message.by &&
      next.at - item.at < GROUP_WINDOW_MS
    );
    out.push({ ...item, grouped, lastOfGroup });
  }

  return out;
}

/** "9:04 am" — the timestamp under a bubble. */
export function clockTime(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Unread-ish helper: how many items arrived from the other person after `since`. */
export function countSince(items: TimelineItem[], since: number, myId: string): number {
  return items.filter(
    (i) => i.at > since && ((i.kind === 'message' && i.message.by !== myId) || i.kind === 'prayer'),
  ).length;
}
