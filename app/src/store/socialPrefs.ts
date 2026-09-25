// Which habits appear on the friend card. Off by default: friends only see streak, today's
// progress, level and badges until the owner turns on "Share habit names" and picks habits.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SocialPrefsState {
  /** Account these prefs belong to (habit ids are per account). */
  userId: string | null;
  shareHabitNames: boolean;
  sharedHabitIds: string[];
  setShareHabitNames: (on: boolean) => void;
  setHabitShared: (habitId: string, on: boolean) => void;
  /** Adopt prefs for an account; resets when the account changes. */
  claim: (userId: string | null) => void;
}

export const useSocialPrefs = create<SocialPrefsState>()(
  persist(
    (set, get) => ({
      userId: null,
      shareHabitNames: false,
      sharedHabitIds: [],
      setShareHabitNames: (shareHabitNames) => set({ shareHabitNames }),
      setHabitShared: (habitId, on) =>
        set((s) => ({
          sharedHabitIds: on ? [...new Set([...s.sharedHabitIds, habitId])] : s.sharedHabitIds.filter((id) => id !== habitId),
        })),
      claim: (userId) => {
        if (get().userId === userId) return;
        set({ userId, shareHabitNames: false, sharedHabitIds: [] });
      },
    }),
    { name: 'tend.socialPrefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
