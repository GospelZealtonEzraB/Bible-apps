/**
 * Song search via the server's Genius proxy. Returns metadata + the Genius page
 * URL only — lyrics/chords are viewed off-app (deep-links), never reproduced
 * in-app (copyright).
 */
import { postServer } from './serverClient';

export interface SongHit {
  id: number;
  title: string;
  artist?: string;
  thumbnail?: string;
  /** Genius page URL — where the lyrics live. */
  url: string;
}

export async function searchSongs(serverUrl: string | null | undefined, q: string): Promise<SongHit[]> {
  const data = await postServer<{ results?: SongHit[] }>(serverUrl ?? null, '/genius', { q });
  return data.results ?? [];
}

/** Deep-link helpers for viewing lyrics/chords/audio off-app. */
export const songLinks = {
  chords: (title: string, artist?: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${title} ${artist ?? ''} chords`)}`,
  listen: (title: string, artist?: string) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist ?? ''}`)}`,
};
