import { randomInt, randomUUID } from "node:crypto";
import type { Db, Tx } from "../lib/db.js";
import { isUniqueViolation } from "../lib/db.js";
import { loadPlusStatus } from "../lib/plus.js";
import { DAY_MS, now } from "../lib/time.js";

/** No I, L, O, 0 or 1 (easy to misread). */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_URL_BASE = "https://hashhorizon.in/app/tend/invite/";

/** Rewards an inviter can earn in a rolling 365-day window. */
export const INVITE_REWARD_CAP = 10;
export const INVITE_REWARD_WINDOW_MS = 365 * DAY_MS;
export const INVITE_REWARD_DAYS = 7;
export const INVITE_REWARD_NOTE = "invite reward";

const CODE_PATTERN = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

/** `k7pq-2mxr`, ` K7PQ2MXR ` → `K7PQ2MXR`; null if it can't be a code. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Display form with a dash: `K7PQ-2MXR`. */
export const formatInviteCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

export const inviteUrl = (code: string): string => `${INVITE_URL_BASE}${code}`;

/** Returns the user's permanent code, generating it on first use. */
export async function ensureInviteCode(db: Db, userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
  if (user.inviteCode) return user.inviteCode;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateInviteCode();
    try {
      // Conditional: two concurrent first calls must not overwrite each other's code.
      const { count } = await db.user.updateMany({ where: { id: userId, inviteCode: null }, data: { inviteCode: code } });
      if (count === 1) return code;
      const again = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
      if (again.inviteCode) return again.inviteCode;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // collision with another user's code: retry
    }
  }
  throw new Error("Could not allocate a unique invite code");
}

export async function countRecentRewards(db: Db | Tx, inviterId: string, at: number = now()): Promise<number> {
  return db.inviteRedemption.count({ where: { inviterId, rewarded: true, createdAt: { gt: at - INVITE_REWARD_WINDOW_MS } } });
}

/** 7-day trial entitlement that starts when the user's current (non-lifetime) Plus ends. */
async function grantInviteReward(tx: Tx, userId: string, at: number): Promise<string> {
  const current = await loadPlusStatus(tx, userId, at);
  const startsAt = current.active && current.expiresAt !== null ? current.expiresAt : at;
  const row = await tx.entitlement.create({
    data: {
      id: randomUUID(),
      userId,
      source: "trial",
      productId: null,
      basePlanId: null,
      status: "active",
      startsAt,
      expiresAt: startsAt + INVITE_REWARD_DAYS * DAY_MS,
      autoRenew: false,
      note: INVITE_REWARD_NOTE,
      grantedBy: null,
      purchaseToken: null,
      createdAt: at,
      updatedAt: at,
    },
  });
  return row.id;
}

export interface Redemption {
  inviterId: string;
  rewarded: boolean;
}

/**
 * Applies an invite code for a freshly registered user: friendship with the inviter and,
 * under the inviter's yearly cap, a 7-day Plus reward for both. Unknown codes, disabled
 * inviters and blocked pairs are ignored (null).
 */
export async function redeemInvite(db: Db, inviteeId: string, rawCode: string): Promise<Redemption | null> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return null;
  return db.$transaction(async (tx) => {
    const inviter = await tx.user.findUnique({ where: { inviteCode: code }, select: { id: true, disabledAt: true } });
    if (!inviter || inviter.disabledAt !== null || inviter.id === inviteeId) return null;
    if (await tx.inviteRedemption.findUnique({ where: { inviteeId } })) return null;

    const at = now();
    const rewarded = (await countRecentRewards(tx, inviter.id, at)) < INVITE_REWARD_CAP;
    const inviterEntitlementId = rewarded ? await grantInviteReward(tx, inviter.id, at) : null;
    const inviteeEntitlementId = rewarded ? await grantInviteReward(tx, inviteeId, at) : null;
    await tx.inviteRedemption.create({
      data: { id: randomUUID(), inviterId: inviter.id, inviteeId, code, rewarded, inviterEntitlementId, inviteeEntitlementId, createdAt: at },
    });
    const [userAId, userBId] = inviter.id < inviteeId ? [inviter.id, inviteeId] : [inviteeId, inviter.id];
    await tx.friendship.create({ data: { userAId, userBId, createdAt: at } });
    await tx.inboxItem.create({
      data: { id: randomUUID(), userId: inviter.id, fromId: inviteeId, kind: "invite_joined", message: null, createdAt: at, readAt: null },
    });
    return { inviterId: inviter.id, rewarded };
  });
}
