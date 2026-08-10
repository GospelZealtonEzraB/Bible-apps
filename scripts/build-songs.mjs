/**
 * Build-time generator for the personal songbook. Reads every
 * assets/songs/*.songbook.txt file, parses them with the shared songbook parser,
 * and writes assets/songs/songs.json (the Hymn[] the app merges into HYMNS).
 *
 * Personal / non-commercial use: full lyrics for your own + traditional songs are
 * bundled. Keep the build private — do not publish it publicly.
 *
 * Run: node scripts/build-songs.mjs   ->  assets/songs/songs.json
 */
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSongbook } from './songbook.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'assets/songs');

async function main() {
  await mkdir(DIR, { recursive: true });
  let files = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith('.songbook.txt')).sort();
  } catch { /* no dir yet */ }

  const out = [];
  const seen = new Set();
  for (const f of files) {
    const text = await readFile(resolve(DIR, f), 'utf8');
    for (const song of parseSongbook(text)) {
      let id = song.id;
      let n = 2;
      while (seen.has(id)) id = `${song.id}-${n++}`;
      seen.add(id);
      out.push({ ...song, id });
    }
  }

  await writeFile(resolve(DIR, 'songs.json'), JSON.stringify(out));
  const ta = out.filter((s) => s.language === 'ta').length;
  console.log(`Wrote ${out.length} songs from ${files.length} file(s) (${ta} Tamil, ${out.length - ta} English).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
