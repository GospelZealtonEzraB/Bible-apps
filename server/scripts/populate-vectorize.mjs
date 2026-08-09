/**
 * One-time populate of the Vectorize index with KJV verse embeddings, so
 * POST /search can do meaning-based lookups. Embeds each verse with Workers AI
 * (bge-base-en-v1.5, 768-dim) and upserts {id, values, metadata:{ref}} — no
 * verse text is stored, only references (metadata).
 *
 * KJV is public domain, so embedding it is fine; the query path returns
 * references only (the app hydrates text locally).
 *
 * Prereqs:
 *   npx wrangler vectorize create kjv-bge-base --dimensions=768 --metric=cosine
 * Run:
 *   CF_ACCOUNT_ID=xxxx CF_API_TOKEN=yyyy node server/scripts/populate-vectorize.mjs
 *
 * The API token needs: Workers AI (Read) + Vectorize (Edit). Cost is a few cents.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ACCT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
const INDEX = process.env.VECTORIZE_INDEX || 'kjv-bge-base';
const MODEL = '@cf/baai/bge-base-en-v1.5';
const BATCH = 100;

const NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew',
  'Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter',
  '2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

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
  return data.result.data; // number[][]
}

async function upsert(ndjson) {
  await withRetry(
    () => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/vectorize/v2/indexes/${INDEX}/upsert`, {
      method: 'POST', headers: { ...AUTH, 'content-type': 'application/x-ndjson' }, body: ndjson,
    }),
    'upsert',
  );
}

async function main() {
  // Build the flat verse list from the bundled KJV.
  const items = [];
  for (let n = 1; n <= 66; n++) {
    const book = JSON.parse(await readFile(resolve(ROOT, `assets/bible/kjv/${n}.json`), 'utf8'));
    for (let c = 0; c < book.length; c++) {
      for (let v = 0; v < book[c].length; v++) {
        items.push({ id: `${n}-${c + 1}-${v + 1}`, ref: `${NAMES[n - 1]} ${c + 1}:${v + 1}`, text: book[c][v] });
      }
    }
  }
  console.log(`Embedding + upserting ${items.length} verses in batches of ${BATCH}…`);

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const vectors = await embed(batch.map((b) => b.text));
    const ndjson = batch.map((b, j) => JSON.stringify({ id: b.id, values: vectors[j], metadata: { ref: b.ref } })).join('\n');
    await upsert(ndjson);
    console.log(`  ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  console.log('Done. Test with a POST /search { "query": "verses about anxiety" }.');
}

main().catch((e) => { console.error(e); process.exit(1); });
