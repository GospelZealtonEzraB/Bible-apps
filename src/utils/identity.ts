/**
 * Local anonymous identity for Growing Together.
 *
 * No accounts: each device mints a random, stable `memberId` once. The same
 * value doubles as the "transfer code" a user can enter on a new phone to keep
 * their identity (and, once circles exist, re-sync their shared data). A clean
 * upgrade path to real accounts later replaces only how this id is minted — see
 * the plan's identity seam (`effectiveId = accountId ?? memberId`).
 */

/** Mint a new stable member id, e.g. `m_l021x8k3f9qz`. No crypto dependency. */
export function newMemberId(): string {
  return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/** True when a string is a well-formed member/transfer code. */
export function isValidMemberId(code: string): boolean {
  return /^m_[a-z0-9]+$/i.test(code.trim());
}
