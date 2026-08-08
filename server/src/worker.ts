/**
 * Engraved server — a tiny Cloudflare Worker that holds the secret AI API key the
 * app can't ship, and proxies AI requests. Works with OpenAI or Anthropic.
 * Deploy with `wrangler deploy`; set secrets with `wrangler secret put`.
 *
 * Endpoints:
 *   POST /ai   { task: 'hook'|'explain'|'pack', reference?, text?, theme? }
 *   (POST /esv is present but commented out — needs a separate Crossway key.)
 *
 * The AI never produces Scripture text — the app always fetches real verses from
 * trusted providers. `pack` returns references only.
 */

/**
 * Minimal shape of a Cloudflare KV namespace (self-contained so the Worker needs
 * no ambient @cloudflare/workers-types). The real binding satisfies this.
 */
interface KVListResult {
  keys: { name: string }[];
  list_complete: boolean;
  cursor?: string;
}
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string; limit?: number }): Promise<KVListResult>;
}

export interface Env {
  /** Set one of these. If both are present, OpenAI is used. */
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ESV_API_KEY?: string;
  /** Optional shared secret; if set, callers must send it as `x-app-secret`. */
  APP_SHARED_SECRET?: string;
  /** Model id for the active provider. Defaults per provider if unset. */
  AI_MODEL?: string;
  /** KV store for Growing Together shared state (optional; routes 501 without it). */
  ENGRAVED_KV?: KVNamespaceLike;
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

/**
 * Call whichever LLM provider is configured. OpenAI takes precedence when both
 * keys are present. Set the exact model with the AI_MODEL variable.
 */
async function callLLM(
  env: Env,
  system: string,
  user: string,
  maxTokens = 400,
): Promise<string> {
  // --- OpenAI (Chat Completions) ---
  if (env.OPENAI_API_KEY) {
    const model = env.AI_MODEL || 'gpt-5.4-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // max_completion_tokens is the current, cross-model param name. Reasoning
        // models (gpt-5.x) spend some of this budget on hidden reasoning, so keep
        // a healthy floor or the visible answer can come back empty.
        max_completion_tokens: Math.max(maxTokens, 768),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data: any = await res.json();
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }

  // --- Anthropic (Messages) ---
  if (env.ANTHROPIC_API_KEY) {
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

  throw new Error('No AI key configured. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY).');
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
    const out = await callLLM(env, HOOK_SYSTEM, `Reference: ${reference}\nText: ${text}`, 220);
    return json({ text: out });
  }
  if (task === 'explain') {
    const out = await callLLM(env, EXPLAIN_SYSTEM, `Reference: ${reference}\nText: ${text}`, 320);
    return json({ text: out });
  }
  if (task === 'pack') {
    const theme = String(body.theme ?? '').slice(0, 200);
    const out = await callLLM(env, PACK_SYSTEM, `Theme: ${theme}`, 200);
    return json({ references: parseReferences(out) });
  }
  return json({ error: 'Unknown task. Use hook | explain | pack.' }, 400);
}

/*
 * ESV is disabled for now (it needs a separate free Crossway API key). To
 * re-enable: uncomment this handler, uncomment the /esv route below, set the
 * ESV_API_KEY secret, and uncomment the ESV entry in the app's TRANSLATIONS.
 *
 * async function handleEsv(req: Request, env: Env): Promise<Response> {
 *   if (!env.ESV_API_KEY) return json({ error: 'ESV not configured on the server.' }, 501);
 *   const body: any = await req.json().catch(() => ({}));
 *   const reference = String(body.reference ?? '').trim();
 *   if (!reference) return json({ error: 'Missing reference.' }, 400);
 *
 *   const url =
 *     'https://api.esv.org/v3/passage/text/?q=' +
 *     encodeURIComponent(reference) +
 *     '&include-headings=false&include-footnotes=false&include-verse-numbers=false' +
 *     '&include-short-copyright=false&include-passage-references=false';
 *   const res = await fetch(url, { headers: { Authorization: `Token ${env.ESV_API_KEY}` } });
 *   if (!res.ok) return json({ error: `ESV HTTP ${res.status}` }, 502);
 *   const data: any = await res.json();
 *   const text = (data.passages ?? []).join(' ').replace(/\s+/g, ' ').trim();
 *   if (!text) return json({ error: 'Verse not found.' }, 404);
 *   return json({ reference: data.canonical || reference, text });
 * }
 */

// ===========================================================================
// Growing Together — circles (shared state in KV)
// ===========================================================================

async function kvGetJson<T>(kv: KVNamespaceLike, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function kvPutJson(kv: KVNamespaceLike, key: string, value: unknown): Promise<void> {
  return kv.put(key, JSON.stringify(value));
}

/** List every key under a prefix (follows KV pagination). */
async function kvListKeys(kv: KVNamespaceLike, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix, cursor });
    for (const k of res.keys) names.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return names;
}

