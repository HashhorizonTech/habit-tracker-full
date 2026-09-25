import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db, Tx } from "../lib/db.js";
import { isUniqueViolation } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { DAY_MS, now } from "../lib/time.js";
import type { InboxKind, Notifier } from "../push/notifier.js";
import { cardForFriend, type FriendCard, parseStoredCard } from "./card.js";
import { countRecentRewards, ensureInviteCode, INVITE_REWARD_CAP, inviteUrl, normalizeInviteCode } from "./invite.js";

export interface SocialDeps {
  db: Db;
  notifier: Notifier;
}

// ---- limits -----------------------------------------------------------------------------

export const MAX_PENDING_OUTGOING = 30;
/** Per sender → receiver per UTC day. */
export const NUDGES_PER_DAY = 1;
export const CHEERS_PER_DAY = 5;
export const REPORTS_PER_DAY = 20;
export const INBOX_PAGE = 50;

// ---- errors -----------------------------------------------------------------------------

const blocked = () => new AppError(403, "BLOCKED", "This action isn't available for this user");
const codeNotFound = () => new AppError(404, "CODE_NOT_FOUND", "No one has this invite code");
const cannotAddSelf = () => new AppError(400, "CANNOT_ADD_SELF", "That's your own invite code");
const alreadyFriends = () => new AppError(409, "ALREADY_FRIENDS", "You're already friends");
const requestPending = () => new AppError(409, "REQUEST_PENDING", "You already sent this person a request");
const tooManyRequests = () =>
  new AppError(429, "TOO_MANY_REQUESTS", `You have ${MAX_PENDING_OUTGOING} pending requests; wait for some to be answered`);
const requestNotFound = () => new AppError(404, "REQUEST_NOT_FOUND", "Friend request not found");
const notFriends = () => new AppError(404, "NOT_FRIENDS", "You're not friends with this user");
const nudgeLimit = (kind: "nudge" | "cheer") =>
  new AppError(
    429,
    "NUDGE_LIMIT",
    kind === "nudge" ? "You already nudged this friend today" : `You can send up to ${CHEERS_PER_DAY} cheers to a friend per day`,
  );
const userNotFound = () => new AppError(404, "USER_NOT_FOUND", "User not found");
const cannotTargetSelf = () => new AppError(400, "CANNOT_TARGET_SELF", "You can't do that to yourself");
const tooManyReports = () => new AppError(429, "TOO_MANY_REPORTS", "Too many reports today; try again tomorrow");

// ---- shapes -----------------------------------------------------------------------------

export interface PublicUser {
  userId: string;
  name: string;
  initial: string;
}

export interface Friend extends PublicUser {
  since: number;
  card: FriendCard | null;
  nudgedToday: boolean;
}

export interface RequestItem {
  id: string;
  from: PublicUser;
  to: PublicUser;
  createdAt: number;
}

export interface InboxItemDto {
  id: string;
  kind: InboxKind;
  from: PublicUser;
  message: string | null;
  createdAt: number;
  readAt: number | null;
}

const publicSelect = { id: true, name: true, profile: { select: { name: true } } } as const;
type PublicRow = { id: string; name: string; profile: { name: string } | null };

/** The app's display name (profile, synced) wins over the registration name. Never the email. */
export const displayName = (u: PublicRow): string => u.profile?.name.trim() || u.name;

export function toPublicUser(u: PublicRow): PublicUser {
  const name = displayName(u);
  return { userId: u.id, name, initial: (Array.from(name)[0] ?? "?").toUpperCase() };
}

const pairOf = (a: string, b: string) => (a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a });

/** Start of the current UTC day (nudge/cheer limits and `nudgedToday`). */
export function utcDayStart(at: number): number {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ---- relationship checks ----------------------------------------------------------------

export async function isBlockedPair(db: Db | Tx, a: string, b: string): Promise<boolean> {
  const row = await db.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { createdAt: true },
  });
  return row !== null;
}

export async function areFriends(db: Db | Tx, a: string, b: string): Promise<boolean> {
  return (await db.friendship.findUnique({ where: { userAId_userBId: pairOf(a, b) }, select: { createdAt: true } })) !== null;
}

async function loadPublic(db: Db | Tx, userId: string): Promise<PublicUser> {
  return toPublicUser(await db.user.findUniqueOrThrow({ where: { id: userId }, select: publicSelect }));
}

async function createInbox(tx: Db | Tx, userId: string, fromId: string, kind: InboxKind, message: string | null, at: number) {
  return tx.inboxItem.create({ data: { id: randomUUID(), userId, fromId, kind, message, createdAt: at, readAt: null } });
}

// ---- me & settings ----------------------------------------------------------------------

