import { CreateHabitSheet, type HabitPrefill } from '@/components/habit/CreateHabitSheet';
import { MoodSheet } from '@/components/mood/MoodSheet';
import { StreakSheet } from '@/components/streak/StreakSheet';
import type { MoodId } from '@/theme/palette';
import { useUI } from '@/store/ui';

/**
 * Opens the Create habit sheet, optionally pre-filled ("Make it a habit" from Tasks).
 * Only known fields are read, so passing it straight to `onPress` (which hands over the
 * press event) is harmless.
 */
export function openCreateHabit(prefill?: HabitPrefill) {
  const p: HabitPrefill | undefined = prefill
    ? { name: prefill.name, icon: prefill.icon, hue: prefill.hue, category: prefill.category }
    : undefined;
  useUI.getState().openSheet((close) => <CreateHabitSheet close={close} prefill={p} />, 'New habit');
}

/** Mood check-in sheet, pre-selected (Home mood strip). */
export function openMood(initial: MoodId = 'good') {
  useUI.getState().openSheet((close) => <MoodSheet initial={initial} close={close} />, 'Mood check-in');
}

/** Streak details sheet (any streak tap). */
export function openStreak() {
  useUI.getState().openSheet(() => <StreakSheet />, 'Streak details');
}
