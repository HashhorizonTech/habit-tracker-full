import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GooglePlayApi, ProductPurchase, SubscriptionPurchaseV2 } from "../src/billing/google.js";
import { GooglePlayError } from "../src/billing/google.js";
import { bearer, createTestApp, register, type Session, type TestContext } from "./helpers.js";

const DAY = 86_400_000;
const PKG = "com.tend.app";
const RTDN_SECRET = "rtdn-secret-for-tests";

/** In-memory stand-in for the Android Publisher API. */
class FakeGoogle implements GooglePlayApi {
  subs = new Map<string, SubscriptionPurchaseV2>();
  products = new Map<string, ProductPurchase>();
  acks: string[] = [];
  async getSubscription(pkg: string, token: string) {
    expect(pkg).toBe(PKG);
    const sub = this.subs.get(token);
    if (!sub) throw new GooglePlayError(404, "not found");
    return sub;
  }
  async getProduct(_pkg: string, _productId: string, token: string) {
    const p = this.products.get(token);
    if (!p) throw new GooglePlayError(400, "invalid");
    return p;
  }
  async acknowledgeSubscription(_pkg: string, id: string, token: string) {
    this.acks.push(`sub:${id}:${token}`);
  }
  async acknowledgeProduct(_pkg: string, id: string, token: string) {
    this.acks.push(`product:${id}:${token}`);
  }
}

const iso = (ms: number) => new Date(ms).toISOString();
const subscription = (state: string, expiresAt: number, extra: Partial<SubscriptionPurchaseV2> = {}): SubscriptionPurchaseV2 => ({
  subscriptionState: state,
  startTime: iso(Date.now() - DAY),
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
  lineItems: [{ productId: "plus", expiryTime: iso(expiresAt), autoRenewingPlan: { autoRenewEnabled: state === "SUBSCRIPTION_STATE_ACTIVE" }, offerDetails: { basePlanId: "monthly" } }],
  ...extra,
});

let ctx: TestContext;
let google: FakeGoogle;
beforeAll(async () => {
  google = new FakeGoogle();
  ctx = await createTestApp({ env: { BILLING_FAKE: true, GOOGLE_RTDN_SECRET: RTDN_SECRET }, googlePlay: google });
});
afterAll(() => ctx.close());

const verify = (session: Session, payload: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: bearer(session), payload });
const verifySub = (session: Session, purchaseToken: string) => verify(session, { productId: "plus", purchaseToken, type: "subscription" });
const plusOf = async (session: Session) => (await ctx.app.inject({ method: "GET", url: "/v1/plus", headers: bearer(session) })).json();

const rtdn = (notification: Record<string, unknown>, token = RTDN_SECRET) =>
  ctx.app.inject({
    method: "POST",
    url: `/v1/billing/google/rtdn?token=${encodeURIComponent(token)}`,
    payload: {
      message: { data: Buffer.from(JSON.stringify({ version: "1.0", packageName: PKG, eventTimeMillis: String(Date.now()), ...notification })).toString("base64"), messageId: "1" },
      subscription: "projects/x/subscriptions/y",
    },
  });

describe("fake mode verify", () => {
  it.each([
    ["monthly", "plus", "subscription", 30],
    ["yearly", "plus", "subscription", 365],
  ])("fake %s token grants a %s subscription", async (plan, productId, type, days) => {
    const session = await register(ctx.app);
    const before = Date.now();
    const res = await verify(session, { productId, type, purchaseToken: `fake:${plan}:abc` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ active: true, source: "play_subscription", autoRenew: true, productId: "plus", basePlanId: plan });
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + days * DAY);
    expect(body.expiresAt).toBeLessThan(before + days * DAY + 60_000);
  });

  it("fake lifetime token grants lifetime, and /me shows it", async () => {
    const session = await register(ctx.app);
    const res = await verify(session, { productId: "plus_lifetime", type: "inapp", purchaseToken: "fake:lifetime:xyz" });
    expect(res.statusCode).toBe(200);
    const expected = { active: true, source: "play_lifetime", expiresAt: null, autoRenew: false, productId: "plus_lifetime", basePlanId: null };
    expect(res.json()).toEqual(expected);
    const me = (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(session) })).json();
    expect(me.plus).toEqual(expected);
    expect(me.user.role).toBe("user");
  });

  it("is idempotent for the same user and 409 for another", async () => {
    const a = await register(ctx.app);
    const b = await register(ctx.app);
    const first = (await verifySub(a, "fake:monthly:shared")).json();
    const again = await verifySub(a, "fake:monthly:shared");
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first);
    expect(await ctx.app.db.entitlement.count({ where: { purchaseToken: "fake:monthly:shared" } })).toBe(1);

    const other = await verifySub(b, "fake:monthly:shared");
    expect(other.statusCode).toBe(409);
    expect(other.json().error.code).toBe("PURCHASE_OWNED_ELSEWHERE");
    expect((await plusOf(b)).active).toBe(false);
  });

  it("rejects malformed or mismatched fake tokens", async () => {
    const session = await register(ctx.app);
    expect((await verifySub(session, "fake:weekly:1")).json().error.code).toBe("INVALID_PURCHASE");
    const mismatch = await verify(session, { productId: "plus_lifetime", type: "inapp", purchaseToken: "fake:monthly:1" });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json().error.code).toBe("INVALID_PURCHASE");
  });

  it("validates the body", async () => {
    const session = await register(ctx.app);
    const res = await verify(session, { productId: "plus", type: "inapp", purchaseToken: "x" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    expect((await ctx.app.inject({ method: "POST", url: "/v1/billing/google/verify", payload: {} })).statusCode).toBe(401);
  });
});

