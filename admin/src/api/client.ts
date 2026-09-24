import type { ApiErrorBody, AuthTokens } from './types';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const err = (value as { error: unknown }).error;
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** Called when the session can no longer be used (refresh failed, account disabled). */
type SessionEndListener = (reason: string) => void;
const sessionEndListeners = new Set<SessionEndListener>();

export function onSessionEnd(listener: SessionEndListener): () => void {
  sessionEndListeners.add(listener);
  return () => sessionEndListeners.delete(listener);
}

function endSession(reason: string): void {
  clearTokens();
  sessionEndListeners.forEach((l) => l(reason));
}

async function rawFetch(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', `Can't reach the API at ${API_URL}. Is the server running?`);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (!res.ok) {
    if (isErrorBody(data)) throw new ApiError(res.status, data.error.code, data.error.message);
    throw new ApiError(res.status, `HTTP_${res.status}`, res.statusText || 'Request failed');
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Refresh: single-flight. The refresh token rotates and is single-use, so two
// concurrent refreshes would revoke each other. Every caller shares one
// in-flight promise; across tabs, a Web Lock serialises refreshes and each
// refresh re-reads the latest token from localStorage inside the lock.
// ---------------------------------------------------------------------------
let refreshInFlight: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    endSession('signed_out');
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in.');
  }
  const res = await rawFetch('POST', '/v1/auth/refresh', { refreshToken }, null);
  let tokens: AuthTokens;
  try {
    tokens = await parse<AuthTokens>(res);
  } catch (e) {
    // Only a definitive rejection ends the session; network/5xx errors keep the token for a retry.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      endSession(e.code === 'ACCOUNT_DISABLED' ? 'disabled' : 'expired');
    }
    throw e;
  }
  setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens.accessToken;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    const run = (): Promise<string> => performRefresh();
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const p = locks ? locks.request('tend-admin-refresh', run) : run();
    refreshInFlight = p.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

interface RequestOptions {
  /** Send the bearer token and auto-refresh on 401. Default true. */
  auth?: boolean;
}

export async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  { auth = true }: RequestOptions = {},
): Promise<T> {
  if (!auth) return parse<T>(await rawFetch(method, path, body, null));

  let token = getAccessToken();
  if (!token) token = await refreshAccessToken();

  let res = await rawFetch(method, path, body, token);
  if (res.status === 401) {
    // If another request already rotated the token meanwhile, just retry with it.
    const current = getAccessToken();
    const next = current && current !== token ? current : await refreshAccessToken();
    res = await rawFetch(method, path, body, next);
  }
  try {
    return await parse<T>(res);
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'ACCOUNT_DISABLED' || e.status === 401)) {
      endSession(e.code === 'ACCOUNT_DISABLED' ? 'disabled' : 'expired');
    }
    throw e;
  }
}

export function toQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