// Invite codes: 6 chars, unambiguous base32 (no O/0/I/1).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}
function normCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase();
}
function str(v: unknown, max: number): string {
  return String(v ?? '').slice(0, max);
}

/** Persist a member's own progress snapshot (only that member writes this key). */
async function writeMember(kv: KVNamespaceLike, code: string, member: any): Promise<void> {
  const memberId = String(member?.memberId ?? '');
  const rec = {
    id: memberId,
    displayName: str(member?.displayName, 40),
    memorizedCount: Number(member?.memorizedCount ?? 0) || 0,
    streak: Number(member?.streak ?? 0) || 0,
    versesDone: Array.isArray(member?.versesDone) ? member.versesDone.slice(0, 500) : [],
    planDone: Array.isArray(member?.planDone) ? member.planDone.slice(0, 500) : [],
    lastActiveDay: member?.lastActiveDay ?? null,
    lastActivity: member?.lastActivity ?? null,
    updatedAt: Date.now(),
  };
  await kvPutJson(kv, `circle:${code}:member:${memberId}`, rec);
}

/** Assemble the full circle snapshot returned to clients. */
async function buildSnapshot(kv: KVNamespaceLike, code: string): Promise<any | null> {
  const meta = await kvGetJson<any>(kv, `circle:${code}:meta`);
  if (!meta) return null;
  const memberKeys = await kvListKeys(kv, `circle:${code}:member:`);
  const members: any[] = [];
  for (const key of memberKeys) {
    const m = await kvGetJson<any>(kv, key);
    if (m) members.push(m);
  }
  members.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  // Later phases populate these from their own key families.
  return { meta, members, sharedVerses: [], plans: [], prayers: [], challenges: [], cheersFor: {} };
}

async function handleCircle(req: Request, env: Env): Promise<Response> {
  if (!env.ENGRAVED_KV) return json({ error: 'Storage not configured on the server.' }, 501);
  const kv = env.ENGRAVED_KV;
  const body: any = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const member = body.member ?? {};
  const memberId = String(member.memberId ?? body.memberId ?? '');

  switch (action) {
    case 'create': {
      if (!memberId) return json({ error: 'Missing member.' }, 400);
      let code = '';
      for (let i = 0; i < 6; i++) {
        const c = genCode();
        if (!(await kvGetJson(kv, `circle:${c}:meta`))) {
          code = c;
          break;
        }
      }
      if (!code) return json({ error: 'Could not allocate a code. Try again.' }, 503);
      const meta = {
        code,
        name: str(body.name, 60) || 'Our Circle',
        goal: body.goal ?? null,
        covenant: body.covenant ?? null,
        createdAt: Date.now(),
        ownerMemberId: memberId,
        version: 1,
        togetherStreak: 0,
        lastTogetherDay: null,
      };
      await kvPutJson(kv, `circle:${code}:meta`, meta);
      await writeMember(kv, code, member);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'join':
    case 'sync': {
      const code = normCode(body.code);
      if (!memberId) return json({ error: 'Missing member.' }, 400);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      await writeMember(kv, code, member);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'get': {
      const code = normCode(body.code);
      const snap = await buildSnapshot(kv, code);
      if (!snap) return json({ error: 'No circle with that code.' }, 404);
      return json({ snapshot: snap });
    }

    case 'setCovenant': {
      const code = normCode(body.code);
      const meta = await kvGetJson<any>(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const prevAgreed: string[] = Array.isArray(meta.covenant?.agreedBy) ? meta.covenant.agreedBy : [];
      const agreedBy = memberId && !prevAgreed.includes(memberId) ? [...prevAgreed, memberId] : prevAgreed;
      meta.covenant = {
        cadenceLabel: str(body.cadenceLabel, 80),
        goalText: str(body.goalText, 120),
        agreedBy: body.resetAgreement ? (memberId ? [memberId] : []) : agreedBy,
      };
      meta.version = (meta.version ?? 1) + 1;
      await kvPutJson(kv, `circle:${code}:meta`, meta);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'leave': {
      const code = normCode(body.code);
      if (memberId) await kv.delete(`circle:${code}:member:${memberId}`);
      return json({ ok: true });
    }

    default:
      return json({ error: 'Unknown circle action.' }, 400);
  }
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
      if (path === '/circle') return await handleCircle(request, env);
      // if (path === '/esv') return await handleEsv(request, env); // ESV disabled for now
      return json({ error: 'Not found. Use /ai or /circle.' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error';
      return json({ error: message }, 500);
    }
  },
};
