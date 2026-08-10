/**
 * One-time populate of the SONGS Vectorize index (multilingual bge-m3, 1024-dim),
 * so POST /search {kind:'songs'} does meaning-based song lookups across Tamil +
 * English. Embeds each bundled song's title + author + chord-stripped lyrics +
 * refs and upserts {id, values, metadata:{id, title, lang}}.
 *
 * Personal / non-commercial use: your own + traditional songs are embedded.
 *
 * Prereqs:
 *   npx wrangler vectorize create songs-bge-m3 --dimensions=1024 --metric=cosine
 *   node scripts/build-songs.mjs            (build assets/songs/songs.json first)
 * Run:
 *   CF_ACCOUNT_ID=xxxx CF_API_TOKEN=yyyy node server/scripts/populate-songs.mjs
 *
 * Token scope: Workers AI (Read) + Vectorize (Edit).
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ACCT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
const INDEX = process.env.SONGS_INDEX || 'songs-bge-m3';
const MODEL = '@cf/baai/bge-m3';
const BATCH = 50;

if (!ACCT || !TOKEN) {
  console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN env vars. See the header comment.');
  process.exit(1);
}
const AUTH = { Authorization: `Bearer ${TOKEN}` };

async function withRetry(fn, label) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn();
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      const wait = 2000 * (attempt + 1);
      console.warn(`  ${label}: HTTP ${res.status}, retrying in ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`${label}: giving up after retries`);
}

async function embed(texts) {
  const res = await withRetry(
    () => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`, {
      method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify({ text: texts }),
    }),
    'embed',
  );
  const data = await res.json();
  return data.result.data;
}

async function upsert(ndjson) {
  await withRetry(
    () => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/vectorize/v2/indexes/${INDEX}/upsert`, {
      method: 'POST', headers: { ...AUTH, 'content-type': 'application/x-ndjson' }, body: ndjson,
    }),
    'upsert',
  );
}

/** Flatten a song into an embeddable string (chords stripped). */
function songText(s) {
  const lyrics = (s.stanzas || []).flatMap((st) => st.lines || []).join(' ').replace(/\[[^\]]*\]/g, '');
  return [s.title, s.author || '', (s.scriptureRefs || []).join(' '), lyrics].join(' \n ').trim().slice(0, 2000);
}

async function main() {
  // Read every bundled song: the personal songbook + the bulk PD hymns.
  const songs = [];
  const seen = new Set();
  for (const rel of ['assets/songs/songs.json', 'assets/hymns/hymns.json']) {
    let arr = [];
    try { arr = JSON.parse(await readFile(resolve(ROOT, rel), 'utf8')); } catch { /* file may not exist */ }
    for (const s of arr) { if (s?.id && !seen.has(s.id)) { seen.add(s.id); songs.push(s); } }
  }
  if (songs.length === 0) { console.error('No songs found. Run `node scripts/build-songs.mjs` first.'); process.exit(1); }
  console.log(`Embedding + upserting ${songs.length} songs in batches of ${BATCH}…`);

  for (let i = 0; i < songs.length; i += BATCH) {
    const batch = songs.slice(i, i + BATCH);
    const vectors = await embed(batch.map(songText));
    const ndjson = batch
      .map((s, j) => JSON.stringify({ id: s.id, values: vectors[j], metadata: { id: s.id, title: String(s.title).slice(0, 120), lang: s.language || 'en' } }))
      .join('\n');
    await upsert(ndjson);
    console.log(`  ${Math.min(i + BATCH, songs.length)}/${songs.length}`);
  }
  console.log('Done. Test: POST /search { "query": "songs about grace", "kind": "songs" }.');
}

main().catch((e) => { console.error(e); process.exit(1); });
