// Friends, requests and inbox (docs/API.md v1.2). The server is the source of truth; a light
// copy is persisted so the Friends screen opens instantly and offline. Refreshed on launch,
// sign-in and foreground, on pull-to-refresh, and every 60 s while the Friends screen is open.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAuth } from '@/api/auth';
import { ApiError } from '@/api/client';
import {
  social, socialMessage, type BlockedUser, type CheerKey, type Friend, type InboxItem, type RequestItem, type SocialMe,
} from '@/api/social';
import { arrivalToast } from '@/lib/socialCopy';
import { usePendingInvite } from './pendingInvite';
import { useSocialPrefs } from './socialPrefs';
import { toast } from './ui';

interface SocialState {
  /** Account the cache belongs to. */
  userId: string | null;
  me: SocialMe | null;
  friends: Friend[];
  incoming: RequestItem[];
  outgoing: RequestItem[];
  inbox: InboxItem[];
  unreadCount: number;
  blocked: BlockedUser[];
  /** Last successful refresh (ms); null = never loaded for this account. */
  loadedAt: number | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  refreshBlocked: () => Promise<void>;
  clear: () => void;
}

const EMPTY = {
  userId: null,
  me: null,
  friends: [],
  incoming: [],
  outgoing: [],
  inbox: [],
  unreadCount: 0,
  blocked: [],
  loadedAt: null,
};

const countUnread = (items: InboxItem[]) => items.filter((i) => i.readAt == null).length;

let inflight: Promise<void> | null = null;

export const useSocial = create<SocialState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      refreshing: false,
      refresh: () => {
        inflight ??= (async () => {
          const user = useAuth.getState().user;
          if (!user) return;
          if (get().userId !== user.id) set({ ...EMPTY, userId: user.id });
          set({ refreshing: true });
          try {
            const [me, friends, requests, inbox] = await Promise.all([social.me(), social.friends(), social.requests(), social.inbox()]);
            if (useAuth.getState().user?.id !== user.id) return;
            const prev = get();
            announceArrivals(prev.loadedAt != null ? prev.inbox : null, inbox.items);
            set({
              me,
              friends: friends.friends,
              incoming: requests.incoming,
              outgoing: requests.outgoing,
              inbox: inbox.items,
              unreadCount: countUnread(inbox.items),
              loadedAt: Date.now(),
            });
          } catch {
            // Offline or server trouble: keep the cached copy.
          } finally {
            set({ refreshing: false });
          }
        })().finally(() => {
          inflight = null;
        });
        return inflight;
      },
      refreshBlocked: async () => {
        try {
          const r = await social.blocked();
          set({ blocked: r.users });
        } catch {
          // keep cached
        }
      },
      clear: () => set({ ...EMPTY, refreshing: false }),
    }),
    {
      name: 'tend.social',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ userId, me, friends, incoming, outgoing, inbox, unreadCount, loadedAt }) => ({
        userId, me, friends, incoming, outgoing, inbox, unreadCount, loadedAt,
      }),
    },
  ),
);

/** New unread nudges/cheers that arrived while the app is open get a gentle toast. */
function announceArrivals(prev: InboxItem[] | null, next: InboxItem[]) {
  if (!prev || AppState.currentState !== 'active') return;
  const known = new Set(prev.map((i) => i.id));
  const fresh = next.find((i) => !known.has(i.id) && i.readAt == null && (i.kind === 'nudge' || i.kind === 'cheer'));
  if (fresh) toast(arrivalToast(fresh), 'heart');
}

export const refreshSocial = () => useSocial.getState().refresh();

// ——— Actions (throw a calm message string on failure so screens can show it) ———

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new Error(socialMessage(e));
  }
}

export async function sendFriendRequest(code: string) {
  const r = await run(() => social.sendRequest(code));
  useSocial.setState((s) => ({ outgoing: [r.request, ...s.outgoing.filter((o) => o.id !== r.request.id)] }));
  void refreshSocial();
  return r.request;
}

