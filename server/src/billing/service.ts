import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { Entitlement } from "../generated/prisma/client.js";
import { type Db, isUniqueViolation } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { loadPlusStatus, type PlusStatus } from "../lib/plus.js";
import { DAY_MS, now } from "../lib/time.js";
import { type GooglePlayApi, GooglePlayError, type MappedPurchase, mapProduct, mapSubscription } from "./google.js";

export const SUBSCRIPTION_PRODUCT_ID = "plus";
export const LIFETIME_PRODUCT_ID = "plus_lifetime";

export interface BillingDeps {
  db: Db;
  /** null when no service-account credentials are configured. */
  google: GooglePlayApi | null;
  packageName: string;
  fake: boolean;
  log: FastifyBaseLogger;
}

export const VerifyBody = z
  .object({
    productId: z.enum([SUBSCRIPTION_PRODUCT_ID, LIFETIME_PRODUCT_ID]),
    purchaseToken: z.string().min(1).max(4096),
    type: z.enum(["subscription", "inapp"]),
  })
  .refine((b) => (b.productId === SUBSCRIPTION_PRODUCT_ID) === (b.type === "subscription"), {
    message: "type must be 'subscription' for 'plus' and 'inapp' for 'plus_lifetime'",
    path: ["type"],
  });
export type VerifyBody = z.output<typeof VerifyBody>;

/** Admin/refund outcomes are final: later Google state never re-activates them. */
const STICKY_STATUSES = new Set(["revoked", "refunded"]);

const invalidPurchase = (message = "Google Play reports this purchase as invalid or not purchased") =>
  new AppError(400, "INVALID_PURCHASE", message);
const notConfigured = () => new AppError(503, "BILLING_NOT_CONFIGURED", "Google Play billing is not configured on this server");
const upstreamError = (err: unknown) =>
  new AppError(502, "BILLING_UPSTREAM_ERROR", "Could not reach Google Play; try again", {
    reason: err instanceof Error ? err.message.slice(0, 200) : String(err),
  });

export const FAKE_PREFIX = "fake:";
const FAKE_TOKEN = /^fake:(monthly|yearly|lifetime):(.+)$/;

// ---- verify -----------------------------------------------------------------------------

export async function verifyPurchase(deps: BillingDeps, userId: string, body: VerifyBody): Promise<PlusStatus> {
  const { db, log } = deps;
  const existing = await db.entitlement.findUnique({ where: { purchaseToken: body.purchaseToken } });
  if (existing && existing.userId !== userId) throw ownedElsewhere();

  if (deps.fake && body.purchaseToken.startsWith(FAKE_PREFIX)) {
    // Each fake token is one purchase; re-verifying it must not extend it.
    if (!existing) await createEntitlement(db, userId, body.purchaseToken, mapFake(body));
    return loadPlusStatus(db, userId);
  }

  const google = deps.google;
  if (!google) throw notConfigured();

  const mapped = await fetchPurchase(google, deps.packageName, body.productId, body.type, body.purchaseToken);
  if (!mapped) throw invalidPurchase();

  if (existing) await updateEntitlement(db, existing, mapped);
  else await createEntitlement(db, userId, body.purchaseToken, mapped);
  await supersedeLinked(deps, userId, mapped.linkedPurchaseToken);

  if (mapped.needsAcknowledge && (mapped.status === "active" || mapped.status === "grace")) {
    try {
      if (body.type === "subscription") await google.acknowledgeSubscription(deps.packageName, body.productId, body.purchaseToken);
      else await google.acknowledgeProduct(deps.packageName, body.productId, body.purchaseToken);
    } catch (err) {
      // The entitlement is stored; the client retries verify (idempotent) so the ack happens before Google's 3-day refund.
      log.error({ err }, "google play acknowledge failed");
      throw upstreamError(err);
    }
  }
  return loadPlusStatus(db, userId);
}

const ownedElsewhere = () =>
  new AppError(409, "PURCHASE_OWNED_ELSEWHERE", "This purchase is already linked to another account");

