/**
 * Client for the server-side semantic search (Workers AI + Vectorize). The
 * server returns references + scores only; the app hydrates verse text locally.
 */
import { postServer } from './serverClient';

export interface SemanticHit {
  reference: string;
  score: number;
}

export async function semanticSearch(serverUrl: string | null | undefined, query: string): Promise<SemanticHit[]> {
  const data = await postServer<{ results?: SemanticHit[] }>(serverUrl ?? null, '/search', { query });
  return data.results ?? [];
}
