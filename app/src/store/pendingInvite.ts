// An invite code picked up from a link (tend://invite/<CODE> or the https share link).
// Kept until it's used: prefilled on sign-up, or sent as a friend request after sign-in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PendingInviteState {
  code: string | null;
  setCode: (code: string) => void;
  clear: () => void;
}

export const usePendingInvite = create<PendingInviteState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
      clear: () => set({ code: null }),
    }),
    { name: 'tend.pendingInvite', storage: createJSONStorage(() => AsyncStorage), partialize: ({ code }) => ({ code }) },
  ),
);
