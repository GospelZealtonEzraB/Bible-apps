/**
 * Versed server — a tiny Cloudflare Worker that holds the secret AI API key the
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

/** Cloudflare Workers AI binding (only the embeddings shape we use). */
interface WorkersAiLike {
  run(model: string, input: { text: string[] }): Promise<{ data: number[][] }>;
}

/** Cloudflare Vectorize binding (only query). */
interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}
interface VectorizeLike {
  query(vector: number[], opts: { topK?: number; returnMetadata?: boolean | 'all' | 'none' }): Promise<{ matches: VectorizeMatch[] }>;
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
  /** Workers AI binding for semantic search embeddings (optional). */
  AI?: WorkersAiLike;
  /** Vectorize index of KJV verse embeddings (optional; /search 501 without it). */
  VECTORIZE?: VectorizeLike;
  /** Genius API token for song search/metadata (optional; /genius 501 without it). */
  GENIUS_ACCESS_TOKEN?: string;
}

/** Embedding model for semantic search — must match the Vectorize index dims (768). */
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

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

const CHORDS_SYSTEM =
  'You are a worship guitarist/pianist. Given a song title and artist, suggest the ' +
  'LIKELY key, a capo suggestion, and common chord PROGRESSIONS for the main ' +
  'sections (Intro/Verse/Chorus/Bridge). Output ONLY chord names and section ' +
  'labels — e.g. "Key: G  Capo: 0\\nVerse: G  D  Em  C\\nChorus: C  G  D  Em". ' +
  'NEVER include any lyrics. If you are unsure of the song, say "Not sure of this ' +
  'song — please verify." Keep it short (a few lines).';

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
  if (task === 'chords') {
    const title = String(body.title ?? '').slice(0, 120);
    const artist = String(body.artist ?? '').slice(0, 120);
    const out = await callLLM(env, CHORDS_SYSTEM, `Song: ${title}\nArtist: ${artist}`, 260);
    return json({ text: out });
  }
  return json({ error: 'Unknown task. Use hook | explain | pack | chords.' }, 400);
}

// ===========================================================================
// AI study brief (/study) — passage context for a Bible-study session
// ===========================================================================

const STUDY_BRIEF_SYSTEM =
  'You produce a STUDY BRIEF for a Bible passage a reader is about to study. You are given ' +
  'ONLY a reference (e.g. "John 3:1-21" or "John 3"). Return ONLY a JSON object with these keys: ' +
  '"summaryBefore" (what happens in the preceding verses/chapter leading into this passage), ' +
  '"setting" (the scene, time, and place), "characters" (array of {"name","insight"} for who is ' +
  'involved), "speakerAudience" (who is speaking and to whom), "location" (geography plus relevant ' +
  'historical/cultural background and demographics), "background" (any other helpful context), ' +
  '"discussionQuestions" (array of 3-5 thoughtful questions), "wordStudy" (array of ' +
  '{"term","language","insight"} for 1-3 key Greek or Hebrew words), and "crossReferences" (array of ' +
  '3-6 related passage reference strings, references ONLY). Write original commentary in your own ' +
  'words. Do NOT quote, paraphrase, or reproduce any Scripture text — no verse text at all. ' +
  'Output JSON only, no preamble.';

function parseStudyBrief(text: string): any {
  const empty = {
    summaryBefore: '', setting: '', characters: [], speakerAudience: '',
    location: '', background: '', discussionQuestions: [], wordStudy: [], crossReferences: [],
  };
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return empty;
  try {
    const o: any = JSON.parse(m[0]);
    const strArr = (v: any, n: number) =>
      Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n) : [];
    return {
      summaryBefore: String(o.summaryBefore ?? ''),
      setting: String(o.setting ?? ''),
      characters: Array.isArray(o.characters)
        ? o.characters
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any) => ({ name: String(c.name ?? ''), insight: String(c.insight ?? '') }))
            .slice(0, 12)
        : [],
      speakerAudience: String(o.speakerAudience ?? ''),
      location: String(o.location ?? ''),
      background: String(o.background ?? ''),
      discussionQuestions: strArr(o.discussionQuestions, 8),
      wordStudy: Array.isArray(o.wordStudy)
        ? o.wordStudy
            .filter((w: any) => w && typeof w === 'object')
            .map((w: any) => ({
              term: String(w.term ?? ''),
              language: String(w.language ?? ''),
              insight: String(w.insight ?? ''),
            }))
            .slice(0, 8)
        : [],
      crossReferences: strArr(o.crossReferences, 12),
    };
  } catch {
    return empty;
  }
}

