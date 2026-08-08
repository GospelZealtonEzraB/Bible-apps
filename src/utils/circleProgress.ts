import { normalizeKey } from '@/data/bibleApi';
import type { Verse } from '@/types';

/**
 * Which references from a circle's shared list this device has *memorized*.
 * Matching is by normalized reference, so it works across translations
 * (e.g. an English and a Tamil "John 3:16" both count).
 */
export function versesDoneFrom(
  verses: Record<string, Verse>,
  sharedRefs: string[],
): string[] {
  const memorized = new Set(
    Object.values(verses)
      .filter((v) => v.status === 'memorized')
      .map((v) => normalizeKey(v.reference)),
  );
  return sharedRefs.filter((ref) => memorized.has(normalizeKey(ref)));
}
