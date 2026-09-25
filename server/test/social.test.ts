import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFcmSender, fcmRequestBody, isUnregistered, type PushMessage, type PushResult, type PushSender } from "../src/push/fcm.js";
import { formatInviteCode, generateInviteCode, INVITE_ALPHABET, normalizeInviteCode } from "../src/social/invite.js";
import { bearer, createTestApp, makeAdmin, profile, register, type Session, sync, type TestContext } from "./helpers.js";

const DAY = 86_400_000;

/** Records every push; tokens starting with "dead" are reported as unregistered. */
class FakePush implements PushSender {
  sent: PushMessage[] = [];
  async send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    return message.token.startsWith("dead") ? "unregistered" : "ok";
  }
  take(): PushMessage[] {
    const out = this.sent;
    this.sent = [];
    return out;
  }
}

let ctx: TestContext;
let push: FakePush;
beforeAll(async () => {
  push = new FakePush();
  ctx = await createTestApp({ push });
});
afterAll(() => ctx.close());

let seq = 0;
async function signup(name: string, inviteCode?: string) {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: { email: `social${++seq}@example.com`, password: "correct horse", name, ...(inviteCode !== undefined ? { inviteCode } : {}) },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  return { session: { userId: body.user.id, accessToken: body.accessToken, refreshToken: body.refreshToken } as Session, inviteReward: body.inviteReward as boolean };
}
const user = async (name: string) => (await signup(name)).session;

const get = (url: string, s: Session) => ctx.app.inject({ method: "GET", url, headers: bearer(s) });
const post = (url: string, s: Session, payload?: unknown) =>
  ctx.app.inject({ method: "POST", url, headers: bearer(s), ...(payload !== undefined ? { payload: payload as object } : {}) });
const put = (url: string, s: Session, payload: unknown) => ctx.app.inject({ method: "PUT", url, headers: bearer(s), payload: payload as object });
const del = (url: string, s: Session, payload?: unknown) =>
  ctx.app.inject({ method: "DELETE", url, headers: bearer(s), ...(payload !== undefined ? { payload: payload as object } : {}) });

const codeOf = async (s: Session): Promise<string> => (await get("/v1/social/me", s)).json().inviteCode;
const sendRequest = (from: Session, code: string) => post("/v1/social/requests", from, { code });
const expectError = (res: { statusCode: number; json(): { error: { code: string } } }, status: number, code: string) => {
  expect(res.statusCode).toBe(status);
  expect(res.json().error.code).toBe(code);
};
async function befriend(a: Session, b: Session) {
  const res = await sendRequest(a, await codeOf(b));
  expect(res.statusCode).toBe(201);
  const accepted = await post(`/v1/social/requests/${res.json().request.id}/accept`, b);
  expect(accepted.statusCode).toBe(200);
}
const friendsOf = async (s: Session) => (await get("/v1/social/friends", s)).json().friends as Array<Record<string, unknown> & { userId: string }>;
const inboxOf = async (s: Session) => (await get("/v1/social/inbox", s)).json().items as Array<Record<string, unknown> & { kind: string; id: string }>;
const pushToken = (s: Session, token: string) => post("/v1/push/token", s, { token, platform: "android", kind: "fcm" });

const card = (overrides: Record<string, unknown> = {}) => ({
  streak: 12,
  longestStreak: 40,
  level: 4,
  xp: 1300,
  todayDone: 2,
  todayTotal: 3,
  todayPct: 67,
  date: "2026-09-25",
  badges: ["first_week"],
  habits: [{ name: "Read", icon: "book", hue: 210, doneToday: true, streak: 12 }],
  updatedAt: 1_000,
  ...overrides,
});

describe("invite codes", () => {
  it("generates 8 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(generateInviteCode()).toMatch(new RegExp(`^[${INVITE_ALPHABET}]{8}$`));
    expect(INVITE_ALPHABET).not.toMatch(/[IL O01]/);
  });

  it("normalises input with or without dash, any case", () => {
    expect(normalizeInviteCode("k7pq-2mxr")).toBe("K7PQ2MXR");
    expect(normalizeInviteCode(" K7PQ2MXR ")).toBe("K7PQ2MXR");
    expect(normalizeInviteCode("K7PQ-2MX")).toBeNull();
    expect(normalizeInviteCode("K7PQ-2MX0")).toBeNull(); // 0 is not in the alphabet
    expect(formatInviteCode("K7PQ2MXR")).toBe("K7PQ-2MXR");
  });

  it("is generated lazily on /social/me and stays the same", async () => {
    const a = await user("Asha");
    expect((await ctx.app.db.user.findUniqueOrThrow({ where: { id: a.userId } })).inviteCode).toBeNull();
    const me = (await get("/v1/social/me", a)).json();
    expect(me).toEqual({
      inviteCode: expect.stringMatching(/^[A-Z2-9]{8}$/),
      inviteUrl: `https://hashhorizon.in/app/tend/invite/${me.inviteCode}`,
      rewardsEarned: 0,
      rewardsLeft: 10,
      settings: { shareHabitNames: false },
    });
    expect(await codeOf(a)).toBe(me.inviteCode);
  });

  it("finds users by a dashed, lower-case code", async () => {
    const a = await user("Dash");
    const b = await user("Lower");
    const code = await codeOf(b);
    const res = await sendRequest(a, formatInviteCode(code).toLowerCase());
    expect(res.statusCode).toBe(201);
    expect(res.json().request.to.userId).toBe(b.userId);
  });
});

