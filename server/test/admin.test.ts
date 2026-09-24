import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, createTestApp, habit, makeAdmin, profile, register, type Session, sync, type TestContext } from "./helpers.js";

const DAY = 86_400_000;

let ctx: TestContext;
let admin: Session;
beforeAll(async () => {
  ctx = await createTestApp({ env: { BILLING_FAKE: true, PRICE_MONTHLY_INR: 100, PRICE_YEARLY_INR: 1200 } });
  admin = await makeAdmin(ctx.app, await register(ctx.app, "admin@example.com"));
});
afterAll(() => ctx.close());

const get = (url: string, session: Session = admin) => ctx.app.inject({ method: "GET", url, headers: bearer(session) });
const post = (url: string, payload?: Record<string, unknown>, session: Session = admin) =>
  ctx.app.inject({ method: "POST", url, headers: bearer(session), ...(payload ? { payload } : {}) });
const del = (url: string, session: Session = admin) => ctx.app.inject({ method: "DELETE", url, headers: bearer(session) });
const plusOf = async (session: Session) => (await get("/v1/plus", session)).json();
const login = (email: string) =>
  ctx.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "correct horse" } });
const latestAudit = async () => (await ctx.app.db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1 }))[0];

describe("admin guard", () => {
  it("403 FORBIDDEN for non-admins, 401 without a token", async () => {
    const user = await register(ctx.app);
    for (const url of ["/v1/admin/stats", "/v1/admin/users", "/v1/admin/audit", "/v1/admin/subscriptions"]) {
      const res = await get(url, user);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    }
    expect((await post(`/v1/admin/users/${user.userId}/grant`, { months: 1 }, user)).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/admin/stats" })).statusCode).toBe(401);
  });

  it("exposes role on login and /me", async () => {
    const res = await login("admin@example.com");
    expect(res.json().user.role).toBe("admin");
    expect((await get("/v1/me")).json().user.role).toBe("admin");
  });
});

describe("grants and revocation", () => {
  it("grants months from now, then extends from the current expiry", async () => {
    const user = await register(ctx.app);
    const before = Date.now();
    const first = await post(`/v1/admin/users/${user.userId}/grant`, { months: 1, note: "beta tester" });
    expect(first.statusCode).toBe(201);
    const e1 = first.json();
    expect(e1).toMatchObject({ userId: user.userId, source: "admin", status: "active", note: "beta tester", grantedBy: admin.userId, autoRenew: false, productId: null });
    expect(e1.startsAt).toBeGreaterThanOrEqual(before);
    expect(e1.expiresAt - e1.startsAt).toBeGreaterThanOrEqual(28 * DAY);
    expect(e1.expiresAt - e1.startsAt).toBeLessThanOrEqual(31 * DAY);
    expect(e1).not.toHaveProperty("purchaseToken");

    const second = (await post(`/v1/admin/users/${user.userId}/grant`, { days: 10 })).json();
    expect(second.startsAt).toBe(e1.expiresAt);
    expect(second.expiresAt).toBe(e1.expiresAt + 10 * DAY);
    expect(await plusOf(user)).toMatchObject({ active: true, source: "admin", expiresAt: second.expiresAt });
  });

  it("extends a running Play subscription and grants lifetime", async () => {
    const user = await register(ctx.app);
    const sub = (await post("/v1/billing/google/verify", { productId: "plus", type: "subscription", purchaseToken: "fake:monthly:g1" }, user)).json();
    const extra = (await post(`/v1/admin/users/${user.userId}/grant`, { days: 5 })).json();
    expect(extra.startsAt).toBe(sub.expiresAt);

    const life = await post(`/v1/admin/users/${user.userId}/grant`, { lifetime: true });
    expect(life.statusCode).toBe(201);
    expect(life.json().expiresAt).toBeNull();
    expect(await plusOf(user)).toMatchObject({ active: true, source: "admin", expiresAt: null });
  });

  it("requires exactly one of months/days/lifetime within range", async () => {
    const user = await register(ctx.app);
    for (const body of [{}, { months: 1, days: 1 }, { months: 25 }, { days: 0 }, { days: 367 }, { lifetime: false }, { months: 1, lifetime: true }]) {
      const res = await post(`/v1/admin/users/${user.userId}/grant`, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    }
    expect((await post("/v1/admin/users/nope/grant", { months: 1 })).statusCode).toBe(404);
  });

  it("revokes an entitlement and audits it", async () => {
    const user = await register(ctx.app);
    const granted = (await post(`/v1/admin/users/${user.userId}/grant`, { months: 2 })).json();
    const res = await post(`/v1/admin/entitlements/${granted.id}/revoke`, { note: "abuse" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: granted.id, status: "revoked" });
    expect((await plusOf(user)).active).toBe(false);
    expect(await latestAudit()).toMatchObject({ adminId: admin.userId, action: "revoke", targetUserId: user.userId });
    expect((await post("/v1/admin/entitlements/missing/revoke")).statusCode).toBe(404);
  });
});

describe("disable / enable / delete", () => {
  it("disabled accounts get 403 ACCOUNT_DISABLED on login, refresh and authenticated routes", async () => {
    const user = await register(ctx.app, "disable-me@example.com");
    const res = await post(`/v1/admin/users/${user.userId}/disable`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: user.userId, disabledAt: expect.any(Number), role: "user", plus: { active: false } });
    expect(await ctx.app.db.refreshToken.count({ where: { userId: user.userId, revokedAt: null } })).toBe(0);

    const checks = [
      await login("disable-me@example.com"),
      await ctx.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: user.refreshToken } }),
      await sync(ctx.app, user, 0),
      await get("/v1/me", user),
    ];
    for (const r of checks) {
      expect(r.statusCode).toBe(403);
      expect(r.json().error.code).toBe("ACCOUNT_DISABLED");
    }
    // Wrong password still says INVALID_CREDENTIALS (disabled state isn't revealed without the password).
    const wrong = await ctx.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "disable-me@example.com", password: "nope-nope" } });
    expect(wrong.json().error.code).toBe("INVALID_CREDENTIALS");

    const enabled = await post(`/v1/admin/users/${user.userId}/enable`);
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json().disabledAt).toBeNull();
    expect((await login("disable-me@example.com")).statusCode).toBe(200);
    expect((await get("/v1/me", user)).statusCode).toBe(200);

    const actions = (await ctx.app.db.auditLog.findMany({ where: { targetUserId: user.userId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["disable", "enable"]);
  });

  it("admins cannot disable or delete themselves", async () => {
    for (const res of [await post(`/v1/admin/users/${admin.userId}/disable`), await del(`/v1/admin/users/${admin.userId}`)]) {
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("CANNOT_TARGET_SELF");
    }
  });

  it("deletes a user with all data and entitlements", async () => {
    const user = await register(ctx.app, "delete-me@example.com");
    await sync(ctx.app, user, 0, { habits: [habit("h1")] });
    await post(`/v1/admin/users/${user.userId}/grant`, { months: 1 });
    await post("/v1/billing/google/verify", { productId: "plus", type: "subscription", purchaseToken: "fake:yearly:del" }, user);
    expect(await ctx.app.db.entitlement.count({ where: { userId: user.userId } })).toBe(2);

    expect((await del(`/v1/admin/users/${user.userId}`)).statusCode).toBe(204);
    expect(await ctx.app.db.user.count({ where: { id: user.userId } })).toBe(0);
    expect(await ctx.app.db.entitlement.count({ where: { userId: user.userId } })).toBe(0);
    expect(await ctx.app.db.habit.count({ where: { userId: user.userId } })).toBe(0);
    expect((await del(`/v1/admin/users/${user.userId}`)).statusCode).toBe(404);

    const audit = (await get("/v1/admin/audit?pageSize=100")).json();
    const entry = audit.items.find((i: { action: string; targetUserId: string }) => i.action === "delete" && i.targetUserId === user.userId);
    expect(entry).toMatchObject({ adminEmail: "admin@example.com", targetEmail: "delete-me@example.com", details: { email: "delete-me@example.com" } });
  });
});

