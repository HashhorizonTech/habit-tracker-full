// Calendar (SPEC §4.9): per-day summaries for a month and the month's stat strip.
// Pure functions over plain data so the screen can memoise per month.
import type { MoodId } from '@/theme/palette';
import { dateKey, daysBetween, parseKey, todayKey } from './dates';
import { dayPercent, doneOn, habitsForDay, progressOn, tasksForDay, type Logs } from './selectors';
import type { Collections, Habit, Task } from './types';

export interface CalendarData {
  /** Live habits (not deleted). */
  habits: Habit[];
  logs: Logs;
  /** Live tasks (not deleted). */
  tasks: Task[];
  focusSessions: Collections['focusSessions'];
  moodLogs: Collections['moodLogs'];
}

export interface CalendarDay {
  date: string;
  /** Day of month, 1–31. */
  day: number;
  /** On or before today (today counts as past, as in the prototype). */
  past: boolean;
  today: boolean;
  future: boolean;
  /** Day score 0–100, same formula as Home's day %. */
  pct: number;
  focusCount: number;
  focusMinutes: number;
  tasksDone: number;
  tasksTotal: number;
  habitsDone: number;
  habitsTotal: number;
  /** Completed habits, in habit order. */
  doneHabitIds: string[];
  mood: MoodId | null;
  /** Anything recorded: a check-in, a task done, a focus session or a mood. */
  logged: boolean;
}

export interface MonthStats {
  /** Mean day % over past days that had something on the agenda; null when none. */
  avgPct: number | null;
  focusMinutes: number;
  daysLogged: number;
}

export interface YearMonth {
  year: number;
  /** 0-based. */
  month: number;
}

const keyOf = (ms: number) => dateKey(new Date(ms));

export const daysInMonth = ({ year, month }: YearMonth) => new Date(year, month + 1, 0).getDate();

