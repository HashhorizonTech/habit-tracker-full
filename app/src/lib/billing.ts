// Google Play Billing via expo-iap. Every purchase is verified by the server
// (POST /v1/billing/google/verify) before it is finished/acknowledged, and the server's
// PlusStatus is what unlocks Plus. Everything is guarded: without Play Billing (web,
// emulator without Play, Expo Go) billing reports `unavailable` and the app carries on.
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type ProductSubscription,
  type Purchase,
  type SubscriptionOffer,
} from 'expo-iap';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';
import { useAuth } from '@/api/auth';
import { ApiError, api } from '@/api/client';
import { ANDROID_PACKAGE } from '@/lib/brand';
import { usePlusStore, type PlusStatus } from '@/store/plus';

export type Plan = 'yearly' | 'monthly' | 'lifetime';

export const SUB_ID = 'plus';
export const LIFETIME_ID = 'plus_lifetime';

export interface PlanPrice {
  /** Localized price for the whole period, e.g. "₹699". */
  price: string;
  /** Yearly only: rough monthly equivalent, e.g. "₹58". */
  perMonth?: string;
  /** Yearly only: a free-trial offer the account is eligible for. */
  trial: boolean;
  /** Offer token for requestPurchase (subscriptions). */
  offerToken?: string;
  /** Came from the store (vs the built-in fallback). */
  fromStore: boolean;
}

/** Shown until (or unless) the store returns localized prices. */
export const FALLBACK_PRICES: Record<Plan, PlanPrice> = {
  yearly: { price: '₹699', perMonth: '₹58', trial: true, fromStore: false },
  monthly: { price: '₹99', trial: false, fromStore: false },
  lifetime: { price: '₹1,999', trial: false, fromStore: false },
};

export type BillingAvailability = 'unknown' | 'connecting' | 'available' | 'unavailable';

interface BillingState {
  availability: BillingAvailability;
  prices: Partial<Record<Plan, PlanPrice>>;
}

export const useBilling = create<BillingState>(() => ({ availability: 'unknown', prices: {} }));

/** Whether this plan can be bought through Play right now. */
export const canBuy = (s: BillingState, plan: Plan) => {
  const p = s.prices[plan];
  return s.availability === 'available' && !!p && (plan === 'lifetime' || !!p.offerToken);
};

export type PurchaseOutcome =
  | { kind: 'success'; status: PlusStatus }
  | { kind: 'cancelled' }
  | { kind: 'pending'; message: string }
  | { kind: 'error'; message: string };

// ─── Copy ────────────────────────────────────────────────────────────────────

export const BILLING_COPY = {
  ownedElsewhere: 'This purchase belongs to another account.',
  notConfigured: 'Purchases aren’t available yet.',
  invalid: 'Google couldn’t confirm this purchase. You haven’t been charged twice — try Restore purchases in a moment.',
  offline: 'We couldn’t reach Tend just now. Your purchase is safe — we’ll finish it when you’re back online.',
  pending: 'Your payment is pending. Plus unlocks as soon as Google confirms it.',
  generic: 'That didn’t go through. Please try again.',
  unavailable: 'Purchases aren’t available on this device right now.',
};

function verifyMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return BILLING_COPY.generic;
  switch (e.code) {
    case 'PURCHASE_OWNED_ELSEWHERE':
      return BILLING_COPY.ownedElsewhere;
    case 'BILLING_NOT_CONFIGURED':
      return BILLING_COPY.notConfigured;
    case 'INVALID_PURCHASE':
      return BILLING_COPY.invalid;
    default:
      return e.offline ? BILLING_COPY.offline : BILLING_COPY.generic;
  }
}

// ─── Prices ──────────────────────────────────────────────────────────────────

const MICROS = 1_000_000;

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

const phases = (o: SubscriptionOffer) => o.pricingPhasesAndroid?.pricingPhaseList ?? [];
const isFreeTrial = (o: SubscriptionOffer) => phases(o).some((p) => Number(p.priceAmountMicros) === 0);

