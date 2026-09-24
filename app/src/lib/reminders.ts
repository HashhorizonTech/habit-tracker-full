// Recurring reminders (SPEC §4.18): per-habit reminders plus the five daily nudges.
// Every notification scheduled here uses an identifier prefixed `tend-`, so a reschedule can
// cancel exactly these and never touches the focus-session alert (which uses a generated id).
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { addDays, parseKey, todayKey } from '@/data/dates';
import { dayCounts, liveHabits, overallStreak } from '@/data/selectors';
import type { Habit } from '@/data/types';
import { CHANNELS, initNotifications } from '@/lib/notifications';
import { usePersistHydrated } from '@/lib/usePersistHydrated';
import { useData, useDataHydrated } from '@/store/data';
import { notificationPrefsSnapshot, useNotificationPrefs, type NotifTone, type NotifType } from '@/store/notificationPrefs';

export const REMINDER_PREFIX = 'tend-';

type Trigger = Notifications.DailyTriggerInput | Notifications.WeeklyTriggerInput | Notifications.DateTriggerInput;

interface Planned {
  identifier: string;
  title: string;
  body: string;
  data: { kind: 'reminder'; type: NotifType; habitId?: string };
  trigger: Trigger;
}

type Copy = Record<NotifTone, { title: string; body: string }>;

/** Fixed-time nudges. The streak reminder is planned separately (one-shot, needs the streak length). */
const DAILY_NUDGES: { type: Exclude<NotifType, 'habit' | 'streak'>; hour: number; minute: number; copy: Copy }[] = [
  {
    type: 'focus',
    hour: 9,
    minute: 0,
    copy: {
      gentle: { title: 'Time to focus', body: 'Your usual focus window is starting — one session is plenty.' },
      facts: { title: 'Focus reminder', body: 'Your focus window starts now.' },
    },
  },
  {
    type: 'summary',
    hour: 21,
    minute: 0,
    copy: {
      gentle: { title: 'Your day, wrapped up', body: 'Take a quiet look at how today went.' },
      facts: { title: 'Daily summary', body: 'Today’s summary is ready.' },
    },
  },
  {
    type: 'morning',
    hour: 7,
    minute: 30,
    copy: {
      gentle: { title: 'Good morning', body: 'One small step is all today needs.' },
      facts: { title: 'Morning motivation', body: 'Your habits for today are ready.' },
    },
  },
  {
    type: 'evening',
    hour: 22,
    minute: 0,
    copy: {
      gentle: { title: 'A quiet moment', body: 'How did today feel? A few lines in your journal is enough.' },
      facts: { title: 'Evening reflection', body: 'Time to journal about today.' },
    },
  },
];

const STREAK_HOUR = 20;

function streakCopy(tone: NotifTone, n: number) {
  return tone === 'gentle'
    ? { title: 'A little nudge', body: `Your ${n}-day streak is still open — a small check-in keeps it going.` }
    : { title: 'Streak reminder', body: `Streak ${n} days · check in before midnight.` };
}

function habitCopy(tone: NotifTone, h: Habit) {
  if (tone === 'gentle') return { title: 'A little nudge', body: `Your ${h.name.toLowerCase()} habit is waiting whenever you are.` };
  const unit = h.goal === 1 && h.unit === 'times' ? 'time' : h.unit;
  return { title: h.name, body: `${h.name} · ${h.goal} ${unit} today.` };
}

