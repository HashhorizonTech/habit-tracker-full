// What Free includes and what Plus unlocks — the single source of truth for every gate.
import { router, type Href } from 'expo-router';
import type { Range } from '@/data/insights';
import type { Ambient } from '@/store/prefs';
import type { ThemeId } from '@/theme/palette';

/** Free accounts can grow this many habits. Existing habits over the limit are kept. */
export const FREE_HABIT_LIMIT = 5;

export const FREE_THEMES: readonly ThemeId[] = ['aurora', 'ocean'];
/** Theme a free account falls back to when its theme is part of Plus. */
export const FALLBACK_THEME: ThemeId = 'aurora';

/** Focus presets by index (store/focus PRESETS; 3 = Custom). Only Classic is free. */
export const FREE_PRESETS: readonly number[] = [0];

/** Ambient sounds are Plus; Free keeps focus quiet. */
export const FREE_AMBIENT: Ambient = 'Off';

export const FREE_RANGES: readonly Range[] = ['7D'];

export const REST_DAYS = { free: 2, plus: 4 } as const;

export const isThemeLocked = (id: ThemeId, plus: boolean) => !plus && !FREE_THEMES.includes(id);
export const isPresetLocked = (i: number, plus: boolean) => !plus && !FREE_PRESETS.includes(i);
export const isAmbientLocked = (a: Ambient, plus: boolean) => !plus && a !== FREE_AMBIENT;
export const isRangeLocked = (r: Range, plus: boolean) => !plus && !FREE_RANGES.includes(r);
export const isHabitLimitReached = (count: number, plus: boolean) => !plus && count >= FREE_HABIT_LIMIT;
export const restDaysFor = (plus: boolean) => (plus ? REST_DAYS.plus : REST_DAYS.free);

/** Where the paywall was opened from; only used to pick a gentle context line. */
export type PlusFrom = 'habits' | 'themes' | 'focus' | 'ambient' | 'insights' | 'mood' | 'export' | 'profile' | 'settings';

export const PLUS_CONTEXT: Partial<Record<PlusFrom, string>> = {
  habits: `Free has room for ${FREE_HABIT_LIMIT} habits. Plus lets your garden keep growing.`,
  themes: 'That theme is part of Plus.',
  focus: 'Deep, Flow and Custom sessions are part of Plus.',
  ambient: 'Ambient sounds are part of Plus.',
  insights: 'Longer ranges are part of Plus.',
  mood: 'Mood patterns are part of Plus.',
  export: 'Data export is part of Plus.',
};

/** Open the paywall. */
export function openPaywall(from?: PlusFrom) {
  router.push((from ? `/plus?from=${from}` : '/plus') as Href);
}