export async function getSocialMe(db: Db, userId: string) {
  const [inviteCode, earned, user] = await Promise.all([
    ensureInviteCode(db, userId),
    countRecentRewards(db, userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { shareHabitNames: true } }),
  ]);
  return {
    inviteCode,
    inviteUrl: inviteUrl(inviteCode),
    rewardsEarned: earned,
    rewardsLeft: Math.max(0, INVITE_REWARD_CAP - earned),
    settings: { shareHabitNames: user.shareHabitNames },
  };
}

export const SettingsBody = z.object({ shareHabitNames: z.boolean() });

export async function updateSettings(db: Db, userId: string, body: z.output<typeof SettingsBody>) {
  const user = await db.user.update({ where: { id: userId }, data: { shareHabitNames: body.shareHabitNames }, select: { shareHabitNames: true } });
  return { shareHabitNames: user.shareHabitNames };
}

/** Last write wins by the card's `updatedAt`; an older card is ignored and the stored one returned. */
export async function putCard(db: Db, userId: string, card: FriendCard): Promise<FriendCard> {
  const existing = await db.friendCard.findUnique({ where: { userId } });
  if (existing && existing.updatedAt > card.updatedAt) return parseStoredCard(existing.data);
  const data = JSON.stringify(card);
  await db.friendCard.upsert({ where: { userId }, create: { userId, data, updatedAt: card.updatedAt }, update: { data, updatedAt: card.updatedAt } });
  return card;
}

// ---- friends ----------------------------------------------------------------------------

async function friendIdsWithSince(db: Db | Tx, userId: string): Promise<Map<string, number>> {
  const rows = await db.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
  return new Map(rows.map((r) => [r.userAId === userId ? r.userBId : r.userAId, r.createdAt]));
}

