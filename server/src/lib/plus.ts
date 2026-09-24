import type { Entitlement, Prisma } from "../generated/prisma/client.js";
import type { Db, Tx } from "./db.js";
import { now } from "./time.js";

export const ENTITLEMENT_SOURCES = ["play_subscription", "play_lifetime", "admin", "trial"] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const ENTITLEMENT_STATUSES = ["active", "grace", "on_hold", "paused", "canceled", "expired", "revoked", "refunded"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export interface PlusStatus {
  active: boolean;
  source: EntitlementSource | null;
  expiresAt: number | null;
  autoRenew: boolean;
  productId: string | null;
  basePlanId: string | null;
}

/** Public shape of an entitlement (the purchase token is never exposed). */
export interface EntitlementDto {
  id: string;
  userId: string;
  source: EntitlementSource;
  productId: string | null;
  basePlanId: string | null;
  status: EntitlementStatus;
  startsAt: number;
  expiresAt: number | null;
  autoRenew: boolean;
  note: string | null;
  grantedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export type EntitlementLike = Pick<Entitlement, "source" | "status" | "expiresAt" | "autoRenew" | "productId" | "basePlanId">;

export const FREE: PlusStatus = { active: false, source: null, expiresAt: null, autoRenew: false, productId: null, basePlanId: null };

/**
 * Whether an entitlement grants Plus at `at`: status active/grace and not expired.
 * A Play subscription the user cancelled keeps access until its paid period ends
 * (Google's SUBSCRIPTION_STATE_CANCELED), so `canceled` with a future expiry also counts.
 */
export function grantsPlus(e: EntitlementLike, at: number): boolean {
  if (e.status === "active" || e.status === "grace") return e.expiresAt === null || e.expiresAt > at;
  if (e.status === "canceled") return e.expiresAt !== null && e.expiresAt > at;
  return false;
}

/** Pure: the Plus status implied by a user's entitlements. Lifetime beats all, then the latest expiry wins. */
export function computePlusStatus(entitlements: readonly EntitlementLike[], at: number = now()): PlusStatus {
  let best: EntitlementLike | undefined;
  for (const e of entitlements) {
    if (!grantsPlus(e, at)) continue;
    if (!best || beats(e, best)) best = e;
  }
  if (!best) return { ...FREE };
  return {
    active: true,
    source: best.source as EntitlementSource,
    expiresAt: best.expiresAt,
    autoRenew: best.autoRenew,
    productId: best.productId,
    basePlanId: best.basePlanId,
  };
}

function beats(a: EntitlementLike, b: EntitlementLike): boolean {
  if (b.expiresAt === null) return false;
  if (a.expiresAt === null) return true;
  if (a.expiresAt !== b.expiresAt) return a.expiresAt > b.expiresAt;
  return a.autoRenew && !b.autoRenew;
}

/** Prisma filter matching the entitlements `grantsPlus` accepts (keep the two in sync). */
export function grantingWhere(at: number): Prisma.EntitlementWhereInput {
  return {
    OR: [
      { status: { in: ["active", "grace"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
      { status: "canceled", expiresAt: { gt: at } },
    ],
  };
}

export async function loadPlusStatus(db: Db | Tx, userId: string, at: number = now()): Promise<PlusStatus> {
  const rows = await db.entitlement.findMany({ where: { userId, ...grantingWhere(at) } });
  return computePlusStatus(rows, at);
}

/** Plus status for many users with one query. */
export async function loadPlusStatuses(db: Db | Tx, userIds: readonly string[], at: number = now()): Promise<Map<string, PlusStatus>> {
  const rows = userIds.length
    ? await db.entitlement.findMany({ where: { userId: { in: [...userIds] }, ...grantingWhere(at) } })
    : [];
  const byUser = new Map<string, Entitlement[]>();
  for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  return new Map(userIds.map((id) => [id, computePlusStatus(byUser.get(id) ?? [], at)]));
}

export const toEntitlementDto = (e: Entitlement): EntitlementDto => ({
  id: e.id,
  userId: e.userId,
  source: e.source as EntitlementSource,
  productId: e.productId,
  basePlanId: e.basePlanId,
  status: e.status as EntitlementStatus,
  startsAt: e.startsAt,
  expiresAt: e.expiresAt,
  autoRenew: e.autoRenew,
  note: e.note,
  grantedBy: e.grantedBy,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});
