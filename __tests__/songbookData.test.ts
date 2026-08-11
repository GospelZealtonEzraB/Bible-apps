import {
  allSongs,
  mySongs,
  favoriteSongs,
  getSong,
  searchAll,
  songsForRef,
  matchSongByTitle,
  playLinks,
  toUserSong,
  newSongId,
  isMine,
  toggleFavorite,
  MINE_PREFIX,
  type Hymn,
} from '../src/data/songbook';
import { HYMNS } from '../src/data/hymns';

const mine = (over: Partial<Hymn> = {}): Hymn => ({
  id: 's_mine1',
  title: 'ஆராதனை',
  author: 'Traditional',
  key: 'C',
  scriptureRefs: ['Psalm 100:2'],
  language: 'ta',
  source: 'personal',
  stanzas: [{ kind: 'chorus', lines: ['ஆராதனை ஆராதனை'] }],
  ...over,
});

describe('allSongs — three tiers', () => {
  test('bundled library alone when the store is empty', () => {
    expect(allSongs()).toHaveLength(HYMNS.length);
    expect(allSongs({})).toHaveLength(HYMNS.length);
  });

  test("the family's own songs come first and add to the total", () => {
    const list = allSongs({ songs: { s_mine1: mine() } });
    expect(list[0].title).toBe('ஆராதனை');
    expect(list).toHaveLength(HYMNS.length + 1);
  });

  test('a chord overlay replaces a bundled song’s stanzas without touching the asset', () => {
    const target = HYMNS.find((h) => h.stanzas.length > 0)!;
    const stanzas = [{ kind: 'verse' as const, label: '1', lines: ['[G]new chords here'] }];
    const list = allSongs({ songChords: { [target.id]: stanzas } });
    expect(list.find((s) => s.id === target.id)!.stanzas).toEqual(stanzas);
    // The bundled asset itself is untouched.
    expect(HYMNS.find((h) => h.id === target.id)!.stanzas).toEqual(target.stanzas);
  });

  test('an empty overlay is ignored (falls back to the original)', () => {
    const target = HYMNS[0];
    const list = allSongs({ songChords: { [target.id]: [] } });
    expect(list.find((s) => s.id === target.id)!.stanzas).toEqual(target.stanzas);
  });

  test('a user song with a bundled id shadows the bundled one (no duplicates)', () => {
    const target = HYMNS[0];
    const list = allSongs({ songs: { [target.id]: mine({ id: target.id, title: 'Mine wins' }) } });
    expect(list.filter((s) => s.id === target.id)).toHaveLength(1);
    expect(list.find((s) => s.id === target.id)!.title).toBe('Mine wins');
  });
});

describe('lookups', () => {
  const state = { songs: { s_mine1: mine() }, favoriteSongs: ['s_mine1', 'nope', HYMNS[0].id] };

  test('getSong finds both tiers, and nothing for an unknown id', () => {
    expect(getSong('s_mine1', state)!.title).toBe('ஆராதனை');
    expect(getSong(HYMNS[0].id, state)!.id).toBe(HYMNS[0].id);
    expect(getSong('does-not-exist', state)).toBeUndefined();
    expect(getSong(undefined, state)).toBeUndefined();
  });

  test('mySongs returns only the family’s songs, sorted by title', () => {
    const two = { songs: { s_b: mine({ id: 's_b', title: 'Zion' }), s_a: mine({ id: 's_a', title: 'Abide' }) } };
    expect(mySongs(two).map((s) => s.title)).toEqual(['Abide', 'Zion']);
    expect(mySongs()).toEqual([]);
  });

  test('favorites keep star order and drop ids that no longer exist', () => {
    expect(favoriteSongs(state).map((s) => s.id)).toEqual(['s_mine1', HYMNS[0].id]);
  });

  test('search covers the family’s songs as well as the bundled ones', () => {
    expect(searchAll('ஆராதனை', state).map((s) => s.id)).toContain('s_mine1');
    expect(searchAll('amazing grace', state).length).toBeGreaterThan(0);
  });

  test('songsForRef matches a user song’s declared Scripture', () => {
    const hits = songsForRef('Psalm 100:2', state);
    expect(hits[0]).toMatchObject({ precision: 'exact' });
    expect(hits.map((h) => h.hymn.id)).toContain('s_mine1');
  });

  test('matchSongByTitle links a suggested title back to a song we have', () => {
    expect(matchSongByTitle('Amazing Grace')?.title).toMatch(/Amazing Grace/i);
    expect(matchSongByTitle('')).toBeUndefined();
  });
});

describe('playback links', () => {
  test('three services, deep links only, and the song’s own listen url wins for YouTube', () => {
    const song = mine({ title: 'It Is Well', author: 'Spafford', listenUrl: 'https://youtu.be/abc' });
    const links = playLinks(song);
    expect(links.map((l) => l.key)).toEqual(['spotify', 'ytmusic', 'youtube']);
    expect(links[0].url).toContain('open.spotify.com/search/');
    expect(links[0].url).toContain('It%20Is%20Well');
    expect(links[2].url).toBe('https://youtu.be/abc');
  });

  test('falls back to a YouTube search when the song has no listen url', () => {
    expect(playLinks(mine({ listenUrl: undefined })!)[2].url).toContain('youtube.com/results');
  });
});

describe('editing helpers', () => {
  test('new ids are unique and namespaced', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newSongId(1700000000000)));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isMine(id)).toBe(true);
    expect(isMine(HYMNS[0].id)).toBe(false);
    expect([...ids][0].startsWith(MINE_PREFIX)).toBe(true);
  });

  test('toUserSong keeps a valid mine-id and re-mints a bundled one', () => {
    expect(toUserSong(mine(), 's_keep').id).toBe('s_keep');
    expect(isMine(toUserSong(mine(), 'amazing-grace').id)).toBe(true);
  });

  test('toUserSong never stores an empty title', () => {
    expect(toUserSong(mine({ title: '   ' })).title).toBe('Untitled song');
  });

  test('toggleFavorite adds, removes, and preserves order', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a']);
    expect(toggleFavorite(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleFavorite(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});
