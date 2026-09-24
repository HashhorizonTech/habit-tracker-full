import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotifTone = 'gentle' | 'facts';
export type NotifType = 'habit' | 'focus' | 'summary' | 'streak' | 'morning' | 'evening';

export interface NotificationPrefs {
  /** Master switch: off schedules nothing. */
  enabled: boolean;
  tone: NotifTone;
  /** "HH:mm", 24h. Quiet hours may wrap midnight. */
  quietStart: string;
  quietEnd: string;
  types: Record<NotifType, boolean>;
}

interface NotificationPrefsState extends NotificationPrefs {
  setEnabled: (enabled: boolean) => void;
  setTone: (tone: NotifTone) => void;
  setType: (type: NotifType, on: boolean) => void;
  setQuietHours: (start: string, end: string) => void;
}

/** Defaults mirror the prototype's NOTIFS list (SPEC §4.18). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  tone: 'gentle',
  quietStart: '22:00',
  quietEnd: '07:00',
  types: { habit: true, focus: true, summary: true, streak: false, morning: true, evening: false },
};

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_NOTIFICATION_PREFS,
      setEnabled: (enabled) => set({ enabled }),
      setTone: (tone) => set({ tone }),
      setType: (type, on) => set((s) => ({ types: { ...s.types, [type]: on } })),
      setQuietHours: (quietStart, quietEnd) => set({ quietStart, quietEnd }),
    }),
    {
      name: 'tend.notificationPrefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Keep newly added types defaulted when an older persisted blob is loaded.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<NotificationPrefs>;
        return { ...current, ...p, types: { ...current.types, ...p.types } };
      },
    },
  ),
);

/** Plain snapshot of the prefs (no setters). */
export function notificationPrefsSnapshot(): NotificationPrefs {
  const { enabled, tone, quietStart, quietEnd, types } = useNotificationPrefs.getState();
  return { enabled, tone, quietStart, quietEnd, types };
}
