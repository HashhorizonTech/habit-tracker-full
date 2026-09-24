// Pure derived data (SPEC §6): scheduling, progress, streaks, rates, heatmap and
// per-habit stats. Everything takes plain data so it's cheap to memoise and test.
import { addDays, daysBetween, formatClock, parseKey, startOfMonth, startOfWeek, todayKey, weekdayMon, WEEKDAYS } from './dates';
import type { Collections, Frequency, Habit, HabitLog, Task } from './types';

export type Logs = Record<string, HabitLog>;

export const liveHabits = (habits: Record<string, Habit>) =>
  Object.values(habits).filter((h) => !h.deleted).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

export const countOn = (logs: Logs, habitId: string, date: string) => {
  const l = logs[`${habitId}:${date}`];
  return l && !l.deleted ? l.count : 0;
};

export const doneOn = (logs: Logs, h: Habit, date: string) => countOn(logs, h.id, date) >= h.goal;

export const progressOn = (logs: Logs, h: Habit, date: string) => Math.min(1, countOn(logs, h.id, date) / Math.max(1, h.goal));

const createdKey = (h: Habit) => {
  const d = new Date(h.createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Is the habit on the agenda for `date`? Daily and weekly/monthly habits appear every day
 * (weekly/monthly are satisfied by the period target); specific days and every-N-days
 * appear only on their days.
 */
export function scheduledOn(h: Habit, date: string): boolean {
  if (daysBetween(createdKey(h), date) < 0) return false;
  const f = h.frequency;
  switch (f.type) {
    case 'days':
      return !!f.days?.[weekdayMon(date)];
    case 'custom':
      return daysBetween(createdKey(h), date) % Math.max(1, f.every ?? 1) === 0;
    default:
      return true;
  }
}

/** Habits shown on Today: scheduled for the day, or already checked in on it. */
export const habitsForDay = (habits: Habit[], logs: Logs, date: string) =>
  habits.filter((h) => scheduledOn(h, date) || countOn(logs, h.id, date) > 0);

function periodMet(h: Habit, logs: Logs, date: string, weekStart: 'Mon' | 'Sun'): boolean {
  const f = h.frequency;
  const target = Math.max(1, f.times ?? 1);
  const start = f.type === 'weekly' ? startOfWeek(date, weekStart) : startOfMonth(date);
  const len = f.type === 'weekly' ? 7 : 31;
  let done = 0;
  for (let i = 0; i < len; i++) {
    const d = addDays(start, i);
    if (f.type === 'monthly' && d.slice(0, 7) !== date.slice(0, 7)) break;
    if (doneOn(logs, h, d)) done++;
  }
  return done >= target;
}

export interface StreakOpts {
  restDays?: string[];
  today?: string;
  weekStart?: 'Mon' | 'Sun';
}

/**
 * Per-habit streak = completed scheduled days in a row, walking back from today.
 * Today only adds (never breaks), unscheduled days and protected rest days are skipped,
 * and for weekly/monthly habits a quiet day only breaks the run if that period missed its target.
 */
export function habitStreak(h: Habit, logs: Logs, { restDays = [], today = todayKey(), weekStart = 'Mon' }: StreakOpts = {}): number {
  const rest = new Set(restDays);
  const periodic = h.frequency.type === 'weekly' || h.frequency.type === 'monthly';
  const created = createdKey(h);
  let streak = 0;
  for (let d = today; daysBetween(created, d) >= 0; d = addDays(d, -1)) {
    if (doneOn(logs, h, d)) {
      streak++;
      continue;
    }
    if (d === today || !scheduledOn(h, d) || rest.has(d)) continue;
    if (periodic) {
      const inCurrent = h.frequency.type === 'weekly' ? startOfWeek(d, weekStart) === startOfWeek(today, weekStart) : d.slice(0, 7) === today.slice(0, 7);
      if (inCurrent || periodMet(h, logs, d, weekStart)) continue;
    }
    break;
  }
  return streak;
}

/** Longest run for a habit using the same rules, scanning its whole history. */
export function habitLongest(h: Habit, logs: Logs, { restDays = [], today = todayKey(), weekStart = 'Mon' }: StreakOpts = {}): number {
  const rest = new Set(restDays);
  const periodic = h.frequency.type === 'weekly' || h.frequency.type === 'monthly';
  let best = 0;
  let run = 0;
  for (let d = createdKey(h); daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    if (doneOn(logs, h, d)) {
      run++;
      best = Math.max(best, run);
      continue;
    }
    if (d === today || !scheduledOn(h, d) || rest.has(d)) continue;
    if (periodic && periodMet(h, logs, d, weekStart)) continue;
    run = 0;
  }
  return best;
}

/** Share of scheduled habits completed on a day (habits only), 0–1; null if nothing scheduled. */
export function habitDayScore(habits: Habit[], logs: Logs, date: string): number | null {
  const list = habits.filter((h) => scheduledOn(h, date));
  if (!list.length) return null;
  return list.reduce((a, h) => a + progressOn(logs, h, date), 0) / list.length;
}

/** A day counts toward the overall streak when more than half of its habits are done. */
export const dayCounts = (habits: Habit[], logs: Logs, date: string) => {
  const list = habits.filter((h) => scheduledOn(h, date));
  if (!list.length) return null;
  return list.filter((h) => doneOn(logs, h, date)).length / list.length > 0.5;
};

export interface Run {
  start: string;
  end: string;
  length: number;
}

/** All overall-streak runs, oldest first. Rest days and empty days neither count nor break. */
export function dayRuns(habits: Habit[], logs: Logs, { restDays = [], today = todayKey() }: StreakOpts = {}): Run[] {
  if (!habits.length) return [];
  const rest = new Set(restDays);
  const first = habits.map(createdKey).sort()[0];
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let d = first; daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    const c = dayCounts(habits, logs, d);
    if (c) {
      if (cur) {
        cur.end = d;
        cur.length++;
      } else cur = { start: d, end: d, length: 1 };
    } else if (c === false && !rest.has(d) && d !== today) {
      if (cur) runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

export function overallStreak(habits: Habit[], logs: Logs, opts: StreakOpts = {}) {
  const today = opts.today ?? todayKey();
  const runs = dayRuns(habits, logs, opts);
  const last = runs[runs.length - 1];
  // The current run must reach today or yesterday (today may still be in progress);
  // protected rest days and days with nothing scheduled in between don't cut it off.
  const rest = new Set(opts.restDays ?? []);
  let alive = !!last;
  if (last) {
    for (let d = addDays(last.end, 1); daysBetween(d, today) > 0; d = addDays(d, 1)) {
      if (!rest.has(d) && dayCounts(habits, logs, d) !== null) {
        alive = false;
        break;
      }
    }
  }
  const current = alive && last ? last.length : 0;
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return { current, longest, runs };
}

/** Completed / scheduled days over the last `window` days of the habit's life. */
export function completionRate(h: Habit, logs: Logs, today = todayKey(), window = 90): number {
  let sched = 0;
  let done = 0;
  for (let i = 1; i <= window; i++) {
    const d = addDays(today, -i);
    if (daysBetween(createdKey(h), d) < 0) break;
    if (h.frequency.type === 'weekly' || h.frequency.type === 'monthly') continue;
    if (!scheduledOn(h, d)) continue;
    sched++;
    if (doneOn(logs, h, d)) done++;
  }
  if (h.frequency.type === 'weekly' || h.frequency.type === 'monthly') {
    // Rate = share of periods that met their target.
    const per = h.frequency.type === 'weekly' ? 7 : 30;
    let periods = 0;
    let met = 0;
    for (let i = 1; i * per <= window; i++) {
      const d = addDays(today, -i * per);
      if (daysBetween(createdKey(h), d) < 0) break;
      periods++;
      if (periodMet(h, logs, d, 'Mon')) met++;
    }
    return periods ? Math.round((met / periods) * 100) : 0;
  }
  return sched ? Math.round((done / sched) * 100) : 0;
}

export const totalCompletions = (h: Habit, logs: Logs) =>
  Object.values(logs).filter((l) => l.habitId === h.id && !l.deleted && l.count >= h.goal).length;

export type WeekCell = { label: string; date: string; state: 'done' | 'missed' | 'today' | 'future' | 'off'; isToday: boolean };

/** M–S row for the Habits list (SPEC §4.4). */
export function weekRow(h: Habit, logs: Logs, weekStart: 'Mon' | 'Sun' = 'Mon', today = todayKey()): WeekCell[] {
  const start = startOfWeek(today, weekStart);
  const labels = weekStart === 'Mon' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return labels.map((label, i) => {
    const date = addDays(start, i);
    const diff = daysBetween(today, date);
    const done = doneOn(logs, h, date);
    let state: WeekCell['state'];
    if (diff > 0) state = 'future';
    else if (done) state = 'done';
    else if (diff === 0) state = 'today';
    else state = scheduledOn(h, date) && h.frequency.type !== 'weekly' && h.frequency.type !== 'monthly' ? 'missed' : 'off';
    return { label, date, state, isToday: diff === 0 };
  });
}

export function frequencyLabel(f: Frequency): string {
  switch (f.type) {
    case 'daily':
      return 'Daily';
    case 'days': {
      const d = f.days ?? [];
      if (d.slice(0, 5).every(Boolean) && !d[5] && !d[6]) return 'Weekdays';
      if (!d.slice(0, 5).some(Boolean) && d[5] && d[6]) return 'Weekends';
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((_, i) => d[i]).join(' · ') || 'Pick some days';
    }
    case 'weekly':
      return `${f.times ?? 1}× a week`;
    case 'monthly':
      return `${f.times ?? 1}× a month`;
    case 'custom':
      return `Every ${f.every ?? 2} days`;
  }
}

/** 18 weeks × 7 days of levels 0–4, Monday-first columns ending this week (SPEC §4.6). */
export function heatmap(h: Habit, logs: Logs, today = todayKey(), weeks = 18) {
  const end = addDays(startOfWeek(today), 6);
  const start = addDays(end, -(weeks * 7 - 1));
  const cols: { date: string; level: number; future: boolean }[][] = [];
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const future = daysBetween(today, date) > 0;
      const p = progressOn(logs, h, date);
      const level = future || p === 0 ? 0 : p >= 1 ? 4 : p >= 0.66 ? 3 : p >= 0.33 ? 2 : 1;
      col.push({ date, level, future });
    }
    const first = col[0].date;
    const monthStart = col.find((c) => c.date.endsWith('-01'));
    if (w === 0 || monthStart) months.push({ col: w, label: parseKey(monthStart?.date ?? first).toLocaleString('en', { month: 'short' }) });
    cols.push(col);
  }
  return { cols, months };
}

/** Completion rate by weekday (Mon-first) over the last `window` days. */
export function byWeekday(h: Habit, logs: Logs, today = todayKey(), window = 84) {
  const sched = Array(7).fill(0);
  const done = Array(7).fill(0);
  for (let i = 1; i <= window; i++) {
    const d = addDays(today, -i);
    if (!scheduledOn(h, d)) continue;
    const wd = weekdayMon(d);
    sched[wd]++;
    if (doneOn(logs, h, d)) done[wd]++;
  }
  const rates = sched.map((s, i) => (s ? Math.round((done[i] / s) * 100) : 0));
  const best = rates.indexOf(Math.max(...rates));
  return { rates, best, bestLabel: WEEKDAYS[best] };
}

/** Most common completion hour → "7–8 AM". */
export function bestTime(h: Habit, logs: Logs): string | null {
  const hours = Array(24).fill(0);
  for (const l of Object.values(logs)) if (l.habitId === h.id && l.completedAt && !l.deleted) hours[new Date(l.completedAt).getHours()]++;
  const max = Math.max(...hours);
  if (!max) return null;
  const hr = hours.indexOf(max);
  const fmt = (x: number) => `${x % 12 || 12}`;
  const ap = (x: number) => (x < 12 ? 'AM' : 'PM');
  return ap(hr) === ap(hr + 1) ? `${fmt(hr)}–${fmt(hr + 1)} ${ap(hr)}` : `${fmt(hr)} ${ap(hr)}–${fmt(hr + 1)} ${ap(hr + 1)}`;
}

export const timeBucket = (h: Habit, logs: Logs): 'morning' | 'afternoon' | 'evening' | null => {
  let m = 0, a = 0, e = 0;
  for (const l of Object.values(logs)) {
    if (l.habitId !== h.id || !l.completedAt || l.deleted) continue;
    const hr = new Date(l.completedAt).getHours();
    if (hr < 12) m++;
    else if (hr < 17) a++;
    else e++;
  }
  if (!m && !a && !e) return null;
  return m >= a && m >= e ? 'morning' : a >= e ? 'afternoon' : 'evening';
};

/** Monthly completion % for the last `n` months (oldest first). */
export function monthlyCompletion(h: Habit, logs: Logs, today = todayKey(), n = 6) {
  const out: { label: string; pct: number }[] = [];
  const t = parseKey(today);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    let sched = 0, done = 0;
    for (let d = 1; d <= 31; d++) {
      const date = `${key}-${String(d).padStart(2, '0')}`;
      if (parseKey(date).getMonth() !== m.getMonth() || daysBetween(today, date) >= 0) continue;
      if (!scheduledOn(h, date)) continue;
      sched++;
      if (doneOn(logs, h, date)) done++;
    }
    out.push({ label: m.toLocaleString('en', { month: 'short' }), pct: sched ? Math.round((done / sched) * 100) : 0 });
  }
  return out;
}

/** Last `n` days (today first) with status for the History list. */
export function history(h: Habit, logs: Logs, today = todayKey(), n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, -i);
    const l = logs[`${h.id}:${date}`];
    const count = l && !l.deleted ? l.count : 0;
    return { date, count, done: count >= h.goal, time: l?.completedAt ? formatClock(l.completedAt) : null, scheduled: scheduledOn(h, date) };
  });
}

