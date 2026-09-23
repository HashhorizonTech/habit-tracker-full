import { randomUUID } from "node:crypto";
import type { Db, Tx } from "./db.js";
import { AppError } from "./errors.js";
import { now } from "./time.js";
import { generateRefreshToken, hashToken, REFRESH_TOKEN_TTL_MS } from "./tokens.js";

const invalidRefreshToken = () => new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");

/** Stores a new refresh token (hashed) and returns the raw value for the client. */
export async function createRefreshToken(
  db: Db | Tx,
  userId: string,
  familyId: string = randomUUID(),
): Promise<{ id: string; token: string }> {
  const token = generateRefreshToken();
  const id = randomUUID();
  const issuedAt = now();
  await db.refreshToken.create({
    data: { id, userId, familyId, tokenHash: hashToken(token), createdAt: issuedAt, expiresAt: issuedAt + REFRESH_TOKEN_TTL_MS },
  });
  return { id, token };
}

/**
 * Exchanges a refresh token for a new one in the same family. Presenting a token
 * that was already rotated or revoked is treated as theft: the whole family is
 * revoked, which also logs out whoever holds the current token of that family.
 */
export async function rotateRefreshToken(db: Db, token: string): Promise<{ userId: string; token: string }> {
  const outcome = await db.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored) return null;

    const at = now();
    if (stored.revokedAt !== null) {
      await revokeFamily(tx, stored.familyId, at);
      return null;
    }
    if (stored.expiresAt <= at) return null;

    // Conditional update so two concurrent refreshes with the same token can't both win.
    const { count } = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: at },
    });
    if (count !== 1) {
      await revokeFamily(tx, stored.familyId, at);
      return null;
    }
    const next = await createRefreshToken(tx, stored.userId, stored.familyId);
    await tx.refreshToken.update({ where: { id: stored.id }, data: { replacedBy: next.id } });
    return { userId: stored.userId, token: next.token };
  });

  if (!outcome) throw invalidRefreshToken();
  return outcome;
}

/** Idempotent: unknown or already-revoked tokens are ignored. */
export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: now() } });
}

async function revokeFamily(tx: Tx, familyId: string, at: number): Promise<void> {
  await tx.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: at } });
}
