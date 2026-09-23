// "Load demo data" (SPEC §7): Ravi's account from the screenshots, generated relative
// to today so it never goes stale. ~200 days of history, shaped so the derived numbers
// match the design (overall streak 12 / longest 37, Water 12, Read 21, Workout 7, Coding 9).
import { defaultProfile, newId } from '@/store/data';
import { addDays, daysBetween, todayKey } from './dates';
import { doneOn, overallStreak } from './selectors';
import type { BadgeState, Collections, FocusSession, Habit, HabitLog, MoodLog, Profile, Task } from './types';

const DAYS = 200;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

type Seed = Pick<Habit, 'name' | 'icon' | 'hue' | 'category' | 'frequency' | 'goal' | 'unit' | 'step' | 'timeOfDay'> & {
  key: string;
  rate: number;
  today: number;
  /** Current streak including today (if done today). */
  streak: number;
  best: number;
  /** Days-ago of the start of the "best run" window. */
  bestAt: number;
};

const SEEDS: Seed[] = [
  { key: 'water', name: 'Drink water', icon: 'drop', hue: 230, category: 'Health', frequency: { type: 'daily' }, goal: 8, unit: 'glasses', step: 1, timeOfDay: 'Anytime', rate: 0.91, today: 6, streak: 12, best: 37, bestAt: 138 },
  { key: 'read', name: 'Read', icon: 'book', hue: 60, category: 'Learning', frequency: { type: 'daily' }, goal: 20, unit: 'pages', step: 5, timeOfDay: 'Evening', rate: 0.78, today: 10, streak: 21, best: 24, bestAt: 70 },
  { key: 'workout', name: 'Workout', icon: 'dumbbell', hue: 25, category: 'Fitness', frequency: { type: 'weekly', times: 5 }, goal: 1, unit: 'session', step: 1, timeOfDay: 'Morning', rate: 0.72, today: 1, streak: 7, best: 18, bestAt: 100 },
  { key: 'code', name: 'Coding', icon: 'code', hue: 285, category: 'Work', frequency: { type: 'days', days: [true, true, true, true, true, false, false] }, goal: 60, unit: 'min', step: 15, timeOfDay: 'Afternoon', rate: 0.74, today: 15, streak: 9, best: 24, bestAt: 120 },
  { key: 'meditate', name: 'Meditate', icon: 'leaf', hue: 165, category: 'Health', frequency: { type: 'daily' }, goal: 10, unit: 'min', step: 5, timeOfDay: 'Morning', rate: 0.88, today: 10, streak: 13, best: 37, bestAt: 138 },
  { key: 'journal', name: 'Journal', icon: 'pen', hue: 340, category: 'Personal', frequency: { type: 'daily' }, goal: 1, unit: 'entry', step: 1, timeOfDay: 'Evening', rate: 0.69, today: 0, streak: 3, best: 15, bestAt: 40 },
];

const HOURS: Record<Habit['timeOfDay'], [number, number]> = {
  Morning: [6.8, 8.6],
  Afternoon: [13.5, 16.5],
  Evening: [20, 22.2],
  Anytime: [17, 20.5],
};

export interface DemoData extends Collections {
  profile: Profile;
}