describe("register with inviteCode", () => {
  it("creates the friendship, rewards both, and notifies the inviter", async () => {
    const inviter = await user("Inviter");
    await pushToken(inviter, "inviter-device");
    const code = await codeOf(inviter);
    push.take();
    const before = Date.now();
    const { session: invitee, inviteReward } = await signup("Newbie", formatInviteCode(code).toLowerCase());
    expect(inviteReward).toBe(true);

    expect((await friendsOf(inviter)).map((f) => f.userId)).toEqual([invitee.userId]);
    expect((await friendsOf(invitee)).map((f) => f.userId)).toEqual([inviter.userId]);

    for (const s of [inviter, invitee]) {
      const ents = await ctx.app.db.entitlement.findMany({ where: { userId: s.userId } });
      expect(ents).toHaveLength(1);
      expect(ents[0]).toMatchObject({ source: "trial", note: "invite reward", status: "active" });
      expect(ents[0]!.expiresAt! - ents[0]!.startsAt).toBe(7 * DAY);
      expect(ents[0]!.startsAt).toBeGreaterThanOrEqual(before);
      expect((await get("/v1/plus", s)).json()).toMatchObject({ active: true, source: "trial" });
    }

    const inbox = await inboxOf(inviter);
    expect(inbox[0]).toMatchObject({ kind: "invite_joined", from: { userId: invitee.userId, name: "Newbie", initial: "N" }, message: null, readAt: null });
    expect((await get("/v1/social/me", inviter)).json()).toMatchObject({ rewardsEarned: 1, rewardsLeft: 9 });

    await ctx.app.notifier.idle();
    expect(push.take()).toEqual([
      { token: "inviter-device", title: "Newbie joined with your code", body: "You both got 7 days of Plus.", data: { type: "invite_joined", fromName: "Newbie" } },
    ]);
  });

  it("stacks the reward after the current Plus", async () => {
    const inviter = await user("Stacker");
    const admin = await makeAdmin(ctx.app, await register(ctx.app));
    const grant = (await post(`/v1/admin/users/${inviter.userId}/grant`, admin, { days: 10 })).json();
    await signup("Joiner", await codeOf(inviter));
    const reward = await ctx.app.db.entitlement.findFirstOrThrow({ where: { userId: inviter.userId, source: "trial" } });
    expect(reward.startsAt).toBe(grant.expiresAt);
    expect(reward.expiresAt).toBe(grant.expiresAt + 7 * DAY);
  });

  it("ignores invalid codes", async () => {
    for (const inviteCode of ["NOPE-NOPE", "", "ZZZZZZZZ"]) {
      const { session, inviteReward } = await signup("Nobody", inviteCode);
      expect(inviteReward).toBe(false);
      expect(await friendsOf(session)).toEqual([]);
      expect(await ctx.app.db.entitlement.count({ where: { userId: session.userId } })).toBe(0);
    }
    const res = await ctx.app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "numcode@example.com", password: "correct horse", name: "N", inviteCode: 42 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().inviteReward).toBe(false);
    expect((await signup("Plain")).inviteReward).toBe(false);
  });

  it("caps rewards at 10 per inviter per 365 days (friendship still created)", async () => {
    const inviter = await user("Popular");
    const code = await codeOf(inviter);
    const at = Date.now();
    const seedRedemption = async (createdAt: number) => {
      const id = randomUUID();
      await ctx.app.db.user.create({ data: { id, email: `${id}@seed.test`, name: "Seed", passwordHash: "x", createdAt } });
      await ctx.app.db.inviteRedemption.create({ data: { id: randomUUID(), inviterId: inviter.userId, inviteeId: id, code, rewarded: true, createdAt } });
    };
    await seedRedemption(at - 400 * DAY); // outside the window
    for (let i = 0; i < 9; i++) await seedRedemption(at - i * DAY);

    const tenth = await signup("Tenth", code);
    expect(tenth.inviteReward).toBe(true);
    expect((await get("/v1/social/me", inviter)).json()).toMatchObject({ rewardsEarned: 10, rewardsLeft: 0 });

    const eleventh = await signup("Eleventh", code);
    expect(eleventh.inviteReward).toBe(false);
    expect(await ctx.app.db.entitlement.count({ where: { userId: eleventh.session.userId } })).toBe(0);
    expect((await friendsOf(eleventh.session)).map((f) => f.userId)).toEqual([inviter.userId]);
    expect(await ctx.app.db.entitlement.count({ where: { userId: inviter.userId, note: "invite reward" } })).toBe(1);
  });
});