export const addMonths = ({ year, month }: YearMonth, n: number): YearMonth => {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/** Negative when a is before b. */
export const compareMonths = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month - (b.year * 12 + b.month);

export const monthOf = (key: string): YearMonth => {
  const d = parseKey(key);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/** Blank cells before day 1 for a Monday- or Sunday-first grid. */
export function leadingBlanks({ year, month }: YearMonth, weekStart: 'Mon' | 'Sun'): number {
  const wd = new Date(year, month, 1).getDay();
  return weekStart === 'Mon' ? (wd + 6) % 7 : wd;
}

export const weekdayLabels = (weekStart: 'Mon' | 'Sun') =>
  weekStart === 'Mon' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month holding the oldest record (habit created, check-in, task, session, mood); today's month if none. */
export function earliestMonth(data: CalendarData, today = todayKey()): YearMonth {
  let min = today;
  const take = (k: string) => {
    if (k < min) min = k;
  };
  for (const h of data.habits) take(keyOf(h.createdAt));
  for (const l of Object.values(data.logs)) if (!l.deleted && l.count > 0) take(l.date);
  for (const t of data.tasks) {
    if (t.due) take(t.due);
    if (t.doneAt) take(keyOf(t.doneAt));
  }
  for (const s of Object.values(data.focusSessions)) if (!s.deleted && s.completed && s.mode === 'focus') take(keyOf(s.start));
  for (const m of Object.values(data.moodLogs)) if (!m.deleted) take(m.date);
  return monthOf(min);
}

interface Buckets {
  focus: Map<string, { minutes: number; count: number }>;
  /** Tasks relevant to a past date: due that day, or completed that day. */
  tasks: Map<string, Task[]>;
  checkedIn: Set<string>;
}

/** Group sessions, tasks and check-ins by date once, restricted to a date range. */
function bucket(data: CalendarData, from: string, to: string): Buckets {
  const inRange = (k: string) => k >= from && k <= to;
  const focus: Buckets['focus'] = new Map();
  for (const s of Object.values(data.focusSessions)) {
    if (s.deleted || !s.completed || s.mode !== 'focus') continue;
    const k = keyOf(s.start);
    if (!inRange(k)) continue;
    const f = focus.get(k) ?? { minutes: 0, count: 0 };
    f.minutes += s.minutes;
    f.count++;
    focus.set(k, f);
  }
  const tasks: Buckets['tasks'] = new Map();
  const add = (k: string, t: Task) => {
    const list = tasks.get(k);
    if (!list) tasks.set(k, [t]);
    else if (!list.includes(t)) list.push(t);
  };
  for (const t of data.tasks) {
    if (t.due && inRange(t.due)) add(t.due, t);
    if (t.done && t.doneAt) {
      const k = keyOf(t.doneAt);
      if (inRange(k)) add(k, t);
    }
  }
  const live = new Set(data.habits.map((h) => h.id));
  const checkedIn = new Set<string>();
  for (const l of Object.values(data.logs)) if (!l.deleted && l.count > 0 && live.has(l.habitId) && inRange(l.date)) checkedIn.add(l.date);
  return { focus, tasks, checkedIn };
}

/** A past task counts as done on the day it was completed (or its due day when no timestamp). */
const doneOnDay = (t: Task, date: string) => t.done && (t.doneAt ? keyOf(t.doneAt) === date : t.due === date);

function summarise(data: CalendarData, date: string, today: string, b: Buckets): CalendarDay {
  const diff = daysBetween(today, date);
  const base = { date, day: parseKey(date).getDate(), past: diff <= 0, today: diff === 0, future: diff > 0 };
  if (base.future) {
    return { ...base, pct: 0, focusCount: 0, focusMinutes: 0, tasksDone: 0, tasksTotal: 0, habitsDone: 0, habitsTotal: 0, doneHabitIds: [], mood: null, logged: false };
  }
  const habits = habitsForDay(data.habits, data.logs, date);
  const doneHabitIds = habits.filter((h) => doneOn(data.logs, h, date)).map((h) => h.id);
  // Today mirrors Home exactly; earlier days use tasks due or completed that day.
  const tasks = base.today ? tasksForDay(data.tasks, date) : (b.tasks.get(date) ?? []);
  const tasksDone = base.today ? tasks.filter((t) => t.done).length : tasks.filter((t) => doneOnDay(t, date)).length;
  const n = habits.length + tasks.length;
  const pct = base.today
    ? dayPercent(data.habits, data.logs, data.tasks, date)
    : n
      ? Math.round(((habits.reduce((a, h) => a + progressOn(data.logs, h, date), 0) + tasksDone) / n) * 100)
      : 0;
  const focus = b.focus.get(date) ?? { minutes: 0, count: 0 };
  const moodLog = data.moodLogs[date];
  const mood = moodLog && !moodLog.deleted ? moodLog.mood : null;
  const doneAnyTask = (b.tasks.get(date) ?? []).some((t) => doneOnDay(t, date));
  return {
    ...base,
    pct,
    focusCount: focus.count,
    focusMinutes: focus.minutes,
    tasksDone,
    tasksTotal: tasks.length,
    habitsDone: doneHabitIds.length,
    habitsTotal: habits.length,
    doneHabitIds,
    mood,
    logged: b.checkedIn.has(date) || doneAnyTask || focus.count > 0 || mood != null,
  };
}

/** Every day of a month, in order. */
export function monthDays(data: CalendarData, ym: YearMonth, today = todayKey()): CalendarDay[] {
  const n = daysInMonth(ym);
  const first = dateKey(new Date(ym.year, ym.month, 1));
  const last = dateKey(new Date(ym.year, ym.month, n));
  const b = bucket(data, first, last);
  return Array.from({ length: n }, (_, i) => summarise(data, dateKey(new Date(ym.year, ym.month, i + 1)), today, b));
}

/** One day's summary (for the day sheet). */
export function daySummary(data: CalendarData, date: string, today = todayKey()): CalendarDay {
  return summarise(data, date, today, bucket(data, date, date));
}

export function monthStats(days: CalendarDay[]): MonthStats {
  let scored = 0;
  let sum = 0;
  let focusMinutes = 0;
  let daysLogged = 0;
  for (const d of days) {
    if (!d.past) continue;
    if (d.habitsTotal + d.tasksTotal > 0) {
      scored++;
      sum += d.pct;
    }
    focusMinutes += d.focusMinutes;
    if (d.logged) daysLogged++;
  }
  return { avgPct: scored ? Math.round(sum / scored) : null, focusMinutes, daysLogged };
}

