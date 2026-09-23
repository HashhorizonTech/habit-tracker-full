// Local-calendar date helpers. Dates are 'YYYY-MM-DD' in the device's time zone.
const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export const todayKey = () => dateKey();

/** Whole days from a → b (b later ⇒ positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export const weekdayMon = (key: string) => (parseKey(key).getDay() + 6) % 7;

/** Monday of the week containing `key` (or Sunday when weekStart is 'Sun'). */
export function startOfWeek(key: string, weekStart: 'Mon' | 'Sun' = 'Mon'): string {
  const wd = weekStart === 'Mon' ? weekdayMon(key) : parseKey(key).getDay();
  return addDays(key, -wd);
}

export const startOfMonth = (key: string) => key.slice(0, 8) + '01';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "WEDNESDAY · SEPTEMBER 23" source text (caption style uppercases it). */
export function longDate(d: Date = new Date()) {
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function greeting(d: Date = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatClock(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 70 → "1h 10m", 25 → "25m". */
export const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
