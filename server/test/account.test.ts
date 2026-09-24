import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  badge,
  bearer,
  createTestApp,
  focusSession,
  habit,
  habitLog,
  moodLog,
  profile,
  register,
  sync,
  task,
  T0,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

describe("GET /v1/me", () => {
  it("returns the user and a null profile before the first profile sync", async () => {
    const session = await register(ctx.app, "me@example.com");
    const res = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(session) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { id: session.userId, email: "me@example.com", name: "Test", createdAt: expect.any(Number), role: "user" },
      profile: null,
      plus: { active: false, source: null, expiresAt: null, autoRenew: false, productId: null, basePlanId: null },
    });
  });
});

describe("export", () => {
  it("exports JSON without tombstones", async () => {
    const session = await register(ctx.app);
    await sync(ctx.app, session, 0, {
      habits: [habit("live"), habit("gone", { deleted: true })],
      habitLogs: [habitLog("live", "2026-09-23")],
      tasks: [task("t1")],
      focusSessions: [focusSession("f1")],
      moodLogs: [moodLog("2026-09-23")],
      badges: [badge("b1")],
      profile: profile(),
    });
    const res = await ctx.app.inject({ method: "GET", url: "/v1/export?format=json", headers: bearer(session) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="tend-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = res.json();
    expect(body.user.id).toBe(session.userId);
    expect(body.profile).toEqual(profile());
    expect(body.habits.map((h: { id: string }) => h.id)).toEqual(["live"]);
    for (const key of ["habitLogs", "tasks", "focusSessions", "moodLogs", "badges"]) expect(body[key]).toHaveLength(1);
  });

  it("exports an escaped CSV with a type column", async () => {
    const session = await register(ctx.app);
    await sync(ctx.app, session, 0, {
      habits: [habit("h1", { name: 'Read, "slowly"\nat night', notes: "=HYPERLINK(\"x\")" }), habit("h2", { deleted: true })],
      habitLogs: [habitLog("h1", "2026-09-23", { count: 3 })],
      tasks: [task("t1", { title: "Plain" })],
      focusSessions: [focusSession("f1")],
      moodLogs: [moodLog("2026-09-23", { tags: ["a", "b"], note: "ok" })],
    });
    const res = await ctx.app.inject({ method: "GET", url: "/v1/export?format=csv", headers: bearer(session) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(/filename="tend-export-.*\.csv"/);

    const csv = res.body;
    const [header] = csv.split("\r\n");
    expect(header!.startsWith("type,id,date,name,")).toBe(true);
    expect(csv).toContain('habit,h1,,"Read, ""slowly""\nat night",mind,');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain("h2");
    expect(csv).toContain("log,h1:2026-09-23,2026-09-23,,");
    expect(csv).toMatch(/\r\ntask,t1,2026-09-23,Plain,/);
    expect(csv).toMatch(/\r\nfocus,f1,/);
    expect(csv).toMatch(/\r\nmood,2026-09-23,2026-09-23,.*,good,a;b,ok,/);
    expect(csv.endsWith("\r\n")).toBe(true);
    // 1 header + 5 records, one of which spans two physical lines.
    expect(csv.trimEnd().split("\r\n")).toHaveLength(6);
  });

  it("rejects an unknown format", async () => {
    const session = await register(ctx.app);
    const res = await ctx.app.inject({ method: "GET", url: "/v1/export?format=xml", headers: bearer(session) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /v1/me", () => {
  it("deletes the account and cascades to all data", async () => {
    const session = await register(ctx.app, "leaving@example.com");
    const other = await register(ctx.app);
    const everything = {
      habits: [habit("h")],
      habitLogs: [habitLog("h", "2026-09-23")],
      tasks: [task("t")],
      focusSessions: [focusSession("f")],
      moodLogs: [moodLog("2026-09-23")],
      badges: [badge("b")],
      profile: profile({ updatedAt: T0 }),
    };
    await sync(ctx.app, session, 0, everything);
    await sync(ctx.app, other, 0, everything);

    const res = await ctx.app.inject({ method: "DELETE", url: "/v1/me", headers: bearer(session) });
    expect(res.statusCode).toBe(204);

    const db = ctx.app.db;
    const where = { userId: session.userId };
    const counts = await Promise.all([
      db.user.count({ where: { id: session.userId } }),
      db.refreshToken.count({ where }),
      db.profile.count({ where }),
      db.habit.count({ where }),
      db.habitLog.count({ where }),
      db.task.count({ where }),
      db.focusSession.count({ where }),
      db.moodLog.count({ where }),
      db.badgeState.count({ where }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Other users are untouched.
    expect((await sync(ctx.app, other, 0)).json().changes.habits).toHaveLength(1);

    // The still-unexpired access token no longer works, and the refresh token is gone.
    const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(session) });
    expect(me.statusCode).toBe(401);
    const refresh = await ctx.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: session.refreshToken } });
    expect(refresh.statusCode).toBe(401);

    // The email is free again.
    const again = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "leaving@example.com", password: "password123", name: "Back" },
    });
    expect(again.statusCode).toBe(201);
  });
});
