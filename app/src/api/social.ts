// Friends, nudges and push tokens (docs/API.md v1.2). Social never sees raw habit data —
// only the FriendCard the owner publishes.
import { ApiError, api } from './client';

export interface FriendCardHabit {
  name: string;
  icon: string;
  hue: number;
  doneToday: boolean;
  streak: number;
}

export interface FriendCard {
  streak: number;
  longestStreak: number;
  level: number;
  xp: number;
  todayDone: number;
  todayTotal: number;
  /** 0–100 day %. */
  todayPct: number;
  /** YYYY-MM-DD: the owner's local day the numbers are for. */
  date: string;
  /** Unlocked badge ids (max 20). */
  badges: string[];
  /** Only habits the owner chose to share (max 30). */
  habits: FriendCardHabit[];
  updatedAt: number;
}

export interface PublicUser {
  userId: string;
  name: string;
  initial: string;
}

export interface Friend extends PublicUser {
  since: number;
  card: FriendCard | null;
  nudgedToday: boolean;
}

export interface RequestItem {
  id: string;
  from: PublicUser;
  to: PublicUser;
  createdAt: number;
}

export type InboxKind = 'nudge' | 'cheer' | 'friend_request' | 'friend_accepted' | 'invite_joined';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  from: PublicUser;
  message: string | null;
  createdAt: number;
  readAt: number | null;
}

export interface SocialMe {
  inviteCode: string;
  inviteUrl: string;
  rewardsEarned: number;
  rewardsLeft: number;
  settings: { shareHabitNames: boolean };
}

export type NudgeKey = 'nudge.gentle' | 'nudge.streak';
export type CheerKey = 'cheer.proud' | 'cheer.keepgoing' | 'cheer.fire';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export interface BlockedUser {
  userId: string;
  name: string;
  blockedAt: number;
}

const id = encodeURIComponent;

/** Strip the display dash / spaces and upper-case: "k7pq-2mxr" → "K7PQ2MXR". */
export const normalizeCode = (code: string) => code.replace(/[^a-z0-9]/gi, '').toUpperCase();

/** "K7PQ2MXR" → "K7PQ-2MXR" for display. */
export const formatCode = (code: string) => {
  const c = normalizeCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

export const social = {
  me: () => api<SocialMe>('/v1/social/me'),
  updateSettings: (settings: { shareHabitNames: boolean }) =>
    api<{ shareHabitNames: boolean }>('/v1/social/settings', { method: 'PUT', json: settings }),
  publishCard: (card: FriendCard) => api<void>('/v1/social/card', { method: 'PUT', json: card as unknown as Record<string, unknown> }),

  sendRequest: (code: string) => api<{ request: RequestItem }>('/v1/social/requests', { method: 'POST', json: { code: normalizeCode(code) } }),
  requests: () => api<{ incoming: RequestItem[]; outgoing: RequestItem[] }>('/v1/social/requests'),
  accept: (requestId: string) => api<unknown>(`/v1/social/requests/${id(requestId)}/accept`, { method: 'POST' }),
  decline: (requestId: string) => api<unknown>(`/v1/social/requests/${id(requestId)}/decline`, { method: 'POST' }),
  cancel: (requestId: string) => api<void>(`/v1/social/requests/${id(requestId)}`, { method: 'DELETE' }),

  friends: () => api<{ friends: Friend[] }>('/v1/social/friends'),
  removeFriend: (userId: string) => api<void>(`/v1/social/friends/${id(userId)}`, { method: 'DELETE' }),
  nudge: (userId: string, kind: 'nudge' | 'cheer', message?: NudgeKey | CheerKey) =>
    api<unknown>(`/v1/social/friends/${id(userId)}/nudge`, { method: 'POST', json: message ? { kind, message } : { kind } }),

  inbox: (since?: number) => api<{ items: InboxItem[] }>(`/v1/social/inbox${since ? `?since=${since}` : ''}`),
  markRead: (ids?: string[]) => api<void>('/v1/social/inbox/read', { method: 'POST', json: ids ? { ids } : {} }),

  block: (userId: string) => api<void>(`/v1/social/block/${id(userId)}`, { method: 'POST' }),
  unblock: (userId: string) => api<void>(`/v1/social/block/${id(userId)}`, { method: 'DELETE' }),
  blocked: () => api<{ users: BlockedUser[] }>('/v1/social/blocked'),
  report: (userId: string, reason: ReportReason, details?: string) =>
    api<unknown>(`/v1/social/report/${id(userId)}`, { method: 'POST', json: details ? { reason, details } : { reason } }),
};

export const push = {
  register: (token: string, platform: 'android' | 'ios', kind: 'fcm' | 'expo') =>
    api<void>('/v1/push/token', { method: 'POST', json: { token, platform, kind } }),
  unregister: (token: string) => api<void>('/v1/push/token', { method: 'DELETE', json: { token } }),
};

/** Calm copy for social errors. */
export function socialMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'CODE_NOT_FOUND':
      return "We couldn't find that code. Check it and try again.";
    case 'CANNOT_ADD_SELF':
      return "That's your own code — share it with a friend instead.";
    case 'ALREADY_FRIENDS':
      return "You're already friends.";
    case 'REQUEST_PENDING':
      return 'A request is already on its way.';
    case 'BLOCKED':
      return "You can't add this person right now.";
    case 'TOO_MANY_REQUESTS':
      return 'You have lots of requests waiting. Give them a little time.';
    case 'NUDGE_LIMIT':
      return "You've already nudged them today.";
    case 'NET_OFFLINE':
      return "We couldn't reach Tend just now. Check your connection.";
    default:
      return e.message || 'Something went wrong. Please try again.';
  }
}
