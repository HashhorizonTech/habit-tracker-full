// Offline-first sync engine: pushes dirty records, pulls everything newer than the
// cursor, merges last-write-wins. Runs after edits (debounced), on launch, when the
// app returns to the foreground, and on a backoff while offline.
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { Collections, CollectionKey } from '@/data/types';
import { COLLECTION_KEYS, useData } from '@/store/data';
import { useAuth } from './auth';
import { ApiError, api } from './client';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export const useSync = create<{ status: SyncStatus; error: string | null; code: string | null }>(() => ({
  status: 'idle',
  error: null,
  code: null,
}));

const MAX_PUSH = 1_500;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;
let backoff = 0;

type Changes = { [K in CollectionKey]: Collections[K][string][] } & { profile: unknown };

function collectPush() {
  const s = useData.getState();
  const changes = { profile: null } as Changes;
  const pushed = {} as Record<CollectionKey, Record<string, number>>;
  let n = 0;
  for (const key of COLLECTION_KEYS) {
    pushed[key] = {};
    const out: unknown[] = [];
    for (const [id, at] of Object.entries(s.dirty[key])) {
      if (n >= MAX_PUSH) break;
      const rec = s[key][id];
      if (!rec) continue;
      out.push(rec);
      pushed[key][id] = at;
      n++;
    }
    (changes as Record<string, unknown>)[key] = out;
  }
  const profileAt = s.profileDirty;
  if (profileAt != null) changes.profile = s.profile;
  const more = COLLECTION_KEYS.some((k) => Object.keys(s.dirty[k]).length > Object.keys(pushed[k]).length);
  return { changes, pushed, profileAt, more };
}

async function runOnce() {
  if (!useAuth.getState().user) return;
  useSync.setState({ status: 'syncing' });
  try {
    let more = true;
    while (more) {
      const batch = collectPush();
      const res = await api<{ cursor: number; changes: Partial<Changes> }>('/v1/sync', {
        method: 'POST',
        json: { cursor: useData.getState().syncCursor, changes: batch.changes },
      });
      const s = useData.getState();
      s.markPushed(batch.pushed, batch.profileAt);
      s.applyRemote(res.changes as never, res.cursor);
      more = batch.more;
    }
    backoff = 0;
    useSync.setState({ status: 'idle', error: null, code: null });
  } catch (e) {
    const offline = e instanceof ApiError && e.offline;
    useSync.setState({
      status: offline ? 'offline' : 'error',
      error: e instanceof Error ? e.message : String(e),
      code: e instanceof ApiError ? (offline ? 'NET-OFFLINE' : e.code) : 'SYNC-FAILED',
    });
    // Retry with backoff: 5s, 10s, 20s … capped at 2 minutes.
    backoff = Math.min(120_000, backoff ? backoff * 2 : 5_000);
    schedule(backoff);
  }
}

/** Sync now (coalesces concurrent calls). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = runOnce().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, ms);
}

let started = false;

/** Wire up automatic sync. Call once at app start. */
export function startSync() {
  if (started) return;
  started = true;
  // Local edits → push shortly after (debounced).
  useData.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty || s.profileDirty !== prev.profileDirty) {
      const hasDirty = s.profileDirty != null || COLLECTION_KEYS.some((k) => Object.keys(s.dirty[k]).length > 0);
      if (hasDirty) schedule(1_500);
    }
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncNow();
  });
  useAuth.subscribe((s, prev) => {
    if (s.user && s.user.id !== prev.user?.id) void syncNow();
  });
  void syncNow();
}
