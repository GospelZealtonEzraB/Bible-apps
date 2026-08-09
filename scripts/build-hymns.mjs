/**
 * Build-time generator for the bundled hymn library. Fetches the public-domain
 * "Believers Hymn Book" dataset (classic 19th-century hymns) and converts it to
 * our Hymn model as lyrics-only entries (no chords — the long tail). The
 * hand-authored, chorded hymns in src/data/hymns.ts are kept separately and
 * merged on top.
 *
 * Safety: skip any hymn whose author carries a year later than 1928 (still in
 * copyright). Everything kept is comfortably public domain.
 *
 * Run: node scripts/build-hymns.mjs   ->  assets/hymns/hymns.json
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://raw.githubusercontent.com/josmithua/song-data/master/bhb_songs.json';
const PD_CUTOFF = 1928;

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' hymn')}`;
const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

async function main() {
  console.log('Fetching hymn dataset…');
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const songs = await res.json();

  const out = [];
  let skipped = 0;
  for (const s of songs) {
    const year = (String(s.author || '').match(/(\d{4})/) || [])[1];
    if (year && Number(year) > PD_CUTOFF) { skipped++; continue; } // possibly in copyright

    const stanzas = [];
    (s.verses || []).forEach((v, i) => {
      const lines = (v || []).map(clean).filter(Boolean);
      if (lines.length) stanzas.push({ kind: 'verse', label: String(i + 1), lines });
    });
    const chorus = (s.chorus || []).map(clean).filter(Boolean);
    if (chorus.length) stanzas.push({ kind: 'chorus', lines: chorus });
    if (stanzas.length === 0) continue;

    out.push({
      id: `bhb-${s.id}`,
      title: clean(s.title),
      author: s.author ? clean(s.author) : undefined,
      key: 'C',
      scriptureRefs: [],
      listenUrl: yt(clean(s.title)),
      language: 'en',
      source: 'pd',
      stanzas,
    });
  }

  const dir = resolve(ROOT, 'assets/hymns');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'hymns.json'), JSON.stringify(out));
  console.log(`Wrote ${out.length} hymns (skipped ${skipped} post-${PD_CUTOFF}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
