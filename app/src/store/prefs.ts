import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Ambient = 'Off' | 'Rain' | 'Café' | 'Forest' | 'Brown noise';

export interface Prefs {
  haptics: boolean;
  /** Completion sounds (SPEC §4.16). Governs every UI sound. */
  sound: boolean;
  autoBreak: boolean;
  ambient: Ambient;
  weekStart: 'Mon' | 'Sun';
  lock: boolean;
}

interface PrefsState extends Prefs {
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

// Device-level preferences. Step 3 mirrors these into Profile.prefs for sync.
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      haptics: true,
      sound: true,
      autoBreak: false,
      ambient: 'Rain',
      weekStart: 'Mon',
      lock: false,
      setPref: (key, value) => set({ [key]: value } as Partial<PrefsState>),
    }),
    { name: 'tend.prefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
