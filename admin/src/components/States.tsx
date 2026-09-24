import type { ReactNode } from 'react';
import { errorMessage } from '../lib/errors';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">Couldn't load this</p>
      <p className="state-text">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {children && <p className="state-text">{children}</p>}
    </div>
  );
}

export function Skeleton({ width, height = 14, className = '' }: { width?: number | string; height?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div className="table-wrap" role="status" aria-label="Loading">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? '70%' : '50%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