describe("friend requests", () => {
  it("send → list → accept creates a friendship and notifies both ways", async () => {
    const a = await user("Anil");
    const b = await user("Bela");
    await pushToken(a, "anil-phone");
    await pushToken(b, "bela-phone");
    push.take();

    const sent = await sendRequest(a, await codeOf(b));
    expect(sent.statusCode).toBe(201);
    const { request, autoAccepted } = sent.json();
    expect(autoAccepted).toBe(false);
    expect(request).toEqual({
      id: expect.any(String),
      from: { userId: a.userId, name: "Anil", initial: "A" },
      to: { userId: b.userId, name: "Bela", initial: "B" },
      createdAt: expect.any(Number),
    });
    expect(JSON.stringify(request)).not.toContain("@");

    expect((await get("/v1/social/requests", b)).json()).toEqual({ incoming: [request], outgoing: [] });
    expect((await get("/v1/social/requests", a)).json()).toEqual({ incoming: [], outgoing: [request] });
    expect((await inboxOf(b))[0]).toMatchObject({ kind: "friend_request", from: { userId: a.userId } });

    // Only the recipient can accept.
    expectError(await post(`/v1/social/requests/${request.id}/accept`, a), 404, "REQUEST_NOT_FOUND");
    const accepted = await post(`/v1/social/requests/${request.id}/accept`, b);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().friend).toMatchObject({ userId: a.userId, name: "Anil", since: expect.any(Number), card: null, nudgedToday: false });
    expect((await get("/v1/social/requests", b)).json()).toEqual({ incoming: [], outgoing: [] });
    expect((await inboxOf(a))[0]).toMatchObject({ kind: "friend_accepted", from: { userId: b.userId } });

    await ctx.app.notifier.idle();
    expect(push.take()).toEqual([
      { token: "bela-phone", title: "Anil wants to be friends", body: "Open the app to accept.", data: { type: "friend_request", fromName: "Anil" } },
      { token: "anil-phone", title: "Bela accepted your invite", body: "You can now see each other's streaks.", data: { type: "friend_accepted", fromName: "Bela" } },
    ]);
    expectError(await sendRequest(a, await codeOf(b)), 409, "ALREADY_FRIENDS");
    expectError(await sendRequest(b, await codeOf(a)), 409, "ALREADY_FRIENDS");
  });

  it("decline and cancel", async () => {
    const a = await user("Chirag");
    const b = await user("Deepa");
    const r1 = (await sendRequest(a, await codeOf(b))).json().request;
    expectError(await post(`/v1/social/requests/${r1.id}/decline`, a), 404, "REQUEST_NOT_FOUND");
    expect((await post(`/v1/social/requests/${r1.id}/decline`, b)).statusCode).toBe(204);
    expect(await friendsOf(a)).toEqual([]);

    const r2 = (await sendRequest(a, await codeOf(b))).json().request;
    expectError(await del(`/v1/social/requests/${r2.id}`, b), 404, "REQUEST_NOT_FOUND");
    expect((await del(`/v1/social/requests/${r2.id}`, a)).statusCode).toBe(204);
    expect((await get("/v1/social/requests", b)).json().incoming).toEqual([]);
    expect((await inboxOf(b)).filter((i) => i.kind === "friend_request" && i.readAt === null)).toHaveLength(0);
    expectError(await post(`/v1/social/requests/${r2.id}/accept`, b), 404, "REQUEST_NOT_FOUND");
  });

  it("auto-accepts when the target already sent you a request", async () => {
    const a = await user("Esha");
    const b = await user("Farid");
    const first = (await sendRequest(a, await codeOf(b))).json().request;
    const res = await sendRequest(b, await codeOf(a));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ autoAccepted: true, request: { id: first.id }, friend: { userId: a.userId, name: "Esha" } });
    expect((await friendsOf(a)).map((f) => f.userId)).toEqual([b.userId]);
    expect(await ctx.app.db.friendRequest.count({ where: { OR: [{ fromId: a.userId }, { fromId: b.userId }] } })).toBe(0);
    expect((await inboxOf(a))[0]).toMatchObject({ kind: "friend_accepted", from: { userId: b.userId } });
  });

  it("rejects bad codes, self, duplicates and too many pending", async () => {
    const a = await user("Gita");
    const b = await user("Hari");
    expectError(await sendRequest(a, "ZZZZ-ZZZZ"), 404, "CODE_NOT_FOUND");
    expectError(await sendRequest(a, "not a code"), 404, "CODE_NOT_FOUND");
    expectError(await post("/v1/social/requests", a, {}), 400, "VALIDATION_ERROR");
    expectError(await sendRequest(a, await codeOf(a)), 400, "CANNOT_ADD_SELF");
    await sendRequest(a, await codeOf(b));
    expectError(await sendRequest(a, await codeOf(b)), 409, "REQUEST_PENDING");

    const at = Date.now();
    for (let i = 0; i < 29; i++) {
      const id = randomUUID();
      await ctx.app.db.user.create({ data: { id, email: `${id}@pending.test`, name: "P", passwordHash: "x", createdAt: at } });
      await ctx.app.db.friendRequest.create({ data: { id: randomUUID(), fromId: a.userId, toId: id, createdAt: at } });
    }
    const c = await user("Isha");
    expectError(await sendRequest(a, await codeOf(c)), 429, "TOO_MANY_REQUESTS");
  });
});

