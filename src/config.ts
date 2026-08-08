/**
 * Build-time app configuration.
 *
 * These values are baked into the app when it's built (from `app.json` → `extra`,
 * or an `EXPO_PUBLIC_*` env var at build time) so features like AI work with
 * **zero setup** for anyone who installs the APK — they don't have to paste a
 * server URL. A user can still override the URL in Settings.
 *
 * `APP_SECRET` is an optional shared secret sent as the `x-app-secret` header.
 * It must match the Worker's `APP_SHARED_SECRET` — set BOTH or NEITHER, or AI
 * calls will fail with 401. It's a light speed bump against strangers who find
 * the URL; the real cost guarantee is an OpenAI spend cap on your key.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function nonEmpty(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * The server URL baked into the build. An `EXPO_PUBLIC_SERVER_URL` env var at
 * build time wins; otherwise `app.json` → `extra.defaultServerUrl`.
 */
export const DEFAULT_SERVER_URL: string | null =
  nonEmpty(process.env.EXPO_PUBLIC_SERVER_URL) ?? nonEmpty(extra.defaultServerUrl);

/**
 * Optional shared secret. `EXPO_PUBLIC_APP_SECRET` at build time wins; otherwise
 * `app.json` → `extra.appSecret`. Leave unset unless the Worker also sets
 * `APP_SHARED_SECRET` to the same value.
 */
export const APP_SECRET: string | null =
  nonEmpty(process.env.EXPO_PUBLIC_APP_SECRET) ?? nonEmpty(extra.appSecret);

/**
 * Resolve which server URL to use: a user's override in Settings wins, else the
 * baked-in default. Returns null only when neither exists (AI features off).
 */
export function resolveServerUrl(settingsUrl?: string | null): string | null {
  return nonEmpty(settingsUrl) ?? DEFAULT_SERVER_URL;
}

/** Headers to attach to server calls (adds the shared secret when configured). */
export function serverHeaders(base: Record<string, string> = {}): Record<string, string> {
  return APP_SECRET ? { ...base, 'x-app-secret': APP_SECRET } : base;
}