describe("verify against Google (fake client)", () => {
  it("activates and acknowledges an active subscription", async () => {
    const session = await register(ctx.app);
    const exp = Date.now() + 30 * DAY;
    google.subs.set("tok-active", subscription("SUBSCRIPTION_STATE_ACTIVE", exp));
    const res = await verifySub(session, "tok-active");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ active: true, source: "play_subscription", expiresAt: exp, autoRenew: true, productId: "plus", basePlanId: "monthly" });
    expect(google.acks).toContain("sub:plus:tok-active");
  });

  it("counts grace period", async () => {
    const session = await register(ctx.app);
    google.subs.set("tok-grace", subscription("SUBSCRIPTION_STATE_IN_GRACE_PERIOD", Date.now() + 3 * DAY));
    expect((await verifySub(session, "tok-grace")).json()).toMatchObject({ active: true, source: "play_subscription" });
  });

  it("keeps Plus for a cancelled subscription until it expires", async () => {
    const session = await register(ctx.app);
    const exp = Date.now() + 10 * DAY;
    google.subs.set("tok-canceled", subscription("SUBSCRIPTION_STATE_CANCELED", exp, { acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }));
    expect((await verifySub(session, "tok-canceled")).json()).toMatchObject({ active: true, autoRenew: false, expiresAt: exp });
    const row = await ctx.app.db.entitlement.findUniqueOrThrow({ where: { purchaseToken: "tok-canceled" } });
    expect(row.status).toBe("canceled");
    expect(google.acks).not.toContain("sub:plus:tok-canceled");
  });

  it("stores but does not grant an expired subscription", async () => {
    const session = await register(ctx.app);
    google.subs.set("tok-expired", subscription("SUBSCRIPTION_STATE_EXPIRED", Date.now() - DAY));
    const res = await verifySub(session, "tok-expired");
    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);
  });

  it("verifies lifetime products", async () => {
    const session = await register(ctx.app);
    google.products.set("tok-life", { purchaseState: 0, acknowledgementState: 0, purchaseTimeMillis: String(Date.now()) });
    const res = await verify(session, { productId: "plus_lifetime", type: "inapp", purchaseToken: "tok-life" });
    expect(res.json()).toMatchObject({ active: true, source: "play_lifetime", expiresAt: null });
    expect(google.acks).toContain("product:plus_lifetime:tok-life");
  });

  it("400 INVALID_PURCHASE when Google does not know the token or it is not purchased", async () => {
    const session = await register(ctx.app);
    expect((await verifySub(session, "tok-unknown")).json().error.code).toBe("INVALID_PURCHASE");
    google.products.set("tok-pending", { purchaseState: 2 });
    const res = await verify(session, { productId: "plus_lifetime", type: "inapp", purchaseToken: "tok-pending" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_PURCHASE");
  });
});

