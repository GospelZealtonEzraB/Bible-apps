/**
 * Client for the Versed server's AI endpoint (/ai). Posts through the shared
 * `postServer` helper, which resolves the server URL and attaches the shared
 * secret. `NoServerError` is re-exported for callers/tests that reference it.
 */
import type { Verse } from '@/types';
import { postServer, NoServerError } from './serverClient';

export { NoServerError };

/** Generate a short memory hook for a verse. */
export async function fetchMemoryHook(serverUrl: string | null, verse: Verse): Promise<string> {
  const { text } = await postServer<{ text: string }>(serverUrl, '/ai', {
    task: 'hook',
    reference: verse.reference,
    text: verse.text,
  });
  return text;
}

/** Generate a plain-English meaning + context for a verse. */
export async function fetchExplanation(serverUrl: string | null, verse: Verse): Promise<string> {
  const { text } = await postServer<{ text: string }>(serverUrl, '/ai', {
    task: 'explain',
    reference: verse.reference,
    text: verse.text,
  });
  return text;
}

/**
 * AI-suggested chord progressions for a song (key/capo/section chords, NO lyrics).
 * Best-effort and may be wrong — always shown with a "verify" disclaimer.
 */
export async function fetchChords(serverUrl: string | null, title: string, artist?: string): Promise<string> {
  const { text } = await postServer<{ text: string }>(serverUrl, '/ai', {
    task: 'chords',
    title,
    artist: artist ?? '',
  });
  return text;
}

/**
 * Summarize a sermon from a pasted transcript OR a URL (YouTube captions best-
 * effort, or an article page) → original-prose summary + extracted references.
 */
export async function fetchSermon(
  serverUrl: string | null,
  input: { transcript?: string; url?: string },
): Promise<{ summary: string; references: string[]; error?: string }> {
  const data = await postServer<{ summary?: string; references?: string[]; error?: string }>(serverUrl, '/ai', {
    task: 'sermon',
    ...input,
  });
  return { summary: data.summary ?? '', references: Array.isArray(data.references) ? data.references : [], error: data.error };
}

/** Suggest verse references for a theme (references only — the app fetches text). */
export async function suggestPack(serverUrl: string | null, theme: string): Promise<string[]> {
  const { references } = await postServer<{ references: string[] }>(serverUrl, '/ai', {
    task: 'pack',
    theme,
  });
  return Array.isArray(references) ? references : [];
}