/** Pick the yearly/monthly offers from the `plus` subscription. */
function subscriptionPrices(sub: ProductSubscription | undefined): Partial<Record<Plan, PlanPrice>> {
  const out: Partial<Record<Plan, PlanPrice>> = {};
  if (!sub) return out;
  const offers = sub.subscriptionOffers ?? [];
  for (const plan of ['yearly', 'monthly'] as const) {
    const mine = offers.filter((o) => o.basePlanIdAndroid === plan && o.offerTokenAndroid);
    if (!mine.length) continue;
    // Play only lists offers this account is eligible for, so a trial here is real.
    const trial = plan === 'yearly' ? mine.find(isFreeTrial) : undefined;
    // The base plan itself has a single recurring phase.
    const base = mine.find((o) => !isFreeTrial(o) && phases(o).length === 1) ?? mine.find((o) => !isFreeTrial(o)) ?? mine[0];
    const regular = phases(trial ?? base).at(-1);
    const price = regular?.formattedPrice ?? base.displayPrice;
    let perMonth: string | undefined;
    if (plan === 'yearly' && regular) perMonth = formatMoney(Number(regular.priceAmountMicros) / MICROS / 12, regular.priceCurrencyCode);
    out[plan] = { price, perMonth, trial: !!trial, offerToken: (trial ?? base).offerTokenAndroid ?? undefined, fromStore: true };
  }
  return out;
}

function lifetimePrice(p: Product | undefined): PlanPrice | undefined {
  if (!p) return undefined;
  return { price: p.displayPrice, trial: false, fromStore: true };
}

// ─── Connection ──────────────────────────────────────────────────────────────

let connecting: Promise<void> | null = null;
let authSub: (() => void) | null = null;
let listeners: { remove: () => void }[] = [];
let pending: { productId: string; resolve: (o: PurchaseOutcome) => void } | null = null;
/** Tokens verified this session, so a replayed purchase event isn't sent twice. */
const handled = new Set<string>();

function settle(o: PurchaseOutcome) {
  const p = pending;
  pending = null;
  p?.resolve(o);
}

