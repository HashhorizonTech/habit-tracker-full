import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  badge,
  createTestApp,
  focusSession,
  habit,
  habitLog,
  moodLog,
  profile,
  register,
  sync,
  T0,
  task,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

describe("sync", () => {
  it("round-trips every collection and returns just-accepted records", async () => {
    const session = await register(ctx.app);
    const changes = {
      habits: [habit("h1")],
      habitLogs: [habitLog("h1", "2026-09-23")],
      tasks: [task("t1")],
      focusSessions: [focusSession("f1", { taskId: "t1" })],
      moodLogs: [moodLog("2026-09-23")],
      badges: [badge("first-streak")],
      profile: profile(),
    };
    const res = await sync(ctx.app, session, 0, changes);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cursor).toBe(7);
    expect(body.changes).toEqual(changes);

    // A second device pulls the same data.
    const pulled = (await sync(ctx.app, session, 0)).json();
    expect(pulled).toEqual(body);
  });

  it("drops unknown fields and defaults omitted nullable fields to null", async () => {
    const session = await register(ctx.app);
    const { notes: _notes, ...withoutNotes } = habit("h1");
    const res = await sync(ctx.app, session, 0, {
      habits: [{ ...withoutNotes, secret: "x", frequency: { type: "daily", junk: 1 } }],
      profile: { ...profile(), level: 7 },
    });
    expect(res.statusCode).toBe(200);
    const [stored] = res.json().changes.habits;
    expect(stored).not.toHaveProperty("secret");
    expect(stored.frequency).toEqual({ type: "daily" });
    expect(stored.notes).toBeNull();
    expect(res.json().changes.profile).not.toHaveProperty("level");
  });

  it("returns the cursor unchanged and no records when nothing is new", async () => {
    const session = await register(ctx.app);
    const first = (await sync(ctx.app, session, 0, { tasks: [task("t1")] })).json();
    const again = (await sync(ctx.app, session, first.cursor)).json();
    expect(again.cursor).toBe(first.cursor);
    expect(again.changes.tasks).toEqual([]);
    expect(again.changes.profile).toBeNull();
  });

  it("only returns records with rev greater than the cursor", async () => {
    const session = await register(ctx.app);
    const c1 = (await sync(ctx.app, session, 0, { habits: [habit("a"), habit("b")] })).json().cursor;
    expect(c1).toBe(2);
    const res = (await sync(ctx.app, session, c1, { habits: [habit("c")], tasks: [task("t")] })).json();
    expect(res.cursor).toBe(4);
    expect(res.changes.habits.map((h: { id: string }) => h.id)).toEqual(["c"]);
    expect(res.changes.tasks.map((t: { id: string }) => t.id)).toEqual(["t"]);

    const fromMiddle = (await sync(ctx.app, session, 3)).json();
    expect(fromMiddle.changes.habits).toEqual([]);
    expect(fromMiddle.changes.tasks.map((t: { id: string }) => t.id)).toEqual(["t"]);
  });

  it("treats a cursor ahead of the server as a full resync", async () => {
    const session = await register(ctx.app);
    await sync(ctx.app, session, 0, { habits: [habit("a")] });
    const res = (await sync(ctx.app, session, 999)).json();
    expect(res.cursor).toBe(1);
    expect(res.changes.habits).toHaveLength(1);
  });

  describe("last write wins", () => {
    it("ignores older and equal writes, accepts newer ones", async () => {
      const session = await register(ctx.app);
      const c1 = (await sync(ctx.app, session, 0, { habits: [habit("h", { name: "v1", updatedAt: T0 + 100 })] })).json().cursor;

      const older = (await sync(ctx.app, session, c1, { habits: [habit("h", { name: "stale", updatedAt: T0 + 50 })] })).json();
      expect(older.cursor).toBe(c1);
      expect(older.changes.habits).toEqual([]);

      const equal = (await sync(ctx.app, session, c1, { habits: [habit("h", { name: "tie", updatedAt: T0 + 100 })] })).json();
      expect(equal.cursor).toBe(c1);

      const newer = (await sync(ctx.app, session, c1, { habits: [habit("h", { name: "v2", updatedAt: T0 + 200 })] })).json();
      expect(newer.cursor).toBe(c1 + 1);
      expect(newer.changes.habits).toEqual([habit("h", { name: "v2", updatedAt: T0 + 200 })]);

      const all = (await sync(ctx.app, session, 0)).json();
      expect(all.changes.habits).toHaveLength(1);
      expect(all.changes.habits[0].name).toBe("v2");
    });

    it("applies LWW within a single push", async () => {
      const session = await register(ctx.app);
      const res = (
        await sync(ctx.app, session, 0, {
          tasks: [task("t", { title: "newest", updatedAt: T0 + 2 }), task("t", { title: "older", updatedAt: T0 + 1 })],
        })
      ).json();
      expect(res.changes.tasks).toHaveLength(1);
      expect(res.changes.tasks[0].title).toBe("newest");
    });

    it("applies LWW to the profile", async () => {
      const session = await register(ctx.app);
      await sync(ctx.app, session, 0, { profile: profile({ xp: 10, updatedAt: T0 + 10 }) });
      await sync(ctx.app, session, 0, { profile: profile({ xp: 5, updatedAt: T0 + 5 }) });
      const res = (await sync(ctx.app, session, 0)).json();
      expect(res.changes.profile.xp).toBe(10);

      const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${session.accessToken}` } });
      expect(me.json().profile).toEqual(profile({ xp: 10, updatedAt: T0 + 10 }));
    });
  });

  it("propagates tombstones to other devices", async () => {
    const session = await register(ctx.app);
    const deviceB = (await sync(ctx.app, session, 0, { habits: [habit("h")], moodLogs: [moodLog("2026-09-01")] })).json().cursor;

    const tombstone = habit("h", { deleted: true, updatedAt: T0 + 1 });
    await sync(ctx.app, session, deviceB, { habits: [tombstone] });

    const pulled = (await sync(ctx.app, session, deviceB)).json();
    expect(pulled.changes.habits).toEqual([tombstone]);

    // A stale device cannot resurrect the record with an older edit.
    await sync(ctx.app, session, 0, { habits: [habit("h", { updatedAt: T0 })] });
    const all = (await sync(ctx.app, session, 0)).json();
    expect(all.changes.habits[0].deleted).toBe(true);
  });

  it("isolates users even when ids collide", async () => {
    const alice = await register(ctx.app);
    const bob = await register(ctx.app);
    await sync(ctx.app, alice, 0, { habits: [habit("shared-id", { name: "Alice's" })], profile: profile({ name: "Alice" }) });

    const bobView = (await sync(ctx.app, bob, 0)).json();
    expect(bobView.cursor).toBe(0);
    expect(bobView.changes.habits).toEqual([]);
    expect(bobView.changes.profile).toBeNull();

    // Bob writing the same id creates his own row, even with an older timestamp.
    await sync(ctx.app, bob, 0, { habits: [habit("shared-id", { name: "Bob's", updatedAt: T0 - 1 })] });
    const aliceView = (await sync(ctx.app, alice, 0)).json();
    expect(aliceView.changes.habits.map((h: { name: string }) => h.name)).toEqual(["Alice's"]);
    const bobAfter = (await sync(ctx.app, bob, 0)).json();
    expect(bobAfter.changes.habits.map((h: { name: string }) => h.name)).toEqual(["Bob's"]);
    expect(bobAfter.cursor).toBe(1);
  });

  describe("validation", () => {
    it.each([
      ["habits", habit("bad-habit", { frequency: { type: "hourly" } }), "bad-habit"],
      ["tasks", task("bad-task", { priority: "urgent" }), "bad-task"],
      ["habitLogs", habitLog("h1", "2026-09-23", { id: "wrong-id" }), "wrong-id"],
      ["moodLogs", moodLog("2026-09-23", { id: "2026-09-24" }), "2026-09-24"],
      ["focusSessions", focusSession("bad-focus", { updatedAt: "yesterday" }), "bad-focus"],
      ["badges", badge("bad-badge", { deleted: "no" }), "bad-badge"],
    ])("rejects an invalid %s record, naming collection and id", async (collection, record, id) => {
      const session = await register(ctx.app);
      const res = await sync(ctx.app, session, 0, { [collection]: [record] });
      expect(res.statusCode).toBe(400);
      const { error } = res.json();
      expect(error.code).toBe("INVALID_RECORD");
      expect(error.message).toContain(collection);
      expect(error.message).toContain(id);
      expect(error.details).toEqual({ collection, id });
    });

    it("rejects an invalid profile", async () => {
      const session = await register(ctx.app);
      const res = await sync(ctx.app, session, 0, { profile: profile({ mode: "sepia" }) });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatchObject({ code: "INVALID_RECORD", details: { collection: "profile", id: null } });
    });

    it("writes nothing when any record in the push is invalid", async () => {
      const session = await register(ctx.app);
      await sync(ctx.app, session, 0, { habits: [habit("good"), habit("bad", { goal: "lots" })] });
      const res = (await sync(ctx.app, session, 0)).json();
      expect(res.cursor).toBe(0);
      expect(res.changes.habits).toEqual([]);
    });

    it("rejects a malformed envelope", async () => {
      const session = await register(ctx.app);
      const res = await sync(ctx.app, session, -1);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("caps a push at 2000 records", async () => {
      const session = await register(ctx.app);
      const tasks = Array.from({ length: 2001 }, (_, i) => task(`t${i}`));
      const res = await sync(ctx.app, session, 0, { tasks });
      expect(res.statusCode).toBe(413);
      expect(res.json().error.code).toBe("TOO_MANY_RECORDS");

      const ok = await sync(ctx.app, session, 0, { tasks: tasks.slice(0, 2000) });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().cursor).toBe(2000);
    });
  });
});
