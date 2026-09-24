import { STORAGE_PREFIX } from '../brand';

// Access token: memory only. Refresh token: localStorage (survives reloads).
const REFRESH_KEY = `${STORAGE_PREFIX}.refreshToken`;

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  try {
    localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // Storage unavailable (private mode): session lasts for this tab only.
  }
}

export function clearTokens(): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}