async function handleStudy(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'brief');

  if (action === 'brief') {
    const passage = str(body.passage, 60).trim();
    if (!passage) return json({ error: 'Missing passage.' }, 400);

    // Global cache by passage — one LLM call per distinct passage, app-wide.
    const key = `study:brief:${normPassage(passage)}`;
    if (env.ENGRAVED_KV && !body.force) {
      const cached = await kvGetJson<any>(env.ENGRAVED_KV, key);
      if (cached?.brief) return json({ brief: cached.brief, cached: true });
    }

    const out = await callLLM(env, STUDY_BRIEF_SYSTEM, `Reference: ${passage}`, 950);
    const brief = parseStudyBrief(out);
    if (env.ENGRAVED_KV) {
      await kvPutJson(env.ENGRAVED_KV, key, {
        passage,
        brief,
        model: env.AI_MODEL || '',
        createdAt: Date.now(),
      });
    }
    return json({ brief, cached: false });
  }

  return json({ error: 'Unknown study action. Use brief.' }, 400);
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

/** Delete every key under a prefix — used to cascade-delete an entity's sub-keys. */
async function kvDeletePrefix(kv: KVNamespaceLike, prefix: string): Promise<void> {
  for (const key of await kvListKeys(kv, prefix)) await kv.delete(key);
}

// Bumped whenever /circle gains actions the client depends on. Returned in every
// snapshot so the app can warn when a deployed Worker is out of date.
const API_VERSION = 6;

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
/** Short unique id for challenges/prayers/notes etc. */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function str(v: unknown, max: number): string {
  return String(v ?? '').slice(0, max);
}
/** Normalized reference key (lowercase, single-spaced) — stable per-verse key. */
function normRef(reference: string): string {
  return String(reference ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Normalized passage key for the global study-brief cache. */
function normPassage(passage: string): string {
  return String(passage ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Whole-day difference b - a for two YYYY-MM-DD keys (NaN if unparseable). */
function dayDiff(a: string, b: string): number {
  const pa = Date.parse(a + 'T00:00:00Z');
  const pb = Date.parse(b + 'T00:00:00Z');
  if (isNaN(pa) || isNaN(pb)) return NaN;
  return Math.round((pb - pa) / 86400000);
}

/**
 * Advance the circle's "together streak" when every member was active on the
 * same most-recent day. Returns the updated fields, or null if nothing changes.
 * Server is effectively the single writer here (called during join/sync).
 */
function recomputeTogether(
  meta: any,
  members: any[],
): { togetherStreak: number; lastTogetherDay: string } | null {
  const days = members.map((m) => m.lastActiveDay).filter(Boolean) as string[];
  if (days.length === 0 || days.length !== members.length) return null;
  if (!days.every((d) => d === days[0])) return null; // not everyone on the same day
  const togetherDay = days[0];
  if (meta.lastTogetherDay === togetherDay) return null; // already counted today
  const consecutive = meta.lastTogetherDay && dayDiff(meta.lastTogetherDay, togetherDay) === 1;
  return {
    togetherStreak: consecutive ? (meta.togetherStreak ?? 0) + 1 : 1,
    lastTogetherDay: togetherDay,
  };
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
    memorizedRefs: Array.isArray(member?.memorizedRefs) ? member.memorizedRefs.slice(0, 400) : [],
    learningRefs: Array.isArray(member?.learningRefs) ? member.learningRefs.slice(0, 200) : [],
    bestStreak: Number(member?.bestStreak ?? 0) || 0,
    xp: Number(member?.xp ?? 0) || 0,
    recentActivity: Array.isArray(member?.recentActivity) ? member.recentActivity.slice(-10) : [],
    lastActiveDay: member?.lastActiveDay ?? null,
    lastActivity: member?.lastActivity ?? null,
    pushToken: member?.pushToken ?? null,
    updatedAt: Date.now(),
  };
  await kvPutJson(kv, `circle:${code}:member:${memberId}`, rec);
}

/** Best-effort push via the Expo Push API. Never throws. */
async function sendPush(tokens: (string | null | undefined)[], title: string, body: string): Promise<void> {
  const valid = tokens.filter((t): t is string => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid.map((to) => ({ to, title, body, sound: 'default' }))),
    });
  } catch {
    // Push is best-effort; never let it break the action.
  }
}