describe("friends and cards", () => {
  let owner: Session;
  let viewer: Session;
  beforeAll(async () => {
    owner = await user("zed");
    viewer = await user("Viewer");
    await befriend(viewer, owner);
    const other = await user("amy");
    await befriend(viewer, other);
  });

  it("lists friends sorted by name, with cards and nudgedToday", async () => {
    expect((await put("/v1/social/card", owner, card())).statusCode).toBe(200);
    const friends = await friendsOf(viewer);
    expect(friends.map((f) => f.name)).toEqual(["amy", "zed"]);
    const zed = friends[1]!;
    expect(zed).toEqual({ userId: owner.userId, name: "zed", initial: "Z", since: expect.any(Number), card: { ...card(), habits: [] }, nudgedToday: false });
    expect(friends[0]!.card).toBeNull();

    expect((await post(`/v1/social/friends/${owner.userId}/nudge`, viewer, { kind: "nudge" })).statusCode).toBe(201);
    expect((await friendsOf(viewer)).find((f) => f.userId === owner.userId)!.nudgedToday).toBe(true);
    expect((await friendsOf(owner)).find((f) => f.userId === viewer.userId)!.nudgedToday).toBe(false);
  });

  it("strips habits unless the owner shares habit names", async () => {
    await put("/v1/social/card", owner, card({ updatedAt: 2_000 }));
    expect((await friendsOf(viewer)).find((f) => f.userId === owner.userId)!.card).toMatchObject({ habits: [], streak: 12 });
    const settings = await put("/v1/social/settings", owner, { shareHabitNames: true });
    expect(settings.json()).toEqual({ shareHabitNames: true });
    expect((await get("/v1/social/me", owner)).json().settings).toEqual({ shareHabitNames: true });
    expect((await friendsOf(viewer)).find((f) => f.userId === owner.userId)!.card).toMatchObject({ habits: card().habits });
    await put("/v1/social/settings", owner, { shareHabitNames: false });
    expect((await friendsOf(viewer)).find((f) => f.userId === owner.userId)!.card).toMatchObject({ habits: [] });
    expectError(await put("/v1/social/settings", owner, { shareHabitNames: "yes" }), 400, "VALIDATION_ERROR");
  });

  it("validates card sizes and keeps the newest card", async () => {
    const habitRow = { name: "x", icon: "book", hue: 1, doneToday: false, streak: 0 };
    const bad = [
      card({ habits: Array.from({ length: 31 }, () => habitRow) }),
      card({ habits: [{ ...habitRow, name: "n".repeat(61) }] }),
      card({ badges: Array.from({ length: 21 }, (_, i) => `b${i}`) }),
      card({ todayPct: 101 }),
      card({ date: "25/09/2026" }),
      card({ streak: -1 }),
      { streak: 1 },
    ];
    for (const body of bad) expectError(await put("/v1/social/card", owner, body), 400, "VALIDATION_ERROR");
    expect((await put("/v1/social/card", owner, card({ habits: Array.from({ length: 30 }, () => habitRow), updatedAt: 3_000 }))).statusCode).toBe(200);

    const stale = await put("/v1/social/card", owner, card({ streak: 1, updatedAt: 2_500 }));
    expect(stale.json()).toMatchObject({ updatedAt: 3_000, streak: 12 });
    const stored = await ctx.app.db.friendCard.findUniqueOrThrow({ where: { userId: owner.userId } });
    expect(stored.updatedAt).toBe(3_000);
  });

  it("only shows cards to accepted friends and prefers the synced profile name", async () => {
    const stranger = await user("Stranger");
    expect(await friendsOf(stranger)).toEqual([]);
    await sync(ctx.app, owner, 0, { profile: profile({ name: "Zed Prime" }) });
    expect((await friendsOf(viewer)).find((f) => f.userId === owner.userId)!.name).toBe("Zed Prime");
  });

  it("removes a friend both ways", async () => {
    const a = await user("Remover");
    const b = await user("Removed");
    await befriend(a, b);
    expect((await del(`/v1/social/friends/${b.userId}`, a)).statusCode).toBe(204);
    expect(await friendsOf(a)).toEqual([]);
    expect(await friendsOf(b)).toEqual([]);
    expect((await del(`/v1/social/friends/${b.userId}`, a)).statusCode).toBe(204);
    expectError(await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "nudge" }), 404, "NOT_FRIENDS");
  });
});

