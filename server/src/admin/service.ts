import { randomUUID } from "node:crypto";
import type { Prisma, User } from "../generated/prisma/client.js";
import type { BillingEnv } from "../env.js";
import { writeAudit } from "../lib/audit.js";
import type { Db } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import {
  computePlusStatus,
  type EntitlementDto,
  grantingWhere,
  loadPlusStatus,
  loadPlusStatuses,
  type PlusStatus,
  toEntitlementDto,
} from "../lib/plus.js";
import { revokeAllForUser } from "../lib/sessions.js";
import { DAY_MS, now } from "../lib/time.js";
import { type Role, toRole } from "../lib/users.js";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
  lastSyncAt: number | null;
  disabledAt: number | null;
  habitCount: number;
  plus: PlusStatus;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Paging {
  page: number;
  pageSize: number;
}

const paging = ({ page, pageSize }: Paging) => ({ skip: (page - 1) * pageSize, take: pageSize });

const withHabitCount = { _count: { select: { habits: { where: { deleted: false } } } } } as const;
type UserWithCount = User & { _count: { habits: number } };

const toRow = (u: UserWithCount, plus: PlusStatus): AdminUserRow => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: toRole(u.role),
  createdAt: u.createdAt,
  lastSyncAt: u.lastSyncAt,
  disabledAt: u.disabledAt,
  habitCount: u._count.habits,
  plus,
});

async function loadRow(db: Db, userId: string): Promise<AdminUserRow> {
  const user = await db.user.findUnique({ where: { id: userId }, include: withHabitCount });
  if (!user) throw userNotFound();
  return toRow(user, await loadPlusStatus(db, userId));
}

const userNotFound = () => notFound("User not found");
const cannotTargetSelf = () => new AppError(400, "CANNOT_TARGET_SELF", "Admins cannot disable or delete their own account");

// ---- users ------------------------------------------------------------------------------

export interface UserFilter extends Paging {
  query?: string;
  plan: "all" | "plus" | "free";
  status: "all" | "active" | "disabled";
}

export async function listUsers(db: Db, filter: UserFilter): Promise<Page<AdminUserRow>> {
  const at = now();
  const and: Prisma.UserWhereInput[] = [];
  const q = filter.query?.trim();
  if (q) and.push({ OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }, { id: q }] });
  if (filter.status === "active") and.push({ disabledAt: null });
  if (filter.status === "disabled") and.push({ disabledAt: { not: null } });
  if (filter.plan === "plus") and.push({ entitlements: { some: grantingWhere(at) } });
  if (filter.plan === "free") and.push({ entitlements: { none: grantingWhere(at) } });
  const where: Prisma.UserWhereInput = { AND: and };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, include: withHabitCount, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...paging(filter) }),
  ]);
  const plus = await loadPlusStatuses(db, users.map((u) => u.id), at);
  return { items: users.map((u) => toRow(u, plus.get(u.id)!)), total, page: filter.page, pageSize: filter.pageSize };
}

/** Level L → L+1 costs 250·L XP (mirrors app/src/lib/xp.ts). */
export function levelForXp(xp: number): number {
  let level = 1;
  while (125 * (level + 1) * level <= xp) level++;
  return level;
}

export async function getUserDetail(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { ...withHabitCount, profile: true } });
  if (!user) throw userNotFound();
  const live = { userId, deleted: false };
  const [habitLogs, tasks, focusSessions, moodLogs, entitlements] = await Promise.all([
    db.habitLog.count({ where: live }),
    db.task.count({ where: live }),
    db.focusSession.count({ where: live }),
    db.moodLog.count({ where: live }),
    db.entitlement.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
  ]);
  return {
    user: toRow(user, computePlusStatus(entitlements)),
    profile: user.profile ? { xp: user.profile.xp, level: levelForXp(user.profile.xp), themeId: user.profile.themeId } : null,
    counts: { habits: user._count.habits, habitLogs, tasks, focusSessions, moodLogs },
    entitlements: entitlements.map(toEntitlementDto),
  };
}

// ---- writes (each one audited) ----------------------------------------------------------

export interface GrantInput {
  months?: number;
  days?: number;
  lifetime?: boolean;
  note?: string;
}

/** Adds calendar months in UTC, clamping to the end of shorter months (Jan 31 + 1 → Feb 28/29). */
export function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}