/** Day % for Home (SPEC §4.3): (Σ habit progress + tasks done) / (habits + tasks). */
export function dayPercent(habits: Habit[], logs: Logs, tasks: Task[], date = todayKey()) {
  const hs = habitsForDay(habits, logs, date);
  const ts = tasksForDay(tasks, date);
  const sum = hs.reduce((a, h) => a + progressOn(logs, h, date), 0) + ts.filter((t) => t.done).length;
  const n = hs.length + ts.length;
  return n ? Math.round((sum / n) * 100) : 0;
}

/** Today's tasks: list 'today' (or due today) and not deleted. */
export const tasksForDay = (tasks: Task[], date = todayKey()) =>
  tasks.filter((t) => !t.deleted && (t.due ? t.due === date : t.list === 'today'));

export const liveList = <T extends { deleted: boolean }>(col: Record<string, T>) => Object.values(col).filter((r) => !r.deleted);

/** Minutes of completed focus sessions on a day. */
export function focusMinutesOn(sessions: Collections['focusSessions'], date = todayKey()) {
  let min = 0, count = 0;
  for (const s of Object.values(sessions)) {
    if (s.deleted || !s.completed || s.mode !== 'focus') continue;
    const d = new Date(s.start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (key === date) {
      min += s.minutes;
      count++;
    }
  }
  return { minutes: min, count };
}

/** Consecutive days (ending today or yesterday) with at least one completed focus session. */
export function focusStreak(sessions: Collections['focusSessions'], today = todayKey()): number {
  const days = new Set<string>();
  for (const s of Object.values(sessions)) {
    if (s.deleted || !s.completed || s.mode !== 'focus') continue;
    const d = new Date(s.start);
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