export async function acceptRequest(id: string) {
  await run(() => social.accept(id));
  useSocial.setState((s) => ({ incoming: s.incoming.filter((r) => r.id !== id) }));
  await refreshSocial();
}

export async function declineRequest(id: string) {
  await run(() => social.decline(id));
  useSocial.setState((s) => ({ incoming: s.incoming.filter((r) => r.id !== id) }));
  void refreshSocial();
}

export async function cancelRequest(id: string) {
  await run(() => social.cancel(id));
  useSocial.setState((s) => ({ outgoing: s.outgoing.filter((r) => r.id !== id) }));
}

export async function removeFriend(userId: string) {
  await run(() => social.removeFriend(userId));
  useSocial.setState((s) => ({ friends: s.friends.filter((f) => f.userId !== userId) }));
}

export async function blockUser(userId: string) {
  await run(() => social.block(userId));
  useSocial.setState((s) => ({
    friends: s.friends.filter((f) => f.userId !== userId),
    incoming: s.incoming.filter((r) => r.from.userId !== userId),
    outgoing: s.outgoing.filter((r) => r.to.userId !== userId),
  }));
  void useSocial.getState().refreshBlocked();
}

export async function unblockUser(userId: string) {
  await run(() => social.unblock(userId));
  useSocial.setState((s) => ({ blocked: s.blocked.filter((b) => b.userId !== userId) }));
}

const markNudged = (userId: string) =>
  useSocial.setState((s) => ({ friends: s.friends.map((f) => (f.userId === userId ? { ...f, nudgedToday: true } : f)) }));

/** Gentle nudge (1 per friend per day). */
export async function nudgeFriend(userId: string) {
  try {
    await social.nudge(userId, 'nudge', 'nudge.gentle');
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NUDGE_LIMIT') markNudged(userId);
    throw new Error(socialMessage(e));
  }
  markNudged(userId);
}

export async function cheerFriend(userId: string, key: CheerKey) {
  await run(() => social.nudge(userId, 'cheer', key));
}

/** Marks everything read (optimistic). */
export function markAllRead() {
  const s = useSocial.getState();
  if (!s.unreadCount) return;
  const now = Date.now();
  useSocial.setState({ inbox: s.inbox.map((i) => (i.readAt == null ? { ...i, readAt: now } : i)), unreadCount: 0 });
  social.markRead().catch(() => {});
}

/** After signing in to an existing account, a pending invite becomes a friend request. */
async function consumePendingInvite() {
  const code = usePendingInvite.getState().code;
  if (!code || !useAuth.getState().user) return;
  usePendingInvite.getState().clear();
  try {
    const req = await sendFriendRequest(code);
    toast(`Friend request sent to ${req.to.name}`, 'heart');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // Already friends (e.g. the code was used at sign-up) needs no message.
    if (!/already friends/i.test(msg)) toast(msg, 'heart');
  }
}

let started = false;

/** Call once after stores hydrate. */
export function startSocial() {
  if (started) return;
  started = true;
  const user = useAuth.getState().user;
  const s = useSocial.getState();
  if (s.userId && s.userId !== user?.id) s.clear();
  if (user) {
    useSocialPrefs.getState().claim(user.id);
    void refreshSocial();
    void consumePendingInvite();
  }
  useAuth.subscribe((a, prev) => {
    if (!a.user && prev.user) useSocial.getState().clear();
    else if (a.user && a.user.id !== prev.user?.id) {
      // Sharing choices are per account (habit ids); a different account starts private.
      useSocialPrefs.getState().claim(a.user.id);
      void refreshSocial();
      void consumePendingInvite();
    }
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshSocial();
  });
}

/** Poll every 60 s while the calling screen is focused (plus once on focus). */
export function useSocialPolling() {
  useFocusEffect(
    useCallback(() => {
      void refreshSocial();
      const id = setInterval(() => {
        if (AppState.currentState === 'active') void refreshSocial();
      }, 60_000);
      return () => clearInterval(id);
    }, []),
  );
}

/** Actions a screen can await; errors carry calm copy in `message`. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