async function fetchPurchase(
  google: GooglePlayApi,
  packageName: string,
  productId: string,
  type: "subscription" | "inapp",
  purchaseToken: string,
): Promise<MappedPurchase | null> {
  try {
    if (type === "subscription") return mapSubscription(await google.getSubscription(packageName, purchaseToken), now());
    return mapProduct(await google.getProduct(packageName, productId, purchaseToken), productId, now());
  } catch (err) {
    if (err instanceof GooglePlayError && err.isInvalidToken) throw invalidPurchase();
    throw upstreamError(err);
  }
}

function mapFake(body: VerifyBody): MappedPurchase {
  const match = FAKE_TOKEN.exec(body.purchaseToken);
  if (!match) throw invalidPurchase("Fake tokens look like fake:<monthly|yearly|lifetime>:<random>");
  const plan = match[1] as "monthly" | "yearly" | "lifetime";
  const expected = plan === "lifetime" ? LIFETIME_PRODUCT_ID : SUBSCRIPTION_PRODUCT_ID;
  if (body.productId !== expected) throw invalidPurchase(`A fake ${plan} token must be verified as productId '${expected}'`);
  const at = now();
  const base = { startsAt: at, note: "fake purchase", isTrial: false, needsAcknowledge: false, linkedPurchaseToken: null };
  if (plan === "lifetime") {
    return { ...base, source: "play_lifetime", productId: LIFETIME_PRODUCT_ID, basePlanId: null, status: "active", expiresAt: null, autoRenew: false };
  }
  return {
    ...base,
    source: "play_subscription",
    productId: SUBSCRIPTION_PRODUCT_ID,
    basePlanId: plan,
    status: "active",
    expiresAt: at + (plan === "monthly" ? 30 : 365) * DAY_MS,
    autoRenew: true,
  };
}

const entitlementFields = (m: MappedPurchase) => ({
  source: m.source,
  productId: m.productId,
  basePlanId: m.basePlanId,
  status: m.status,
  startsAt: m.startsAt,
  expiresAt: m.expiresAt,
  autoRenew: m.autoRenew,
  note: m.note,
});

