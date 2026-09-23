// Pomodoro timer state (SPEC §4.7). The source of truth while running is `endAt`
// (epoch ms): remaining time is always computed from the clock, so the timer survives
// backgrounding, JS pauses and even an app restart.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FocusMode } from '@/data/types';

export interface Preset {
  name: string;
  focus: number;
  short: number;
  long: number;
}

export const PRESETS: Preset[] = [
  { name: 'Classic', focus: 25, short: 5, long: 15 },
  { name: 'Deep', focus: 50, short: 10, long: 20 },
  { name: 'Flow', focus: 90, short: 20, long: 30 },
];

/** A long break follows every 4th focus session. */
export const LONG_EVERY = 4;

export type TimerStatus = 'idle' | 'running' | 'paused';

interface FocusState {
  mode: FocusMode;
  /** 0–2 = PRESETS, 3 = Custom. */
  preset: number;
  customFocus: number;
  customBreak: number;
  status: TimerStatus;
  /** Epoch ms the current run ends (running only). */
  endAt: number | null;
  /** When the current run started (for the saved session). */
  startedAt: number | null;
  /** Remaining ms while paused. */
  pausedRemaining: number | null;
  /** Task the session is linked to. */
  taskId: string | null;
  /** Focus sessions completed since the last long break. */
  cycle: number;
  /** Scheduled completion notification. */
  notificationId: string | null;

  setMode: (mode: FocusMode) => void;
  setPreset: (i: number) => void;
  setCustom: (focus: number, brk: number) => void;
  setTask: (taskId: string | null) => void;
  start: (now?: number) => void;
  pause: (now?: number) => void;
  reset: () => void;
  /** Called when a run reaches zero; returns to idle on the same mode. */
  finish: () => void;
  setNotificationId: (id: string | null) => void;
  bumpCycle: () => void;
}

export function presetValues(s: Pick<FocusState, 'preset' | 'customFocus' | 'customBreak'>): Preset {
  return s.preset === 3 ? { name: 'Custom', focus: s.customFocus, short: s.customBreak, long: 15 } : PRESETS[s.preset] ?? PRESETS[0];
}

/** Full length of the current mode in ms. */
export function modeTotal(s: Pick<FocusState, 'preset' | 'customFocus' | 'customBreak' | 'mode'>): number {
  const p = presetValues(s);
  return (s.mode === 'focus' ? p.focus : s.mode === 'short' ? p.short : p.long) * 60_000;
}

/** Remaining ms right now. */
export function remainingMs(s: FocusState, now = Date.now()): number {
  if (s.status === 'running' && s.endAt) return Math.max(0, s.endAt - now);
  if (s.status === 'paused' && s.pausedRemaining != null) return s.pausedRemaining;
  return modeTotal(s);
}

const idle = { status: 'idle' as const, endAt: null, startedAt: null, pausedRemaining: null };

export const useFocus = create<FocusState>()(
  persist(
    (set, get) => ({
      mode: 'focus',
      preset: 0,
      customFocus: 30,
      customBreak: 5,
      ...idle,
      taskId: null,
      cycle: 0,
      notificationId: null,

      setMode: (mode) => set({ mode, ...idle }),
      setPreset: (preset) => set({ preset, mode: 'focus', ...idle }),
      setCustom: (customFocus, customBreak) => set({ customFocus, customBreak, preset: 3, mode: 'focus', ...idle }),
      setTask: (taskId) => set({ taskId }),
      start: (now = Date.now()) => {
        const s = get();
        const left = s.status === 'paused' && s.pausedRemaining != null ? s.pausedRemaining : modeTotal(s);
        set({
          status: 'running',
          endAt: now + left,
          startedAt: s.status === 'paused' && s.startedAt ? s.startedAt : now,
          pausedRemaining: null,
        });
      },
      pause: (now = Date.now()) => {
        const s = get();
        if (s.status !== 'running' || !s.endAt) return;
        set({ status: 'paused', pausedRemaining: Math.max(0, s.endAt - now), endAt: null });
      },
      reset: () => set({ ...idle }),
      finish: () => set({ ...idle }),
      setNotificationId: (notificationId) => set({ notificationId }),
      bumpCycle: () => set((s) => ({ cycle: s.cycle + 1 })),
    }),
    {
      name: 'tend.focus',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ mode, preset, customFocus, customBreak, status, endAt, startedAt, pausedRemaining, taskId, cycle, notificationId }) => ({
        mode, preset, customFocus, customBreak, status, endAt, startedAt, pausedRemaining, taskId, cycle, notificationId,
      }),
    },
  ),
);
