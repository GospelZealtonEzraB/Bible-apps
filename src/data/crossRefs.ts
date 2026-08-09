/**
 * Offline cross-references (Treasury of Scripture Knowledge via openbible.info,
 * CC-BY). Reads the bundled per-book data (see scripts/build-xrefs.mjs). Given a
 * reference, returns the top related references. No network.
 */
import { parseReference } from './books';
import { XREF_LOADERS } from './xrefAssets';

const cache = new Map<number, Record<string, string[]>>();

function loadBook(bookNumber: number): Record<string, string[]> | null {
  if (cache.has(bookNumber)) return cache.get(bookNumber)!;
  const loader = XREF_LOADERS[bookNumber];
  if (!loader) return null;
  try {
    const data = loader();
    cache.set(bookNumber, data);
    return data;
  } catch {
    return null;
  }
}

/** Top related references for a verse reference (e.g. "John 3:16"), or []. */
export function getCrossRefs(reference: string): string[] {
  const p = parseReference(reference);
  if (!p) return [];
  const book = loadBook(p.bookNumber);
  return book?.[`${p.chapter}:${p.verseStart}`] ?? [];
}
