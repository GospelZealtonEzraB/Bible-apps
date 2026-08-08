/**
 * Client for the server's /circle endpoint (Growing Together). Every call posts
 * an `action` and returns the updated `snapshot` (except `leave`).
 */
import { postServer } from './serverClient';
import type { ChallengeKind, CircleGoal, CircleSnapshot } from '@/types';

/** The progress snapshot a device pushes up about itself. */
export interface MemberSnapshotInput {
  memberId: string;
  displayName: string;
  memorizedCount: number;
  streak: number;
  versesDone: string[];
  planDone: string[];
  lastActiveDay: string | null;
  lastActivity?: { type: string; ref?: string; at: number } | null;
}

async function circleCall(
  serverUrl: string | null,
  body: Record<string, unknown>,
): Promise<CircleSnapshot> {
  const { snapshot } = await postServer<{ snapshot: CircleSnapshot }>(serverUrl, '/circle', body);
  return snapshot;
}

export function createCircle(
  serverUrl: string | null,
  member: MemberSnapshotInput,
  opts: { name?: string; goal?: CircleGoal | null } = {},
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, {
    action: 'create',
    member,
    name: opts.name ?? '',
    goal: opts.goal ?? null,
  });
}

export function joinCircle(
  serverUrl: string | null,
  code: string,
  member: MemberSnapshotInput,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'join', code, member });
}

export function syncCircle(
  serverUrl: string | null,
  code: string,
  member: MemberSnapshotInput,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'sync', code, member });
}

export function getCircle(serverUrl: string | null, code: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'get', code });
}

export function addSharedVerse(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  reference: string,
  forMemberId?: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, {
    action: 'addVerse',
    code,
    memberId: member.memberId,
    displayName: member.displayName,
    reference,
    forMemberId,
  });
}

export function setGoal(
  serverUrl: string | null,
  code: string,
  memberId: string,
  goal: CircleGoal | null,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'setGoal', code, memberId, goal });
}

export function setCovenant(
  serverUrl: string | null,
  code: string,
  memberId: string,
  cadenceLabel: string,
  goalText: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'setCovenant', code, memberId, cadenceLabel, goalText });
}

export function assignChallenge(
  serverUrl: string | null,
  code: string,
  from: { memberId: string; displayName: string },
  toMemberId: string,
  toName: string,
  reference: string,
  kind: ChallengeKind,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, {
    action: 'assignChallenge',
    code,
    memberId: from.memberId,
    displayName: from.displayName,
    toMemberId,
    toName,
    reference,
    kind,
  });
}

export function submitChallenge(
  serverUrl: string | null,
  code: string,
  memberId: string,
  chalId: string,
  text: string,
  accuracy?: number,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'submitChallenge', code, memberId, chalId, text, accuracy });
}

export function reviewChallenge(
  serverUrl: string | null,
  code: string,
  memberId: string,
  chalId: string,
  note: string,
  meaningPrompt?: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, {
    action: 'reviewChallenge',
    code,
    memberId,
    chalId,
    note,
    meaningPrompt,
  });
}

export async function leaveCircle(
  serverUrl: string | null,
  code: string,
  memberId: string,
): Promise<void> {
  await postServer<{ ok: boolean }>(serverUrl, '/circle', { action: 'leave', code, memberId });
}
