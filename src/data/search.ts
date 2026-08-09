/**
 * Scripture search orchestrator. Tries server-side **semantic** search (meaning-
 * based; Workers AI + Vectorize) which returns references-only, hydrates snippets
 * from the local KJV, and falls back to offline **keyword** search when the
 * server is unset, offline, or returns nothing. The screen never changes.
 */
import { searchLocalKjv, hydrateReference, type SearchResult } from './localSearch';
import { semanticSearch } from './searchClient';

export type { SearchResult } from './localSearch';

export interface SearchResponse {
  results: SearchResult[];
  /** Which tier answered — surfaced in the UI. */
  source: 'local' | 'semantic';
}

export async function searchScripture(query: string, opts: { serverUrl?: string | null } = {}): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length < 2) return { results: [], source: 'local' };

  try {
    const hits = await semanticSearch(opts.serverUrl, q);
    if (hits.length) {
      const results = hits.map((h) => hydrateReference(h.reference)).filter((r): r is SearchResult => !!r);
      if (results.length) return { results, source: 'semantic' };
    }
  } catch {
    // No server / offline / not configured — fall back to keyword search.
  }

  return { results: searchLocalKjv(q), source: 'local' };
}
