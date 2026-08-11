/**
 * The one songbook.
 *
 * Three tiers resolved into a single list so every caller (search, the chat
 * attach tray, songs-from-a-verse, the daily "sing" movement) sees the same
 * songs:
 *   1. BUNDLED — the public-domain hymnal + the repo-imported personal songbook
 *      (`src/data/hymns.ts` → `HYMNS`).
 *   2. MINE — songs the family typed into the app (Tamil included), stored in
 *      the `songs` slice. These win over a bundled song with the same id.
 *   3. CHORDS — a per-song stanza overlay, so chords can be written onto a
 *      lyrics-only public-domain hymn without touching the bundled asset.
 *
 * Everything here is pure: state comes in as an argument, nothing is read from
 * the store. Playback is deep-link only — we never host audio.
 */
import {
  HYMNS,
  getHymn,
  searchHymns,
  hymnsForRef,
  matchHymnByTitle,
  hymnHasChords,
  type Hymn,
  type HymnStanza,
  type HymnRefMatch,
} from './hymns';

export type { Hymn, HymnStanza, HymnRefMatch };
export { hymnHasChords };

/** Ids of songs the family added in-app are prefixed so tiers never collide. */
export const MINE_PREFIX = 's_';

export function isMine(id: string): boolean {
  return id.startsWith(MINE_PREFIX);
}

/** The songbook slices of the store, passed in so this module stays pure. */
export interface SongbookState {
  /** Songs added in the app, by id. */
  songs?: Record<string, Hymn>;
  /** Chord/lyric overlays for a bundled song, by that song's id. */
  songChords?: Record<string, HymnStanza[]>;
  /** Favourite song ids (any tier). */
  favoriteSongs?: string[];
}

/** Apply a chord overlay to a bundled song, if one exists. */
function withOverlay(song: Hymn, overlays: Record<string, HymnStanza[]>): Hymn {
  const stanzas = overlays[song.id];
  return stanzas && stanzas.length ? { ...song, stanzas } : song;
}

/**
 * Every song, in one list: the family's own songs first (they're the ones being
 * sung), then the bundled library, with overlays applied.
 */
export function allSongs(state: SongbookState = {}): Hymn[] {
  const mine = Object.values(state.songs ?? {});
  const overlays = state.songChords ?? {};
  const mineIds = new Set(mine.map((s) => s.id));
  const bundled = HYMNS.filter((h) => !mineIds.has(h.id)).map((h) => withOverlay(h, overlays));
  return [...mine, ...bundled];
}

/** Just the family's own songs, newest first is not meaningful — sort by title. */
export function mySongs(state: SongbookState = {}): Hymn[] {
  return Object.values(state.songs ?? {}).sort((a, b) => a.title.localeCompare(b.title));
}

/** Favourites, in the order they were starred, resolved to songs that still exist. */
export function favoriteSongs(state: SongbookState = {}): Hymn[] {
  const all = allSongs(state);
  return (state.favoriteSongs ?? [])
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Hymn => !!s);
}

export function getSong(id: string | undefined, state: SongbookState = {}): Hymn | undefined {
  if (!id) return undefined;
  return state.songs?.[id] ?? getHymn(id, allSongs(state));
}

/** Keyword search across all three tiers (the offline tier of songbook search). */
export function searchAll(query: string, state: SongbookState = {}): Hymn[] {
  return searchHymns(query, allSongs(state));
}

/** Songs whose declared Scripture matches a reference — across all tiers. */
export function songsForRef(reference: string, state: SongbookState = {}): HymnRefMatch[] {
  return hymnsForRef(reference, allSongs(state));
}

/** Link an AI-suggested/Genius title back to a song we actually have. */
export function matchSongByTitle(title: string, state: SongbookState = {}): Hymn | undefined {
  return matchHymnByTitle(title, allSongs(state));
}

// ---- Playback (deep links only — no hosted audio) --------------------------

const q = (song: Pick<Hymn, 'title' | 'author'>) =>
  encodeURIComponent(`${song.title} ${song.author ?? ''}`.trim());

/**
 * Where to hear a song. We can't host audio, so each of these opens the song in
 * a service the user already has. `youtube` prefers the song's own `listenUrl`
 * when the songbook carries one.
 */
export function playLinks(song: Hymn): { key: string; label: string; url: string }[] {
  return [
    { key: 'spotify', label: 'Spotify', url: `https://open.spotify.com/search/${q(song)}` },
    { key: 'ytmusic', label: 'YouTube Music', url: `https://music.youtube.com/search?q=${q(song)}` },
    { key: 'youtube', label: 'YouTube', url: song.listenUrl || `https://www.youtube.com/results?search_query=${q(song)}` },
  ];
}

/** Where to find a chord chart for a song we don't have chords for. */
export function chordChartUrl(song: Hymn): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${song.title} ${song.author ?? ''} chords`)}`;
}

// ---- Editing (pure reducers over the songbook slices) ----------------------

let seq = 0;

/** A collision-proof id for a song the family adds in-app. */
export function newSongId(now = Date.now()): string {
  seq = (seq + 1) % 1000;
  return `${MINE_PREFIX}${now.toString(36)}${seq.toString(36)}`;
}

/**
 * Normalize a parsed/edited song into a storable one: a stable id in the "mine"
 * namespace and a title that is never empty.
 */
export function toUserSong(song: Hymn, id = newSongId()): Hymn {
  return {
    ...song,
    id: isMine(id) ? id : newSongId(),
    title: song.title.trim() || 'Untitled song',
    source: song.source === 'link' ? 'link' : song.source ?? 'personal',
  };
}

/** Toggle a favourite, preserving order (starred songs append). */
export function toggleFavorite(favorites: string[], id: string): string[] {
  return favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
}