async function buildFriends(db: Db | Tx, me: string, since: Map<string, number>, at: number = now()): Promise<Friend[]> {
  const ids = [...since.keys()];
  if (!ids.length) return [];
  const [users, nudged] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { ...publicSelect, shareHabitNames: true, friendCard: true } }),
    db.inboxItem.findMany({
      where: { fromId: me, userId: { in: ids }, kind: "nudge", createdAt: { gte: utcDayStart(at) } },
      select: { userId: true },
    }),
  ]);
  const nudgedIds = new Set(nudged.map((n) => n.userId));
  return users
    .map((u) => ({
      ...toPublicUser(u),
      since: since.get(u.id)!,
      card: u.friendCard ? cardForFriend(parseStoredCard(u.friendCard.data), u.shareHabitNames) : null,
      nudgedToday: nudgedIds.has(u.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.userId.localeCompare(b.userId));
}

export async function listFriends(db: Db, userId: string): Promise<{ friends: Friend[] }> {
  return { friends: await buildFriends(db, userId, await friendIdsWithSince(db, userId)) };
}

async function friendView(db: Db | Tx, me: string, other: string): Promise<Friend> {
  const row = await db.friendship.findUniqueOrThrow({ where: { userAId_userBId: pairOf(me, other) } });
  return (await buildFriends(db, me, new Map([[other, row.createdAt]])))[0]!;
}

export async function removeFriend(db: Db, userId: string, otherId: string): Promise<void> {
  await db.friendship.deleteMany({ where: pairOf(userId, otherId) });
}

// ---- requests ---------------------------------------------------------------------------

const requestInclude = { from: { select: publicSelect }, to: { select: publicSelect } } as const;

type RequestRow = { id: string; createdAt: number; from: PublicRow; to: PublicRow };
const toRequestItem = (r: RequestRow): RequestItem => ({ id: r.id, from: toPublicUser(r.from), to: toPublicUser(r.to), createdAt: r.createdAt });

export const RequestBody = z.object({ code: z.string().trim().min(1).max(32) });

export type SendResult =
  | { autoAccepted: false; request: RequestItem }
  | { autoAccepted: true; request: RequestItem; friend: Friend };

/**
 * Sends a friend request by invite code. If the target already has a pending request to
 * the sender, that request is accepted instead (`autoAccepted: true` + the new friend).
 */
export async function sendRequest({ db, notifier }: SocialDeps, me: string, rawCode: string): Promise<SendResult> {
  const code = normalizeInviteCode(rawCode);
  if (!code) throw codeNotFound();
  const target = await db.user.findUnique({ where: { inviteCode: code }, select: { id: true, disabledAt: true } });
  if (!target || target.disabledAt !== null) throw codeNotFound();
  if (target.id === me) throw cannotAddSelf();
  if (await isBlockedPair(db, me, target.id)) throw blocked();
  if (await areFriends(db, me, target.id)) throw alreadyFriends();
  if (await db.friendRequest.findUnique({ where: { fromId_toId: { fromId: me, toId: target.id } } })) throw requestPending();

  const reciprocal = await db.friendRequest.findUnique({ where: { fromId_toId: { fromId: target.id, toId: me } }, include: requestInclude });
  if (reciprocal) {
    const friend = await acceptRequest({ db, notifier }, me, reciprocal.id);
    return { autoAccepted: true, request: toRequestItem(reciprocal), friend };
  }

  if ((await db.friendRequest.count({ where: { fromId: me } })) >= MAX_PENDING_OUTGOING) throw tooManyRequests();

  const at = now();
  let row;
  try {
    row = await db.$transaction(async (tx) => {
      const created = await tx.friendRequest.create({ data: { id: randomUUID(), fromId: me, toId: target.id, createdAt: at }, include: requestInclude });
      await createInbox(tx, target.id, me, "friend_request", null, at);
      return created;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw requestPending();
    throw err;
  }
  const item = toRequestItem(row);
  notifier.notify(target.id, "friend_request", item.from.name);
  return { autoAccepted: false, request: item };
}

export async function listRequests(db: Db, userId: string): Promise<{ incoming: RequestItem[]; outgoing: RequestItem[] }> {
  const order = [{ createdAt: "desc" as const }, { id: "asc" as const }];
  const [incoming, outgoing] = await Promise.all([
    db.friendRequest.findMany({ where: { toId: userId }, include: requestInclude, orderBy: order }),
    db.friendRequest.findMany({ where: { fromId: userId }, include: requestInclude, orderBy: order }),
  ]);
  return { incoming: incoming.map(toRequestItem), outgoing: outgoing.map(toRequestItem) };
}

/** Recipient accepts: the request becomes a friendship and the sender gets `friend_accepted`. */
export async function acceptRequest({ db, notifier }: SocialDeps, me: string, requestId: string): Promise<Friend> {
  const at = now();
  const { fromId } = await db.$transaction(async (tx) => {
    const req = await tx.friendRequest.findUnique({ where: { id: requestId } });
    if (!req || req.toId !== me) throw requestNotFound();
    // Blocking deletes pending requests, but check anyway.
    if (await isBlockedPair(tx, me, req.fromId)) throw blocked();
    await tx.friendRequest.deleteMany({ where: { OR: [{ id: req.id }, { fromId: me, toId: req.fromId }] } });
    if (!(await areFriends(tx, me, req.fromId))) await tx.friendship.create({ data: { ...pairOf(me, req.fromId), createdAt: at } });
    await createInbox(tx, req.fromId, me, "friend_accepted", null, at);
    return req;
  });
  const friend = await friendView(db, me, fromId);
  notifier.notify(fromId, "friend_accepted", (await loadPublic(db, me)).name);
  return friend;
}

export async function declineRequest(db: Db, me: string, requestId: string): Promise<void> {
  const { count } = await db.friendRequest.deleteMany({ where: { id: requestId, toId: me } });
  if (count === 0) throw requestNotFound();
}

/** Sender cancels; the unread `friend_request` inbox item goes with it. */
export async function cancelRequest(db: Db, me: string, requestId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const req = await tx.friendRequest.findUnique({ where: { id: requestId } });
    if (!req || req.fromId !== me) throw requestNotFound();
    await tx.friendRequest.delete({ where: { id: req.id } });
    await tx.inboxItem.deleteMany({ where: { userId: req.toId, fromId: me, kind: "friend_request", readAt: null } });
  });
}

// ---- nudges & inbox ---------------------------------------------------------------------

export const NUDGE_MESSAGES = ["nudge.gentle", "nudge.streak"] as const;
export const CHEER_MESSAGES = ["cheer.proud", "cheer.keepgoing", "cheer.fire"] as const;

export const NudgeBody = z
  .object({
    kind: z.enum(["nudge", "cheer"]),
    message: z.enum([...NUDGE_MESSAGES, ...CHEER_MESSAGES]).optional(),
  })
  .refine((b) => b.message === undefined || b.message.startsWith(`${b.kind}.`), {
    message: "message must be a preset key of the same kind (nudge.* or cheer.*)",
    path: ["message"],
  });

export async function nudge({ db, notifier }: SocialDeps, me: string, targetId: string, body: z.output<typeof NudgeBody>): Promise<InboxItemDto> {
  if (targetId === me) throw cannotTargetSelf();
  if (await isBlockedPair(db, me, targetId)) throw blocked();
  if (!(await areFriends(db, me, targetId))) throw notFriends();
  const at = now();
  const sent = await db.inboxItem.count({ where: { fromId: me, userId: targetId, kind: body.kind, createdAt: { gte: utcDayStart(at) } } });
  if (sent >= (body.kind === "nudge" ? NUDGES_PER_DAY : CHEERS_PER_DAY)) throw nudgeLimit(body.kind);
  const row = await createInbox(db, targetId, me, body.kind, body.message ?? null, at);
  const from = await loadPublic(db, me);
  notifier.notify(targetId, body.kind, from.name, row.message);
  return { id: row.id, kind: body.kind, from, message: row.message, createdAt: row.createdAt, readAt: null };
}

export const InboxQuery = z.object({ since: z.coerce.number().min(0).optional() });

export async function listInbox(db: Db, userId: string, since?: number): Promise<{ items: InboxItemDto[] }> {
  const rows = await db.inboxItem.findMany({
    where: { userId, ...(since !== undefined ? { createdAt: { gt: since } } : {}) },
    include: { from: { select: publicSelect } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: INBOX_PAGE,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind as InboxKind,
      from: toPublicUser(r.from),
      message: r.message,
      createdAt: r.createdAt,
      readAt: r.readAt,
    })),
  };
}

export const ReadBody = z.object({ ids: z.array(z.string().min(1).max(200)).max(500).optional() }).default({});

export async function markRead(db: Db, userId: string, ids?: string[]): Promise<void> {
  await db.inboxItem.updateMany({ where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: now() } });
}