/** Push tokens of all members except `exceptId`. */
async function otherMemberTokens(kv: KVNamespaceLike, code: string, exceptId: string): Promise<string[]> {
  const keys = await kvListKeys(kv, `circle:${code}:member:`);
  const tokens: string[] = [];
  for (const key of keys) {
    const m = await kvGetJson<any>(kv, key);
    if (m && m.id !== exceptId && m.pushToken) tokens.push(m.pushToken);
  }
  return tokens;
}

async function memberPushToken(kv: KVNamespaceLike, code: string, id: string): Promise<string | null> {
  const m = await kvGetJson<any>(kv, `circle:${code}:member:${id}`);
  return m?.pushToken ?? null;
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

  const verseKeys = await kvListKeys(kv, `circle:${code}:verse:`);
  const sharedVerses: any[] = [];
  for (const key of verseKeys) {
    const v = await kvGetJson<any>(kv, key);
    if (v) sharedVerses.push(v);
  }
  sharedVerses.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

  // Challenges: the meta key is `...:chal:{id}`; submission/review are deeper
  // keys under it. List the prefix, keep only the meta keys (no extra colon),
  // then derive lifecycle status from the presence of submission/review.
  const chalPrefix = `circle:${code}:chal:`;
  const chalKeys = await kvListKeys(kv, chalPrefix);
  const chalIds = chalKeys
    .map((k) => k.substring(chalPrefix.length))
    .filter((rest) => rest.length > 0 && !rest.includes(':'));
  const challenges: any[] = [];
  for (const id of chalIds) {
    const cm = await kvGetJson<any>(kv, `${chalPrefix}${id}`);
    if (!cm) continue;
    const submission = await kvGetJson<any>(kv, `${chalPrefix}${id}:submission`);
    const review = await kvGetJson<any>(kv, `${chalPrefix}${id}:review`);
    challenges.push({
      ...cm,
      submission: submission ?? undefined,
      review: review ?? undefined,
      status: review ? 'reviewed' : submission ? 'submitted' : 'pending',
    });
  }
  challenges.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Study plans.
  const planKeys = await kvListKeys(kv, `circle:${code}:plan:`);
  const plans: any[] = [];
  for (const key of planKeys) {
    const p = await kvGetJson<any>(kv, key);
    if (p) plans.push(p);
  }
  plans.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Shared notes (each member writes only their own note keys).
  const noteKeys = await kvListKeys(kv, `circle:${code}:note:`);
  const notes: any[] = [];
  for (const key of noteKeys) {
    const n = await kvGetJson<any>(kv, key);
    if (n) notes.push(n);
  }
  notes.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  // Prayers: meta key `...:prayer:{id}`; "prayed" marks are deeper keys.
  const prayerPrefix = `circle:${code}:prayer:`;
  const prayerKeys = await kvListKeys(kv, prayerPrefix);
  const prayerIds = prayerKeys
    .map((k) => k.substring(prayerPrefix.length))
    .filter((rest) => rest.length > 0 && !rest.includes(':'));
  const prayers: any[] = [];
  for (const id of prayerIds) {
    const pm = await kvGetJson<any>(kv, `${prayerPrefix}${id}`);
    if (!pm) continue;
    const prayMarks = await kvListKeys(kv, `${prayerPrefix}${id}:pray:`);
    prayers.push({ ...pm, prayedByCount: prayMarks.length, prayedByIds: prayMarks.map((k) => k.split(':pray:')[1]) });
  }
  prayers.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Cheers received, summed per target member (key `...:cheer:{from}:{to}`).
  const cheerKeys = await kvListKeys(kv, `circle:${code}:cheer:`);
  const cheersFor: Record<string, number> = {};
  for (const key of cheerKeys) {
    const c = await kvGetJson<any>(kv, key);
    const to = key.split(':').pop() || '';
    if (to) cheersFor[to] = (cheersFor[to] ?? 0) + (Number(c?.count ?? 1) || 1);
  }

  return { apiVersion: API_VERSION, meta, members, sharedVerses, plans, notes, prayers, challenges, cheersFor };
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
      const meta = await kvGetJson<any>(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      await writeMember(kv, code, member);
      const snapshot = await buildSnapshot(kv, code);
      // Advance the together streak when everyone is active on the same day.
      const upd = recomputeTogether(snapshot.meta, snapshot.members);
      if (upd) {
        snapshot.meta = { ...snapshot.meta, ...upd };
        await kvPutJson(kv, `circle:${code}:meta`, snapshot.meta);
      }
      return json({ snapshot });
    }

    case 'addVerse': {
      const code = normCode(body.code);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const reference = str(body.reference, 60).trim();
      if (!reference) return json({ error: 'Missing reference.' }, 400);
      const rec = {
        reference,
        addedBy: memberId,
        addedByName: str(body.displayName, 40),
        addedAt: Date.now(),
        forMemberId: body.forMemberId ? String(body.forMemberId) : undefined,
      };
      await kvPutJson(kv, `circle:${code}:verse:${normRef(reference)}`, rec);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'setGoal': {
      const code = normCode(body.code);
      const meta = await kvGetJson<any>(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const goal = body.goal ?? null;
      meta.goal = goal
        ? {
            kind: String(goal.kind ?? 'memorizeCount'),
            target: Math.max(0, Math.min(9999, Number(goal.target ?? 0) || 0)),
            label: goal.label ? str(goal.label, 60) : undefined,
          }
        : null;
      meta.version = (meta.version ?? 1) + 1;
      await kvPutJson(kv, `circle:${code}:meta`, meta);
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

    case 'assignChallenge': {
      const code = normCode(body.code);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const to = String(body.toMemberId ?? '');
      const reference = str(body.reference, 60).trim();
      if (!to || !reference) return json({ error: 'Missing partner or reference.' }, 400);
      // Honor a client-supplied id so optimistic UI ids match the server's.
      const chalId = str(body.chalId, 40).trim() || genId();
      const rec = {
        chalId,
        from: memberId,
        fromName: str(body.displayName, 40),
        to,
        toName: str(body.toName, 40),
        reference,
        kind: String(body.kind ?? 'type'),
        createdAt: Date.now(),
      };
      await kvPutJson(kv, `circle:${code}:chal:${chalId}`, rec);
      await sendPush([await memberPushToken(kv, code, to)], 'New challenge 💪', `${rec.fromName || 'Your partner'} challenged you: ${reference}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'submitChallenge': {
      const code = normCode(body.code);
      const chalId = String(body.chalId ?? '');
      const cm = await kvGetJson<any>(kv, `circle:${code}:chal:${chalId}`);
      if (!cm) return json({ error: 'Challenge not found.' }, 404);
      const submission = {
        by: memberId,
        text: str(body.text, 2000),
        accuracy: body.accuracy != null ? Number(body.accuracy) : undefined,
        submittedAt: Date.now(),
      };
      await kvPutJson(kv, `circle:${code}:chal:${chalId}:submission`, submission);
      await sendPush([await memberPushToken(kv, code, cm.from)], 'Ready to review ✍️', `${cm.toName || 'Your partner'} answered your challenge on ${cm.reference}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'reviewChallenge': {
      const code = normCode(body.code);
      const chalId = String(body.chalId ?? '');
      const cm = await kvGetJson<any>(kv, `circle:${code}:chal:${chalId}`);
      if (!cm) return json({ error: 'Challenge not found.' }, 404);
      const review = {
        by: memberId,
        note: str(body.note, 500),
        meaningPrompt: body.meaningPrompt ? str(body.meaningPrompt, 300) : undefined,
        at: Date.now(),
      };
      await kvPutJson(kv, `circle:${code}:chal:${chalId}:review`, review);
      await sendPush([await memberPushToken(kv, code, cm.to)], 'Encouragement from your partner 💛', `${cm.fromName || 'Your partner'} reviewed your ${cm.reference}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'createPlan': {
      const code = normCode(body.code);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const title = str(body.title, 80).trim();
      const items = Array.isArray(body.items)
        ? body.items.filter((x: any) => typeof x === 'string').map((x: string) => str(x, 60).trim()).slice(0, 200)
        : [];
      if (!title || items.length === 0) return json({ error: 'Missing plan title or items.' }, 400);
      const planId = str(body.planId, 40).trim() || genId();
      await kvPutJson(kv, `circle:${code}:plan:${planId}`, {
        planId, title, items, createdBy: memberId, createdAt: Date.now(),
      });
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'updatePlan': {
      const code = normCode(body.code);
      const planId = String(body.planId ?? '');
      const existing = await kvGetJson<any>(kv, `circle:${code}:plan:${planId}`);
      if (!existing) return json({ error: 'Plan not found.' }, 404);
      const title = str(body.title, 80).trim();
      const items = Array.isArray(body.items)
        ? body.items.filter((x: any) => typeof x === 'string').map((x: string) => str(x, 60).trim()).slice(0, 200)
        : [];
      if (!title || items.length === 0) return json({ error: 'Missing plan title or items.' }, 400);
      await kvPutJson(kv, `circle:${code}:plan:${planId}`, {
        ...existing, title, items,
      });
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'saveNote': {
      const code = normCode(body.code);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const noteId = String(body.noteId ?? genId());
      const rec = {
        noteId,
        by: memberId,
        byName: str(body.displayName, 40),
        scope: String(body.scope ?? 'free'),
        ref: body.ref ? str(body.ref, 60) : undefined,
        text: str(body.text, 2000),
        updatedAt: Date.now(),
      };
      await kvPutJson(kv, `circle:${code}:note:${memberId}:${noteId}`, rec);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'deleteNote': {
      const code = normCode(body.code);
      const noteId = String(body.noteId ?? '');
      if (memberId && noteId) await kv.delete(`circle:${code}:note:${memberId}:${noteId}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'addPrayer': {
      const code = normCode(body.code);
      const meta = await kvGetJson(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      const text = str(body.text, 1000).trim();
      if (!text) return json({ error: 'Missing prayer request.' }, 400);
      const prayerId = str(body.prayerId, 40).trim() || genId();
      const byName = str(body.displayName, 40);
      await kvPutJson(kv, `circle:${code}:prayer:${prayerId}`, {
        prayerId, text, by: memberId, byName,
        createdAt: Date.now(), status: 'active',
      });
      await sendPush(await otherMemberTokens(kv, code, memberId), 'A prayer request 🙏', `${byName || 'Someone'} shared a prayer request`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'prayFor': {
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      const pm = await kvGetJson(kv, `circle:${code}:prayer:${prayerId}`);
      if (!pm) return json({ error: 'Prayer not found.' }, 404);
      await kvPutJson(kv, `circle:${code}:prayer:${prayerId}:pray:${memberId}`, {
        id: memberId, name: str(body.displayName, 40), at: Date.now(),
      });
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'answerPrayer': {
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      const pm = await kvGetJson<any>(kv, `circle:${code}:prayer:${prayerId}`);
      if (!pm) return json({ error: 'Prayer not found.' }, 404);
      pm.status = 'answered';
      pm.answeredAt = Date.now();
      pm.answerNote = body.answerNote ? str(body.answerNote, 500) : undefined;
      await kvPutJson(kv, `circle:${code}:prayer:${prayerId}`, pm);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'reopenPrayer': {
      // Undo an accidental "mark answered" — revert to active.
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      const pm = await kvGetJson<any>(kv, `circle:${code}:prayer:${prayerId}`);
      if (!pm) return json({ error: 'Prayer not found.' }, 404);
      pm.status = 'active';
      delete pm.answeredAt;
      delete pm.answerNote;
      await kvPutJson(kv, `circle:${code}:prayer:${prayerId}`, pm);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'editPrayer': {
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      const pm = await kvGetJson<any>(kv, `circle:${code}:prayer:${prayerId}`);
      if (!pm) return json({ error: 'Prayer not found.' }, 404);
      const text = str(body.text, 1000).trim();
      if (!text) return json({ error: 'Missing prayer request.' }, 400);
      pm.text = text;
      await kvPutJson(kv, `circle:${code}:prayer:${prayerId}`, pm);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'deletePrayer': {
      // Remove the request and every "I prayed" mark under it.
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      if (prayerId) {
        await kv.delete(`circle:${code}:prayer:${prayerId}`);
        await kvDeletePrefix(kv, `circle:${code}:prayer:${prayerId}:pray:`);
      }
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'unpray': {
      // Undo an accidental "I prayed" — remove only the caller's own mark.
      const code = normCode(body.code);
      const prayerId = String(body.prayerId ?? '');
      if (memberId && prayerId) await kv.delete(`circle:${code}:prayer:${prayerId}:pray:${memberId}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'deleteChallenge': {
      // Cancel a challenge — remove it plus any submission/review sub-keys.
      const code = normCode(body.code);
      const chalId = String(body.chalId ?? '');
      if (chalId) {
        await kv.delete(`circle:${code}:chal:${chalId}`);
        await kv.delete(`circle:${code}:chal:${chalId}:submission`);
        await kv.delete(`circle:${code}:chal:${chalId}:review`);
      }
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'cheer': {
      const code = normCode(body.code);
      const to = String(body.toMemberId ?? '');
      if (!memberId || !to) return json({ error: 'Missing member.' }, 400);
      const key = `circle:${code}:cheer:${memberId}:${to}`;
      const prev = await kvGetJson<any>(kv, key);
      await kvPutJson(kv, key, {
        count: (Number(prev?.count ?? 0) || 0) + 1,
        lastAt: Date.now(),
        kind: str(body.kind, 20) || 'cheer',
      });
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'renameCircle': {
      const code = normCode(body.code);
      const meta = await kvGetJson<any>(kv, `circle:${code}:meta`);
      if (!meta) return json({ error: 'No circle with that code.' }, 404);
      meta.name = str(body.name, 60).trim() || meta.name;
      meta.version = (meta.version ?? 1) + 1;
      await kvPutJson(kv, `circle:${code}:meta`, meta);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'removeVerse': {
      const code = normCode(body.code);
      const reference = str(body.reference, 60).trim();
      if (reference) await kv.delete(`circle:${code}:verse:${normRef(reference)}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'deletePlan': {
      const code = normCode(body.code);
      const planId = String(body.planId ?? '');
      if (planId) await kv.delete(`circle:${code}:plan:${planId}`);
      return json({ snapshot: await buildSnapshot(kv, code) });
    }

    case 'leave': {
      const code = normCode(body.code);
      if (memberId) await kv.delete(`circle:${code}:member:${memberId}`);
      return json({ ok: true });
    }

    // --- Full-account backup, keyed by the device/transfer id -----------------
    // Stores an opaque client-exported blob so a new phone with the same
    // transfer code can restore the whole library + progress automatically.
    case 'backupPush': {
      const id = String(body.memberId ?? '');
      const blob = typeof body.blob === 'string' ? body.blob : '';
      if (!id || !blob) return json({ error: 'Missing backup.' }, 400);
      if (blob.length > 20_000_000) return json({ error: 'Backup too large.' }, 413);
      await kvPutJson(kv, `backup:${id}`, { blob, updatedAt: Date.now() });
      return json({ ok: true });
    }

    case 'backupPull': {
      const id = String(body.memberId ?? '');
      if (!id) return json({ error: 'Missing member.' }, 400);
      const rec = await kvGetJson<any>(kv, `backup:${id}`);
      return json({ backup: rec ?? null });
    }

    default:
      return json({ error: 'Unknown circle action.' }, 400);
  }
}

const PRIVACY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Versed — Privacy Policy</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px;
    margin: 0 auto; padding: 32px 20px 64px; color: #1a2233; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e6ecff; background: #0b1220; } a { color: #7c9cf5; } }
  h1 { font-size: 28px; } h2 { font-size: 19px; margin-top: 28px; }
  .muted { opacity: .7; font-size: 14px; }
  code { background: rgba(127,127,127,.15); padding: 1px 5px; border-radius: 4px; }
</style></head><body>
<h1>Versed — Privacy Policy</h1>
<p class="muted">Last updated: 8 August 2026</p>

<p>Versed is a Bible-verse memorization app. This policy explains what data the app handles and why.
We keep it minimal on purpose.</p>

<h2>No account required</h2>
<p>Versed does not ask for your name, email, or phone number to work. When you first open the app it
generates a random, anonymous device ID (a “transfer code”) stored on your phone. You may optionally
enter a display name so people you choose to grow with can recognize you.</p>

<h2>What stays on your device</h2>
<p>Your verse library, memorization progress, streaks, review schedule, and personal notes are stored
locally on your phone. This data is not sent anywhere unless you use the optional features below.</p>

<h2>Circles (optional shared groups)</h2>
<p>If you create or join a “circle” with a friend or small group, the following is stored on our server
(Cloudflare) so others in that circle can see it: your display name, the verses/plans/prayers/notes/
challenges you choose to share into the circle, and progress counters (e.g. verses memorized, streak).
Only people who have your circle’s 6-character invite code can see it. You can delete shared items or
leave a circle at any time.</p>

<h2>Cloud backup (optional)</h2>
<p>So you don’t lose your data if you change phones, the app can back up a copy of your library and
progress to our server, keyed to your anonymous transfer code. Only someone who enters your transfer
code can restore it. You can trigger or skip this in Settings.</p>

<h2>AI study features (optional)</h2>
<p>When you request an AI study brief, memory hook, or verse suggestions, the app sends the passage
<em>reference</em> (e.g. “John 3:16”) to an AI provider (OpenAI/Anthropic) to generate original
commentary. We do not send the biblical text itself, and we do not send your personal notes.</p>

<h2>Notifications (optional)</h2>
<p>If you enable reminders or circle notifications, the app stores a push token so we can deliver them.
You can turn this off in your device settings.</p>

<h2>What we do NOT do</h2>
<p>No advertising. No third-party analytics or tracking. We do not sell or share your data with anyone,
and there are no ads or trackers embedded in the app.</p>

<h2>Data retention & deletion</h2>
<p>Local data is removed when you uninstall the app or use “Reset all data” in Settings. Shared circle
data can be removed by deleting items or leaving the circle. To request deletion of any server-stored
data tied to your transfer code, contact us at the email below.</p>

<h2>Children</h2>
<p>Versed is not directed at children under 13 and does not knowingly collect personal information from
them.</p>

<h2>Contact</h2>
<p>Questions or deletion requests: <a href="mailto:gospel.e.tgb@gmail.com">gospel.e.tgb@gmail.com</a></p>
</body></html>`;

// ===========================================================================
// Semantic search — Workers AI (bge embeddings) + Vectorize. References only:
// the query is embedded, the index is queried, and only verse *references*
// (never verse text) are returned; the app hydrates snippets from its local KJV.
// ===========================================================================

async function handleSearch(request: Request, env: Env): Promise<Response> {
  if (!env.AI || !env.VECTORIZE) {
    return json({ error: 'Semantic search is not configured on this server yet.', results: [] }, 501);
  }
  const body = (await request.json().catch(() => ({}))) as { query?: unknown; topK?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : '';
  if (query.length < 2) return json({ results: [] });

  const cacheKey = env.ENGRAVED_KV ? `search:${query.toLowerCase()}` : null;
  if (cacheKey) {
    const cached = await kvGetJson<{ results: unknown[] }>(env.ENGRAVED_KV!, cacheKey);
    if (cached) return json(cached);
  }

  const embed = await env.AI.run(EMBED_MODEL, { text: [query] });
  const vector = embed?.data?.[0];
  if (!vector) return json({ results: [] });

  const topK = Math.min(Math.max(Number(body.topK) || 20, 1), 20);
  const res = await env.VECTORIZE.query(vector, { topK, returnMetadata: true });
  const results = (res.matches || [])
    .map((m) => ({ reference: String(m.metadata?.ref ?? ''), score: m.score }))
    .filter((r) => r.reference);

  const out = { results };
  if (cacheKey) await kvPutJson(env.ENGRAVED_KV!, cacheKey, out);
  return json(out);
}

// ===========================================================================
// Song search — Genius API proxy (keeps the token server-side). Returns
// metadata + the Genius page URL only; lyrics/chords are viewed on Genius /
// via deep-links (copyright: we never reproduce lyrics in-app).
// ===========================================================================

async function handleGenius(request: Request, env: Env): Promise<Response> {
  if (!env.GENIUS_ACCESS_TOKEN) {
    return json({ error: 'Song search is not configured on this server yet.', results: [] }, 501);
  }
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 120) : '';
  if (q.length < 2) return json({ results: [] });

  const res = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${env.GENIUS_ACCESS_TOKEN}` },
  });
  if (!res.ok) return json({ error: `Genius HTTP ${res.status}`, results: [] }, 502);
  const data = (await res.json()) as any;
  const results = (data?.response?.hits || [])
    .filter((h: any) => h?.type === 'song' && h?.result)
    .map((h: any) => ({
      id: h.result.id,
      title: h.result.title,
      artist: h.result.primary_artist?.name,
      thumbnail: h.result.song_art_image_thumbnail_url || h.result.header_image_thumbnail_url,
      url: h.result.url,
    }));
  return json({ results });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Public GET pages (privacy policy for the app stores; a tiny landing page).
    if (request.method === 'GET') {
      const p = new URL(request.url).pathname.replace(/\/$/, '');
      if (p === '/privacy') {
        return new Response(PRIVACY_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (p === '' || p === '/') {
        return new Response('Versed API. See /privacy for the privacy policy.', {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      return json({ error: 'Not found.' }, 404);
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    if (env.APP_SHARED_SECRET) {
      const provided = request.headers.get('x-app-secret');
      if (provided !== env.APP_SHARED_SECRET) return json({ error: 'Unauthorized' }, 401);
    }

    const path = new URL(request.url).pathname.replace(/\/$/, '');
    try {
      if (path === '/ai') return await handleAi(request, env);
      if (path === '/study') return await handleStudy(request, env);
      if (path === '/circle') return await handleCircle(request, env);
      if (path === '/search') return await handleSearch(request, env);
      if (path === '/genius') return await handleGenius(request, env);
      // if (path === '/esv') return await handleEsv(request, env); // ESV disabled for now
      return json({ error: 'Not found. Use /ai, /study, /circle, /search, or /genius.' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error';
      return json({ error: message }, 500);
    }
  },
};