export async function grant(db: Db, adminId: string, userId: string, input: GrantInput): Promise<EntitlementDto> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw userNotFound();
    const at = now();
    const current = await loadPlusStatus(tx, userId, at);
    // Extends a running period; a lifetime (or no) current Plus starts the grant now.
    const startsAt = !input.lifetime && current.active && current.expiresAt !== null ? current.expiresAt : at;
    const expiresAt = input.lifetime
      ? null
      : input.months !== undefined
        ? addMonthsUtc(startsAt, input.months)
        : startsAt + input.days! * DAY_MS;
    const row = await tx.entitlement.create({
      data: {
        id: randomUUID(),
        userId,
        source: "admin",
        productId: null,
        basePlanId: null,
        status: "active",
        startsAt,
        expiresAt,
        autoRenew: false,
        note: input.note ?? null,
        grantedBy: adminId,
        purchaseToken: null,
        createdAt: at,
        updatedAt: at,
      },
    });
    await writeAudit(tx, {
      adminId,
      action: "grant",
      targetUserId: userId,
      details: {
        entitlementId: row.id,
        ...(input.lifetime ? { lifetime: true } : input.months !== undefined ? { months: input.months } : { days: input.days }),
        startsAt,
        expiresAt,
        note: input.note ?? null,
      },
    });
    return toEntitlementDto(row);
  });
}

export async function revokeEntitlement(db: Db, adminId: string, entitlementId: string, note?: string): Promise<EntitlementDto> {
  return db.$transaction(async (tx) => {
    const existing = await tx.entitlement.findUnique({ where: { id: entitlementId } });
    if (!existing) throw notFound("Entitlement not found");
    const row = await tx.entitlement.update({
      where: { id: entitlementId },
      data: {
        status: "revoked",
        autoRenew: false,
        updatedAt: now(),
        ...(note !== undefined ? { note: existing.note ? `${existing.note}; revoked: ${note}` : `revoked: ${note}` } : {}),
      },
    });
    await writeAudit(tx, {
      adminId,
      action: "revoke",
      targetUserId: existing.userId,
      details: { entitlementId, source: existing.source, previousStatus: existing.status, note: note ?? null },
    });
    return toEntitlementDto(row);
  });
}

export async function setDisabled(db: Db, adminId: string, userId: string, disabled: boolean): Promise<AdminUserRow> {
  if (disabled && userId === adminId) throw cannotTargetSelf();
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true, email: true } });
    if (!user) throw userNotFound();
    if (disabled) {
      // Keep the original timestamp when disabling twice.
      if (user.disabledAt === null) await tx.user.update({ where: { id: userId }, data: { disabledAt: now() } });
      await revokeAllForUser(tx, userId);
    } else if (user.disabledAt !== null) {
      await tx.user.update({ where: { id: userId }, data: { disabledAt: null } });
    }
    await writeAudit(tx, {
      adminId,
      action: disabled ? "disable" : "enable",
      targetUserId: userId,
      details: { email: user.email, changed: disabled ? user.disabledAt === null : user.disabledAt !== null },
    });
  });
  return loadRow(db, userId);
}

export async function deleteUser(db: Db, adminId: string, userId: string): Promise<void> {
  if (userId === adminId) throw cannotTargetSelf();
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) throw userNotFound();
    // The audit row outlives the user, so it keeps the email for display.
    await writeAudit(tx, { adminId, action: "delete", targetUserId: userId, details: { email: user.email, name: user.name } });
    await tx.user.delete({ where: { id: userId } }); // cascades to all user-owned rows, entitlements included
  });
}

// ---- subscriptions & audit --------------------------------------------------------------

export interface SubscriptionFilter extends Paging {
  status: string;
  source: "all" | "play" | "admin" | "trial";
}

export async function listSubscriptions(db: Db, filter: SubscriptionFilter): Promise<Page<EntitlementDto & { userEmail: string }>> {
  const where: Prisma.EntitlementWhereInput = {};
  if (filter.status !== "all") where.status = filter.status;
  if (filter.source === "play") where.source = { in: ["play_subscription", "play_lifetime"] };
  else if (filter.source !== "all") where.source = filter.source;
  const [total, rows] = await Promise.all([
    db.entitlement.count({ where }),
    db.entitlement.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...paging(filter),
    }),
  ]);
  return {
    items: rows.map((r) => ({ ...toEntitlementDto(r), userEmail: r.user.email })),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

export interface AuditItem {
  id: string;
  adminEmail: string | null;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  details: Record<string, unknown>;
  createdAt: number;
}

export async function listAudit(db: Db, filter: Paging): Promise<Page<AuditItem>> {
  const [total, rows] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...paging(filter) }),
  ]);
  const ids = [...new Set(rows.flatMap((r) => (r.targetUserId ? [r.adminId, r.targetUserId] : [r.adminId])))];
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  const emails = new Map(users.map((u) => [u.id, u.email]));
  const items = rows.map((r) => {
    const details = parseDetails(r.details);
    const detailEmail = typeof details.email === "string" ? details.email : null;
    return {
      id: r.id,
      adminEmail: emails.get(r.adminId) ?? null,
      action: r.action,
      targetUserId: r.targetUserId,
      targetEmail: r.targetUserId ? (emails.get(r.targetUserId) ?? detailEmail) : null,
      details,
      createdAt: r.createdAt,
    };
  });
  return { items, total, page: filter.page, pageSize: filter.pageSize };
}