describe("lists", () => {
  let plusUser: Session;
  let freeUser: Session;
  let disabledUser: Session;
  beforeAll(async () => {
    plusUser = await register(ctx.app, "zz-plus@list.test");
    freeUser = await register(ctx.app, "zz-free@list.test");
    disabledUser = await register(ctx.app, "zz-disabled@list.test");
    await post(`/v1/admin/users/${plusUser.userId}/grant`, { months: 1 });
    await post(`/v1/admin/users/${disabledUser.userId}/disable`);
    await sync(ctx.app, plusUser, 0, { habits: [habit("a"), habit("b"), habit("c", { deleted: true })], profile: profile({ xp: 800 }) });
  });

  it("filters users by query, plan and status", async () => {
    const all = (await get("/v1/admin/users?query=LIST.TEST")).json();
    expect(all.total).toBe(3);
    const row = all.items.find((r: { id: string }) => r.id === plusUser.userId);
    expect(row).toEqual({
      id: plusUser.userId,
      email: "zz-plus@list.test",
      name: "Test",
      role: "user",
      createdAt: expect.any(Number),
      lastSyncAt: expect.any(Number),
      disabledAt: null,
      habitCount: 2,
      plus: expect.objectContaining({ active: true, source: "admin" }),
    });

    const plus = (await get("/v1/admin/users?query=list.test&plan=plus")).json();
    expect(plus.items.map((r: { id: string }) => r.id)).toEqual([plusUser.userId]);
    const free = (await get("/v1/admin/users?query=list.test&plan=free")).json();
    expect(free.items.map((r: { id: string }) => r.id).sort()).toEqual([freeUser.userId, disabledUser.userId].sort());
    const disabled = (await get("/v1/admin/users?query=list.test&status=disabled")).json();
    expect(disabled.items.map((r: { id: string }) => r.id)).toEqual([disabledUser.userId]);
    const active = (await get("/v1/admin/users?query=list.test&status=active&plan=free")).json();
    expect(active.items.map((r: { id: string }) => r.id)).toEqual([freeUser.userId]);
  });

  it("paginates users", async () => {
    const p1 = (await get("/v1/admin/users?query=list.test&pageSize=2&page=1")).json();
    const p2 = (await get("/v1/admin/users?query=list.test&pageSize=2&page=2")).json();
    expect(p1).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p2.items).toHaveLength(1);
    const ids = [...p1.items, ...p2.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(3);
    expect((await get("/v1/admin/users?pageSize=101")).statusCode).toBe(400);
    expect((await get("/v1/admin/users?plan=gold")).json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns user detail", async () => {
    const res = await get(`/v1/admin/users/${plusUser.userId}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe(plusUser.userId);
    expect(body.profile).toEqual({ xp: 800, level: 3, themeId: "sage" });
    expect(body.counts).toEqual({ habits: 2, habitLogs: 0, tasks: 0, focusSessions: 0, moodLogs: 0 });
    expect(body.entitlements).toHaveLength(1);
    expect((await get("/v1/admin/users/unknown")).statusCode).toBe(404);
  });

  it("lists subscriptions with filters", async () => {
    const buyer = await register(ctx.app, "buyer@list.test");
    await post("/v1/billing/google/verify", { productId: "plus", type: "subscription", purchaseToken: "fake:yearly:sub1" }, buyer);
    const play = (await get("/v1/admin/subscriptions?source=play&status=active")).json();
    expect(play.items.some((i: { userEmail: string; basePlanId: string }) => i.userEmail === "buyer@list.test" && i.basePlanId === "yearly")).toBe(true);
    expect(play.items.every((i: { source: string }) => i.source.startsWith("play_"))).toBe(true);
    const adminGrants = (await get("/v1/admin/subscriptions?source=admin")).json();
    expect(adminGrants.total).toBeGreaterThan(0);
    expect(adminGrants.items.every((i: { source: string }) => i.source === "admin")).toBe(true);
    const revoked = (await get("/v1/admin/subscriptions?status=revoked")).json();
    expect(revoked.items.every((i: { status: string }) => i.status === "revoked")).toBe(true);
  });

  it("lists audit entries newest first", async () => {
    const res = (await get("/v1/admin/audit?pageSize=5")).json();
    expect(res).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.total).toBeGreaterThanOrEqual(5);
    expect(res.items[0]).toEqual({
      id: expect.any(String),
      adminEmail: "admin@example.com",
      action: expect.any(String),
      targetUserId: expect.any(String),
      targetEmail: expect.any(String),
      details: expect.any(Object),
      createdAt: expect.any(Number),
    });
    const times = res.items.map((i: { createdAt: number }) => i.createdAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const actions = new Set((await ctx.app.db.auditLog.findMany()).map((a) => a.action));
    for (const a of ["grant", "revoke", "disable", "enable", "delete"]) expect(actions).toContain(a);
  });
});

describe("stats", () => {
  it("has the contract shape", async () => {
    const res = await get("/v1/admin/stats");
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.users).toEqual({ total: expect.any(Number), new7d: expect.any(Number), new30d: expect.any(Number), active7d: expect.any(Number), disabled: expect.any(Number) });
    expect(s.users.total).toBe(await ctx.app.db.user.count());
    expect(s.users.new7d).toBe(s.users.total);
    expect(s.users.disabled).toBe(1);
    expect(s.users.active7d).toBeGreaterThanOrEqual(1);
    expect(Object.keys(s.plus.bySource).sort()).toEqual(["admin", "play_lifetime", "play_subscription", "trial"]);
    expect(Object.keys(s.plus.byPlan).sort()).toEqual(["admin", "lifetime", "monthly", "trial", "yearly"]);
    expect(s.plus.active).toBe(Object.values(s.plus.byPlan as Record<string, number>).reduce((a, b) => a + b, 0));
    expect(s.revenue.monthlyEstimateInr).toEqual(expect.any(Number));
    for (const key of ["signupsByDay", "activeByDay"]) {
      expect(s[key]).toHaveLength(30);
      expect(s[key][29].date).toBe(new Date().toISOString().slice(0, 10));
      expect(s[key][0]).toEqual({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), count: expect.any(Number) });
    }
    expect(s.signupsByDay.reduce((n: number, d: { count: number }) => n + d.count, 0)).toBe(s.users.total);
    expect(s.activeByDay[29].count).toBeGreaterThanOrEqual(1);
  });

  it("estimates monthly revenue from live Play subscriptions", async () => {
    const before = (await get("/v1/admin/stats")).json().revenue.monthlyEstimateInr;
    const a = await register(ctx.app);
    const b = await register(ctx.app);
    await post("/v1/billing/google/verify", { productId: "plus", type: "subscription", purchaseToken: "fake:monthly:rev" }, a);
    await post("/v1/billing/google/verify", { productId: "plus", type: "subscription", purchaseToken: "fake:yearly:rev" }, b);
    const after = (await get("/v1/admin/stats")).json();
    expect(after.revenue.monthlyEstimateInr - before).toBe(100 + 1200 / 12);
  });
});

describe("admin panel on another origin", () => {
  let cors: TestContext;
  beforeAll(async () => {
    cors = await createTestApp({ env: { CORS_ORIGIN: "http://localhost:5173, https://admin.tend.app" } });
  });
  afterAll(() => cors.close());

  it("answers preflight for listed origins with Authorization and DELETE allowed", async () => {
    const res = await cors.app.inject({
      method: "OPTIONS",
      url: "/v1/admin/users/x",
      headers: { origin: "http://localhost:5173", "access-control-request-method": "DELETE", "access-control-request-headers": "authorization,content-type" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(String(res.headers["access-control-allow-methods"])).toContain("DELETE");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("authorization");
  });

  it("does not allow unlisted origins", async () => {
    const res = await cors.app.inject({ method: "GET", url: "/health", headers: { origin: "https://evil.example" } });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("accepts bodiless POSTs sent with a JSON content type", async () => {
    const a = await makeAdmin(cors.app, await register(cors.app));
    const u = await register(cors.app);
    const res = await cors.app.inject({
      method: "POST",
      url: `/v1/admin/users/${u.userId}/disable`,
      headers: { ...bearer(a), "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
  });
});