export function buildDemo(today = todayKey(), ownerName = 'Ravi'): DemoData {
  const r = rng(20260923);
  const start = addDays(today, -DAYS);
  const createdAt = new Date(`${start}T09:00:00`).getTime();

  const habits: Record<string, Habit> = {};
  SEEDS.forEach((s, order) => {
    habits[s.key] = {
      id: s.key, name: s.name, icon: s.icon, hue: s.hue, category: s.category, frequency: s.frequency,
      goal: s.goal, unit: s.unit, step: s.step, timeOfDay: s.timeOfDay,
      reminder: s.timeOfDay === 'Morning' ? { on: true, time: '7:00 AM' } : s.timeOfDay === 'Evening' ? { on: true, time: '9:00 PM' } : null,
      notes: null, createdAt, order, updatedAt: createdAt, deleted: false,
    };
  });

  // done[key][daysAgo] — decide completion first, then materialise logs.
  const done: Record<string, boolean[]> = {};
  const isSched = (h: Habit, ago: number) => {
    const d = addDays(today, -ago);
    return h.frequency.type !== 'days' || !!h.frequency.days?.[(new Date(`${d}T12:00:00`).getDay() + 6) % 7];
  };
  for (const s of SEEDS) {
    const h = habits[s.key];
    const arr = Array.from({ length: DAYS + 1 }, (_, ago) => isSched(h, ago) && r() < s.rate);
    // best-run window
    for (let i = 0; i < s.best; i++) arr[s.bestAt - i] = true;
    arr[s.bestAt + 1] = false;
    arr[s.bestAt - s.best] = false;
    done[s.key] = arr;
  }

  // Current streaks (today counts only if done today).
  const setStreak = (key: string, len: number, scheduledOnly: boolean) => {
    const h = habits[key];
    const s = SEEDS.find((x) => x.key === key)!;
    const arr = done[key];
    arr[0] = s.today >= s.goal;
    let need = len - (arr[0] ? 1 : 0);
    let ago = 1;
    while (need > 0) {
      if (!scheduledOnly || isSched(h, ago)) {
        arr[ago] = true;
        need--;
      }
      ago++;
    }
    while (scheduledOnly && !isSched(h, ago)) ago++;
    arr[ago] = false;
    return ago;
  };
  setStreak('water', 12, false);
  setStreak('read', 21, false);
  setStreak('code', 9, true);
  setStreak('meditate', 13, false);
  setStreak('journal', 3, false);
  // Workout (5× a week): 7 in a row incl. today, then a week that missed its target.
  done.workout[0] = true;
  for (let i = 1; i <= 6; i++) done.workout[i] = true;
  for (let i = 7; i <= 13; i++) done.workout[i] = i >= 11 && i % 2 === 0;

  // Overall: day 13 ago is a light day so the current overall run is exactly 12.
  done.workout[13] = false;
  done.journal[13] = false;

  // Materialise logs.
  const habitLogs: Record<string, HabitLog> = {};
  const writeLog = (s: Seed, ago: number, count: number) => {
    if (count <= 0) return;
    const date = addDays(today, -ago);
    const [a, b] = HOURS[s.timeOfDay];
    const hr = a + r() * (b - a);
    const at = new Date(`${date}T00:00:00`).getTime() + hr * 3_600_000;
    const id = `${s.key}:${date}`;
    habitLogs[id] = { id, habitId: s.key, date, count, completedAt: count >= s.goal ? Math.round(at) : null, updatedAt: Math.round(at), deleted: false };
  };
  const applyDone = () => {
    for (const s of SEEDS) {
      writeLog(s, 0, s.today);
      for (let ago = 1; ago <= DAYS; ago++) {
        if (done[s.key][ago]) writeLog(s, ago, s.goal);
        else if (r() < 0.35) writeLog(s, ago, Math.floor(r() * s.goal)); // partial day (0 writes nothing)
      }
    }
  };
  applyDone();

  // Cap overall runs outside the designated ones so "longest" is the 37-day run.
  const list = Object.values(habits);
  const bestStart = 138;
  const inBest = (ago: number) => ago <= bestStart && ago > bestStart - 37;
  for (let pass = 0; pass < 12; pass++) {
    const { runs } = overallStreak(list, habitLogs, { today });
    const long = runs.find((run) => {
      const endAgo = daysBetween(run.end, today);
      return run.length > 26 && !(inBest(endAgo) || inBest(endAgo + run.length - 1)) && endAgo > 12;
    });
    if (!long) break;
    const mid = daysBetween(addDays(long.start, Math.floor(long.length / 2)), today);
    for (const s of SEEDS) if (s.key !== 'water' || !inBest(mid)) delete habitLogs[`${s.key}:${addDays(today, -mid)}`];
  }
  // Force the 37-day overall run (water, workout, coding, meditate), light days either side.
  const runKeys = ['water', 'workout', 'code', 'meditate'];
  for (let i = 0; i < 37; i++) {
    const ago = bestStart - i;
    for (const s of SEEDS) if (runKeys.includes(s.key) && isSched(habits[s.key], ago)) writeLog(s, ago, s.goal);
  }
  for (const edge of [bestStart + 1, bestStart - 37]) for (const s of SEEDS.slice(1)) delete habitLogs[`${s.key}:${addDays(today, -edge)}`];

  // Cap each daily habit's stray runs just under its designated best, outside the protected windows.
  for (const s of SEEDS) {
    if (s.frequency.type !== 'daily') continue;
    const keep = (ago: number) => ago <= s.streak || (ago <= s.bestAt && ago > s.bestAt - s.best) || (runKeys.includes(s.key) && inBest(ago));
    let run = 0;
    for (let ago = DAYS; ago >= 1; ago--) {
      const on = (habitLogs[`${s.key}:${addDays(today, -ago)}`]?.count ?? 0) >= s.goal;
      run = on ? run + 1 : 0;
      if (run >= s.best && !keep(ago)) {
        delete habitLogs[`${s.key}:${addDays(today, -ago)}`];
        run = 0;
      }
    }
  }

  // Tasks (today + upcoming) from the design.
  const at = (hhmm: string) => new Date(`${today}T${hhmm.padStart(5, '0')}:00`).getTime();
  const task = (title: string, time: string | null, priority: Task['priority'], isDone: boolean, list: Task['list'], extra: Partial<Task> = {}): Task => ({
    id: newId(), title, time, due: list === 'today' ? today : null, priority, done: isDone, doneAt: isDone && time ? at(time) + 1_800_000 : null,
    habitId: null, focusSessions: 0, list, createdAt: createdAt, updatedAt: createdAt, deleted: false, ...extra,
  });
  const tasks: Task[] = [
    task('Finish project proposal', '10:00', 'high', false, 'today', { focusSessions: 2 }),
    task('30 min workout', '07:00', 'med', true, 'today', { habitId: 'workout' }),
    task('Read 20 pages', '21:00', 'low', false, 'today', { habitId: 'read' }),
    task('Reply to design feedback', '11:30', 'med', true, 'today'),
    task('Book dentist appointment', '16:00', 'low', true, 'today'),
    task('Prep team retro', null, 'med', false, 'upcoming', { due: addDays(today, 1), focusSessions: 1 }),
    task('Plan weekend hike', null, 'low', false, 'upcoming', { due: addDays(today, 2) }),
    task('Renew gym membership', null, 'high', false, 'upcoming', { due: addDays(today, 5), habitId: 'workout' }),
  ];

  // Focus sessions: today 3 (25 + 25 + 20 = 1h 10m); ~0–3 a day before, 4-day focus streak.
  const focusSessions: Record<string, FocusSession> = {};
  const addSession = (date: string, hour: number, minutes: number, taskId: string | null = null) => {
    const start = new Date(`${date}T00:00:00`).getTime() + hour * 3_600_000;
    const id = newId();
    focusSessions[id] = { id, start, end: start + minutes * 60_000, mode: 'focus', minutes, taskId, completed: true, updatedAt: start, deleted: false };
  };
  addSession(today, 8.5, 25, tasks[0].id);
  addSession(today, 9.1, 25, tasks[0].id);
  addSession(today, 10.2, 20);
  for (let ago = 1; ago <= DAYS; ago++) {
    const date = addDays(today, -ago);
    const n = ago <= 3 ? 1 + Math.floor(r() * 3) : ago === 4 ? 0 : r() < 0.72 ? 1 + Math.floor(r() * 3) : 0;
    for (let k = 0; k < n; k++) addSession(date, 8.5 + k * 1.1 + r() * 0.6, r() < 0.2 ? 50 : 25);
  }

  // Mood: most past days, none today (Home shows the faces).
  const moodLogs: Record<string, MoodLog> = {};
  const moods: MoodLog['mood'][] = ['great', 'good', 'good', 'okay', 'good', 'great', 'low', 'okay', 'tired'];
  const tagPool = ['Energized', 'Calm', 'Focused', 'Grateful', 'Stressed', 'Tired', 'Social', 'Anxious'];
  for (let ago = 1; ago <= DAYS; ago++) {
    if (r() < 0.25) continue;
    const date = addDays(today, -ago);
    const workout = doneOn(habitLogs, habits.workout, date);
    // Workout days skew happier (Insights: "You tend to feel better on days you complete your workout").
    const mood = workout && r() < 0.8 ? (r() < 0.5 ? 'great' : 'good') : moods[Math.floor(r() * moods.length)];
    moodLogs[date] = { id: date, date, mood, tags: [tagPool[Math.floor(r() * tagPool.length)]], note: null, loggedAt: new Date(`${date}T09:12:00`).getTime(), updatedAt: new Date(`${date}T09:12:00`).getTime(), deleted: false };
  }

  // Badges (SPEC §4.11): five unlocked.
  const unlocked = (ago: number) => new Date(`${addDays(today, -ago)}T19:00:00`).getTime();
  const badge = (id: string, unlockedAt: number | null, progress: number): BadgeState => ({ id, unlockedAt, progress, updatedAt: createdAt, deleted: false });
  const badges: Record<string, BadgeState> = Object.fromEntries(
    [
      badge('spark', unlocked(42), 7), badge('momentum', unlocked(19), 30), badge('diver', unlocked(24), 10),
      badge('pages', unlocked(13), 100), badge('bird', unlocked(8), 10), badge('iron', null, 14),
      badge('perfect', null, 5), badge('owl', null, 9), badge('century', null, 37),
    ].map((b) => [b.id, b]),
  );

  const profile: Profile = {
    ...defaultProfile(ownerName),
    xp: 18_880, // Level 12 · 2,380 / 3,000
    streakProtection: { enabled: true, restDaysLeft: 2, restDays: [addDays(today, -14)] },
    onboardedAt: createdAt,
    updatedAt: Date.now(),
  };

  return {
    habits,
    habitLogs,
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    focusSessions,
    moodLogs,
    badges,
    profile,
  };
}
