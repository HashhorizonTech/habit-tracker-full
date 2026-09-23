import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useData } from '@/store/data';
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

/** Local data belongs to one account; switching accounts starts from that account's server copy. */
function adoptLocalData(user: User) {
  const data = useData.getState();
  if (data.ownerId === user.id) return;
  if (data.ownerId === null) {
    // First sign-in on this device: upload whatever was created before signing in.
    data.claim(user.id);
    if (!data.profile.name) data.updateProfile({ name: user.name });
  } else {
    data.replaceAll(user.id);
    useData.getState().updateProfile({ name: user.name });
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: async (email, password) => {
        const r = await publicApi<AuthResponse>('/v1/auth/login', { method: 'POST', json: { email, password } });
        await tokens.set(r.accessToken, r.refreshToken);
        adoptLocalData(r.user);
        set({ user: r.user });
      },
      signUp: async (name, email, password) => {
        const r = await publicApi<AuthResponse>('/v1/auth/register', { method: 'POST', json: { name, email, password } });
        await tokens.set(r.accessToken, r.refreshToken);
        adoptLocalData(r.user);
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
