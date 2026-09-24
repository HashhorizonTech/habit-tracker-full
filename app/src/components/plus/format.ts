import { MONTHS } from '@/data/dates';
import type { PlusStatus } from '@/store/plus';

/** "Yearly", "Monthly", "Lifetime", … */
export function planLabel(s: PlusStatus): string {
  if (s.source === 'play_lifetime' || s.productId === 'plus_lifetime') return 'Lifetime';
  if (s.basePlanId === 'yearly') return 'Yearly';
  if (s.basePlanId === 'monthly') return 'Monthly';
  if (s.source === 'admin') return 'Gifted';
  if (s.source === 'trial') return 'Trial';
  return 'Plus';
}

/** "12 Oct" (adds the year when it isn't this year). */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "renews 12 Oct" / "ends 12 Oct" / "yours for good". */
export function renewalLabel(s: PlusStatus): string {
  if (s.expiresAt == null) return 'yours for good';
  return `${s.autoRenew ? 'renews' : 'ends'} ${shortDate(s.expiresAt)}`;
}

/** "Plus · Yearly · renews 12 Oct". */
export function plusSummary(s: PlusStatus): string {
  const plan = planLabel(s);
  return plan === 'Plus' ? `Plus · ${renewalLabel(s)}` : `Plus · ${plan} · ${renewalLabel(s)}`;
}

/** Google Play subscriptions can be managed in the Play Store. */
export const isPlaySubscription = (s: PlusStatus) => s.source === 'play_subscription';