/** Connect to Play Billing and load prices. Safe to call often. */
export function initBilling(): Promise<void> {
  if (Platform.OS !== 'android') {
    useBilling.setState({ availability: 'unavailable' });
    return Promise.resolve();
  }
  if (useBilling.getState().availability === 'available') return Promise.resolve();
  connecting ??= (async () => {
    useBilling.setState({ availability: 'connecting' });
    try {
      const ok = await initConnection();
      if (ok === false) throw new Error('Billing unavailable');
      if (!listeners.length) {
        listeners = [
          purchaseUpdatedListener((p) => void onPurchase(p)),
          purchaseErrorListener((e) => onPurchaseError(e)),
        ];
      }
      const [subs, inapp] = await Promise.all([
        fetchProducts({ skus: [SUB_ID], type: 'subs' }).catch(() => null),
        fetchProducts({ skus: [LIFETIME_ID], type: 'in-app' }).catch(() => null),
      ]);
      const sub = (subs as ProductSubscription[] | null)?.find((p) => p.id === SUB_ID);
      const life = (inapp as Product[] | null)?.find((p) => p.id === LIFETIME_ID);
      const prices = { ...subscriptionPrices(sub) };
      const lp = lifetimePrice(life);
      if (lp) prices.lifetime = lp;
      useBilling.setState({ availability: 'available', prices });
      void reconcile();
      if (!authSub) {
        // Someone signing in may have a purchase the previous session couldn't verify.
        authSub = useAuth.subscribe((st, prev) => {
          if (st.user && st.user.id !== prev.user?.id) void reconcile();
        });
      }
    } catch {
      useBilling.setState({ availability: 'unavailable', prices: {} });
      for (const l of listeners) l.remove();
      listeners = [];
      endConnection().catch(() => {});
    }
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

// ─── Verify ──────────────────────────────────────────────────────────────────

type VerifyBody = { productId: string; purchaseToken: string; type: 'subscription' | 'inapp' };

async function verify(body: VerifyBody): Promise<PlusStatus> {
  const status = await api<PlusStatus>('/v1/billing/google/verify', { method: 'POST', json: body });
  usePlusStore.getState().setStatus(status);
  return status;
}

const isOurs = (productId: string) => productId === SUB_ID || productId === LIFETIME_ID;

async function verifyPurchase(p: Purchase): Promise<PlusStatus> {
  if (!p.purchaseToken) throw new Error('Missing purchase token');
  const status = await verify({
    productId: p.productId,
    purchaseToken: p.purchaseToken,
    type: p.productId === LIFETIME_ID ? 'inapp' : 'subscription',
  });
  // Acknowledge only after the server has the entitlement; unacknowledged purchases
  // are refunded by Google after 3 days, so a failed verify never grants for free.
  await finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
  return status;
}

async function onPurchase(p: Purchase) {
  if (!isOurs(p.productId)) return;
  if (p.purchaseState === 'pending') {
    if (pending?.productId === p.productId) settle({ kind: 'pending', message: BILLING_COPY.pending });
    return;
  }
  if (p.purchaseState !== 'purchased' || !p.purchaseToken) return;
  if (!useAuth.getState().user || handled.has(p.purchaseToken)) return;
  handled.add(p.purchaseToken);
  try {
    const status = await verifyPurchase(p);
    settle({ kind: 'success', status });
  } catch (e) {
    handled.delete(p.purchaseToken);
    settle({ kind: 'error', message: verifyMessage(e) });
  }
}

function onPurchaseError(e: unknown) {
  if (isUserCancelledError(e)) settle({ kind: 'cancelled' });
  else settle({ kind: 'error', message: BILLING_COPY.generic });
}

/** Verify purchases Play still holds unacknowledged (e.g. the app closed mid-purchase). */
async function reconcile() {
  if (!useAuth.getState().user) return;
  try {
    const held = await getAvailablePurchases();
    for (const p of held) {
      const token = p.purchaseToken;
      if (!isOurs(p.productId) || p.purchaseState !== 'purchased' || !token) continue;
      if ('isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid) continue;
      if (handled.has(token)) continue;
      handled.add(token);
      await verifyPurchase(p).catch(() => handled.delete(token));
    }
  } catch {
    // Nothing to reconcile right now.
  }
}

// ─── Public actions ──────────────────────────────────────────────────────────

/** Buy a plan through Google Play. Resolves once the server has verified it (or it failed). */
export async function buy(plan: Plan): Promise<PurchaseOutcome> {
  const price = useBilling.getState().prices[plan];
  if (useBilling.getState().availability !== 'available' || !price) return { kind: 'error', message: BILLING_COPY.unavailable };
  if (pending) return { kind: 'error', message: BILLING_COPY.generic };
  const productId = plan === 'lifetime' ? LIFETIME_ID : SUB_ID;
  const done = new Promise<PurchaseOutcome>((resolve) => {
    pending = { productId, resolve };
  });
  try {
    if (plan === 'lifetime') {
      await requestPurchase({ type: 'in-app', request: { google: { skus: [LIFETIME_ID] } } });
    } else {
      if (!price.offerToken) {
        settle({ kind: 'error', message: BILLING_COPY.unavailable });
        return done;
      }
      await requestPurchase({
        type: 'subs',
        request: { google: { skus: [SUB_ID], subscriptionOffers: [{ sku: SUB_ID, offerToken: price.offerToken }] } },
      });
    }
  } catch (e) {
    settle(isUserCancelledError(e) ? { kind: 'cancelled' } : { kind: 'error', message: BILLING_COPY.generic });
  }
  return done;
}

/** Development only: a fake purchase the server accepts when BILLING_FAKE=true. */
export async function simulatePurchase(plan: Plan): Promise<PurchaseOutcome> {
  if (!__DEV__) return { kind: 'error', message: BILLING_COPY.unavailable };
  const token = `fake:${plan}:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const status = await verify({
      productId: plan === 'lifetime' ? LIFETIME_ID : SUB_ID,
      purchaseToken: token,
      type: plan === 'lifetime' ? 'inapp' : 'subscription',
    });
    return { kind: 'success', status };
  } catch (e) {
    return { kind: 'error', message: verifyMessage(e) };
  }
}

export type RestoreOutcome = { kind: 'restored'; status: PlusStatus } | { kind: 'none' } | { kind: 'error'; message: string };

/** Re-send every Plus purchase this Google account holds to the server. */
export async function restore(): Promise<RestoreOutcome> {
  await initBilling();
  if (useBilling.getState().availability !== 'available') return { kind: 'error', message: BILLING_COPY.unavailable };
  let held: Purchase[];
  try {
    held = await getAvailablePurchases();
  } catch {
    return { kind: 'error', message: BILLING_COPY.generic };
  }
  const ours = held.filter((p) => isOurs(p.productId) && p.purchaseState === 'purchased' && p.purchaseToken);
  if (!ours.length) return { kind: 'none' };
  let last: PlusStatus | null = null;
  let error: string | null = null;
  for (const p of ours) {
    try {
      last = await verifyPurchase(p);
    } catch (e) {
      error = verifyMessage(e);
    }
  }
  if (last) return { kind: 'restored', status: last };
  return { kind: 'error', message: error ?? BILLING_COPY.generic };
}

export const MANAGE_SUBSCRIPTION_URL = `https://play.google.com/store/account/subscriptions?sku=${SUB_ID}&package=${ANDROID_PACKAGE}`;

/** Opens Google Play's subscription page for Tend Plus. */
export function manageSubscription() {
  Linking.openURL(MANAGE_SUBSCRIPTION_URL).catch(() => {});
}
