import { useSyncExternalStore } from 'react';

interface PersistApi {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
}

/** True once a zustand `persist` store has loaded from AsyncStorage. */
export function usePersistHydrated(persist: PersistApi): boolean {
  return useSyncExternalStore(persist.onFinishHydration, persist.hasHydrated, () => false);
}
