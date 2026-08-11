/**
 * Teaching notes — the structured output of the sermon pipeline.
 *
 * A sermon used to come back as a 4–8 sentence blob that vanished when you left
 * the screen. Now it comes back as an outline the message actually followed,
 * the truths worth keeping, the Scripture it cited, and how to live it — and it
 * lands in Notes as a `sermon` document.
 *
 * Pure: coercion + block composition only, no store or UI imports.
 */
import { makeBlock } from '@/utils/blocks';
import { validateReferences } from '@/data/books';
import type { Block } from '@/types';

export interface TeachingSection {
  heading: string;
  points: string[];
}

export interface Teaching {
  title: string;
  summary: string;
  outline: TeachingSection[];
  keyPoints: string[];
  application: string;
  /** Canonicalized Scripture references (hallucinated ones are dropped). */
  references: string[];
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const strList = (v: unknown, max: number, len = 400): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => str(x, len))
        .filter(Boolean)
        .slice(0, max)
    : [];

/**
 * Coerce a server response into a Teaching. Tolerates the old
 * `{summary, references}` shape (a Worker that hasn't been redeployed yet), and
 * drops anything malformed rather than rendering junk.
 */
export function coerceTeaching(raw: unknown): Teaching {
  const o = (raw ?? {}) as Record<string, unknown>;
  const outline = Array.isArray(o.outline)
    ? o.outline
        .map((sec) => {
          const s = (sec ?? {}) as Record<string, unknown>;
          return { heading: str(s.heading, 160), points: strList(s.points, 8) };
        })
        .filter((sec) => sec.heading || sec.points.length)
        .slice(0, 8)
    : [];
  return {
    title: str(o.title, 120),
    summary: str(o.summary, 2500),
    outline,
    keyPoints: strList(o.keyPoints, 8),
    application: str(o.application, 1200),
    references: validateReferences(strList(o.references, 60, 60)),
  };
}

/** True when there is nothing worth showing (a failed or empty run). */
export function teachingIsEmpty(t: Teaching): boolean {
  return !t.summary && !t.outline.length && !t.keyPoints.length && !t.application;
}

/** A title to file it under, falling back to something recognizable. */
export function teachingTitle(t: Teaching, fallback = 'Teaching notes'): string {
  return t.title || t.summary.split(/(?<=[.!?])\s/)[0]?.slice(0, 80) || fallback;
}

/**
 * Compose the teaching into blocks for a `sermon` document — the same block
 * model the Notes editor uses, so it is fully editable once saved.
 */
export function teachingToBlocks(t: Teaching, opts: { source?: string } = {}): Block[] {
  const blocks: Block[] = [];
  if (t.summary) blocks.push(makeBlock('paragraph', t.summary));

  for (const sec of t.outline) {
    if (sec.heading) blocks.push(makeBlock('h2', sec.heading));
    for (const p of sec.points) blocks.push(makeBlock('bulleted', p));
  }

  if (t.keyPoints.length) {
    blocks.push(makeBlock('h2', 'Key points'));
    for (const p of t.keyPoints) blocks.push(makeBlock('bulleted', p));
  }

  if (t.references.length) {
    blocks.push(makeBlock('h2', 'Scripture'));
    blocks.push(makeBlock('paragraph', t.references.join(' · ')));
  }

  if (t.application) {
    blocks.push(makeBlock('h2', 'Living it out'));
    blocks.push(makeBlock('quote', t.application));
  }

  if (opts.source) blocks.push(makeBlock('callout', `Source: ${opts.source}`));
  blocks.push(makeBlock('callout', 'AI-written notes — weigh them against the message and the Word.'));

  return blocks.length ? blocks : [makeBlock('paragraph', '')];
}
