// Minimal typed client for the Tend API (docs/API.md). Handles bearer auth and a
// single-flight token refresh — two refreshes racing with one token count as reuse
// on the server and would sign the device out.
import { tokens } from './tokens';

// Dev default works on the Android emulator via `adb reverse tcp:4000 tcp:4000`.
// Set EXPO_PUBLIC_API_URL (e.g. in app/.env) for a phone on Wi-Fi or production.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  /** True when the server couldn't be reached at all (offline, DNS, refused). */
  get offline() {
    return this.status === 0;
  }
}

type Json = Record<string, unknown> | unknown[];

async function raw<T>(path: string, init: RequestInit & { json?: Json; auth?: string | null; timeoutMs?: number } = {}): Promise<T> {
  const { json, auth, timeoutMs = 15_000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...rest.headers,
      },
      body: json ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, 'NET_OFFLINE', 'Could not reach the server');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? `HTTP_${res.status}`, err.message ?? res.statusText);
  }
  return body as T;
}

let refreshing: Promise<string | null> | null = null;

/** Rotate the refresh token once, even if many requests hit 401 together. */
function refreshAccess(): Promise<string | null> {
  refreshing ??= (async () => {
    const refreshToken = await tokens.getRefresh();
    if (!refreshToken) return null;
    try {
      const r = await raw<{ accessToken: string; refreshToken: string }>('/v1/auth/refresh', { method: 'POST', json: { refreshToken } });
      await tokens.set(r.accessToken, r.refreshToken);
      return r.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await tokens.clear();
        onSignedOut?.();
      }
      if (e instanceof ApiError && e.offline) throw e;
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

let onSignedOut: (() => void) | null = null;
/** Called when the session can no longer be refreshed (revoked / expired). */
export const setSignedOutHandler = (fn: () => void) => {
  onSignedOut = fn;
};

/** Authenticated request with one transparent refresh-and-retry on 401. */
export async function api<T>(path: string, init: RequestInit & { json?: Json } = {}): Promise<T> {
  let access = tokens.getAccess();
  if (!access) access = await refreshAccess();
  if (!access) throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in');
  try {
    return await raw<T>(path, { ...init, auth: access });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const next = await refreshAccess();
    if (!next) throw e;
    return raw<T>(path, { ...init, auth: next });
  }
}

/** Unauthenticated call (auth endpoints, health). */
export const publicApi = raw;
