// Plus entitlement (docs/API.md v1.1). The server is the source of truth; the last known
// status is persisted so offline users keep access until it actually expires.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAuth } from '@/api/auth';
import { api } from '@/api/client';

export interface PlusStatus {
  active: boolean;
  source: 'play_subscription' | 'play_lifetime' | 'admin' | 'trial' | null;
  expiresAt: number | null;
  autoRenew: boolean;
  productId: string | null;
  basePlanId: string | null;
}

export const FREE_STATUS: PlusStatus = {
  active: false,
  source: null,
  expiresAt: null,
  autoRenew: false,
  productId: null,
  basePlanId: null,
};

interface PlusState {
  status: PlusStatus;
  /** Account the cached status belongs to. */
  userId: string | null;
  /** The server has answered for `userId` in this session (safe to downgrade local prefs).
   *  Not persisted: an auto-renewed subscription looks expired in the cache until refreshed. */
  verified: boolean;
  /** Clock used by selectors (bumped on refresh, resume and at expiry) so they stay pure. */
  now: number;
  setStatus: (status: PlusStatus) => void;
  refresh: () => Promise<PlusStatus | null>;
  clear: () => void;
  tick: () => void;
}

/** Active, and a cached expiry that has already passed counts as inactive. */
export const isActive = (s: PlusStatus, now: number) => s.active && (s.expiresAt == null || s.expiresAt > now);

let inflight: Promise<PlusStatus | null> | null = null;

export const usePlusStore = create<PlusState>()(
  persist(
    (set, get) => ({
      status: FREE_STATUS,
      userId: null,
      verified: false,
      now: Date.now(),
      setStatus: (status) => set({ status, userId: useAuth.getState().user?.id ?? null, verified: true, now: Date.now() }),
      refresh: () => {
        inflight ??= (async () => {
          const user = useAuth.getState().user;
          if (!user) return null;
          try {
            const status = await api<PlusStatus>('/v1/plus');
            // The account may have changed while the request was in flight.
            if (useAuth.getState().user?.id !== user.id) return null;
            get().setStatus(status);
            return status;
          } catch {
            // Offline or server trouble: keep the cached status.
            return null;
          } finally {
            set({ now: Date.now() });
          }
        })().finally(() => {
          inflight = null;
        });
        return inflight;
      },
      clear: () => set({ status: FREE_STATUS, userId: null, verified: false, now: Date.now() }),
      tick: () => set({ now: Date.now() }),
    }),
    {
      name: 'tend.plus',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ status, userId }) => ({ status, userId }),
    },
  ),
);

/** Non-React check (streak protection, focus engine, billing). */
export const isPlusNow = () => isActive(usePlusStore.getState().status, Date.now());

/** `active` is true while the account has Plus. */
export function usePlus() {
  const active = usePlusStore((s) => isActive(s.status, s.now));
  const status = usePlusStore((s) => s.status);
  return { active, status };
}

export const refreshPlus = () => usePlusStore.getState().refresh();

let started = false;

/** Call once after stores hydrate: refresh on launch, sign-in and foreground; clear on sign-out. */
export function startPlus() {
  if (started) return;
  started = true;
  const auth = useAuth.getState().user;
  const plus = usePlusStore.getState();
  // A cached status from another account never carries over.
  if (plus.userId && plus.userId !== auth?.id) plus.clear();
  void refreshPlus();
  useAuth.subscribe((s, prev) => {
    if (!s.user && prev.user) usePlusStore.getState().clear();
    else if (s.user && s.user.id !== prev.user?.id) {
      if (usePlusStore.getState().userId !== s.user.id) usePlusStore.getState().clear();
      void refreshPlus();
    }
  });
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    usePlusStore.getState().tick();
    void refreshPlus();
  });
}
