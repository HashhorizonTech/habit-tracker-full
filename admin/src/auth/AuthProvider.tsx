import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, onSessionEnd } from '../api/client';
import { getMe, login, logoutRemote } from '../api/endpoints';
import { clearTokens, getRefreshToken, setTokens } from '../api/tokens';
import { AuthContext, type AuthContextValue, type AuthState } from './context';

export const NOT_ADMIN_MESSAGE = "This account doesn't have admin access.";

const NOTICES: Record<string, string> = {
  expired: 'Your session expired. Please sign in again.',
  disabled: 'This account has been disabled.',
  not_admin: NOT_ADMIN_MESSAGE,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    getRefreshToken() ? { status: 'loading' } : { status: 'signedOut' },
  );

  // Session ended by the API client (refresh rejected, account disabled).
  useEffect(
    () =>
      onSessionEnd((reason) => {
        queryClient.clear();
        setState({ status: 'signedOut', notice: NOTICES[reason] });
      }),
    [queryClient],
  );

  // Restore a session from the stored refresh token.
  const bootstrapping = state.status === 'loading';
  useEffect(() => {
    if (!bootstrapping) return;
    let cancelled = false;
    getMe()
      .then(async ({ user }) => {
        if (cancelled) return;
        if (user.role === 'admin') {
          setState({ status: 'signedIn', user });
        } else {
          await logoutRemote();
          clearTokens();
          setState({ status: 'signedOut', notice: NOT_ADMIN_MESSAGE });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Network errors keep the refresh token so a reload can retry.
        const offline = e instanceof ApiError && e.status === 0;
        setState({ status: 'signedOut', notice: offline ? e.message : undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrapping]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await login(email, password);
    setTokens(res.accessToken, res.refreshToken);
    const me = await getMe();
    if (me.user.role !== 'admin') {
      await logoutRemote();
      clearTokens();
      throw new ApiError(403, 'NOT_ADMIN', NOT_ADMIN_MESSAGE);
    }
    setState({ status: 'signedIn', user: me.user });
  }, []);

  const signOut = useCallback(async () => {
    await logoutRemote();
    clearTokens();
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
