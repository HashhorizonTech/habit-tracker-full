import { describe, expect, it } from "vitest";
import { addMonthsUtc, lastUtcDays, levelForXp } from "../src/admin/service.js";
import { mapProduct, mapSubscription } from "../src/billing/google.js";
import { computePlusStatus, type EntitlementLike } from "../src/lib/plus.js";

const NOW = Date.UTC(2026, 8, 24, 12);
const DAY = 86_400_000;

const ent = (overrides: Partial<EntitlementLike>): EntitlementLike => ({
  source: "play_subscription",
  status: "active",
  expiresAt: NOW + 10 * DAY,
  autoRenew: true,
  productId: "plus",
  basePlanId: "monthly",
  ...overrides,
});

describe("computePlusStatus", () => {
  it("is free without entitlements", () => {
    expect(computePlusStatus([], NOW)).toEqual({ active: false, source: null, expiresAt: null, autoRenew: false, productId: null, basePlanId: null });
  });

  it("lifetime beats any expiry", () => {
    const status = computePlusStatus(
      [ent({ expiresAt: NOW + 900 * DAY }), ent({ source: "play_lifetime", productId: "plus_lifetime", basePlanId: null, expiresAt: null, autoRenew: false })],
      NOW,
    );
    expect(status).toEqual({ active: true, source: "play_lifetime", expiresAt: null, autoRenew: false, productId: "plus_lifetime", basePlanId: null });
  });

  it("picks the latest expiry among active/grace", () => {
    const status = computePlusStatus(
      [ent({ expiresAt: NOW + 5 * DAY }), ent({ source: "admin", status: "grace", expiresAt: NOW + 50 * DAY, autoRenew: false, productId: null, basePlanId: null })],
      NOW,
    );
    expect(status).toMatchObject({ active: true, source: "admin", expiresAt: NOW + 50 * DAY });
  });

  it("counts grace", () => {
    expect(computePlusStatus([ent({ status: "grace" })], NOW).active).toBe(true);
  });

  it("does not count expired entitlements (by status or by time)", () => {
    expect(computePlusStatus([ent({ status: "expired" })], NOW).active).toBe(false);
    expect(computePlusStatus([ent({ expiresAt: NOW - 1 })], NOW).active).toBe(false);
    expect(computePlusStatus([ent({ status: "grace", expiresAt: NOW - 1 })], NOW).active).toBe(false);
  });

  it("does not count revoked, refunded, on hold or paused", () => {
    for (const status of ["revoked", "refunded", "on_hold", "paused"]) {
      expect(computePlusStatus([ent({ status })], NOW).active).toBe(false);
    }
  });

  it("keeps a cancelled subscription until its paid period ends", () => {
    expect(computePlusStatus([ent({ status: "canceled", autoRenew: false })], NOW)).toMatchObject({ active: true, autoRenew: false });
    expect(computePlusStatus([ent({ status: "canceled", expiresAt: NOW - 1 })], NOW).active).toBe(false);
    expect(computePlusStatus([ent({ status: "canceled", expiresAt: null })], NOW).active).toBe(false);
  });
});

