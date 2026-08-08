/**
 * Shared client for the Versed server. Resolves the server URL (a user's
 * Settings override wins, else the baked-in default) and attaches the optional
 * shared-secret header. All server families (/ai, /circle, /study) post through
 * `postServer`. Without any resolvable URL it throws `NoServerError`, which the
 * UI turns into a friendly "set up in Settings" hint.
 */
import { resolveServerUrl, serverHeaders } from '@/config';

export class NoServerError extends Error {
  constructor() {
    super('Add your Server URL in Settings to use online features.');
    this.name = 'NoServerError';
  }
}

function normalizeBase(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

export async function postServer<T>(
  serverUrl: string | null,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const base = resolveServerUrl(serverUrl);
  if (!base) throw new NoServerError();
  const res = await fetch(`${normalizeBase(base)}${path}`, {
    method: 'POST',
    headers: serverHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`);
  }
  return data as T;
}
