/**
 * The songbook text format, parsed in-app.
 *
 * This is the TypeScript twin of `scripts/songbook.mjs` (the build-time parser
 * for `assets/songs/*.songbook.txt`). Same format, same output — so a song the
 * family types into the app and a song imported from the repo are identical.
 * `__tests__/songbook.test.ts` runs BOTH implementations over the same fixtures
 * so the two can never drift apart.
 *
 * Format (one block per song; a block starts at a "# " title line):
 *
 *   # Title of the song
 *   @author: Name        @year: 1779        @key: G
 *   @lang: ta            (optional; auto-detected from Tamil script if omitted)
 *   @source: personal    (personal|pd|link)  @ref: John 3:16; Psalm 23
 *   @listen: <url>       @lyricsUrl: <url, for link-only songs>
 *
 *   [verse]
 *   A-[G]mazing line (inline [chords] optional)
 *   [chorus]             ([pallavi]/[refrain]/[anupallavi] also accepted)
 *   chorus line
 *
 * Blank lines also separate stanzas. Tamil is auto-detected (Unicode ஀–௿).
 */
import type { Hymn, HymnStanza } from '@/data/hymns';

const TAMIL_RE = /[஀-௿]/;

/** URL-safe id fragment from a title (Tamil letters are kept). */
export function slugify(s: string): string {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9஀-௿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'song'
  );
}

/** Map a section marker to a stanza kind (Tamil section names included). */
function kindOf(marker: string): HymnStanza['kind'] {
  const m = marker.toLowerCase();
  if (m === 'chorus' || m === 'pallavi') return 'chorus';
  if (m === 'refrain' || m === 'anupallavi') return 'refrain';
  return 'verse'; // verse, charanam, stanza, anything else
}

/** Parse one song block (its lines; the title is already stripped). */
function parseBlock(title: string, lines: string[], indexFallback: number): Hymn {
  const meta: Record<string, string> = {};
  const stanzas: HymnStanza[] = [];
  let cur: HymnStanza | null = null;
  let verseNo = 0;

  const flush = () => {
    if (cur && cur.lines.length) stanzas.push(cur);
    cur = null;
  };
  const startStanza = (kind: HymnStanza['kind']) => {
    flush();
    if (kind === 'verse') {
      verseNo += 1;
      cur = { kind, label: String(verseNo), lines: [] };
    } else {
      cur = { kind, lines: [] };
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    if (!line.trim()) {
      flush();
      continue;
    } // a blank line ends a stanza

    const metaMatch = line.match(/^@(\w+)\s*:\s*(.*)$/);
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    const sectionMatch = line.trim().match(/^\[([a-zA-Z]+)\]$/);
    if (sectionMatch) {
      startStanza(kindOf(sectionMatch[1]));
      continue;
    }

    if (!cur) startStanza('verse');
    cur!.lines.push(line.trim());
  }
  flush();

  const allText = `${title} ${stanzas.flatMap((s) => s.lines).join(' ')}`;
  const language: Hymn['language'] =
    meta.lang === 'ta' || meta.lang === 'en' ? meta.lang : TAMIL_RE.test(allText) ? 'ta' : 'en';
  const source = (['pd', 'personal', 'link', 'ccli'] as const).includes(meta.source as any)
    ? (meta.source as Hymn['source'])
    : 'personal';
  const scriptureRefs = meta.ref
    ? meta.ref.split(/[;,]/).map((r) => r.trim()).filter(Boolean)
    : [];
  const listenUrl =
    meta.listen || `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;

  return {
    id: meta.id ? slugify(meta.id) : `${slugify(title)}-${indexFallback}`,
    title: title.trim(),
    author: meta.author || undefined,
    year: meta.year || undefined,
    key: meta.key || 'C',
    scriptureRefs,
    listenUrl,
    lyricsUrl: meta.lyricsurl || undefined,
    language,
    source,
    stanzas,
  };
}

/** Parse a whole songbook document into songs. Never throws; bad blocks are skipped. */
export function parseSongbook(text: string): Hymn[] {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks: { title: string; lines: string[] }[] = [];
  let title: string | null = null;
  let buf: string[] = [];
  const push = () => {
    if (title != null) blocks.push({ title, lines: buf });
  };
  for (const line of lines) {
    const t = line.match(/^#\s+(.*)$/);
    if (t) {
      push();
      title = t[1].trim();
      buf = [];
      continue;
    }
    if (title != null) buf.push(line);
  }
  push();

  const out: Hymn[] = [];
  const seen = new Set<string>();
  blocks.forEach((b, i) => {
    if (!b.title) return;
    const song = parseBlock(b.title, b.lines, i + 1);
    // Keep only songs that have lyrics OR are deliberately link-only.
    if (song.stanzas.length === 0 && song.source !== 'link') return;
    let id = song.id;
    let n = 2;
    while (seen.has(id)) id = `${song.id}-${n++}`;
    seen.add(id);
    out.push({ ...song, id });
  });
  return out;
}

/** Serialize a song back to the text format — for editing an existing song. */
export function songToText(song: Hymn): string {
  const lines: string[] = [`# ${song.title}`];
  if (song.author) lines.push(`@author: ${song.author}`);
  if (song.year) lines.push(`@year: ${song.year}`);
  lines.push(`@key: ${song.key}`);
  if (song.language) lines.push(`@lang: ${song.language}`);
  lines.push(`@source: ${song.source}`);
  if (song.scriptureRefs.length) lines.push(`@ref: ${song.scriptureRefs.join('; ')}`);
  if (song.listenUrl) lines.push(`@listen: ${song.listenUrl}`);
  if (song.lyricsUrl) lines.push(`@lyricsUrl: ${song.lyricsUrl}`);
  for (const st of song.stanzas) {
    lines.push('', `[${st.kind}]`, ...st.lines);
  }
  return lines.join('\n');
}
