/**
 * Pure parser for the ".songbook.txt" template → an array of Hymn-shaped song
 * objects (the schema in src/data/hymns.ts). Kept dependency-free and exported
 * so both scripts/build-songs.mjs and the jest test use the same logic.
 *
 * Template (one block per song; a block starts at a "# " title line):
 *
 *   # Title of the song
 *   @author: Name        @year: 1779        @key: G
 *   @lang: ta            (optional; auto-detected from Tamil script if omitted)
 *   @source: personal    (personal|pd|link) @ref: John 3:16; Psalm 23
 *   @listen: <url>       @lyricsUrl: <url, for link-only songs>
 *
 *   [verse]
 *   A-[G]mazing line (inline [chords] optional)
 *   next line
 *   [chorus]             ([pallavi]/[refrain] also accepted)
 *   chorus line
 *
 * Blank lines also separate stanzas. Tamil is auto-detected (Unicode ஀–௿).
 */

const TAMIL_RE = /[஀-௿]/;

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9஀-௿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'song';
}

/** Map a section marker to a stanza kind. */
function kindOf(marker) {
  const m = marker.toLowerCase();
  if (m === 'chorus' || m === 'pallavi') return 'chorus';
  if (m === 'refrain' || m === 'anupallavi') return 'refrain';
  return 'verse'; // verse, charanam, stanza, anything else
}

/** Parse one song block (its lines, title already stripped) into a Hymn object. */
function parseBlock(title, lines, indexFallback) {
  const meta = {};
  const stanzas = [];
  let cur = null; // { kind, label, lines }
  let verseNo = 0;

  const flush = () => { if (cur && cur.lines.length) stanzas.push(cur); cur = null; };
  const startStanza = (kind) => {
    flush();
    if (kind === 'verse') { verseNo += 1; cur = { kind, label: String(verseNo), lines: [] }; }
    else cur = { kind, lines: [] };
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    if (!line.trim()) { flush(); continue; } // blank line ends a stanza

    const metaMatch = line.match(/^@(\w+)\s*:\s*(.*)$/);
    if (metaMatch) { meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim(); continue; }

    const sectionMatch = line.trim().match(/^\[([a-zA-Z]+)\]$/);
    if (sectionMatch) { startStanza(kindOf(sectionMatch[1])); continue; }

    if (!cur) startStanza('verse');
    cur.lines.push(line.trim());
  }
  flush();

  const allText = title + ' ' + stanzas.flatMap((s) => s.lines).join(' ');
  const language = meta.lang === 'ta' || meta.lang === 'en' ? meta.lang : (TAMIL_RE.test(allText) ? 'ta' : 'en');
  const source = ['pd', 'personal', 'link', 'ccli'].includes(meta.source) ? meta.source : 'personal';
  const scriptureRefs = meta.ref ? meta.ref.split(/[;,]/).map((r) => r.trim()).filter(Boolean) : [];
  const listenUrl = meta.listen || `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;

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

/** Parse a full .songbook.txt document into an array of song objects. */
export function parseSongbook(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let title = null;
  let buf = [];
  const push = () => { if (title != null) blocks.push({ title, lines: buf }); };
  for (const line of lines) {
    const t = line.match(/^#\s+(.*)$/);
    if (t) { push(); title = t[1].trim(); buf = []; continue; }
    if (title != null) buf.push(line);
  }
  push();

  const out = [];
  const seen = new Set();
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