describe("nudges, cheers and inbox", () => {
  let a: Session;
  let b: Session;
  beforeAll(async () => {
    a = await user("Kiran");
    b = await user("Lata");
    await befriend(a, b);
    await pushToken(b, "lata-phone");
    await ctx.app.notifier.idle();
    push.take();
  });

  it("allows one nudge per friend per day", async () => {
    const res = await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "nudge", message: "nudge.streak" });
    expect(res.statusCode).toBe(201);
    expect(res.json().item).toMatchObject({ kind: "nudge", message: "nudge.streak", from: { userId: a.userId, name: "Kiran" }, readAt: null });
    expectError(await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "nudge" }), 429, "NUDGE_LIMIT");
    // The limit is per sender → receiver.
    expect((await post(`/v1/social/friends/${a.userId}/nudge`, b, { kind: "nudge" })).statusCode).toBe(201);

    await ctx.app.notifier.idle();
    expect(push.take()).toEqual([
      { token: "lata-phone", title: "Kiran is cheering you on", body: "A small check-in keeps your streak growing.", data: { type: "nudge", fromName: "Kiran" } },
    ]);
  });

  it("allows five cheers per day with preset text", async () => {
    const keys = ["cheer.proud", "cheer.keepgoing", "cheer.fire", undefined, "cheer.proud"];
    for (const message of keys) {
      const res = await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "cheer", ...(message ? { message } : {}) });
      expect(res.statusCode).toBe(201);
    }
    expectError(await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "cheer" }), 429, "NUDGE_LIMIT");
    await ctx.app.notifier.idle();
    const sent = push.take();
    expect(sent.map((m) => m.body)).toEqual(["Proud of you!", "Keep going — you've got this.", "Your streak is on fire!", "Keep going — you've got this.", "Proud of you!"]);
    expect(sent[0]).toMatchObject({ title: "Kiran sent you a cheer 🎉", data: { type: "cheer", fromName: "Kiran" } });
  });

  it("validates nudge bodies and targets", async () => {
    expectError(await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "nudge", message: "cheer.fire" }), 400, "VALIDATION_ERROR");
    expectError(await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "poke" }), 400, "VALIDATION_ERROR");
    expectError(await post(`/v1/social/friends/${a.userId}/nudge`, a, { kind: "cheer" }), 400, "CANNOT_TARGET_SELF");
    const stranger = await user("Stranger2");
    expectError(await post(`/v1/social/friends/${stranger.userId}/nudge`, a, { kind: "cheer" }), 404, "NOT_FRIENDS");
  });

  it("lists the inbox newest first, filters by since, and marks read", async () => {
    const items = await inboxOf(b);
    expect(items.length).toBeGreaterThanOrEqual(7);
    const times = items.map((i) => i.createdAt as number);
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    expect(items[0]).toEqual({ id: expect.any(String), kind: "cheer", from: { userId: a.userId, name: "Kiran", initial: "K" }, message: "cheer.proud", createdAt: expect.any(Number), readAt: null });

    const cutoff = items[2]!.createdAt as number;
    const newer = (await get(`/v1/social/inbox?since=${cutoff}`, b)).json().items;
    expect(newer.every((i: { createdAt: number }) => i.createdAt > cutoff)).toBe(true);
    expectError(await get("/v1/social/inbox?since=abc", b), 400, "VALIDATION_ERROR");

    expect((await post("/v1/social/inbox/read", b, { ids: [items[0]!.id] })).statusCode).toBe(204);
    const afterOne = await inboxOf(b);
    expect(afterOne.find((i) => i.id === items[0]!.id)!.readAt).toEqual(expect.any(Number));
    expect(afterOne.filter((i) => i.readAt === null).length).toBe(items.length - 1);
    // Someone else's ids are ignored.
    await post("/v1/social/inbox/read", a, { ids: [items[1]!.id] });
    expect((await inboxOf(b)).find((i) => i.id === items[1]!.id)!.readAt).toBeNull();

    expect((await post("/v1/social/inbox/read", b)).statusCode).toBe(204);
    expect((await inboxOf(b)).every((i) => i.readAt !== null)).toBe(true);
  });

  it("caps the inbox at 50 items", async () => {
    const at = Date.now();
    await ctx.app.db.inboxItem.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({ id: randomUUID(), userId: a.userId, fromId: b.userId, kind: "cheer", message: null, createdAt: at - i * 1000, readAt: null })),
    });
    expect(await inboxOf(a)).toHaveLength(50);
  });
});

