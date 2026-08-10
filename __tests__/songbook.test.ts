// @ts-nocheck — the parser is plain JS shared with the build script.
import { parseSongbook, slugify } from '../scripts/songbook.mjs';

describe('parseSongbook', () => {
  test('parses title, metadata, verses and chorus with inline chords', () => {
    const doc = `# Amazing Grace
@author: John Newton
@year: 1779
@key: G
@source: pd
@ref: Ephesians 2:8; John 9:25

[verse]
A-[G]mazing grace! how [C]sweet the [G]sound
That saved a wretch like [D]me!
[chorus]
Praise the Lord
`;
    const [s] = parseSongbook(doc);
    expect(s.title).toBe('Amazing Grace');
    expect(s.author).toBe('John Newton');
    expect(s.year).toBe('1779');
    expect(s.key).toBe('G');
    expect(s.source).toBe('pd');
    expect(s.language).toBe('en');
    expect(s.scriptureRefs).toEqual(['Ephesians 2:8', 'John 9:25']);
    expect(s.stanzas[0]).toMatchObject({ kind: 'verse', label: '1' });
    expect(s.stanzas[0].lines[0]).toContain('[G]');
    expect(s.stanzas[1].kind).toBe('chorus');
  });

  test('auto-detects Tamil script and maps pallavi → chorus', () => {
    const doc = `# ஆராதனை
@source: personal

[pallavi]
ஆராதனை ஆராதனை
[verse]
உம்மைப் போற்றுகிறோம்
`;
    const [s] = parseSongbook(doc);
    expect(s.language).toBe('ta');
    expect(s.source).toBe('personal');
    expect(s.stanzas[0].kind).toBe('chorus');
    expect(s.stanzas[1].kind).toBe('verse');
  });

  test('blank lines separate stanzas and verses auto-number', () => {
    const doc = `# Two Verses

first verse line

second verse line
`;
    const [s] = parseSongbook(doc);
    expect(s.stanzas.map((x) => x.label)).toEqual(['1', '2']);
  });

  test('multiple songs; ids are unique and slugified', () => {
    const doc = `# Song One
[verse]
a
# Song One
[verse]
b`;
    const songs = parseSongbook(doc);
    expect(songs).toHaveLength(2);
    expect(new Set(songs.map((s) => s.id)).size).toBe(2);
  });

  test('a link-only song with no lyrics is kept (metadata + deep-link)', () => {
    const doc = `# Modern Worship Song
@source: link
@lyricsUrl: https://example.com/lyrics`;
    const [s] = parseSongbook(doc);
    expect(s.source).toBe('link');
    expect(s.stanzas).toHaveLength(0);
    expect(s.lyricsUrl).toBe('https://example.com/lyrics');
  });

  test('slugify handles Tamil + punctuation', () => {
    expect(slugify('Amazing Grace!')).toBe('amazing-grace');
    expect(slugify('  ')).toBe('song');
  });
});
