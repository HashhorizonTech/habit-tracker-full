import { CreateHabitSheet, type HabitPrefill } from '@/components/habit/CreateHabitSheet';
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