describe("Google Play mapping", () => {
  const iso = (ms: number) => new Date(ms).toISOString();
  const sub = (state: string, extra: Record<string, unknown> = {}) => ({
    subscriptionState: state,
    startTime: iso(NOW - DAY),
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [
      {
        productId: "plus",
        expiryTime: iso(NOW + 30 * DAY),
        autoRenewingPlan: { autoRenewEnabled: true },
        offerDetails: { basePlanId: "monthly" },
      },
    ],
    ...extra,
  });

  it.each([
    ["SUBSCRIPTION_STATE_ACTIVE", "active"],
    ["SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "grace"],
    ["SUBSCRIPTION_STATE_ON_HOLD", "on_hold"],
    ["SUBSCRIPTION_STATE_PAUSED", "paused"],
    ["SUBSCRIPTION_STATE_CANCELED", "canceled"],
    ["SUBSCRIPTION_STATE_EXPIRED", "expired"],
  ])("maps %s → %s", (state, status) => {
    expect(mapSubscription(sub(state), NOW)?.status).toBe(status);
  });

  it("maps line items to plan, expiry, auto-renew and ack state", () => {
    expect(mapSubscription(sub("SUBSCRIPTION_STATE_ACTIVE"), NOW)).toMatchObject({
      source: "play_subscription",
      productId: "plus",
      basePlanId: "monthly",
      startsAt: NOW - DAY,
      expiresAt: NOW + 30 * DAY,
      autoRenew: true,
      isTrial: false,
      needsAcknowledge: true,
    });
  });

  it("uses the line item with the latest expiry and detects free trials", () => {
    const mapped = mapSubscription(
      sub("SUBSCRIPTION_STATE_ACTIVE", {
        lineItems: [
          { productId: "plus", expiryTime: iso(NOW + DAY), offerDetails: { basePlanId: "monthly" } },
          { productId: "plus", expiryTime: iso(NOW + 7 * DAY), offerDetails: { basePlanId: "yearly", offerId: "yearly-free-trial" } },
        ],
      }),
      NOW,
    );
    expect(mapped).toMatchObject({ source: "play_subscription", basePlanId: "yearly", expiresAt: NOW + 7 * DAY, isTrial: true, autoRenew: false });
    const phase = mapSubscription(
      sub("SUBSCRIPTION_STATE_ACTIVE", { lineItems: [{ expiryTime: iso(NOW + DAY), offerPhase: { freeTrial: {} }, offerDetails: { basePlanId: "yearly" } }] }),
      NOW,
    );
    expect(phase?.isTrial).toBe(true);
  });

  it("rejects pending subscriptions", () => {
    expect(mapSubscription(sub("SUBSCRIPTION_STATE_PENDING"), NOW)).toBeNull();
    expect(mapSubscription({}, NOW)).toBeNull();
  });

  it("maps purchased one-time products to lifetime", () => {
    expect(mapProduct({ purchaseState: 0, acknowledgementState: 0, purchaseTimeMillis: String(NOW) }, "plus_lifetime", NOW)).toMatchObject({
      source: "play_lifetime",
      productId: "plus_lifetime",
      status: "active",
      startsAt: NOW,
      expiresAt: null,
      needsAcknowledge: true,
    });
    expect(mapProduct({ purchaseState: 1 }, "plus_lifetime", NOW)).toBeNull();
    expect(mapProduct({ purchaseState: 2 }, "plus_lifetime", NOW)).toBeNull();
  });
});

describe("admin helpers", () => {
  it("adds calendar months, clamping month ends", () => {
    expect(new Date(addMonthsUtc(Date.UTC(2026, 0, 31), 1)).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(new Date(addMonthsUtc(Date.UTC(2026, 10, 15, 9), 3)).toISOString()).toBe("2027-02-15T09:00:00.000Z");
  });

  it("computes levels like the app", () => {
    expect([0, 249, 250, 749, 750, 16_500].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 12]);
  });

  it("lists the last 30 UTC days ending today", () => {
    const days = lastUtcDays(30, NOW);
    expect(days).toHaveLength(30);
    expect(days[29]).toBe("2026-09-24");
    expect(days[0]).toBe("2026-08-26");
  });
});

describe("env", () => {
  it("refuses BILLING_FAKE in production", async () => {
    const { loadEnv } = await import("../src/env.js");
    const base = { DATABASE_URL: "file:x.db", JWT_SECRET: "x".repeat(32) };
    expect(() => loadEnv({ ...base, BILLING_FAKE: "true", NODE_ENV: "production" })).toThrow(/BILLING_FAKE/);
    expect(loadEnv({ ...base, BILLING_FAKE: "true" }).BILLING_FAKE).toBe(true);
    expect(loadEnv(base)).toMatchObject({ BILLING_FAKE: false, GOOGLE_PLAY_PACKAGE_NAME: "com.tend.app", PRICE_MONTHLY_INR: 99, PRICE_YEARLY_INR: 699, PRICE_LIFETIME_INR: 1999 });
  });
});