function parseDetails(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : { value };
  } catch {
    return { raw: text };
  }
}

// ---- stats ------------------------------------------------------------------------------

export type Prices = Pick<BillingEnv, "PRICE_MONTHLY_INR" | "PRICE_YEARLY_INR" | "PRICE_LIFETIME_INR">;

const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The last `n` UTC dates, oldest first, ending today. */
export function lastUtcDays(n: number, at: number): string[] {
  const today = Date.UTC(new Date(at).getUTCFullYear(), new Date(at).getUTCMonth(), new Date(at).getUTCDate());
  return Array.from({ length: n }, (_, i) => utcDate(today - (n - 1 - i) * DAY_MS));
}

export async function getStats(db: Db, prices: Prices) {
  const at = now();
  const days = lastUtcDays(30, at);
  const windowStart = Date.parse(`${days[0]}T00:00:00.000Z`);
  const since = { gte: windowStart };

  const [total, new7d, new30d, active7d, disabled, granting, recentSignups, recentSyncs, ...activity] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: at - 7 * DAY_MS } } }),
    db.user.count({ where: { createdAt: { gte: at - 30 * DAY_MS } } }),
    db.user.count({ where: { lastSyncAt: { gte: at - 7 * DAY_MS } } }),
    db.user.count({ where: { disabledAt: { not: null } } }),
    db.entitlement.findMany({ where: grantingWhere(at) }),
    db.user.findMany({ where: { createdAt: since }, select: { createdAt: true } }),
    db.user.findMany({ where: { lastSyncAt: since }, select: { id: true, lastSyncAt: true } }),
    // Daily activity = users who changed any record that day (by the record's updatedAt), plus their last sync.
    db.habitLog.findMany({ where: { updatedAt: since }, select: { userId: true, updatedAt: true } }),
    db.habit.findMany({ where: { updatedAt: since }, select: { userId: true, updatedAt: true } }),
    db.task.findMany({ where: { updatedAt: since }, select: { userId: true, updatedAt: true } }),
    db.focusSession.findMany({ where: { updatedAt: since }, select: { userId: true, updatedAt: true } }),
    db.moodLog.findMany({ where: { updatedAt: since }, select: { userId: true, updatedAt: true } }),
  ]);

  // Plus per user (one PlusStatus each).
  const byUser = new Map<string, typeof granting>();
  for (const e of granting) byUser.set(e.userId, [...(byUser.get(e.userId) ?? []), e]);
  const bySource = { play_subscription: 0, play_lifetime: 0, admin: 0, trial: 0 };
  const byPlan = { monthly: 0, yearly: 0, lifetime: 0, admin: 0, trial: 0 };
  let monthlyEstimate = 0;
  let plusActive = 0;
  for (const ents of byUser.values()) {
    const plus = computePlusStatus(ents, at);
    if (!plus.source) continue;
    plusActive++;
    bySource[plus.source]++;
    if (plus.source === "play_lifetime") byPlan.lifetime++;
    else if (plus.source === "admin") byPlan.admin++;
    else if (plus.source === "trial") byPlan.trial++;
    else if (plus.basePlanId === "yearly") byPlan.yearly++;
    else byPlan.monthly++;
  }
  // Revenue: every live Play subscription (not only the one that decides a user's status).
  let lifetimeCount = 0;
  for (const e of granting) {
    if (e.source === "play_subscription") monthlyEstimate += e.basePlanId === "yearly" ? prices.PRICE_YEARLY_INR / 12 : prices.PRICE_MONTHLY_INR;
    if (e.source === "play_lifetime") lifetimeCount++;
  }

  const signups = new Map(days.map((d) => [d, 0]));
  for (const u of recentSignups) {
    const d = utcDate(u.createdAt);
    if (signups.has(d)) signups.set(d, signups.get(d)! + 1);
  }
  const active = new Map(days.map((d) => [d, new Set<string>()]));
  const mark = (userId: string, ms: number | null) => {
    if (ms !== null && ms <= at) active.get(utcDate(ms))?.add(userId);
  };
  for (const u of recentSyncs) mark(u.id, u.lastSyncAt);
  for (const rows of activity) for (const r of rows) mark(r.userId, r.updatedAt);

  return {
    users: { total, new7d, new30d, active7d, disabled },
    plus: { active: plusActive, bySource, byPlan },
    revenue: {
      monthlyEstimateInr: Math.round(monthlyEstimate),
      /** Not in the contract: list-price value of live lifetime purchases. */
      lifetimeTotalInr: lifetimeCount * prices.PRICE_LIFETIME_INR,
    },
    signupsByDay: days.map((date) => ({ date, count: signups.get(date)! })),
    activeByDay: days.map((date) => ({ date, count: active.get(date)!.size })),
  };
}
