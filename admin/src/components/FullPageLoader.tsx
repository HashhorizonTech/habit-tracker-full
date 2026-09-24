import { Logo } from './Logo';

export function FullPageLoader() {
  return (
    <div className="full-page-loader" role="status" aria-live="polite">
      <Logo />
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