describe("RTDN", () => {
  it("401s without the right token", async () => {
    expect((await rtdn({ testNotification: { version: "1.0" } }, "wrong")).statusCode).toBe(401);
    const none = await ctx.app.inject({ method: "POST", url: "/v1/billing/google/rtdn", payload: {} });
    expect(none.statusCode).toBe(401);
    expect(none.json().error.code).toBe("UNAUTHORIZED");
  });

  it("ignores test notifications, unknown tokens and junk with 204", async () => {
    expect((await rtdn({ testNotification: { version: "1.0" } })).statusCode).toBe(204);
    expect((await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: "never-seen", subscriptionId: "plus" } })).statusCode).toBe(204);
    const junk = await ctx.app.inject({ method: "POST", url: `/v1/billing/google/rtdn?token=${RTDN_SECRET}`, payload: { message: { data: "!!!" } } });
    expect(junk.statusCode).toBe(204);
  });

  it("re-fetches the subscription on a notification (renewal, then expiry)", async () => {
    const session = await register(ctx.app);
    google.subs.set("tok-rtdn", subscription("SUBSCRIPTION_STATE_ACTIVE", Date.now() + DAY));
    await verifySub(session, "tok-rtdn");

    const renewed = Date.now() + 31 * DAY;
    google.subs.set("tok-rtdn", subscription("SUBSCRIPTION_STATE_ACTIVE", renewed, { acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }));
    const note = { subscriptionNotification: { version: "1.0", notificationType: 2, purchaseToken: "tok-rtdn", subscriptionId: "plus" } };
    expect((await rtdn(note)).statusCode).toBe(204);
    expect((await plusOf(session)).expiresAt).toBe(renewed);

    google.subs.set("tok-rtdn", subscription("SUBSCRIPTION_STATE_ON_HOLD", Date.now() - 1));
    expect((await rtdn(note)).statusCode).toBe(204);
    expect((await plusOf(session)).active).toBe(false);
    expect((await ctx.app.db.entitlement.findUniqueOrThrow({ where: { purchaseToken: "tok-rtdn" } })).status).toBe("on_hold");
  });

  it("marks voided purchases refunded, and later Google state does not revive them", async () => {
    const session = await register(ctx.app);
    google.subs.set("tok-refund", subscription("SUBSCRIPTION_STATE_ACTIVE", Date.now() + 20 * DAY));
    await verifySub(session, "tok-refund");
    expect((await plusOf(session)).active).toBe(true);

    const res = await rtdn({ voidedPurchaseNotification: { purchaseToken: "tok-refund", orderId: "GPA.1", productType: 1, refundType: 1 } });
    expect(res.statusCode).toBe(204);
    expect((await ctx.app.db.entitlement.findUniqueOrThrow({ where: { purchaseToken: "tok-refund" } })).status).toBe("refunded");
    expect((await plusOf(session)).active).toBe(false);

    await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 2, purchaseToken: "tok-refund", subscriptionId: "plus" } });
    expect((await plusOf(session)).active).toBe(false);
  });

  it("handles one-time product cancellation", async () => {
    const session = await register(ctx.app);
    google.products.set("tok-life-2", { purchaseState: 0, acknowledgementState: 1 });
    await verify(session, { productId: "plus_lifetime", type: "inapp", purchaseToken: "tok-life-2" });
    google.products.set("tok-life-2", { purchaseState: 1, acknowledgementState: 1 });
    const res = await rtdn({ oneTimeProductNotification: { version: "1.0", notificationType: 2, purchaseToken: "tok-life-2", sku: "plus_lifetime" } });
    expect(res.statusCode).toBe(204);
    expect((await plusOf(session)).active).toBe(false);
  });
});

describe("without credentials or fake mode", () => {
  let bare: TestContext;
  beforeAll(async () => {
    bare = await createTestApp();
  });
  afterAll(() => bare.close());

  it("503 BILLING_NOT_CONFIGURED, including for fake tokens", async () => {
    const session = await register(bare.app);
    for (const purchaseToken of ["real-token", "fake:monthly:1"]) {
      const res = await bare.app.inject({
        method: "POST",
        url: "/v1/billing/google/verify",
        headers: bearer(session),
        payload: { productId: "plus", type: "subscription", purchaseToken },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("BILLING_NOT_CONFIGURED");
    }
  });

  it("rejects RTDN when no secret is configured", async () => {
    const res = await bare.app.inject({ method: "POST", url: "/v1/billing/google/rtdn?token=anything", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("refuses to build with BILLING_FAKE in production", async () => {
    await expect(createTestApp({ env: { BILLING_FAKE: true, NODE_ENV: "production" } })).rejects.toThrow(/BILLING_FAKE/);
  });
});
