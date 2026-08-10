/**
 * Client for the server's /study endpoint. The AI receives only a passage
 * reference (never verse text) and returns a structured study brief.
 */
import { postServer } from './serverClient';
import type { StudyBrief, StudyContextItem } from '@/types';

export async function fetchStudyBrief(
  serverUrl: string | null,
  passage: string,
  opts: { force?: boolean; circleCode?: string } = {},
): Promise<{ brief: StudyBrief; cached: boolean }> {
  return postServer<{ brief: StudyBrief; cached: boolean }>(serverUrl, '/study', {
    action: 'brief',
    passage,
    force: opts.force,
    circleCode: opts.circleCode,
  });
}

/**
 * Real history/geography/culture for a passage: the AI names the people/places/
 * events, and the server returns actual Wikipedia summaries (cited, with links).
 */
export async function fetchStudyContext(
  serverUrl: string | null,
  passage: string,
): Promise<StudyContextItem[]> {
  const data = await postServer<{ context?: StudyContextItem[] }>(serverUrl, '/study', { action: 'context', passage });
  return Array.isArray(data.context) ? data.context : [];
}

/**
 * A grounded follow-up question about a passage. Returns the AI's answer plus the
 * Scripture references it cites (validate + peek client-side; never verse text).
 */
export async function askStudy(
  serverUrl: string | null,
  passage: string,
  question: string,
  history: { q: string; a: string }[] = [],
): Promise<{ answer: string; references: string[] }> {
  const data = await postServer<{ answer?: string; references?: string[] }>(serverUrl, '/study', {
    action: 'ask',
    passage,
    question,
    history,
  });
  return { answer: data.answer ?? '', references: Array.isArray(data.references) ? data.references : [] };
}
