// Daily summary "journal page" (SPEC §4.14): a pure snapshot of one day built from real data,
// including the Highlights sentence and the plan for tomorrow.
import type { IconName } from '@/components/icons/paths';
import type { MoodId } from '@/theme/palette';
import { addDays, dateKey, daysBetween, formatClock, MONTHS, parseKey, todayKey, WEEKDAYS, weekdayMon } from './dates';
import {
  countOn, dayPercent, doneOn, habitsForDay, habitStreak, liveHabits, liveList, overallStreak, scheduledOn, tasksForDay, type Logs,
} from './selectors';
import type { Collections, FocusSession, Habit, Task } from './types';

/** A run of prose; `bold` spans render in the strong weight. */
export interface Span {
  text: string;
  bold?: boolean;
}

export interface SummaryTile {
  id: string;
  name: string;
  icon: IconName;
  hue: number;
  done: boolean;
}

export interface PlanRow {
  icon: IconName;
  /** Bold lead, e.g. "3 habits". */
  lead: string;
  /** Muted remainder after " · ". */
  detail: string;
}

export interface DaySummary {
  date: string;
  /** "Wednesday · Sep 23 · 9:40 PM" (time only when `date` is today); caption style uppercases it. */
  caption: string;
  /** 0–100, same formula as Home's day dial. */
  percent: number;
  streak: number;
  habitsDone: number;
  habitsTotal: number;
  tiles: SummaryTile[];
  focusSessions: number;
  focusMinutes: number;
  mood: MoodId | null;
  highlights: Span[];
  tomorrow: { weekday: string; habits: PlanRow; tasks: PlanRow; focus: PlanRow };
}

export interface SummaryInput extends Pick<Collections, 'habits' | 'habitLogs' | 'tasks' | 'focusSessions' | 'moodLogs'> {
  restDays: string[];
  /** Defaults to today. */
  date?: string;
  /** Clock used for the caption time; defaults to now. */
  now?: number;
}

const EARLY_HOUR = 8;
const STREAK_HIGHLIGHT_MIN = 7;
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
/** Leading verbs dropped when shortening names ("Drink water" → "Water"). */
const LEADING_VERBS = new Set(['drink', 'do', 'go', 'take', 'practice', 'practise', 'have', 'eat', 'get', 'make']);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ordinal(n: number): string {
  if (n < ORDINALS.length) return ORDINALS[n];
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** Short label for the Tomorrow list: first word, or the word after a leading verb. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && LEADING_VERBS.has(words[0].toLowerCase())) return capitalise(words[1]);
  return words[0];
}

const hourLabel = (hour: number) => formatClock(new Date(2000, 0, 1, hour).getTime());
const sessionDay = (s: FocusSession) => dateKey(new Date(s.start));
const completedFocus = (sessions: Record<string, FocusSession>) =>
  Object.values(sessions).filter((s) => !s.deleted && s.completed && s.mode === 'focus');

/** Consecutive days (ending on `date`) this habit was completed before 8 AM. */
function earlyRun(h: Habit, logs: Logs, date: string): number {
  let n = 0;
  for (let d = date; ; d = addDays(d, -1)) {
    const l = logs[`${h.id}:${d}`];
    if (!l || l.deleted || l.count < h.goal || l.completedAt == null) break;
    if (new Date(l.completedAt).getHours() >= EARLY_HOUR) break;
    n++;
  }
  return n;
}

function earlyHighlight(habits: Habit[], logs: Logs, date: string): Span[] | null {
  let best: { h: Habit; run: number } | null = null;
  for (const h of habits) {
    const run = earlyRun(h, logs, date);
    if (run > 0 && (!best || run > best.run)) best = { h, run };
  }
  if (!best) return null;
  const tail = best.run === 1 ? ' today.' : ` for the ${ordinal(best.run)} day running.`;
  return [{ text: `${best.h.name} done ` }, { text: `before ${EARLY_HOUR} AM`, bold: true }, { text: tail }];
}

function focusHighlight(sessions: FocusSession[], tasks: Record<string, Task>, date: string): Span[] | null {
  const week = sessions.filter((s) => {
    const diff = daysBetween(sessionDay(s), date);
    return diff >= 0 && diff < 7;
  });
  if (!week.length) return null;
  const top = week.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const task = top.taskId ? tasks[top.taskId] : undefined;
  const title = task && !task.deleted ? task.title : null;
  const mins = Math.round(top.minutes);
  return [
    { text: 'Your longest focus block this week — ' },
    { text: plural(mins, 'minute'), bold: true },
    { text: title ? ` on “${title}”.` : '.' },
  ];
}

