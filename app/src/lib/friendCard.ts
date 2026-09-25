// Friend card (docs/API.md v1.2): the only view friends get of this account. Built from local
// data and published (debounced) after check-ins and sync. Mood, notes and unshared habit
// names never leave the device.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/api/auth';
import { social, type FriendCard } from '@/api/social';
import { useSync } from '@/api/sync';
import { todayKey } from '@/data/dates';
import { dayPercent, doneOn, habitStreak, habitsForDay, liveHabits, liveList, overallStreak, tasksForDay } from '@/data/selectors';
import { badgeProgress } from '@/lib/badges';
import { levelInfo } from '@/lib/xp';
import { useData } from '@/store/data';
import { usePrefs } from '@/store/prefs';
import { useSocialPrefs } from '@/store/socialPrefs';

const MAX_BADGES = 20;
const MAX_HABITS = 30;
const DEBOUNCE_MS = 3_000;

export function buildFriendCard(now = Date.now()): FriendCard {
  const data = useData.getState();
  const { shareHabitNames, sharedHabitIds } = useSocialPrefs.getState();
  const weekStart = usePrefs.getState().weekStart;
  const today = todayKey();
  const restDays = data.profile.streakProtection.restDays;
  const habits = liveHabits(data.habits);
  const logs = data.habitLogs;
  const todays = habitsForDay(habits, logs, today);
  const streak = overallStreak(habits, logs, { restDays, today });
  const shared = new Set(sharedHabitIds);
  return {
    streak: streak.current,
    longestStreak: streak.longest,
    level: levelInfo(data.profile.xp).level,
    xp: data.profile.xp,
    todayDone: todays.filter((h) => doneOn(logs, h, today)).length,
    todayTotal: todays.length,
    todayPct: dayPercent(habits, logs, tasksForDay(liveList(data.tasks), today), today),
    date: today,
    badges: badgeProgress(data).filter((b) => b.unlocked).map((b) => b.id).slice(0, MAX_BADGES),
    habits: shareHabitNames
      ? habits
          .filter((h) => shared.has(h.id))
          .slice(0, MAX_HABITS)
          .map((h) => ({
            name: h.name.slice(0, 80),
            icon: h.icon,
            hue: h.hue,
            doneToday: doneOn(logs, h, today),
            streak: habitStreak(h, logs, { restDays, today, weekStart }),
          }))
      : [],
    updatedAt: now,
  };
}

let lastSent: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Local data is ready to describe this account (never publish a blank pre-sync card). */
function canPublish() {
  const user = useAuth.getState().user;
  const d = useData.getState();
  return !!user && d.ownerId === user.id && d.lastSyncedAt != null;
}

export async function publishFriendCard(force = false) {
  if (!canPublish()) return;
  const card = buildFriendCard();
  const key = JSON.stringify({ ...card, updatedAt: 0 });
  if (!force && key === lastSent) return;
  try {
    await social.publishCard(card);
    lastSent = key;
  } catch {
    // Offline: the next change, sync or foreground tries again.
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void publishFriendCard();
  }, DEBOUNCE_MS);
}

/** Mount once (root layout): republishes after data changes, sync, sharing changes and resume. */
export function useFriendCardPublisher() {
  useEffect(() => {
    const unsubs = [
      useData.subscribe((s, p) => {
        if (s.habits !== p.habits || s.habitLogs !== p.habitLogs || s.tasks !== p.tasks || s.badges !== p.badges || s.profile !== p.profile) schedule();
      }),
      useSync.subscribe((s, p) => {
        if (s.status === 'idle' && p.status === 'syncing') schedule();
      }),
      useSocialPrefs.subscribe(schedule),
      useAuth.subscribe((s, p) => {
        if (s.user?.id !== p.user?.id) lastSent = null;
      }),
    ];
    // A new day changes "today" even without edits.
    const app = AppState.addEventListener('change', (st) => st === 'active' && schedule());
    schedule();
    return () => {
      unsubs.forEach((u) => u());
      app.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
