// Types mirroring docs/API.md (v1 auth + v1.1 Plus / admin).

export type Role = 'user' | 'admin';

export type EntitlementSource = 'play_subscription' | 'play_lifetime' | 'admin' | 'trial';

export type EntitlementStatus =
  | 'active'
  | 'grace'
  | 'on_hold'
  | 'paused'
  | 'canceled'
  | 'expired'
  | 'revoked'
  | 'refunded';

export interface Entitlement {
  id: string;
  userId: string;
  source: EntitlementSource;
  productId: string | null;
  basePlanId: string | null;
  status: EntitlementStatus;
  startsAt: number;
  expiresAt: number | null;
  autoRenew: boolean;
  note: string | null;
  grantedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlusStatus {
  active: boolean;
  source: EntitlementSource | null;
  expiresAt: number | null;
  autoRenew: boolean;
  productId: string | null;
  basePlanId: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface MeResponse {
  user: User;
  profile: unknown;
  plus: PlusStatus;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AdminStats {
  users: { total: number; new7d: number; new30d: number; active7d: number; disabled: number };
  plus: {
    active: number;
    bySource: Partial<Record<EntitlementSource, number>>;
    byPlan: { monthly: number; yearly: number; lifetime: number; admin: number; trial: number };
  };
  revenue: { monthlyEstimateInr: number };
  signupsByDay: DayCount[];
  activeByDay: DayCount[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
  lastSyncAt: number | null;
  disabledAt: number | null;
  habitCount: number;
  plus: PlusStatus;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  profile: { xp: number; level: number; themeId: string | null } | null;
  counts: { habits: number; habitLogs: number; tasks: number; focusSessions: number; moodLogs: number };
  entitlements: Entitlement[];
}

export type PlanFilter = 'all' | 'plus' | 'free';
export type UserStatusFilter = 'all' | 'active' | 'disabled';

export interface UserListParams {
  query: string;
  plan: PlanFilter;
  status: UserStatusFilter;
  page: number;
  pageSize: number;
}

export type GrantBody =
  | { months: number; note?: string }
  | { days: number; note?: string }
  | { lifetime: true; note?: string };

export type SubscriptionStatusFilter = 'all' | 'active' | 'canceled' | 'expired' | 'revoked' | 'refunded';
export type SubscriptionSourceFilter = 'all' | 'play' | 'admin' | 'trial';

export interface SubscriptionListParams {
  status: SubscriptionStatusFilter;
  source: SubscriptionSourceFilter;
  page: number;
  pageSize: number;
}

export type SubscriptionRow = Entitlement & { userEmail: string };

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  details: unknown;
  createdAt: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
