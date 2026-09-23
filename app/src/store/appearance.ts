import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Mode, ThemeId } from '@/theme/palette';

interface AppearanceState {
  themeId: ThemeId;
  mode: Mode;
  setTheme: (id: ThemeId) => void;
  setMode: (mode: Mode) => void;
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      themeId: 'aurora',
      mode: 'dark',
      setTheme: (themeId) => set({ themeId }),
      setMode: (mode) => set({ mode }),
    }),
    { name: 'tend.appearance', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
