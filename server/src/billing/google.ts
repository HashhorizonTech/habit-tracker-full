import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import type { EntitlementSource, EntitlementStatus } from "../lib/plus.js";

/*
 * Google Play Developer API (Android Publisher v3), called with plain fetch.
 * The rest of the server talks to `GooglePlayApi`, so tests inject a fake.
 */

const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

// ---- Response shapes (only the fields we use) -----------------------------------------

export interface SubscriptionLineItem {
  productId?: string;
  expiryTime?: string; // RFC 3339
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
  prepaidPlan?: { allowExtendAfterTime?: string };
  offerDetails?: { basePlanId?: string; offerId?: string; offerTags?: string[] };
  /** Present on newer API responses. */
  offerPhase?: { freeTrial?: object; introductoryPrice?: object; basePrice?: object; prorationPeriod?: object };
}

export interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  startTime?: string;
  lineItems?: SubscriptionLineItem[];
  linkedPurchaseToken?: string;
  acknowledgementState?: string; // ACKNOWLEDGEMENT_STATE_PENDING | ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED
  testPurchase?: object;
}

export interface ProductPurchase {
  purchaseState?: number; // 0 purchased, 1 canceled, 2 pending
  acknowledgementState?: number; // 0 pending, 1 acknowledged
  purchaseTimeMillis?: string;
  productId?: string;
  orderId?: string;
}

export interface GooglePlayApi {
  getSubscription(packageName: string, purchaseToken: string): Promise<SubscriptionPurchaseV2>;
  getProduct(packageName: string, productId: string, purchaseToken: string): Promise<ProductPurchase>;
  acknowledgeSubscription(packageName: string, subscriptionId: string, purchaseToken: string): Promise<void>;
  acknowledgeProduct(packageName: string, productId: string, purchaseToken: string): Promise<void>;
}

/** Non-2xx answer from Google. 400/404/410 mean the token is not a valid purchase. */
export class GooglePlayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GooglePlayError";
  }

  get isInvalidToken(): boolean {
    return this.status === 400 || this.status === 404 || this.status === 410;
  }
}

// ---- Mapping to entitlements ------------------------------------------------------------

export interface MappedPurchase {
  source: EntitlementSource;
  productId: string | null;
  basePlanId: string | null;
  status: EntitlementStatus;
  startsAt: number;
  expiresAt: number | null;
  autoRenew: boolean;
  note: string | null;
  isTrial: boolean;
  needsAcknowledge: boolean;
  linkedPurchaseToken: string | null;
}

const SUBSCRIPTION_STATES: Record<string, EntitlementStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
  SUBSCRIPTION_STATE_PAUSED: "paused",
  SUBSCRIPTION_STATE_CANCELED: "canceled",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
};

const parseTime = (value: string | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Maps a subscriptionsv2 resource. Returns null when it doesn't represent a purchase
 * that was ever paid for/started (PENDING, PENDING_PURCHASE_CANCELED, UNSPECIFIED).
 */
export function mapSubscription(sub: SubscriptionPurchaseV2, fallbackNow: number): MappedPurchase | null {
  const status = SUBSCRIPTION_STATES[sub.subscriptionState ?? ""];
  if (!status) return null;

  // The line item with the latest expiry describes the current plan.
  let item: SubscriptionLineItem | undefined;
  let expiresAt: number | null = null;
  for (const li of sub.lineItems ?? []) {
    const exp = parseTime(li.expiryTime);
    if (!item || (exp !== null && (expiresAt === null || exp > expiresAt))) {
      item = li;
      expiresAt = exp;
    }
  }

  const offerId = item?.offerDetails?.offerId ?? "";
  const isTrial = /trial/i.test(offerId) || item?.offerPhase?.freeTrial !== undefined;

  return {
    source: "play_subscription",
    productId: item?.productId ?? "plus",
    basePlanId: item?.offerDetails?.basePlanId ?? null,
    status,
    startsAt: parseTime(sub.startTime) ?? fallbackNow,
    // A subscription without an expiry would read as lifetime; treat it as already expired instead.
    expiresAt: expiresAt ?? fallbackNow,
    autoRenew: item?.autoRenewingPlan?.autoRenewEnabled ?? false,
    note: isTrial ? "free trial" : null,
    isTrial,
    needsAcknowledge: sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    linkedPurchaseToken: sub.linkedPurchaseToken ?? null,
  };
}

/** Maps a one-time product purchase. Returns null unless it is purchased (purchaseState 0). */
export function mapProduct(purchase: ProductPurchase, productId: string, fallbackNow: number): MappedPurchase | null {
  if (purchase.purchaseState !== 0) return null;
  const purchasedAt = Number(purchase.purchaseTimeMillis);
  return {
    source: "play_lifetime",
    productId,
    basePlanId: null,
    status: "active",
    startsAt: Number.isFinite(purchasedAt) && purchasedAt > 0 ? purchasedAt : fallbackNow,
    expiresAt: null,
    autoRenew: false,
    note: null,
    isTrial: false,
    needsAcknowledge: purchase.acknowledgementState === 0,
    linkedPurchaseToken: null,
  };
}

// ---- Real client -------------------------------------------------------------------------

/** Accepts the service-account key as raw JSON or as a path to the JSON file. */
export function loadServiceAccount(value: string): Record<string, unknown> {
  const text = value.trimStart().startsWith("{") ? value : readFileSync(value, "utf8");
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== "object" || parsed === null || !("client_email" in parsed) || !("private_key" in parsed)) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not a service-account key (client_email/private_key missing)");
  }
  return parsed as Record<string, unknown>;
}

export function createGooglePlayApi(serviceAccountJson: string, fetchImpl: typeof fetch = fetch): GooglePlayApi {
  const auth = new GoogleAuth({ credentials: loadServiceAccount(serviceAccountJson), scopes: [SCOPE] });

  async function call<T>(method: "GET" | "POST", url: string): Promise<T> {
    const token = await auth.getAccessToken();
    if (!token) throw new GooglePlayError(401, "Could not obtain a Google access token");
    const res = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new GooglePlayError(res.status, `Google Play API ${res.status}: ${text.slice(0, 500)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  const enc = encodeURIComponent;
  return {
    getSubscription: (pkg, token) =>
      call("GET", `${API_BASE}/${enc(pkg)}/purchases/subscriptionsv2/tokens/${enc(token)}`),
    getProduct: (pkg, productId, token) =>
      call("GET", `${API_BASE}/${enc(pkg)}/purchases/products/${enc(productId)}/tokens/${enc(token)}`),
    acknowledgeSubscription: async (pkg, subscriptionId, token) => {
      await call("POST", `${API_BASE}/${enc(pkg)}/purchases/subscriptions/${enc(subscriptionId)}/tokens/${enc(token)}:acknowledge`);
    },
    acknowledgeProduct: async (pkg, productId, token) => {
      await call("POST", `${API_BASE}/${enc(pkg)}/purchases/products/${enc(productId)}/tokens/${enc(token)}:acknowledge`);
    },
  };
}