describe("blocking", () => {
  it("hides both sides and answers BLOCKED", async () => {
    const a = await user("Mohan");
    const b = await user("Nisha");
    await befriend(a, b);
    await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "cheer" });
    const c = await user("Omar");
    await sendRequest(b, await codeOf(c)); // unrelated request survives

    expect((await post(`/v1/social/block/${b.userId}`, a)).statusCode).toBe(204);
    expect((await post(`/v1/social/block/${b.userId}`, a)).statusCode).toBe(204); // idempotent
    expect(await friendsOf(a)).toEqual([]);
    expect(await friendsOf(b)).toEqual([]);
    expect((await inboxOf(b)).filter((i) => (i.from as { userId: string }).userId === a.userId)).toEqual([]);
    expect((await inboxOf(a)).filter((i) => (i.from as { userId: string }).userId === b.userId)).toEqual([]);
    expect((await get("/v1/social/requests", b)).json().outgoing).toHaveLength(1);

    const blockedA = await sendRequest(a, await codeOf(b));
    const blockedB = await sendRequest(b, await codeOf(a));
    for (const res of [blockedA, blockedB]) expectError(res, 403, "BLOCKED");
    expect(blockedA.json().error.message).toBe(blockedB.json().error.message);
    expectError(await post(`/v1/social/friends/${a.userId}/nudge`, b, { kind: "nudge" }), 403, "BLOCKED");

    expect((await get("/v1/social/blocked", a)).json()).toEqual({ users: [{ userId: b.userId, name: "Nisha", blockedAt: expect.any(Number) }] });
    expect((await get("/v1/social/blocked", b)).json()).toEqual({ users: [] });

    expect((await del(`/v1/social/block/${b.userId}`, a)).statusCode).toBe(204);
    expect((await sendRequest(b, await codeOf(a))).statusCode).toBe(201);
  });

  it("removes pending requests and validates targets", async () => {
    const a = await user("Pooja");
    const b = await user("Qasim");
    await sendRequest(b, await codeOf(a));
    await post(`/v1/social/block/${b.userId}`, a);
    expect((await get("/v1/social/requests", a)).json()).toEqual({ incoming: [], outgoing: [] });
    expectError(await post(`/v1/social/block/${a.userId}`, a), 400, "CANNOT_TARGET_SELF");
    expectError(await post(`/v1/social/block/${randomUUID()}`, a), 404, "USER_NOT_FOUND");
  });
});

describe("reports", () => {
  it("files a report that admins can list and resolve (audited)", async () => {
    const reporter = await user("Reporter");
    const target = await user("Target");
    await post(`/v1/social/block/${target.userId}`, reporter); // reporting still works after blocking
    const res = await post(`/v1/social/report/${target.userId}`, reporter, { reason: "harassment", details: "  rude messages  " });
    expect(res.statusCode).toBe(201);
    const filed = res.json();
    expect(filed).toEqual({ id: expect.any(String), reason: "harassment", status: "open", createdAt: expect.any(Number) });

    expectError(await post(`/v1/social/report/${target.userId}`, reporter, { reason: "rude" }), 400, "VALIDATION_ERROR");
    expectError(await post(`/v1/social/report/${target.userId}`, reporter, { reason: "other", details: "x".repeat(501) }), 400, "VALIDATION_ERROR");
    expectError(await post(`/v1/social/report/${reporter.userId}`, reporter, { reason: "spam" }), 400, "CANNOT_TARGET_SELF");
    expectError(await post(`/v1/social/report/${randomUUID()}`, reporter, { reason: "spam" }), 404, "USER_NOT_FOUND");

    const admin = await makeAdmin(ctx.app, await register(ctx.app, "social-admin@example.com"));
    expectError(await get("/v1/admin/reports", reporter), 403, "FORBIDDEN");
    const open = (await get("/v1/admin/reports?status=open", admin)).json();
    const item = open.items.find((i: { id: string }) => i.id === filed.id);
    expect(item).toMatchObject({
      reporter: { userId: reporter.userId, email: expect.stringContaining("@example.com"), name: "Reporter" },
      target: { userId: target.userId, email: expect.stringContaining("@example.com"), name: "Target" },
      reason: "harassment",
      details: "rude messages",
      status: "open",
      createdAt: filed.createdAt,
      resolvedAt: null,
    });
    expect(open).toMatchObject({ page: 1, pageSize: 25, total: expect.any(Number) });

    const resolved = await post(`/v1/admin/reports/${filed.id}/resolve`, admin, { note: "warned" });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ id: filed.id, status: "resolved", resolvedAt: expect.any(Number) });
    expect((await get("/v1/admin/reports?status=open", admin)).json().items.some((i: { id: string }) => i.id === filed.id)).toBe(false);
    expect((await get("/v1/admin/reports?status=resolved", admin)).json().items.map((i: { id: string }) => i.id)).toContain(filed.id);
    expect((await get("/v1/admin/reports", admin)).json().items.map((i: { id: string }) => i.id)).toContain(filed.id);
    expectError(await get("/v1/admin/reports?status=weird", admin), 400, "VALIDATION_ERROR");
    expectError(await post(`/v1/admin/reports/${randomUUID()}/resolve`, admin), 404, "NOT_FOUND");

    const audit = await ctx.app.db.auditLog.findFirstOrThrow({ where: { action: "resolve_report" } });
    expect(audit).toMatchObject({ adminId: admin.userId, targetUserId: target.userId });
    expect(JSON.parse(audit.details)).toMatchObject({ reportId: filed.id, note: "warned", changed: true });
  });
});

