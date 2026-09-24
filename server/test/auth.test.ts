import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, createTestApp, register, type TestContext } from "./helpers.js";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

const post = (url: string, payload: unknown) => ctx.app.inject({ method: "POST", url, payload: payload as object });

describe("health and errors", () => {
  it("reports health without auth", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, version: "1.0.0" });
  });

  it("uses the error envelope for unknown routes", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("uses the error envelope for malformed JSON", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("BAD_REQUEST");
  });
});

describe("register", () => {
  it("creates a user, normalising the email", async () => {
    const res = await post("/v1/auth/register", { email: "  Mixed.Case@Example.COM ", password: "password123", name: "Ravi" });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toEqual({ id: expect.any(String), email: "mixed.case@example.com", name: "Ravi", createdAt: expect.any(Number), role: "user" });
    expect(Object.keys(body.user)).toHaveLength(5);
    expect(body.accessToken).toMatch(/^ey/);
    expect(typeof body.refreshToken).toBe("string");
  });

  it("rejects duplicate emails case-insensitively", async () => {
    await post("/v1/auth/register", { email: "dup@example.com", password: "password123", name: "A" });
    const res = await post("/v1/auth/register", { email: "DUP@example.com", password: "password123", name: "B" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("EMAIL_TAKEN");
  });

  it.each([
    ["short password", { email: "a@b.co", password: "short", name: "A" }],
    ["long password", { email: "a@b.co", password: "x".repeat(129), name: "A" }],
    ["bad email", { email: "nope", password: "password123", name: "A" }],
    ["missing name", { email: "a@b.co", password: "password123" }],
  ])("rejects %s with VALIDATION_ERROR", async (_label, payload) => {
    const res = await post("/v1/auth/register", payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: expect.any(String) } });
  });
});

describe("login", () => {
  beforeAll(async () => {
    await post("/v1/auth/register", { email: "login@example.com", password: "password123", name: "L" });
  });

  it("returns user and tokens", async () => {
    const res = await post("/v1/auth/login", { email: "LOGIN@example.com", password: "password123" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "login@example.com" }, accessToken: expect.any(String), refreshToken: expect.any(String) });
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const wrong = await post("/v1/auth/login", { email: "login@example.com", password: "wrong-password" });
    const unknown = await post("/v1/auth/login", { email: "ghost@example.com", password: "password123" });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("refresh tokens", () => {
  it("rotates: the new pair works and the old token is revoked", async () => {
    const session = await register(ctx.app);
    const res = await post("/v1/auth/refresh", { refreshToken: session.refreshToken });
    expect(res.statusCode).toBe(200);
    const next = res.json();
    expect(Object.keys(next).sort()).toEqual(["accessToken", "refreshToken"]);
    expect(next.refreshToken).not.toBe(session.refreshToken);

    const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${next.accessToken}` } });
    expect(me.statusCode).toBe(200);

    const again = await post("/v1/auth/refresh", { refreshToken: next.refreshToken });
    expect(again.statusCode).toBe(200);
  });

  it("detects reuse of a rotated token and revokes the whole family", async () => {
    const session = await register(ctx.app);
    const rotated = (await post("/v1/auth/refresh", { refreshToken: session.refreshToken })).json();

    const replay = await post("/v1/auth/refresh", { refreshToken: session.refreshToken });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe("INVALID_REFRESH_TOKEN");

    // The legitimate successor is now dead too.
    const successor = await post("/v1/auth/refresh", { refreshToken: rotated.refreshToken });
    expect(successor.statusCode).toBe(401);
  });

  it("does not revoke other sessions (families) on reuse", async () => {
    const first = await register(ctx.app, "families@example.com");
    const second = (await post("/v1/auth/login", { email: "families@example.com", password: "correct horse" })).json();
    await post("/v1/auth/refresh", { refreshToken: first.refreshToken });
    await post("/v1/auth/refresh", { refreshToken: first.refreshToken }); // reuse
    const other = await post("/v1/auth/refresh", { refreshToken: second.refreshToken });
    expect(other.statusCode).toBe(200);
  });

  it("rejects unknown tokens", async () => {
    const res = await post("/v1/auth/refresh", { refreshToken: "not-a-real-token" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("stores refresh tokens hashed", async () => {
    const session = await register(ctx.app);
    const rows = await ctx.app.db.refreshToken.findMany({ where: { userId: session.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(session.refreshToken);
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.expiresAt - rows[0]!.createdAt).toBe(60 * 86_400_000);
  });
});

describe("logout", () => {
  it("revokes the refresh token and is idempotent", async () => {
    const session = await register(ctx.app);
    const res = await post("/v1/auth/logout", { refreshToken: session.refreshToken });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    expect((await post("/v1/auth/refresh", { refreshToken: session.refreshToken })).statusCode).toBe(401);
    expect((await post("/v1/auth/logout", { refreshToken: session.refreshToken })).statusCode).toBe(204);
  });
});

describe("authentication", () => {
  it.each([
    ["GET", "/v1/me"],
    ["DELETE", "/v1/me"],
    ["POST", "/v1/sync"],
    ["GET", "/v1/export?format=json"],
  ] as const)("%s %s requires a bearer token", async (method, url) => {
    const res = await ctx.app.inject({ method, url, payload: method === "POST" ? { cursor: 0, changes: {} } : undefined });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: expect.any(String) } });
  });

  it("rejects a tampered token", async () => {
    const session = await register(ctx.app);
    const res = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer({ ...session, accessToken: `${session.accessToken}x` }) });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token signed with another secret", async () => {
    const other = await createTestApp({ env: { DATABASE_URL: "file::memory:", JWT_SECRET: "another-secret-that-is-at-least-32-characters", CORS_ORIGIN: "*" } });
    const forged = other.app.signAccessToken("anyone");
    await other.close();
    const res = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${forged}` } });
    expect(res.statusCode).toBe(401);
  });
});

describe("rate limiting", () => {
  it("limits login to 10 per minute per IP", async () => {
    const limited = await createTestApp({ authRateLimit: undefined });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const res = await limited.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "x@example.com", password: "whatever1" } });
        statuses.push(res.statusCode);
        if (res.statusCode === 429) expect(res.json().error.code).toBe("RATE_LIMITED");
      }
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