// ---- blocks & reports -------------------------------------------------------------------

async function requireOtherUser(db: Db, me: string, targetId: string): Promise<void> {
  if (targetId === me) throw cannotTargetSelf();
  if (!(await db.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw userNotFound();
}

/** Idempotent. Also removes the friendship, pending requests and inbox items between the two. */
export async function block(db: Db, me: string, targetId: string): Promise<void> {
  await requireOtherUser(db, me, targetId);
  await db.$transaction(async (tx) => {
    if (!(await tx.block.findUnique({ where: { blockerId_blockedId: { blockerId: me, blockedId: targetId } } }))) {
      await tx.block.create({ data: { blockerId: me, blockedId: targetId, createdAt: now() } });
    }
    await tx.friendship.deleteMany({ where: pairOf(me, targetId) });
    await tx.friendRequest.deleteMany({ where: { OR: [{ fromId: me, toId: targetId }, { fromId: targetId, toId: me }] } });
    await tx.inboxItem.deleteMany({ where: { OR: [{ userId: me, fromId: targetId }, { userId: targetId, fromId: me }] } });
  });
}

export async function unblock(db: Db, me: string, targetId: string): Promise<void> {
  await db.block.deleteMany({ where: { blockerId: me, blockedId: targetId } });
}

export async function listBlocked(db: Db, me: string) {
  const rows = await db.block.findMany({
    where: { blockerId: me },
    include: { blocked: { select: publicSelect } },
    orderBy: [{ createdAt: "desc" }, { blockedId: "asc" }],
  });
  return { users: rows.map((r) => ({ userId: r.blockedId, name: displayName(r.blocked), blockedAt: r.createdAt })) };
}

export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;

export const ReportBody = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

/** Allowed even when the pair is blocked (you often report someone you just blocked). */
export async function report(db: Db, me: string, targetId: string, body: z.output<typeof ReportBody>) {
  await requireOtherUser(db, me, targetId);
  const at = now();
  if ((await db.report.count({ where: { reporterId: me, createdAt: { gte: at - DAY_MS } } })) >= REPORTS_PER_DAY) throw tooManyReports();
  const row = await db.report.create({
    data: { id: randomUUID(), reporterId: me, targetId, reason: body.reason, details: body.details || null, status: "open", createdAt: at },
  });
  return { id: row.id, reason: row.reason, status: row.status, createdAt: row.createdAt };
}

// ---- push tokens ------------------------------------------------------------------------

export const PushTokenBody = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "ios"]),
  kind: z.enum(["fcm", "expo"]),
});
export const PushTokenDeleteBody = z.object({ token: z.string().trim().min(1).max(4096) });

/** Keeps a user's most recent tokens only. */
export const MAX_PUSH_TOKENS_PER_USER = 10;

/** Upsert keyed by token: a device that signs into another account moves to it. */
export async function upsertPushToken(db: Db, userId: string, body: z.output<typeof PushTokenBody>): Promise<void> {
  const at = now();
  await db.pushToken.upsert({
    where: { token: body.token },
    create: { token: body.token, userId, platform: body.platform, kind: body.kind, createdAt: at, updatedAt: at },
    update: { userId, platform: body.platform, kind: body.kind, updatedAt: at },
  });
  const stale = await db.pushToken.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { token: "asc" }],
    skip: MAX_PUSH_TOKENS_PER_USER,
    select: { token: true },
  });
  if (stale.length) await db.pushToken.deleteMany({ where: { token: { in: stale.map((s) => s.token) } } });
}

export async function deletePushToken(db: Db, userId: string, token: string): Promise<void> {
  await db.pushToken.deleteMany({ where: { token, userId } });
}
