import { WEB_FIXTURES } from './fixtures';
import { parseReference, formatReference } from './books';

const BIBLE_API_BASE = 'https://bible-api.com';
const GETBIBLE_BASE = 'https://api.getbible.net/v2';
const BOLLS_BASE = 'https://bolls.life';

type Provider = 'bible-api' | 'getbible' | 'bolls' | 'esv';

export interface TranslationInfo {
  id: string;
  name: string;
  /** ISO-ish language code; 'en'/'la' are Latin-script. */
  language: string;
  provider: Provider;
  /** The provider's own translation code, when it differs from `id`. */
  providerCode?: string;
}

/**
 * Available translations. bible-api.com serves the public-domain English/Latin
 * set; Tamil comes keyless from getbible.net. ESV is defined but gated behind a
 * server (see the esv provider) and intentionally not listed until that exists.
 */
export const TRANSLATIONS: TranslationInfo[] = [
  { id: 'web', name: 'World English Bible', language: 'en', provider: 'bible-api' },
  { id: 'kjv', name: 'King James Version', language: 'en', provider: 'bible-api' },
  { id: 'bbe', name: 'Bible in Basic English', language: 'en', provider: 'bible-api' },
  { id: 'oeb-us', name: 'Open English Bible (US)', language: 'en', provider: 'bible-api' },
  { id: 'webbe', name: 'WEB British Edition', language: 'en', provider: 'bible-api' },
  { id: 'clementine', name: 'Clementine Latin Vulgate', language: 'la', provider: 'bible-api' },
  { id: 'tamil', name: 'தமிழ் (Tamil)', language: 'ta', provider: 'bolls', providerCode: 'TAOVBSI' },
  { id: 'esv', name: 'English Standard Version', language: 'en', provider: 'esv' },
];

const LATIN_LANGS = new Set(['en', 'la']);

export function translationInfo(id: string): TranslationInfo | undefined {
  return TRANSLATIONS.find((t) => t.id === id);
}

export function translationName(id: string): string {
  return translationInfo(id)?.name ?? id.toUpperCase();
}

export function translationLanguage(id: string): string {
  return translationInfo(id)?.language ?? 'en';
}

/** True when a translation's script is Latin/Roman (so the serif font fits). */
export function isLatinTranslation(id: string): boolean {
  return LATIN_LANGS.has(translationLanguage(id));
}

export interface FetchedVerse {
  reference: string;
  text: string;
  translation: string;
  translationName: string;
  /** True when served from the offline fixture set rather than the network. */
  offline: boolean;
}

