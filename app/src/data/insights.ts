// Insights aggregation (SPEC §4.10). Pure functions over plain data, so the screen can
// memoise them; every range is split into chart buckets that end today.
import { addDays, daysBetween, parseKey, todayKey, weekdayMon } from './dates';
import { doneOn, focusMinutesOn, liveHabits, overallStreak, scheduledOn, type Logs } from './selectors';
import type { Category, Collections, FocusSession, Habit, MoodLog, Task } from './types';
import type { MoodId } from '@/theme/palette';

export type Range = '7D' | '30D' | '3M' | '1Y';
export const RANGES: Range[] = ['7D', '30D', '3M', '1Y'];

export const RANGE_LABEL: Record<Range, string> = { '7D': 'This week', '30D': 'Last 30 days', '3M': 'Last 3 months', '1Y': 'This year' };
export const RANGE_VS: Record<Range, string> = { '7D': 'last week', '30D': 'last month', '3M': 'previous 3 months', '1Y': 'last year' };

/** Inclusive date span (YYYY-MM-DD) with its axis label. */
export interface Bucket {
  start: string;
  end: string;
  label: string;
}

const DOW_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const monthShort = (key: string) => parseKey(key).toLocaleString('en', { month: 'short' });
const keyOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const inSpan = (d: string, b: { start: string; end: string }) => d >= b.start && d <= b.end;

/**
 * Chart buckets for a range, oldest first: 7 days, 30 days, 13 weeks or 12 calendar months.
 * `shift` moves the whole window back by one range (for "vs last week" comparisons).
 */
export function rangeBuckets(range: Range, today = todayKey(), shift = 0): Bucket[] {
  if (range === '1Y') {
    const t = parseKey(today);
    return Array.from({ length: 12 }, (_, i) => {
      const m = new Date(t.getFullYear(), t.getMonth() - 11 + i - shift * 12, 1);
      const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const start = keyOf(m.getTime());
      const end = keyOf(last.getTime());
      return { start, end: end > today ? today : end, label: MONTH_LETTER[m.getMonth()] };
    });
  }
  const days = range === '7D' ? 7 : range === '30D' ? 30 : 91;
  const end = addDays(today, -shift * days);
  if (range === '3M') {
    return Array.from({ length: 13 }, (_, i) => {
      const e = addDays(end, -(12 - i) * 7);
      return { start: addDays(e, -6), end: e, label: i % 3 === 0 ? `W${i + 1}` : '' };
    });
  }
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(end, -(days - 1 - i));
    const label = range === '7D' ? DOW_LETTER[weekdayMon(d)] : i % 5 === 0 ? String(parseKey(d).getDate()) : '';
    return { start: d, end: d, label };
  });
}

const spanOf = (buckets: Bucket[]) => ({ start: buckets[0].start, end: buckets[buckets.length - 1].end });

const forEachDay = (b: { start: string; end: string }, fn: (d: string) => void) => {
  for (let d = b.start; daysBetween(d, b.end) >= 0; d = addDays(d, 1)) fn(d);
};

/** Expected / done completions. Weekly and monthly habits expect `times` per period, spread per day. */
interface Tally {
  sched: number;
  done: number;
}

function tallyHabits(habits: Habit[], logs: Logs, b: { start: string; end: string }): Tally {
  const t: Tally = { sched: 0, done: 0 };
  forEachDay(b, (d) => {
    for (const h of habits) {
      if (!scheduledOn(h, d)) continue;
      const f = h.frequency;
      const done = doneOn(logs, h, d);
      if (f.type === 'weekly' || f.type === 'monthly') {
        t.sched += Math.max(1, f.times ?? 1) / (f.type === 'weekly' ? 7 : 30);
        if (done) t.done++;
      } else {
        t.sched++;
        if (done) t.done++;
      }
    }
  });
  return t;
}

