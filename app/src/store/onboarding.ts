import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingState {
  /** The welcome flow has been completed (or skipped) on this device. */
  seen: boolean;
  /** Goals picked in step 6 (Health, Learning…). */
  goals: string[];
  markSeen: () => void;
  setGoals: (goals: string[]) => void;
  /** Settings → Replay onboarding. */
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      goals: ['Health', 'Learning'],
      markSeen: () => set({ seen: true }),
      setGoals: (goals) => set({ goals }),
      reset: () => set({ seen: false }),
    }),
    { name: 'tend.onboarding', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
