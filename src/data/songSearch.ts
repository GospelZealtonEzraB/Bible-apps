/**
 * Songbook search orchestrator: meaning-based (semantic, online, Tamil+English)
 * first, falling back to the offline keyword search. Mirrors the scripture
 * search orchestrator (src/data/search.ts). Semantic hits are song ids the app
 * hydrates from the songbook — so results always render locally, and a song the
 * family added in-app is searched exactly like a bundled one.
 */
import { postServer } from './serverClient';
import { allSongs, getSong, searchAll, type Hymn, type SongbookState } from './songbook';

interface SongHitId { id: string; score: number }

export interface SongbookSearchResult {
  results: Hymn[];
  source: 'semantic' | 'keyword';
}

async function semantic(serverUrl: string | null, query: string, state: SongbookState): Promise<Hymn[]> {
  const data = await postServer<{ results?: SongHitId[] }>(serverUrl, '/search', { query, kind: 'songs' });
  const hits = Array.isArray(data.results) ? data.results : [];
  const out: Hymn[] = [];
  for (const h of hits) {
    const song = getSong(h.id, state);
    if (song) out.push(song);
  }
  return out;
}

/**
 * Search the whole songbook. Tries semantic (online) — if it returns hydratable
 * hits, use them; otherwise fall back to the offline keyword index. The offline
 * tier always includes the family's own songs (the semantic index only knows
 * the bundled ones). Never throws.
 */
export async function searchSongbook(
  query: string,
  opts: { serverUrl?: string | null; songbook?: SongbookState } = {},
): Promise<SongbookSearchResult> {
  const state = opts.songbook ?? {};
  const q = query.trim();
  if (q.length < 2) return { results: q ? searchAll(q, state) : allSongs(state), source: 'keyword' };
  const local = searchAll(q, state);
  try {
    const results = await semantic(opts.serverUrl ?? null, q, state);
    if (results.length) {
      // Keep any local keyword hit the semantic index doesn't know about
      // (notably the family's own songs), appended after the meaning matches.
      const seen = new Set(results.map((r) => r.id));
      return { results: [...results, ...local.filter((l) => !seen.has(l.id))], source: 'semantic' };
    }
  } catch {
    // offline / server down / not configured → keyword
  }
  return { results: local, source: 'keyword' };
}