/** 0–100, or null when nothing was scheduled. */
const pctOf = (t: Tally) => (t.sched > 0 ? Math.round(Math.min(1, t.done / t.sched) * 100) : null);

const focusSessions = (sessions: Collections['focusSessions']) =>
  Object.values(sessions).filter((s) => !s.deleted && s.completed && s.mode === 'focus');

const doneTasks = (tasks: Collections['tasks']) => Object.values(tasks).filter((t): t is Task & { doneAt: number } => !t.deleted && t.done && t.doneAt != null);

export interface CategoryPerf {
  category: Category;
  pct: number;
  hue: number;
}

export interface StreakRunBar {
  label: string;
  length: number;
  current: boolean;
  longest: boolean;
}

export interface MoodInsight {
  habitName: string;
  withPct: number;
  withoutPct: number;
}

export interface HabitInsights {
  /** null when no habit was scheduled in the range. */
  consistency: number | null;
  /** Percentage points vs the previous equal range; null without a comparison. */
  delta: number | null;
  bars: number[];
  labels: string[];
  currentStreak: number;
  longestStreak: number;
  focusMinutes: number;
  tasksDone: number;
  /** Habits + tasks completion per point, ≤ 12 points. */
  trend: number[];
  categories: CategoryPerf[];
  runs: StreakRunBar[];
  mood: MoodInsight | null;
}

/** Trend points: group buckets so the line never has more than 12 points. */
function trendSpans(range: Range, buckets: Bucket[]): { start: string; end: string }[] {
  if (range === '3M') return buckets.slice(-12);
  if (range !== '30D') return buckets;
  return Array.from({ length: 10 }, (_, i) => ({ start: buckets[i * 3].start, end: buckets[i * 3 + 2].end }));
}

/** Streak runs worth showing: the last five (always including the longest), oldest first. */
function streakRuns(habits: Habit[], logs: Logs, restDays: string[], today: string) {
  const { current, longest, runs } = overallStreak(habits, logs, { restDays, today });
  const last = runs[runs.length - 1];
  const tagged = runs
    .map((r) => ({ r, current: current > 0 && r === last }))
    .filter((x) => x.r.length >= 2 || x.current);
  let shown = tagged.slice(-5);
  const best = tagged.find((x) => x.r.length === longest);
  if (best && !shown.includes(best)) shown = [best, ...shown.slice(1)];
  let longestMarked = false;
  const bars: StreakRunBar[] = shown.map(({ r, current: cur }) => {
    const isLongest = !cur && !longestMarked && r.length === longest;
    if (isLongest) longestMarked = true;
    return { label: cur ? 'Now' : monthShort(r.start), length: r.length, current: cur, longest: isLongest };
  });
  return { current, longest: Math.max(longest, current), bars };
}

const MOOD_SCORE: Record<MoodId, number> = { great: 5, good: 4, okay: 3, low: 2, tired: 1 };
const MIN_MOOD_DAYS = 5;

/**
 * The habit whose completed days line up with the best moods, over the last year.
 * Ranked by average mood score (great 5 … tired 1) with vs without; reported as the share of
 * "good" or "great" days. Null until both sides have ≥ 5 logged moods.
 */
export function moodInsight(habits: Habit[], logs: Logs, moods: Record<string, MoodLog>, today = todayKey()): MoodInsight | null {
  const from = addDays(today, -365);
  const days = Object.values(moods).filter((m) => !m.deleted && m.date >= from && m.date <= today);
  let best: (MoodInsight & { gap: number }) | null = null;
  for (const h of habits) {
    const side = { with: { n: 0, score: 0, good: 0 }, without: { n: 0, score: 0, good: 0 } };
    for (const m of days) {
      if (!scheduledOn(h, m.date)) continue;
      const s = doneOn(logs, h, m.date) ? side.with : side.without;
      s.n++;
      s.score += MOOD_SCORE[m.mood];
      if (m.mood === 'great' || m.mood === 'good') s.good++;
    }
    if (side.with.n < MIN_MOOD_DAYS || side.without.n < MIN_MOOD_DAYS) continue;
    const gap = side.with.score / side.with.n - side.without.score / side.without.n;
    const withPct = Math.round((side.with.good / side.with.n) * 100);
    const withoutPct = Math.round((side.without.good / side.without.n) * 100);
    if (gap <= 0 || withPct <= withoutPct) continue;
    if (!best || gap > best.gap) best = { habitName: h.name, withPct, withoutPct, gap };
  }
  return best && { habitName: best.habitName, withPct: best.withPct, withoutPct: best.withoutPct };
}