/** "7:00 AM", "7:00 PM" (any whitespace, incl. narrow no-break space) or 24h "19:00" → minutes since midnight. */
export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(s);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = m[3]?.toUpperCase();
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (ampm === 'PM' ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Quiet hours rule: a reminder at minute `t` is silenced when start < t < end (wrapping midnight
 * when start > end). Both boundary minutes are allowed, so with 22:00–07:00 a 10:00 PM evening
 * reflection and a 7:00 AM reminder still fire, while 10:30 PM or 6:59 AM are skipped.
 * start === end means no quiet hours.
 */
export function isQuiet(hour: number, minute: number, quietStart: string, quietEnd: string): boolean {
  const s = parseTime(quietStart);
  const e = parseTime(quietEnd);
  if (!s || !e) return false;
  const t = hour * 60 + minute;
  const start = s.hour * 60 + s.minute;
  const end = e.hour * 60 + e.minute;
  if (start === end) return false;
  return start < end ? t > start && t < end : t > start || t < end;
}

/** Mon-first index (0 = Monday) → expo weekday (1 = Sunday … 7 = Saturday). */
const expoWeekday = (monIndex: number) => ((monIndex + 1) % 7) + 1;

function atTime(key: string, hour: number, minute: number): number {
  const d = parseKey(key);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function plan(now = Date.now()): Planned[] {
  const prefs = notificationPrefsSnapshot();
  if (!prefs.enabled) return [];
  const { tone, types, quietStart, quietEnd } = prefs;
  const quiet = (h: number, m: number) => isQuiet(h, m, quietStart, quietEnd);
  const channelId = CHANNELS.reminders;
  const out: Planned[] = [];
  const { habits: habitMap, habitLogs, profile } = useData.getState();
  const habits = liveHabits(habitMap);

  if (types.habit) {
    for (const h of habits) {
      if (!h.reminder?.on) continue;
      const t = parseTime(h.reminder.time);
      if (!t || quiet(t.hour, t.minute)) continue;
      const copy = habitCopy(tone, h);
      const data = { kind: 'reminder', type: 'habit', habitId: h.id } as const;
      if (h.frequency.type === 'days') {
        (h.frequency.days ?? []).forEach((on, i) => {
          if (!on) return;
          out.push({
            identifier: `${REMINDER_PREFIX}habit-${h.id}-${i}`,
            ...copy,
            data,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(i), hour: t.hour, minute: t.minute, channelId },
          });
        });
      } else {
        out.push({
          identifier: `${REMINDER_PREFIX}habit-${h.id}`,
          ...copy,
          data,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, channelId },
        });
      }
    }
  }

  for (const n of DAILY_NUDGES) {
    if (!types[n.type] || quiet(n.hour, n.minute)) continue;
    out.push({
      identifier: `${REMINDER_PREFIX}${n.type}`,
      ...n.copy[tone],
      data: { kind: 'reminder', type: n.type },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: n.hour, minute: n.minute, channelId },
    });
  }

  // Streak: one-shot at the next 8 PM when the streak is alive and that day is still open.
  if (types.streak && !quiet(STREAK_HOUR, 0) && habits.length) {
    const today = todayKey();
    const n = overallStreak(habits, habitLogs, { restDays: profile.streakProtection.restDays, today }).current;
    if (n > 0) {
      const todayState = dayCounts(habits, habitLogs, today);
      let target: string | null = null;
      if (todayState === false) {
        if (now < atTime(today, STREAK_HOUR, 0)) target = today;
      } else {
        // Today already counts (or has nothing due): remind tomorrow evening instead.
        const tomorrow = addDays(today, 1);
        if (dayCounts(habits, habitLogs, tomorrow) !== null) target = tomorrow;
      }
      if (target) {
        out.push({
          identifier: `${REMINDER_PREFIX}streak`,
          ...streakCopy(tone, n),
          data: { kind: 'reminder', type: 'streak' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atTime(target, STREAK_HOUR, 0), channelId },
        });
      }
    }
  }

  return out;
}

async function cancelOurs() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((r) => r.identifier.startsWith(REMINDER_PREFIX)).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier).catch(() => {})),
  );
}

let lastSignature: string | null = null;
let chain: Promise<void> = Promise.resolve();

async function run() {
  const perm = await Notifications.getPermissionsAsync();
  const planned = perm.granted ? plan() : [];
  const signature = JSON.stringify(planned);
  if (signature === lastSignature) return;
  await initNotifications();
  await cancelOurs();
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.identifier,
      content: { title: p.title, body: p.body, data: p.data, sound: 'default' },
      trigger: p.trigger,
    }).catch(() => {});
  }
  lastSignature = signature;
}

/**
 * Cancel every `tend-` reminder and schedule the current set. Never prompts for permission
 * (that happens on the Notifications screen); without permission it only cancels.
 * Calls are serialised, and a no-op when nothing would change. Web: no-op.
 */
export function rescheduleReminders(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  chain = chain.then(run).catch(() => {
    lastSignature = null;
  });
  return chain;
}

/**
 * Keeps scheduled reminders in step with notification prefs, habits, check-ins (streak) and
 * rest days — debounced 1 s — and re-checks whenever the app returns to the foreground.
 * Mount once at the root.
 */
export function useReminderSync() {
  const prefsReady = usePersistHydrated(useNotificationPrefs.persist);
  const dataReady = useDataHydrated();

  useEffect(() => {
    if (Platform.OS === 'web' || !prefsReady || !dataReady) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void rescheduleReminders();
      }, 1000);
    };
    kick();
    const offPrefs = useNotificationPrefs.subscribe(kick);
    const offData = useData.subscribe((s, prev) => {
      if (s.habits !== prev.habits || s.habitLogs !== prev.habitLogs || s.profile.streakProtection !== prev.profile.streakProtection) kick();
    });
    const offApp = AppState.addEventListener('change', (state) => {
      if (state === 'active') kick();
    });
    return () => {
      if (timer) clearTimeout(timer);
      offPrefs();
      offData();
      offApp.remove();
    };
  }, [prefsReady, dataReady]);
}