function streakHighlight(habits: Habit[], logs: Logs, restDays: string[], date: string): Span[] | null {
  let best: { h: Habit; streak: number } | null = null;
  for (const h of habits) {
    const streak = habitStreak(h, logs, { restDays, today: date });
    if (streak >= STREAK_HIGHLIGHT_MIN && (!best || streak > best.streak)) best = { h, streak };
  }
  if (!best) return null;
  return [{ text: best.h.name, bold: true }, { text: ' is on a ' }, { text: `${best.streak}-day streak`, bold: true }, { text: '.' }];
}

function fallbackHighlight(checkedIn: number): Span[] {
  if (!checkedIn) return [{ text: 'A quiet day, and that’s okay. Tomorrow is a fresh page.' }];
  return [{ text: 'You checked in on ' }, { text: plural(checkedIn, 'habit'), bold: true }, { text: ' today. Small steps count.' }];
}

/** Most common start hour of past focus sessions, or null with no history. */
export function bestFocusHour(sessions: FocusSession[]): number | null {
  if (!sessions.length) return null;
  const hours = Array<number>(24).fill(0);
  for (const s of sessions) hours[new Date(s.start).getHours()]++;
  return hours.indexOf(Math.max(...hours));
}

function tomorrowPlan(habits: Habit[], tasks: Task[], focus: FocusSession[], tomorrow: string): DaySummary['tomorrow'] {
  const hs = habits.filter((h) => scheduledOn(h, tomorrow));
  const names = hs.slice(0, 3).map((h) => shortName(h.name)).join(', ');
  const more = hs.length > 3 ? ` + ${hs.length - 3} more` : '';

  const ts = tasks
    .filter((t) => !t.deleted && !t.done && t.due === tomorrow)
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt - b.createdAt);

  // Planned sessions on tomorrow's tasks, or a single suggested one.
  const sessions = Math.max(1, ts.reduce((n, t) => n + t.focusSessions, 0));
  const hour = bestFocusHour(focus);

  return {
    weekday: WEEKDAYS[weekdayMon(tomorrow)],
    habits: hs.length
      ? { icon: 'habits', lead: plural(hs.length, 'habit'), detail: names + more }
      : { icon: 'habits', lead: 'No habits', detail: 'a rest day' },
    tasks: ts.length
      ? { icon: 'tasks', lead: plural(ts.length, 'task'), detail: `${ts[0].title} first` }
      : { icon: 'tasks', lead: 'No tasks', detail: 'nothing due yet' },
    focus: {
      icon: 'focus',
      lead: plural(sessions, 'focus session'),
      detail: hour == null ? 'whenever suits you' : `${hourLabel(hour)}, your best window`,
    },
  };
}

export function buildSummary({ habits: habitsMap, habitLogs: logs, tasks: tasksMap, focusSessions, moodLogs, restDays, date = todayKey(), now = Date.now() }: SummaryInput): DaySummary {
  const all = liveHabits(habitsMap);
  const day = habitsForDay(all, logs, date);
  const tasks = liveList(tasksMap);
  const focus = completedFocus(focusSessions);
  const todays = focus.filter((s) => sessionDay(s) === date);

  const d = parseKey(date);
  const time = date === dateKey(new Date(now)) ? ` · ${formatClock(now)}` : '';
  const caption = `${WEEKDAYS[weekdayMon(date)]} · ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}${time}`;

  const doneList = day.filter((h) => doneOn(logs, h, date));
  const picked = [earlyHighlight(doneList, logs, date), focusHighlight(focus, tasksMap, date), streakHighlight(day, logs, restDays, date)]
    .filter((p): p is Span[] => p !== null)
    .slice(0, 2);
  const highlights = picked.length
    ? picked.flatMap((p, i) => (i ? [{ text: ' ' }, ...p] : p))
    : fallbackHighlight(day.filter((h) => countOn(logs, h.id, date) > 0).length);

  const mood = moodLogs[date];

  return {
    date,
    caption,
    percent: dayPercent(all, logs, tasksForDay(tasks, date), date),
    streak: overallStreak(all, logs, { restDays, today: date }).current,
    habitsDone: doneList.length,
    habitsTotal: day.length,
    tiles: day.map((h) => ({ id: h.id, name: h.name, icon: h.icon, hue: h.hue, done: doneOn(logs, h, date) })),
    focusSessions: todays.length,
    focusMinutes: todays.reduce((m, s) => m + s.minutes, 0),
    mood: mood && !mood.deleted ? mood.mood : null,
    highlights,
    tomorrow: tomorrowPlan(all, tasks, focus, addDays(date, 1)),
  };
}
