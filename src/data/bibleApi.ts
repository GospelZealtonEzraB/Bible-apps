import { WEB_FIXTURES } from './fixtures';
import { parseReference, formatReference, parsePassage, formatPassage } from './books';
import { getLocalChapter, getLocalRange } from './localBible';
import { resolveServerUrl, serverHeaders } from '@/config';

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
  // Tamil Old Version (TAOVBSI) is served by getbible.net, not bolls — bolls uses
  // its own numeric ids. The provider/code pairing here was the reason Tamil
  // silently failed to load.
  { id: 'tamil', name: 'தமிழ் (Tamil)', language: 'ta', provider: 'getbible', providerCode: 'TAOVBSI' },
  // ESV is copyrighted: its text is fetched through the user's Worker (which holds
  // the Crossway key as ESV_API_KEY). Available only when a Server URL is set.
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
  /** Publisher attribution to display (e.g. ESV/Crossway), when required. */
  attribution?: string;
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
  // ESV is copyrighted: its key lives on the user's server. Route through it,
  // falling back to the baked-in server URL when Settings has no override.
  const resolved = resolveServerUrl(serverUrl);
  if (!resolved) {
    throw new Error('ESV needs a Server URL — add it in Settings → AI & Server.');
  }
  const base = resolved.replace(/\/+$/, '');
  const res = await fetch(`${base}/esv`, {
    method: 'POST',
    headers: serverHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ reference: ref }),
  });
  const data: { reference?: string; text?: string; error?: string; attribution?: string } = await res
    .json()
    .catch(() => ({}));
  if (!res.ok || !data.text) throw new Error(data.error || `ESV request failed (${res.status}).`);
  return {
    reference: data.reference ? displayReference(data.reference) : ref,
    text: cleanText(data.text),
    translation: info.id,
    translationName: info.name,
    offline: false,
    attribution: data.attribution,
  };
}

interface EsvChapterResponse {
  reference?: string;
  verses?: { verse: number; text: string }[];
  attribution?: string;
  error?: string;
}

async function chapterFromEsv(
  info: TranslationInfo,
  bookName: string,
  chapter: number,
  serverUrl?: string | null,
): Promise<{ verses: ChapterVerse[]; attribution?: string }> {
  const resolved = resolveServerUrl(serverUrl);
  if (!resolved) {
    throw new Error('ESV needs a Server URL — add it in Settings → AI & Server.');
  }
  const base = resolved.replace(/\/+$/, '');
  const res = await fetch(`${base}/esv`, {
    method: 'POST',
    headers: serverHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ reference: `${bookName} ${chapter}` }),
  });
  const data: EsvChapterResponse = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.verses) || data.verses.length === 0) {
    throw new Error(data.error || `ESV request failed (${res.status}).`);
  }
  return {
    verses: data.verses
      .map((v) => ({ verse: Number(v.verse), text: cleanText(String(v.text ?? '')) }))
      .filter((v) => v.text)
      .sort((a, b) => a.verse - b.verse),
    attribution: data.attribution,
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

  // Local-first: KJV is bundled offline, so it resolves instantly with no network.
  if (info.id === 'kjv') {
    const parsed = parseReference(ref);
    if (parsed) {
      const text = getLocalRange(parsed.bookNumber, parsed.chapter, parsed.verseStart, parsed.verseEnd);
      if (text) {
        return {
          reference: formatReference(parsed),
          text: cleanText(text),
          translation: 'kjv',
          translationName: info.name,
          offline: true,
        };
      }
    }
  }

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

// ---- Whole-chapter / passage fetch (for the study reader) -----------------

export interface ChapterVerse {
  verse: number;
  text: string;
}
export interface FetchedChapter {
  reference: string;
  verses: ChapterVerse[];
  translationName: string;
  /** Publisher attribution to display (e.g. ESV/Crossway), when required. */
  attribution?: string;
}

async function chapterFromBibleApi(info: TranslationInfo, bookName: string, chapter: number): Promise<ChapterVerse[]> {
  const url = `${BIBLE_API_BASE}/${encodeURIComponent(`${bookName} ${chapter}`)}?translation=${info.id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  if (data.error) throw new Error(data.error);
  const arr: any[] = Array.isArray(data.verses) ? data.verses : [];
  return arr
    .map((v) => ({ verse: Number(v.verse), text: cleanText(String(v.text ?? '')) }))
    .filter((v) => v.text);
}

async function chapterFromGetBible(info: TranslationInfo, bookNumber: number, chapter: number): Promise<ChapterVerse[]> {
  const code = info.providerCode ?? info.id;
  const res = await fetch(`${GETBIBLE_BASE}/${code}/${bookNumber}/${chapter}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: GetBibleChapter = await res.json();
  const list: GetBibleVerse[] = Array.isArray(data.verses) ? data.verses : Object.values(data.verses ?? {});
  return list.map((v) => ({ verse: v.verse, text: cleanText(v.text) })).sort((a, b) => a.verse - b.verse);
}

async function chapterFromBolls(info: TranslationInfo, bookNumber: number, chapter: number): Promise<ChapterVerse[]> {
  const code = info.providerCode ?? info.id;
  const res = await fetch(`${BOLLS_BASE}/get-text/${code}/${bookNumber}/${chapter}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: BollsVerse[] = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response shape from bolls.');
  return data.map((v) => ({ verse: v.verse, text: cleanText(v.text) })).sort((a, b) => a.verse - b.verse);
}

/**
 * Fetch a whole chapter or a verse range for reading/study. Unlike `getVerse`
 * this accepts a verseless chapter ("John 3"). No offline fixtures (chapters
 * aren't bundled), so it needs a connection.
 */
export async function getChapterVerses(
  reference: string,
  translation = 'web',
  opts: { serverUrl?: string | null } = {},
): Promise<FetchedChapter> {
  const passage = parsePassage(reference);
  if (!passage) {
    throw new Error('Enter a chapter or passage, e.g. "John 3" or "John 3:1-21".');
  }
  const info = translationInfo(translation) ?? TRANSLATIONS[0];

  // Local-first: KJV is bundled offline — serve the chapter with no network.
  if (info.id === 'kjv') {
    const local = getLocalChapter(passage.bookNumber, passage.chapter);
    if (local) {
      const verses = passage.whole
        ? local
        : local.filter((v) => v.verse >= (passage.verseStart ?? 1) && v.verse <= (passage.verseEnd ?? 99999));
      if (verses.length) return { reference: formatPassage(passage), verses, translationName: info.name };
    }
  }

  let all: ChapterVerse[];
  let attribution: string | undefined;
  switch (info.provider) {
    case 'bolls':
      all = await chapterFromBolls(info, passage.bookNumber, passage.chapter);
      break;
    case 'getbible':
      all = await chapterFromGetBible(info, passage.bookNumber, passage.chapter);
      break;
    case 'esv': {
      const esv = await chapterFromEsv(info, passage.bookName, passage.chapter, opts.serverUrl);
      all = esv.verses;
      attribution = esv.attribution;
      break;
    }
    case 'bible-api':
    default:
      all = await chapterFromBibleApi(info, passage.bookName, passage.chapter);
      break;
  }

  const verses = passage.whole
    ? all
    : all.filter((v) => v.verse >= (passage.verseStart ?? 1) && v.verse <= (passage.verseEnd ?? 99999));
  if (verses.length === 0) throw new Error('No verses found for that passage.');

  return { reference: formatPassage(passage), verses, translationName: info.name, attribution };
}
