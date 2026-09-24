// Streak protection (SPEC §4.12): while enabled, a missed day that would end an active
// streak is covered by one of the month's rest days (2 per month). Rest days never break
// a streak and are drawn with a dashed outline. Runs on launch, on resume and after sync.
import { addDays, todayKey } from '@/data/dates';
import { dayCounts, liveHabits, overallStreak } from '@/data/selectors';
import { useData } from '@/store/data';

export const REST_DAYS_PER_MONTH = 2;
/** How far back a missed day can still be covered (a week of not opening the app). */
const LOOKBACK = 7;

export const restDaysUsed = (restDays: string[], month: string) => restDays.filter((d) => d.startsWith(month)).length;

export const restDaysLeft = (restDays: string[], today = todayKey()) =>
  Math.max(0, REST_DAYS_PER_MONTH - restDaysUsed(restDays, today.slice(0, 7)));

/** Cover eligible missed days; returns the days newly protected. */
export function applyStreakProtection(today = todayKey()): string[] {
  const s = useData.getState();
  const sp = s.profile.streakProtection;
  if (!sp.enabled) return [];
  const habits = liveHabits(s.habits);
  if (!habits.length) return [];
  const restDays = [...sp.restDays];
  const added: string[] = [];
  for (let i = LOOKBACK; i >= 1; i--) {
    const d = addDays(today, -i);
    if (restDays.includes(d) || dayCounts(habits, s.habitLogs, d) !== false) continue;
    // Only worth protecting if a streak was alive going into this day.
    const before = overallStreak(habits, s.habitLogs, { restDays, today: addDays(d, -1) }).current;
    if (before === 0) continue;
    if (restDaysUsed(restDays, d.slice(0, 7)) >= REST_DAYS_PER_MONTH) continue;
    restDays.push(d);
    added.push(d);
  }
  const left = restDaysLeft(restDays, today);
  if (added.length || left !== sp.restDaysLeft) {
    s.updateProfile({ streakProtection: { ...sp, restDays: restDays.sort(), restDaysLeft: left } });
  }
  return added;
}
