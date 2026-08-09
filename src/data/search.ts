/**
 * Scripture search orchestrator. Today: offline keyword search over the bundled
 * KJV. Next: try server-side **semantic** search (Workers AI + Vectorize) first —
 * which returns references-only — then hydrate snippets from the local text and
 * fall back to this keyword search when offline or the server is unset. Keeping
 * this seam here means the screen never changes when semantic lands.
 */
import { searchLocalKjv, type SearchResult } from './localSearch';

export type { SearchResult } from './localSearch';

export interface SearchResponse {
  results: SearchResult[];
  /** Which tier answered — surfaced in the UI. */
  source: 'local' | 'semantic';
}

export async function searchScripture(query: string, _opts: { serverUrl?: string | null } = {}): Promise<SearchResponse> {
  // TODO(semantic): when a serverUrl is configured, POST /search (Workers AI +
  // Vectorize) for meaning-based references, hydrate from local text, and fall
  // back to keyword on error/offline. For now, keyword-only (offline).
  return { results: searchLocalKjv(query), source: 'local' };
}
