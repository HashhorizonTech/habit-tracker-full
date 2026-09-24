import { APP_NAME } from '../brand';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <circle cx="12" cy="12" r="7" fill="var(--a1)" />
      <circle cx="20" cy="12" r="7" fill="var(--a2)" fillOpacity="0.9" />
      <circle cx="12" cy="20" r="7" fill="var(--a1)" fillOpacity="0.75" />
      <circle cx="20" cy="20" r="7" fill="var(--a2)" fillOpacity="0.75" />
    </svg>
  );
}

export function Logo({ showTag = true }: { showTag?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">{APP_NAME.toLowerCase()}</span>
      {showTag && <span className="logo-tag">Admin</span>}
    </span>
  );
}
