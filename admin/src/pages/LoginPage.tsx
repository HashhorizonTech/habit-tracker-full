import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/context';
import { APP_NAME } from '../brand';
import { FullPageLoader } from '../components/FullPageLoader';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { usePageTitle } from '../lib/usePageTitle';

function loginErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'INVALID_CREDENTIALS':
        return 'Incorrect email or password.';
      case 'ACCOUNT_DISABLED':
        return 'This account has been disabled.';
      case 'RATE_LIMITED':
        return 'Too many sign-in attempts. Wait a minute and try again.';
      case 'VALIDATION_ERROR':
        return 'Enter a valid email and a password of at least 8 characters.';
      default:
        return e.message || 'Sign-in failed.';
    }
  }
  return 'Sign-in failed.';
}

export function LoginPage() {
  usePageTitle('Sign in');
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'loading') return <FullPageLoader />;
  if (state.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const notice = error ?? state.notice ?? null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(loginErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <form className="card login-card" onSubmit={submit} noValidate={false}>
        <Logo />
        <div>
          <h1 className="login-title">Sign in</h1>
          <p className="login-sub">{APP_NAME} admin console. Admin accounts only.</p>
        </div>
        {notice && (
          <div className="alert alert-danger" role="alert">
            {notice}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
