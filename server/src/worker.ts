/**
 * Engraved server — a tiny Cloudflare Worker that holds the secret API keys the
 * app can't ship (Anthropic for AI features, Crossway for ESV) and proxies
 * requests. Deploy with `wrangler deploy`; set secrets with `wrangler secret put`.
 *
 * Endpoints:
 *   POST /ai   { task: 'hook'|'explain'|'pack', reference?, text?, theme? }
 *   POST /esv  { reference }
 *
 * The AI never produces Scripture text — the app always fetches real verses from
 * trusted providers. `pack` returns references only.
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
  ESV_API_KEY?: string;
  /** Optional shared secret; if set, callers must send it as `x-app-secret`. */
  APP_SHARED_SECRET?: string;
  /** Claude model id; defaults to the cheapest suitable model. */
  AI_MODEL?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-app-secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

async function callClaude(
  env: Env,
  system: string,
  user: string,
  maxTokens = 400,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim();
}

const HOOK_SYSTEM =
  'You craft short, vivid memory aids that help someone memorize a Bible verse. ' +
  'Given the reference and text, produce ONE concise memory hook — a mnemonic, a ' +
  'vivid mental image, or a structural pattern — in 1–2 sentences. Do NOT restate ' +
  'the verse. No preamble, no quotation marks around the whole thing.';

const EXPLAIN_SYSTEM =
  'You explain Bible verses simply and faithfully. In 2–4 sentences, give the ' +
  'plain-English meaning and brief context (who wrote it, to whom, the situation). ' +
  'Be accurate and broadly ecumenical; avoid denominationally controversial claims. ' +
  'No preamble.';

const PACK_SYSTEM =
  'You suggest Bible verse REFERENCES for a theme. Return ONLY a JSON array of 4–8 ' +
  'reference strings, e.g. ["John 3:16","Romans 8:28"]. Do NOT include any verse ' +
  'text, commentary, or prose — only the JSON array of references.';

function parseReferences(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

async function handleAi(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const task = body.task as string;
  const reference = String(body.reference ?? '');
  const text = String(body.text ?? '');

  if (task === 'hook') {
    const out = await callClaude(env, HOOK_SYSTEM, `Reference: ${reference}\nText: ${text}`, 220);
    return json({ text: out });
  }
  if (task === 'explain') {
    const out = await callClaude(env, EXPLAIN_SYSTEM, `Reference: ${reference}\nText: ${text}`, 320);
    return json({ text: out });
  }
  if (task === 'pack') {
    const theme = String(body.theme ?? '').slice(0, 200);
    const out = await callClaude(env, PACK_SYSTEM, `Theme: ${theme}`, 200);
    return json({ references: parseReferences(out) });
  }
  return json({ error: 'Unknown task. Use hook | explain | pack.' }, 400);
}

async function handleEsv(req: Request, env: Env): Promise<Response> {
  if (!env.ESV_API_KEY) return json({ error: 'ESV not configured on the server.' }, 501);
  const body: any = await req.json().catch(() => ({}));
  const reference = String(body.reference ?? '').trim();
  if (!reference) return json({ error: 'Missing reference.' }, 400);

  const url =
    'https://api.esv.org/v3/passage/text/?q=' +
    encodeURIComponent(reference) +
    '&include-headings=false&include-footnotes=false&include-verse-numbers=false' +
    '&include-short-copyright=false&include-passage-references=false';
  const res = await fetch(url, { headers: { Authorization: `Token ${env.ESV_API_KEY}` } });
  if (!res.ok) return json({ error: `ESV HTTP ${res.status}` }, 502);
  const data: any = await res.json();
  const text = (data.passages ?? []).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return json({ error: 'Verse not found.' }, 404);
  return json({ reference: data.canonical || reference, text });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    if (env.APP_SHARED_SECRET) {
      const provided = request.headers.get('x-app-secret');
      if (provided !== env.APP_SHARED_SECRET) return json({ error: 'Unauthorized' }, 401);
    }

    const path = new URL(request.url).pathname.replace(/\/$/, '');
    try {
      if (path === '/ai') return await handleAi(request, env);
      if (path === '/esv') return await handleEsv(request, env);
      return json({ error: 'Not found. Use /ai or /esv.' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error';
      return json({ error: message }, 500);
    }
  },
};
