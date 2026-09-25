import { request, toQuery } from './client';
import { getRefreshToken } from './tokens';
import type {
  AdminReport,
  AdminStats,
  AdminUserDetail,
  AdminUserRow,
  AuditEntry,
  Entitlement,
  GrantBody,
  LoginResponse,
  MeResponse,
  Paged,
  ReportListParams,
  SubscriptionListParams,
  SubscriptionRow,
  UserListParams,
} from './types';

// ---- Auth ----
export const login = (email: string, password: string) =>
  request<LoginResponse>('POST', '/v1/auth/login', { email, password }, { auth: false });

/** Best-effort server-side revoke of the stored refresh token. */
export async function logoutRemote(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  try {
    await request<void>('POST', '/v1/auth/logout', { refreshToken }, { auth: false });
  } catch {
    // The local session is cleared regardless.
  }
}

export const getMe = () => request<MeResponse>('GET', '/v1/me');

// ---- Admin ----
export const getStats = () => request<AdminStats>('GET', '/v1/admin/stats');

export const listUsers = (p: UserListParams) =>
  request<Paged<AdminUserRow>>(
    'GET',
    `/v1/admin/users${toQuery({ query: p.query.trim(), plan: p.plan, status: p.status, page: p.page, pageSize: p.pageSize })}`,
  );

export const getUser = (id: string) => request<AdminUserDetail>('GET', `/v1/admin/users/${encodeURIComponent(id)}`);

export const grantPlus = (id: string, body: GrantBody) =>
  request<Entitlement>('POST', `/v1/admin/users/${encodeURIComponent(id)}/grant`, body);

export const revokeEntitlement = (id: string, note?: string) =>
  request<Entitlement>('POST', `/v1/admin/entitlements/${encodeURIComponent(id)}/revoke`, note ? { note } : {});

export const setUserDisabled = (id: string, disabled: boolean) =>
  request<AdminUserRow>('POST', `/v1/admin/users/${encodeURIComponent(id)}/${disabled ? 'disable' : 'enable'}`, {});

export const deleteUser = (id: string) => request<void>('DELETE', `/v1/admin/users/${encodeURIComponent(id)}`);

export const listSubscriptions = (p: SubscriptionListParams) =>
  request<Paged<SubscriptionRow>>('GET', `/v1/admin/subscriptions${toQuery({ ...p })}`);

export const listAudit = (page: number, pageSize: number) =>
  request<Paged<AuditEntry>>('GET', `/v1/admin/audit${toQuery({ page, pageSize })}`);

export const listReports = (p: ReportListParams) =>
  request<Paged<AdminReport>>('GET', `/v1/admin/reports${toQuery({ ...p })}`);

export const resolveReport = (id: string, note?: string) =>
  request<AdminReport>('POST', `/v1/admin/reports/${encodeURIComponent(id)}/resolve`, note ? { note } : {});