describe("push tokens", () => {
  it("upserts, moves between accounts and deletes", async () => {
    const a = await user("Tok A");
    const b = await user("Tok B");
    expect((await pushToken(a, "device-1")).statusCode).toBe(204);
    expect((await pushToken(a, "device-1")).statusCode).toBe(204);
    expect((await pushToken(a, "device-2")).statusCode).toBe(204);
    expect(await ctx.app.db.pushToken.count({ where: { userId: a.userId } })).toBe(2);
    await pushToken(b, "device-1"); // same phone, other account
    expect(await ctx.app.db.pushToken.findUniqueOrThrow({ where: { token: "device-1" } })).toMatchObject({ userId: b.userId, platform: "android", kind: "fcm" });

    expectError(await post("/v1/push/token", a, { token: "x", platform: "web", kind: "fcm" }), 400, "VALIDATION_ERROR");
    expect((await del("/v1/push/token", a, { token: "device-1" })).statusCode).toBe(204); // not a's anymore: no-op
    expect(await ctx.app.db.pushToken.count({ where: { token: "device-1" } })).toBe(1);
    expect((await del("/v1/push/token", b, { token: "device-1" })).statusCode).toBe(204);
    expect(await ctx.app.db.pushToken.count({ where: { token: "device-1" } })).toBe(0);
    expectError(await del("/v1/push/token", b, {}), 400, "VALIDATION_ERROR");
  });

  it("deletes tokens FCM reports as unregistered and skips expo tokens", async () => {
    const a = await user("Pusher");
    const b = await user("Receiver");
    await befriend(a, b);
    await pushToken(b, "live-token");
    await pushToken(b, "dead-token");
    await post("/v1/push/token", b, { token: "ExponentPushToken[abc]", platform: "ios", kind: "expo" });
    await ctx.app.notifier.idle();
    push.take();

    await post(`/v1/social/friends/${b.userId}/nudge`, a, { kind: "nudge" });
    await ctx.app.notifier.idle();
    expect(push.take().map((m) => m.token).sort()).toEqual(["dead-token", "live-token"]);
    expect((await ctx.app.db.pushToken.findMany({ where: { userId: b.userId } })).map((t) => t.token).sort()).toEqual(["ExponentPushToken[abc]", "live-token"]);
  });
});

describe("FCM sender", () => {
  const serviceAccount = JSON.stringify({ project_id: "tend-test", client_email: "push@tend-test.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n" });
  const message: PushMessage = { token: "tok", title: "T", body: "B", data: { type: "nudge", fromName: "Kiran" } };

  it("posts the HTTP v1 message with a bearer token", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const sender = createFcmSender(serviceAccount, { fetchImpl, getAccessToken: async () => "access-123" });
    expect(await sender.send(message)).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://fcm.googleapis.com/v1/projects/tend-test/messages:send");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer access-123");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      message: {
        token: "tok",
        notification: { title: "T", body: "B" },
        data: { type: "nudge", fromName: "Kiran" },
        android: { priority: "high", notification: { channel_id: "social" } },
      },
    });
    expect(fcmRequestBody(message).message.android.notification.channel_id).toBe("social");
  });

  it("maps 404 / UNREGISTERED to unregistered and other failures to error", async () => {
    const respond = (status: number, body: unknown) =>
      createFcmSender(serviceAccount, {
        fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
        getAccessToken: async () => "t",
      });
    expect(await respond(404, { error: { status: "NOT_FOUND" } }).send(message)).toBe("unregistered");
    expect(await respond(400, { error: { status: "INVALID_ARGUMENT", details: [{ errorCode: "UNREGISTERED" }] } }).send(message)).toBe("unregistered");
    expect(await respond(500, { error: { status: "INTERNAL" } }).send(message)).toBe("error");
    expect(await respond(400, { error: { status: "INVALID_ARGUMENT" } }).send(message)).toBe("error");
    expect(isUnregistered(200, "not json")).toBe(false);
    const noToken = createFcmSender(serviceAccount, { fetchImpl: fetch, getAccessToken: async () => null });
    expect(await noToken.send(message)).toBe("error");
    expect(() => createFcmSender("{}")).toThrow(/FIREBASE_SERVICE_ACCOUNT_JSON/);
  });
});