export interface InsightsInput {
  habits: Record<string, Habit>;
  logs: Logs;
  tasks: Collections['tasks'];
  sessions: Collections['focusSessions'];
  moods: Record<string, MoodLog>;
  restDays: string[];
  today?: string;
}

export function habitInsights(range: Range, { habits: map, logs, tasks, sessions, moods, restDays, today = todayKey() }: InsightsInput): HabitInsights {
  const habits = liveHabits(map);
  const buckets = rangeBuckets(range, today);
  const span = spanOf(buckets);
  const prevSpan = spanOf(rangeBuckets(range, today, 1));

  const consistency = pctOf(tallyHabits(habits, logs, span));
  const prev = pctOf(tallyHabits(habits, logs, prevSpan));
  const finished = doneTasks(tasks);
  const tasksIn = (b: { start: string; end: string }) => finished.filter((t) => inSpan(keyOf(t.doneAt), b)).length;
  // Open tasks that were due in the span count against it; nothing else can be "missed".
  const open = Object.values(tasks).filter((t) => !t.deleted && !t.done && t.due && t.due < today);

  const trend = trendSpans(range, buckets).map((b) => {
    const h = tallyHabits(habits, logs, b);
    const done = tasksIn(b);
    const missed = open.filter((t) => inSpan(t.due as string, b)).length;
    const total = h.sched + done + missed;
    return total > 0 ? Math.round(Math.min(1, (h.done + done) / total) * 100) : 0;
  });

  const byCat = new Map<Category, { hue: number; t: Tally }>();
  for (const h of habits) {
    const entry = byCat.get(h.category) ?? { hue: h.hue, t: { sched: 0, done: 0 } };
    const t = tallyHabits([h], logs, span);
    entry.t.sched += t.sched;
    entry.t.done += t.done;
    byCat.set(h.category, entry);
  }
  const categories = [...byCat.entries()]
    .map(([category, { hue, t }]) => ({ category, hue, pct: pctOf(t) }))
    .filter((x): x is CategoryPerf => x.pct != null)
    .sort((a, b) => b.pct - a.pct);

  const streaks = streakRuns(habits, logs, restDays, today);
  let focusMinutes = 0;
  for (const s of focusSessions(sessions)) if (inSpan(keyOf(s.start), span)) focusMinutes += s.minutes;

  return {
    consistency,
    delta: consistency != null && prev != null ? consistency - prev : null,
    bars: buckets.map((b) => pctOf(tallyHabits(habits, logs, b)) ?? 0),
    labels: buckets.map((b) => b.label),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    focusMinutes,
    tasksDone: tasksIn(span),
    trend,
    categories,
    runs: streaks.bars,
    mood: moodInsight(habits, logs, moods, today),
  };
}

