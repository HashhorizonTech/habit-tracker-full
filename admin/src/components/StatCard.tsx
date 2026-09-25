import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Makes the whole card a link. */
  to?: string;
  /** Draws attention to the card (e.g. something needs action). */
  highlight?: boolean;
}

export function StatCard({ label, value, hint, to, highlight = false }: StatCardProps) {
  const className = `card stat-card ${to ? 'stat-card-link' : ''} ${highlight ? 'is-highlighted' : ''}`;
  const body = (
    <>
      <span className="card-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