describe("account deletion and admin views", () => {
  it("deleting a user cascades all social rows", async () => {
    const leaving = await user("Leaving");
    const friend = await user("Stays");
    await befriend(leaving, friend);
    await put("/v1/social/card", leaving, card());
    await post(`/v1/social/friends/${friend.userId}/nudge`, leaving, { kind: "nudge" });
    await pushToken(leaving, "leaving-phone");
    const third = await user("Third");
    await sendRequest(leaving, await codeOf(third));
    await post(`/v1/social/block/${third.userId}`, friend);
    await post(`/v1/social/report/${friend.userId}`, leaving, { reason: "spam" });
    await post(`/v1/social/block/${friend.userId}`, leaving);
    await signup("Invitee", await codeOf(leaving));

    expect((await del("/v1/me", leaving)).statusCode).toBe(204);
    const db = ctx.app.db;
    const id = leaving.userId;
    const counts = await Promise.all([
      db.friendship.count({ where: { OR: [{ userAId: id }, { userBId: id }] } }),
      db.friendRequest.count({ where: { OR: [{ fromId: id }, { toId: id }] } }),
      db.friendCard.count({ where: { userId: id } }),
      db.inboxItem.count({ where: { OR: [{ userId: id }, { fromId: id }] } }),
      db.block.count({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }),
      db.report.count({ where: { OR: [{ reporterId: id }, { targetId: id }] } }),
      db.pushToken.count({ where: { userId: id } }),
      db.inviteRedemption.count({ where: { OR: [{ inviterId: id }, { inviteeId: id }] } }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await friendsOf(friend)).toEqual([]);
    expect(await db.block.count({ where: { blockerId: friend.userId } })).toBe(1);
  });

  it("admin stats and user detail include social", async () => {
    const admin = await makeAdmin(ctx.app, await register(ctx.app, "stats-admin@example.com"));
    const inviter = await user("Stat Inviter");
    const { session: joined } = await signup("Stat Joined", await codeOf(inviter));
    const third = await user("Stat Third");
    await befriend(third, inviter);
    await post(`/v1/social/block/${third.userId}`, joined);

    const stats = (await get("/v1/admin/stats", admin)).json();
    expect(stats.social).toEqual({ friendships: expect.any(Number), invitesJoined30d: expect.any(Number), nudges7d: expect.any(Number), openReports: expect.any(Number) });
    expect(stats.social.friendships).toBe(await ctx.app.db.friendship.count());
    expect(stats.social.invitesJoined30d).toBeGreaterThanOrEqual(1);
    expect(stats.social.nudges7d).toBe(await ctx.app.db.inboxItem.count({ where: { kind: { in: ["nudge", "cheer"] } } }));
    expect(stats.social.openReports).toBe(await ctx.app.db.report.count({ where: { status: "open" } }));

    const inviterDetail = (await get(`/v1/admin/users/${inviter.userId}`, admin)).json();
    expect(inviterDetail.social).toEqual({ friends: 2, invitedBy: null, invitesJoined: 1, blockedCount: 0 });
    const joinedDetail = (await get(`/v1/admin/users/${joined.userId}`, admin)).json();
    expect(joinedDetail.social).toEqual({ friends: 1, invitedBy: { userId: inviter.userId, email: expect.stringContaining("@example.com") }, invitesJoined: 0, blockedCount: 1 });
  });
});

describe("social rate limit", () => {
  let limited: TestContext;
  beforeAll(async () => {
    limited = await createTestApp({ socialRateLimit: { max: 2, timeWindow: "1 minute" } });
  });
  afterAll(() => limited.close());

  it("limits social writes per account", async () => {
    const a = await register(limited.app);
    const b = await register(limited.app);
    const req = (s: Session) => limited.app.inject({ method: "POST", url: "/v1/social/requests", headers: bearer(s), payload: { code: "ZZZZZZZZ" } });
    expect((await req(a)).statusCode).toBe(404);
    expect((await req(a)).statusCode).toBe(404);
    expectError(await req(a), 429, "RATE_LIMITED");
    expect((await req(b)).statusCode).toBe(404); // other account, same IP
  });
});

describe("auth", () => {
  it("requires a token on social and push routes", async () => {
    for (const [method, url] of [["GET", "/v1/social/me"], ["GET", "/v1/social/friends"], ["POST", "/v1/push/token"], ["PUT", "/v1/social/card"]] as const) {
      expect((await ctx.app.inject({ method, url })).statusCode).toBe(401);
    }
  });
});
