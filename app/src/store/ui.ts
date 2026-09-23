import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { IconName } from '@/components/icons/paths';

export interface Toast {
  key: number;
  text: string;
  icon: IconName;
}

export interface SheetRequest {
  key: number;
  render: (close: () => void) => ReactNode;
  /** Accessible name announced when the sheet opens. */
  label: string;
}

export interface ModalRequest {
  key: number;
  render: (close: () => void) => ReactNode;
  label: string;
  /** Fires a 20-particle confetti burst when the card lands. */
  burst?: boolean;
}

interface UIState {
  toast: Toast | null;
  sheet: SheetRequest | null;
  modal: ModalRequest | null;
  /** Immersive focus: hides the tab bar and page chrome (SPEC §4.7). */
  calm: boolean;
  showToast: (text: string, icon?: IconName) => void;
  hideToast: () => void;
  openSheet: (render: SheetRequest['render'], label: string) => void;
  closeSheet: () => void;
  openModal: (render: ModalRequest['render'], label: string, opts?: { burst?: boolean }) => void;
  closeModal: () => void;
  setCalm: (calm: boolean) => void;
}

let seq = 0;

export const useUI = create<UIState>()((set) => ({
  toast: null,
  sheet: null,
  modal: null,
  calm: false,
  showToast: (text, icon = 'check') => set({ toast: { key: ++seq, text, icon } }),
  hideToast: () => set({ toast: null }),
  openSheet: (render, label) => set({ sheet: { key: ++seq, render, label } }),
  closeSheet: () => set({ sheet: null }),
  openModal: (render, label, opts) => set({ modal: { key: ++seq, render, label, burst: opts?.burst } }),
  closeModal: () => set({ modal: null }),
  setCalm: (calm) => set({ calm }),
}));

/** Imperative helpers for use outside components. */
export const toast = (text: string, icon?: IconName) => useUI.getState().showToast(text, icon);
