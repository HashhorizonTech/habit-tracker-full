import type { SubscriptionListParams, UserListParams } from './types';

export const qk = {
  stats: ['admin', 'stats'] as const,
  users: (p: UserListParams) => ['admin', 'users', p] as const,
  usersAll: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  subscriptions: (p: SubscriptionListParams) => ['admin', 'subscriptions', p] as const,
  audit: (page: number) => ['admin', 'audit', page] as const,
  all: ['admin'] as const,
};
