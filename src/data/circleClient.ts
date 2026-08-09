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
  memorizedRefs: string[];
  learningRefs: string[];
  bestStreak: number;
  xp: number;
  recentActivity: { type: string; ref?: string; at: number }[];
  lastActiveDay: string | null;
  lastActivity?: { type: string; ref?: string; at: number } | null;
  pushToken?: string | null;
}

async function circleCall(
  serverUrl: string | null,
  body: Record<string, unknown>,
): Promise<CircleSnapshot> {
  try {
    const { snapshot } = await postServer<{ snapshot: CircleSnapshot }>(serverUrl, '/circle', body);
    return snapshot;
  } catch (e) {
    // An old Worker rejects newer actions with this — make it actionable.
    if (e instanceof Error && /unknown circle action/i.test(e.message)) {
      throw new Error('Your circle server is out of date. Ask the owner to redeploy it (see Settings → Smart features).');
    }
    throw e;
  }
}

/** The API version this app build expects from the Worker. */
export const EXPECTED_API_VERSION = 7;

/** Upload an opaque backup blob keyed by the device/transfer id. Best-effort. */
export async function pushBackup(serverUrl: string | null, memberId: string, blob: string): Promise<void> {
  await postServer<{ ok: boolean }>(serverUrl, '/circle', { action: 'backupPush', memberId, blob });
}

/** Fetch the latest backup blob for a transfer id, or null if none exists. */
export async function pullBackup(
  serverUrl: string | null,
  memberId: string,
): Promise<{ blob: string; updatedAt: number } | null> {
  const { backup } = await postServer<{ backup: { blob: string; updatedAt: number } | null }>(
    serverUrl,
    '/circle',
    { action: 'backupPull', memberId },
  );
  return backup ?? null;
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
  chalId?: string,
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
    chalId,
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

export function submitDuel(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  chalId: string,
  accuracy: number,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'submitDuel', code, memberId: member.memberId, displayName: member.displayName, chalId, accuracy });
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

export function createPlan(
  serverUrl: string | null,
  code: string,
  memberId: string,
  title: string,
  items: string[],
  planId?: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'createPlan', code, memberId, title, items, planId });
}

/** Edit an existing plan's title and/or items. */
export function updatePlan(
  serverUrl: string | null,
  code: string,
  memberId: string,
  planId: string,
  title: string,
  items: string[],
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'updatePlan', code, memberId, planId, title, items });
}

export function saveNote(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  note: { noteId?: string; scope: string; ref?: string; text: string },
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, {
    action: 'saveNote',
    code,
    memberId: member.memberId,
    displayName: member.displayName,
    ...note,
  });
}

export function deleteNote(serverUrl: string | null, code: string, memberId: string, noteId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'deleteNote', code, memberId, noteId });
}

export function postMessage(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  msg: { msgId?: string; text: string; context?: string },
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'postMessage', code, memberId: member.memberId, displayName: member.displayName, ...msg });
}

export function deleteMessage(serverUrl: string | null, code: string, memberId: string, msgId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'deleteMessage', code, memberId, msgId });
}

export function addPrayer(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  text: string,
  prayerId?: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'addPrayer', code, memberId: member.memberId, displayName: member.displayName, text, prayerId });
}

export function prayFor(
  serverUrl: string | null,
  code: string,
  member: { memberId: string; displayName: string },
  prayerId: string,
): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'prayFor', code, memberId: member.memberId, displayName: member.displayName, prayerId });
}

export function answerPrayer(serverUrl: string | null, code: string, memberId: string, prayerId: string, answerNote?: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'answerPrayer', code, memberId, prayerId, answerNote });
}

/** Revert an accidentally-answered prayer back to active. */
export function reopenPrayer(serverUrl: string | null, code: string, memberId: string, prayerId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'reopenPrayer', code, memberId, prayerId });
}

/** Edit a prayer request's text. */
export function editPrayer(serverUrl: string | null, code: string, memberId: string, prayerId: string, text: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'editPrayer', code, memberId, prayerId, text });
}

/** Delete a prayer request (and its "prayed" marks). */
export function deletePrayer(serverUrl: string | null, code: string, memberId: string, prayerId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'deletePrayer', code, memberId, prayerId });
}

/** Undo my own "I prayed" mark. */
export function unpray(serverUrl: string | null, code: string, memberId: string, prayerId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'unpray', code, memberId, prayerId });
}

/** Cancel/delete a challenge (and any submission/review). */
export function deleteChallenge(serverUrl: string | null, code: string, memberId: string, chalId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'deleteChallenge', code, memberId, chalId });
}

export function cheer(serverUrl: string | null, code: string, memberId: string, toMemberId: string, kind = 'cheer'): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'cheer', code, memberId, toMemberId, kind });
}

export function renameCircle(serverUrl: string | null, code: string, memberId: string, name: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'renameCircle', code, memberId, name });
}

export function removeVerse(serverUrl: string | null, code: string, memberId: string, reference: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'removeVerse', code, memberId, reference });
}

export function deletePlan(serverUrl: string | null, code: string, memberId: string, planId: string): Promise<CircleSnapshot> {
  return circleCall(serverUrl, { action: 'deletePlan', code, memberId, planId });
}

export async function leaveCircle(
  serverUrl: string | null,
  code: string,
  memberId: string,
): Promise<void> {
  await postServer<{ ok: boolean }>(serverUrl, '/circle', { action: 'leave', code, memberId });
}