/** Lowercased, single-spaced reference used as a stable lookup/id key. */
export function normalizeKey(reference: string): string {
  return reference.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Tidy a reference for display: collapse whitespace, trim. */
export function displayReference(reference: string): string {
  return reference.trim().replace(/\s+/g, ' ');
}

/** Build the stable verse id from translation + reference. */
export function verseId(reference: string, translation: string): string {
  return `${translation}:${normalizeKey(reference)}`;
}

function cleanText(text: string): string {
  // Strip any HTML markup (some providers wrap Strong's numbers / italics) then
  // collapse whitespace.
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Providers ------------------------------------------------------------

interface BibleApiResponse {
  reference?: string;
  text?: string;
  translation_id?: string;
  translation_name?: string;
  verses?: { text: string }[];
  error?: string;
}

async function fetchFromBibleApi(
  ref: string,
  info: TranslationInfo,
): Promise<FetchedVerse> {
  const url = `${BIBLE_API_BASE}/${encodeURIComponent(ref)}?translation=${info.id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: BibleApiResponse = await res.json();
  if (data.error || !data.text) throw new Error(data.error || 'No text');
  return {
    reference: data.reference ? displayReference(data.reference) : ref,
    text: cleanText(data.text),
    translation: info.id,
    translationName: data.translation_name ?? info.name,
    offline: false,
  };
}

interface GetBibleVerse {
  verse: number;
  text: string;
}
interface GetBibleChapter {
  verses?: GetBibleVerse[] | Record<string, GetBibleVerse>;
}

async function fetchFromGetBible(
  ref: string,
  info: TranslationInfo,
): Promise<FetchedVerse> {
  const parsed = parseReference(ref);
  if (!parsed) {
    throw new Error(
      `Please enter a reference with a verse, e.g. "John 3:16" or "Romans 12:1-2".`,
    );
  }
  const code = info.providerCode ?? info.id;
  const url = `${GETBIBLE_BASE}/${code}/${parsed.bookNumber}/${parsed.chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: GetBibleChapter = await res.json();

  const list: GetBibleVerse[] = Array.isArray(data.verses)
    ? data.verses
    : Object.values(data.verses ?? {});
  const picked = list
    .filter((v) => v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd)
    .sort((a, b) => a.verse - b.verse)
    .map((v) => cleanText(v.text));

  if (picked.length === 0) throw new Error('Verse not found in that chapter.');

  return {
    reference: formatReference(parsed),
    text: picked.join(' '),
    translation: info.id,
    translationName: info.name,
    offline: false,
  };
}

interface BollsVerse {
  verse: number;
  text: string;
}

async function fetchFromBolls(
  ref: string,
  info: TranslationInfo,
): Promise<FetchedVerse> {
  const parsed = parseReference(ref);
  if (!parsed) {
    throw new Error(
      `Please enter a reference with a verse, e.g. "John 3:16" or "Romans 12:1-2".`,
    );
  }
  const code = info.providerCode ?? info.id;
  const url = `${BOLLS_BASE}/get-text/${code}/${parsed.bookNumber}/${parsed.chapter}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from bolls (${url})`);
  const data: BollsVerse[] = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response shape from bolls.');

  const picked = data
    .filter((v) => v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd)
    .sort((a, b) => a.verse - b.verse)
    .map((v) => cleanText(v.text));

  if (picked.length === 0) throw new Error('Verse not found in that chapter.');

  return {
    reference: formatReference(parsed),
    text: picked.join(' '),
    translation: info.id,
    translationName: info.name,
    offline: false,
  };
}

async function fetchFromEsv(
  ref: string,
  info: TranslationInfo,
  serverUrl?: string | null,
): Promise<FetchedVerse> {
  // ESV is copyrighted: its key lives on the user's server. Route through it.
  if (!serverUrl || !serverUrl.trim()) {
    throw new Error('ESV needs a Server URL — add it in Settings → AI & Server.');
  }
  const base = serverUrl.trim().replace(/\/+$/, '');
  const res = await fetch(`${base}/esv`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reference: ref }),
  });
  const data: { reference?: string; text?: string; error?: string } = await res
    .json()
    .catch(() => ({}));
  if (!res.ok || !data.text) throw new Error(data.error || `ESV request failed (${res.status}).`);
  return {
    reference: data.reference ? displayReference(data.reference) : ref,
    text: cleanText(data.text),
    translation: info.id,
    translationName: info.name,
    offline: false,
  };
}

// ---- Public API -----------------------------------------------------------

/**
 * Fetch a verse (or range) in the given translation, dispatching to the right
 * provider. Falls back to bundled WEB fixtures for the default translation when
 * the network is unavailable.
 */
export async function getVerse(
  reference: string,
  translation = 'web',
  opts: { serverUrl?: string | null } = {},
): Promise<FetchedVerse> {
  const ref = displayReference(reference);
  const info = translationInfo(translation) ?? TRANSLATIONS[0];

  try {
    switch (info.provider) {
      case 'bolls':
        return await fetchFromBolls(ref, info);
      case 'getbible':
        return await fetchFromGetBible(ref, info);
      case 'esv':
        return await fetchFromEsv(ref, info, opts.serverUrl);
      case 'bible-api':
      default:
        return await fetchFromBibleApi(ref, info);
    }
  } catch (err) {
    // Offline fallback only exists for the bundled WEB translation.
    if (info.id === 'web') {
      const fixture = WEB_FIXTURES[normalizeKey(ref)];
      if (fixture) {
        return {
          reference: ref,
          text: cleanText(fixture),
          translation: 'web',
          translationName: translationName('web'),
          offline: true,
        };
      }
    }
    if (err instanceof Error && /Server URL|enter a reference/.test(err.message)) {
      throw err; // already a friendly message
    }
    const detail = err instanceof Error ? ` (${err.message})` : '';
    throw new Error(
      `Couldn't load "${ref}" in ${info.name}. Check your connection and the reference (e.g. "John 3:16").${detail}`,
    );
  }
}