export const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
export const hourLabel = (h: number) => (h % 3 === 0 ? (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`) : '');

const clock = (h: number) => `${h % 12 || 12}`;
const meridiem = (h: number) => (h % 24 < 12 ? 'AM' : 'PM');
/** Hours [from, to) → "9–11 AM" or "11 AM–1 PM". */
const hourSpan = (from: number, to: number) =>
  meridiem(from) === meridiem(to) ? `${clock(from)}–${clock(to)} ${meridiem(to)}` : `${clock(from)} ${meridiem(from)}–${clock(to)} ${meridiem(to)}`;

export interface FocusInsights {
  totalMinutes: number;
  /** % change vs the previous equal range; null when there was nothing to compare. */
  delta: number | null;
  bars: number[];
  labels: string[];
  todayMinutes: number;
  sessions: number;
  avgSession: number;
  /** Session starts per hour, 6 AM – 10 PM. */
  hours: number[];
  /** Indices into `hours` of the busiest 2–3 hour window. */
  peak: number[];
  peakLabel: string | null;
  /** Minutes longer that sessions before 11 AM run; null without enough sessions either side. */
  morningEdge: number | null;
}

const MIN_SIDE_SESSIONS = 3;

/** Busiest 2-hour window, widened to 3 when the neighbour is nearly as busy. */
function peakWindow(counts: number[]): number[] {
  let at = -1;
  let best = 0;
  let bestLow = 0;
  for (let i = 0; i < counts.length - 1; i++) {
    const s = counts[i] + counts[i + 1];
    const low = Math.min(counts[i], counts[i + 1]);
    // Ties go to the window whose quieter hour is busier.
    if (s > best || (s === best && s > 0 && low > bestLow)) {
      best = s;
      bestLow = low;
      at = i;
    }
  }
  if (at < 0) return [];
  const top = Math.max(counts[at], counts[at + 1]);
  const left = at > 0 ? counts[at - 1] : -1;
  const right = at + 2 < counts.length ? counts[at + 2] : -1;
  const side = Math.max(left, right);
  if (side > 0 && side >= top * 0.6) return right >= left ? [at, at + 1, at + 2] : [at - 1, at, at + 1];
  return [at, at + 1];
}

export function focusInsights(range: Range, sessionsMap: Collections['focusSessions'], today = todayKey()): FocusInsights {
  const buckets = rangeBuckets(range, today);
  const span = spanOf(buckets);
  const prevSpan = spanOf(rangeBuckets(range, today, 1));
  const all = focusSessions(sessionsMap);
  const inRange: FocusSession[] = [];
  let prevMinutes = 0;
  for (const s of all) {
    const d = keyOf(s.start);
    if (inSpan(d, span)) inRange.push(s);
    else if (inSpan(d, prevSpan)) prevMinutes += s.minutes;
  }
  const totalMinutes = inRange.reduce((a, s) => a + s.minutes, 0);

  const hours = HOURS.map(() => 0);
  const before = { n: 0, min: 0 };
  const after = { n: 0, min: 0 };
  for (const s of inRange) {
    const hr = new Date(s.start).getHours();
    if (hr >= HOURS[0] && hr <= HOURS[HOURS.length - 1]) hours[hr - HOURS[0]]++;
    const side = hr < 11 ? before : after;
    side.n++;
    side.min += s.minutes;
  }
  const peak = peakWindow(hours);
  const edge =
    before.n >= MIN_SIDE_SESSIONS && after.n >= MIN_SIDE_SESSIONS ? Math.round(before.min / before.n - after.min / after.n) : null;

  return {
    totalMinutes,
    delta: prevMinutes > 0 ? Math.round(((totalMinutes - prevMinutes) / prevMinutes) * 100) : null,
    bars: buckets.map((b) => inRange.reduce((a, s) => (inSpan(keyOf(s.start), b) ? a + s.minutes : a), 0)),
    labels: buckets.map((b) => b.label),
    todayMinutes: focusMinutesOn(sessionsMap, today).minutes,
    sessions: inRange.length,
    avgSession: inRange.length ? Math.round(totalMinutes / inRange.length) : 0,
    hours,
    peak,
    peakLabel: peak.length ? hourSpan(HOURS[peak[0]], HOURS[peak[peak.length - 1]] + 1) : null,
    morningEdge: edge,
  };
}

/** "3h 25m", "41h", "162h". */
export function formatFocusTotal(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m === 0 || h >= 40 ? `${h}h` : `${h}h ${m}m`;
}
