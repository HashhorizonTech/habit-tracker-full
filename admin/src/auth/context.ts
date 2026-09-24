import { createContext, useContext } from 'react';
import type { User } from '../api/types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; user: User };

export interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in admin. Only call inside routes guarded by <RequireAdmin>. */
export function useAdmin(): User {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useAdmin called while signed out');
  return state.user;
}
