/**
 * Client for the server's /study endpoint. The AI receives only a passage
 * reference (never verse text) and returns a structured study brief.
 */
import { postServer } from './serverClient';
import type { StudyBrief } from '@/types';

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
