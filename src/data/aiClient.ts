/**
 * Client for the Engraved server's AI endpoint. All calls require the user to
 * have set a Server URL in Settings (the deployed Worker). Without it, these
 * throw a friendly error the UI turns into a "set up AI in Settings" hint.
 */
import type { Verse } from '@/types';

export class NoServerError extends Error {
  constructor() {
    super('Add your Server URL in Settings to use AI features.');
    this.name = 'NoServerError';
  }
}

function normalizeBase(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function postAi<T>(
  serverUrl: string | null,
  body: Record<string, unknown>,
): Promise<T> {
  if (!serverUrl || !serverUrl.trim()) throw new NoServerError();
  const res = await fetch(`${normalizeBase(serverUrl)}/ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `AI request failed (${res.status}).`);
  }
  return data as T;
}

/** Generate a short memory hook for a verse. */
export async function fetchMemoryHook(serverUrl: string | null, verse: Verse): Promise<string> {
  const { text } = await postAi<{ text: string }>(serverUrl, {
    task: 'hook',
    reference: verse.reference,
    text: verse.text,
  });
  return text;
}

/** Generate a plain-English meaning + context for a verse. */
export async function fetchExplanation(serverUrl: string | null, verse: Verse): Promise<string> {
  const { text } = await postAi<{ text: string }>(serverUrl, {
    task: 'explain',
    reference: verse.reference,
    text: verse.text,
  });
  return text;
}

/** Suggest verse references for a theme (references only — the app fetches text). */
export async function suggestPack(serverUrl: string | null, theme: string): Promise<string[]> {
  const { references } = await postAi<{ references: string[] }>(serverUrl, {
    task: 'pack',
    theme,
  });
  return Array.isArray(references) ? references : [];
}
