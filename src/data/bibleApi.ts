import { WEB_FIXTURES } from './fixtures';

const API_BASE = 'https://bible-api.com';

/** Translations supported by bible-api.com that are public domain. */
export const TRANSLATIONS: { id: string; name: string }[] = [
  { id: 'web', name: 'World English Bible' },
  { id: 'kjv', name: 'King James Version' },
  { id: 'bbe', name: 'Bible in Basic English' },
  { id: 'oeb-us', name: 'Open English Bible (US)' },
  { id: 'webbe', name: 'WEB British Edition' },
  { id: 'clementine', name: 'Clementine Latin Vulgate' },
];

export function translationName(id: string): string {
  return TRANSLATIONS.find((t) => t.id === id)?.name ?? id.toUpperCase();
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

interface ApiResponse {
  reference?: string;
  text?: string;
  translation_id?: string;
  translation_name?: string;
  verses?: { text: string }[];
  error?: string;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a verse (or range) from bible-api.com, falling back to bundled WEB
 * fixtures when the request fails or the device is offline.
 */
export async function getVerse(
  reference: string,
  translation = 'web',
): Promise<FetchedVerse> {
  const ref = displayReference(reference);
  const url = `${API_BASE}/${encodeURIComponent(ref)}?translation=${translation}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ApiResponse = await res.json();
    if (data.error || !data.text) throw new Error(data.error || 'No text');
    return {
      reference: data.reference ? displayReference(data.reference) : ref,
      text: cleanText(data.text),
      translation: data.translation_id ?? translation,
      translationName: data.translation_name ?? translationName(translation),
      offline: false,
    };
  } catch (networkErr) {
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
    throw new Error(
      `Couldn't load "${ref}". Check your connection and the reference (e.g. "John 3:16").`,
    );
  }
}
