import { useState, type ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '@/api/auth';
import { syncNow, useSync } from '@/api/sync';
import { useData, useDataHydrated } from '@/store/data';
import { ErrorState } from './ErrorState';
import { ScreenSkeleton } from './Skeleton';

type GateState = 'loading' | 'error' | 'content';

const hasLive = (col: Record<string, { deleted: boolean }>) => {
  for (const id in col) if (!col[id].deleted) return true;
  return false;
};

/**
 * Decides what a data screen shows (SPEC §4.19). Local-first: anything on the device is shown
 * straight away, even offline. Only a signed-in account with nothing local that has never
 * synced waits on the network — skeleton while the first download runs, error if it fails.
 */
function useGateState(): { state: GateState; code: string | null } {
  const hydrated = useDataHydrated();
  const signedIn = useAuth((s) => !!s.user);
  const { status, code } = useSync();
  const neverSynced = useData((s) => s.lastSyncedAt == null);
  const hasLocal = useData((s) => hasLive(s.habits) || hasLive(s.tasks) || hasLive(s.focusSessions));

  if (!hydrated) return { state: 'loading', code };
  if (!signedIn || hasLocal || !neverSynced) return { state: 'content', code };
  if (status === 'offline' || status === 'error') return { state: 'error', code };
  return { state: 'loading', code };
}

export function DataGate({ variant = 'list', children }: { variant?: 'home' | 'list'; children: ReactNode }) {
  const { state, code } = useGateState();
  // Content that is ready on first render appears with the screen's own page-enter; only fade on a switch.
  const [initial] = useState(state);
  const fade = state === 'content' && initial === 'content' ? undefined : FadeIn.duration(300);

  return (
    <Animated.View key={state} entering={fade}>
      {state === 'loading' && <ScreenSkeleton variant={variant} />}
      {state === 'error' && <ErrorState code={code} onRetry={() => void syncNow()} />}
      {state === 'content' && children}
    </Animated.View>
  );
}
