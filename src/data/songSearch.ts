/**
 * Songbook search orchestrator: meaning-based (semantic, online, Tamil+English)
 * first, falling back to the offline keyword `searchHymns`. Mirrors the scripture
 * search orchestrator (src/data/search.ts). Semantic hits are song ids the app
 * hydrates from the bundled `HYMNS` — so results always render locally.
 */
import { postServer } from './serverClient';
import { HYMNS, searchHymns, getHymn, type Hymn } from './hymns';

interface SongHitId { id: string; score: number }

export interface SongbookSearchResult {
  results: Hymn[];
  source: 'semantic' | 'keyword';
}

async function semantic(serverUrl: string | null, query: string): Promise<Hymn[]> {
  const data = await postServer<{ results?: SongHitId[] }>(serverUrl, '/search', { query, kind: 'songs' });
  const hits = Array.isArray(data.results) ? data.results : [];
  const out: Hymn[] = [];
  for (const h of hits) {
    const song = getHymn(h.id);
    if (song) out.push(song);
  }
  return out;
}

/**
 * Search the bundled songbook. Tries semantic (online) — if it returns hydratable
 * hits, use them; otherwise fall back to the offline keyword index. Never throws.
 */
export async function searchSongbook(
  query: string,
  opts: { serverUrl?: string | null } = {},
): Promise<SongbookSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { results: q ? searchHymns(q) : HYMNS, source: 'keyword' };
  try {
    const results = await semantic(opts.serverUrl ?? null, q);
    if (results.length) return { results, source: 'semantic' };
  } catch {
    // offline / server down / not configured → keyword
  }
  return { results: searchHymns(q), source: 'keyword' };
}