async function createEntitlement(db: Db, userId: string, purchaseToken: string, mapped: MappedPurchase): Promise<void> {
  const at = now();
  try {
    await db.entitlement.create({
      data: { id: randomUUID(), userId, purchaseToken, grantedBy: null, createdAt: at, updatedAt: at, ...entitlementFields(mapped) },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Lost a race with a concurrent verify of the same token.
    const winner = await db.entitlement.findUnique({ where: { purchaseToken } });
    if (winner && winner.userId !== userId) throw ownedElsewhere();
    if (winner) await updateEntitlement(db, winner, mapped);
  }
}

async function updateEntitlement(db: Db, existing: Entitlement, mapped: MappedPurchase): Promise<Entitlement> {
  const fields = entitlementFields(mapped);
  if (STICKY_STATUSES.has(existing.status)) {
    fields.status = existing.status as MappedPurchase["status"];
    fields.autoRenew = false;
  }
  return db.entitlement.update({ where: { id: existing.id }, data: { ...fields, updatedAt: now() } });
}

/** An upgrade/resubscribe carries the replaced purchase's token; that one no longer grants anything. */
async function supersedeLinked(deps: BillingDeps, userId: string, linkedToken: string | null): Promise<void> {
  if (!linkedToken) return;
  const { count } = await deps.db.entitlement.updateMany({
    where: { purchaseToken: linkedToken, userId, status: { notIn: [...STICKY_STATUSES, "expired"] } },
    data: { status: "expired", autoRenew: false, updatedAt: now() },
  });
  if (count) deps.log.info({ userId }, "superseded linked play purchase");
}

// ---- RTDN -------------------------------------------------------------------------------

const PushBody = z.object({ message: z.object({ data: z.string().optional() }).loose() }).loose();

const DeveloperNotification = z
  .object({
    packageName: z.string().optional(),
    subscriptionNotification: z
      .object({ notificationType: z.number().optional(), purchaseToken: z.string(), subscriptionId: z.string().optional() })
      .optional(),
    oneTimeProductNotification: z
      .object({ notificationType: z.number().optional(), purchaseToken: z.string(), sku: z.string().optional() })
      .optional(),
    voidedPurchaseNotification: z
      .object({ purchaseToken: z.string(), orderId: z.string().optional(), productType: z.number().optional() })
      .optional(),
    testNotification: z.object({}).loose().optional(),
  })
  .loose();

/** Decodes a Pub/Sub push body. Returns null (and logs) for anything that isn't a usable notification. */
export function decodeRtdn(body: unknown, log: FastifyBaseLogger): z.output<typeof DeveloperNotification> | null {
  const push = PushBody.safeParse(body);
  if (!push.success || !push.data.message.data) {
    log.warn("rtdn: body is not a Pub/Sub push message");
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(push.data.message.data, "base64").toString("utf8")) as unknown;
    const parsed = DeveloperNotification.safeParse(json);
    if (!parsed.success) {
      log.warn("rtdn: message data is not a developer notification");
      return null;
    }
    return parsed.data;
  } catch {
    log.warn("rtdn: message data is not base64 JSON");
    return null;
  }
}

export async function handleRtdn(deps: BillingDeps, body: unknown): Promise<void> {
  const { db, log } = deps;
  const n = decodeRtdn(body, log);
  if (!n) return;
  if (n.packageName && n.packageName !== deps.packageName) {
    log.warn({ packageName: n.packageName }, "rtdn: notification for another package ignored");
    return;
  }
  if (n.testNotification) {
    log.info("rtdn: test notification");
    return;
  }

  if (n.voidedPurchaseNotification) {
    const { purchaseToken } = n.voidedPurchaseNotification;
    const { count } = await db.entitlement.updateMany({
      where: { purchaseToken },
      data: { status: "refunded", autoRenew: false, updatedAt: now() },
    });
    if (!count) log.warn("rtdn: voided purchase for unknown purchase token");
    return;
  }

  const sub = n.subscriptionNotification;
  const product = n.oneTimeProductNotification;
  const purchaseToken = sub?.purchaseToken ?? product?.purchaseToken;
  if (!purchaseToken) {
    log.info("rtdn: notification without a purchase token ignored");
    return;
  }

  const existing = await db.entitlement.findUnique({ where: { purchaseToken } });
  if (!existing) {
    // The app links purchases to accounts via /verify; nothing to update yet.
    log.warn({ type: sub ? "subscription" : "product", notificationType: (sub ?? product)?.notificationType }, "rtdn: unknown purchase token");
    return;
  }
  if (purchaseToken.startsWith(FAKE_PREFIX)) return;
  if (!deps.google) throw notConfigured();

  let mapped: MappedPurchase | null;
  try {
    mapped = sub
      ? mapSubscription(await deps.google.getSubscription(deps.packageName, purchaseToken), now())
      : await mapOneTime(deps.google, deps.packageName, product?.sku ?? existing.productId ?? LIFETIME_PRODUCT_ID, purchaseToken);
  } catch (err) {
    if (err instanceof GooglePlayError && err.isInvalidToken) {
      log.warn({ status: err.status }, "rtdn: Google no longer knows this purchase token");
      return;
    }
    throw err; // non-2xx → Pub/Sub retries
  }
  if (!mapped) {
    log.info("rtdn: purchase is pending; nothing to update");
    return;
  }
  await updateEntitlement(db, existing, mapped);
  await supersedeLinked(deps, existing.userId, mapped.linkedPurchaseToken);
}

/** One-time products: purchased → active lifetime; cancelled → canceled (no longer grants Plus). */
async function mapOneTime(google: GooglePlayApi, packageName: string, productId: string, token: string): Promise<MappedPurchase | null> {
  const purchase = await google.getProduct(packageName, productId, token);
  const mapped = mapProduct(purchase, productId, now());
  if (mapped || purchase.purchaseState !== 1) return mapped;
  return { ...mapProduct({ ...purchase, purchaseState: 0 }, productId, now())!, status: "canceled", needsAcknowledge: false };
}
