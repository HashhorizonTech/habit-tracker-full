import type { EntitlementSource, PlusStatus } from '../api/types';

const LOCALE = 'en-IN';

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const numberFmt = new Intl.NumberFormat(LOCALE);
const inrFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const relFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export const formatDate = (ms: number) => dateFmt.format(ms);
export const formatShortDate = (ms: number) => shortDateFmt.format(ms);
export const formatDateTime = (ms: number) => dateTimeFmt.format(ms);
export const formatNumber = (n: number) => numberFmt.format(n);
export const formatInr = (n: number) => inrFmt.format(n);

/** `YYYY-MM-DD` → "12 Oct" (parsed as a local calendar date). */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return shortDateFmt.format(new Date(y, m - 1, d));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600e3],
  ['month', 30 * 24 * 3600e3],
  ['week', 7 * 24 * 3600e3],
  ['day', 24 * 3600e3],
  ['hour', 3600e3],
  ['minute', 60e3],
];

export function formatRelative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return relFmt.format(Math.round(diff / size), unit);
  }
  return 'just now';
}

export const SOURCE_LABEL: Record<EntitlementSource, string> = {
  play_subscription: 'Play subscription',
  play_lifetime: 'Play lifetime',
  admin: 'Admin grant',
  trial: 'Trial',
};

const PLAN_LABEL: Record<string, string> = { monthly: 'Monthly', yearly: 'Yearly' };

export function planName(basePlanId: string | null, productId: string | null, expiresAt: number | null): string {
  if (productId === 'plus_lifetime' || expiresAt === null) return 'Lifetime';
  if (basePlanId) return PLAN_LABEL[basePlanId] ?? basePlanId;
  return '—';
}

export function humanize(code: string): string {
  const s = code.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Free / Plus · Yearly / Plus · Admin until 12 Oct / Lifetime */
export function plusLabel(p: PlusStatus): { label: string; tone: 'free' | 'plus' | 'lifetime' } {
  if (!p.active) return { label: 'Free', tone: 'free' };
  if (p.source === 'play_lifetime' || p.expiresAt === null) return { label: 'Lifetime', tone: 'lifetime' };
  const until = formatShortDate(p.expiresAt);
  switch (p.source) {
    case 'play_subscription':
      return { label: `Plus · ${planName(p.basePlanId, p.productId, p.expiresAt)}`, tone: 'plus' };
    case 'admin':
      return { label: `Plus · Admin until ${until}`, tone: 'plus' };
    case 'trial':
      return { label: `Plus · Trial until ${until}`, tone: 'plus' };
    default:
      return { label: 'Plus', tone: 'plus' };
  }
}
