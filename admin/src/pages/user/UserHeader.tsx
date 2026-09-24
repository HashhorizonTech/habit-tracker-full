import type { AdminUserRow } from '../../api/types';
import { AccountStatusBadge, RoleBadge } from '../../components/Badges';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';

export function UserHeader({ user }: { user: AdminUserRow }) {
  return (
    <header className="page-header user-header">
      <div>
        <h1 className="page-title">
          {user.name || user.email}
          <span className="title-badges">
            <RoleBadge role={user.role} />
            <AccountStatusBadge disabledAt={user.disabledAt} />
          </span>
        </h1>
        <p className="page-subtitle">{user.email}</p>
        <dl className="meta-row">
          <div>
            <dt>Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Last sync</dt>
            <dd title={user.lastSyncAt ? formatDateTime(user.lastSyncAt) : undefined}>
              {user.lastSyncAt ? formatRelative(user.lastSyncAt) : 'Never'}
            </dd>
          </div>
          {user.disabledAt && (
            <div>
              <dt>Disabled</dt>
              <dd>{formatDateTime(user.disabledAt)}</dd>
            </div>
          )}
          <div>
            <dt>ID</dt>
            <dd className="mono">{user.id}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
