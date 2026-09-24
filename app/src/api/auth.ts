import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COLLECTION_KEYS, useData } from '@/store/data';
import { ApiError, api, publicApi, setSignedOutHandler } from './client';
import { tokens } from './tokens';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string | number;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/** True when this device holds anything the user created (habits, logs, tasks…). */
function hasLocalData() {
  const d = useData.getState();
  return COLLECTION_KEYS.some((k) => Object.keys(d[k]).length > 0);
}

/**
 * Local data belongs to one account.
 * - Sign up (new account): anything created before signing in (the onboarding habit)
 *   is claimed and uploaded.
 * - Sign in (existing account): the account is restored as-is from the server; the
 *   device's anonymous starter data is dropped so a returning user never gets
 *   duplicate habits from replaying onboarding on a new phone.
 */
function adoptLocalData(user: User, isNewAccount: boolean) {
  const data = useData.getState();
  if (data.ownerId === user.id) return;
  if (isNewAccount && data.ownerId === null && hasLocalData()) {
    data.claim(user.id);
    useData.getState().updateProfile({ name: useData.getState().profile.name || user.name });
    return;
  }
  data.replaceAll(user.id);
  // A brand-new account has no server profile yet; seed it with the name.
  if (isNewAccount) useData.getState().updateProfile({ name: user.name });
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: async (email, password) => {
        const r = await publicApi<AuthResponse>('/v1/auth/login', { method: 'POST', json: { email, password } });
        await tokens.set(r.accessToken, r.refreshToken);
        adoptLocalData(r.user, false);
        set({ user: r.user });
      },
      signUp: async (name, email, password) => {
        const r = await publicApi<AuthResponse>('/v1/auth/register', { method: 'POST', json: { name, email, password } });
        await tokens.set(r.accessToken, r.refreshToken);
        adoptLocalData(r.user, true);
        set({ user: r.user });
      },
      signOut: async () => {
        const refreshToken = await tokens.getRefresh();
        if (refreshToken) await publicApi('/v1/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => {});
        await tokens.clear();
        useData.getState().replaceAll(null);
        set({ user: null });
      },
      deleteAccount: async () => {
        await api('/v1/me', { method: 'DELETE' });
        await tokens.clear();
        useData.getState().replaceAll(null);
        set({ user: null });
      },
    }),
    { name: 'tend.auth', storage: createJSONStorage(() => AsyncStorage), partialize: ({ user }) => ({ user }) },
  ),
);

// A revoked session drops back to signed-out but keeps local data (nothing is lost).
setSignedOutHandler(() => useAuth.setState({ user: null }));

/** Human copy for auth errors (no guilt, no jargon). */
export function authMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'INVALID_CREDENTIALS':
      return "That email and password don't match.";
    case 'EMAIL_TAKEN':
      return 'That email already has an account — try signing in.';
    case 'RATE_LIMITED':
      return 'Too many tries. Take a breath and try again in a minute.';
    case 'VALIDATION_ERROR':
      return 'Check your email, and use a password of at least 8 characters.';
    case 'NET_OFFLINE':
      return "We couldn't reach Tend just now. Check your connection.";
    default:
      return e.message || 'Something went wrong. Please try again.';
  }
}
