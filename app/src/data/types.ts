// Record shapes shared with the server (docs/API.md, SPEC §6).
import type { IconName } from '@/components/icons/paths';
import type { Mode, MoodId, ThemeId } from '@/theme/palette';

export type Category = 'Morning' | 'Health' | 'Fitness' | 'Learning' | 'Work' | 'Personal' | 'Evening';
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';
export type FrequencyType = 'daily' | 'days' | 'weekly' | 'monthly' | 'custom';

export interface Frequency {
  type: FrequencyType;
  /** Mon-first booleans for 'days'. */
  days?: boolean[];
  /** Target count per week/month for 'weekly' / 'monthly'. */
  times?: number;
  /** Every N days for 'custom'. */
  every?: number;
}

interface Synced {
  id: string;
  updatedAt: number;
  deleted: boolean;
}

export interface Habit extends Synced {
  name: string;
  icon: IconName;
  hue: number;
  category: Category;
  frequency: Frequency;
  goal: number;
  unit: string;
  step: number;
  timeOfDay: TimeOfDay;
  reminder: { on: boolean; time: string } | null;
  notes: string | null;
  createdAt: number;
  order: number;
}

export interface HabitLog extends Synced {
  /** `${habitId}:${date}` */
  habitId: string;
  date: string;
  count: number;
  completedAt: number | null;
}

export type Priority = 'high' | 'med' | 'low';

export interface Task extends Synced {
  title: string;
  /** YYYY-MM-DD, or null for "today" when list is 'today'. */
  due: string | null;
  /** "10:00" 24h, or null for any time. */
  time: string | null;
  priority: Priority;
  done: boolean;
  doneAt: number | null;
  habitId: string | null;
  focusSessions: number;
  list: 'today' | 'upcoming';
  createdAt: number;
}

export type FocusMode = 'focus' | 'short' | 'long';

export interface FocusSession extends Synced {
  start: number;
  end: number;
  mode: FocusMode;
  minutes: number;
  taskId: string | null;
  completed: boolean;
}

export interface MoodLog extends Synced {
  /** id === date */
  date: string;
  mood: MoodId;
  tags: string[];
  note: string | null;
  loggedAt: number;
}

export interface BadgeState extends Synced {
  unlockedAt: number | null;
  progress: number;
}

export interface Profile {
  name: string;
  xp: number;
  themeId: ThemeId;
  mode: Mode;
  prefs: Record<string, unknown>;
  notificationPrefs: Record<string, unknown>;
  streakProtection: { enabled: boolean; restDaysLeft: number; restDays: string[] };
  onboardedAt: number | null;
  updatedAt: number;
}

export type CollectionKey = 'habits' | 'habitLogs' | 'tasks' | 'focusSessions' | 'moodLogs' | 'badges';

export interface Collections {
  habits: Record<string, Habit>;
  habitLogs: Record<string, HabitLog>;
  tasks: Record<string, Task>;
  focusSessions: Record<string, FocusSession>;
  moodLogs: Record<string, MoodLog>;
  badges: Record<string, BadgeState>;
}
