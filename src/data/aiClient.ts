/**
 * Client for the Engraved server's AI endpoint (/ai). Posts through the shared
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

/** Suggest verse references for a theme (references only — the app fetches text). */
export async function suggestPack(serverUrl: string | null, theme: string): Promise<string[]> {
  const { references } = await postServer<{ references: string[] }>(serverUrl, '/ai', {
    task: 'pack',
    theme,
  });
  return Array.isArray(references) ? references : [];
}
