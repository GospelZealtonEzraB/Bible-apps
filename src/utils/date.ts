import { DAY_MS } from '@/srs/sm2';

/** Local day key in YYYY-MM-DD form. */
export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Epoch ms for the end of the local day containing `ts` (23:59:59.999). */
export function endOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Epoch ms for the start of the local day containing `ts`. */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole-day difference between two day keys (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const at = new Date(ay, am - 1, ad).getTime();
  const bt = new Date(by, bm - 1, bd).getTime();
  return Math.round((bt - at) / DAY_MS);
}

/** Compact "just now" / "5m ago" / "3h ago" / "2d ago" / "4w ago" label. */
export function relativeTimeAgo(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** Human "in 3 days" / "today" / "2 days ago" label for a due date. */
export function relativeDueLabel(dueDate: number, now: number = Date.now()): string {
  const days = daysBetweenKeys(dayKey(now), dayKey(dueDate));
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}
