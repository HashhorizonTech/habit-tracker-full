import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listSubscriptions } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import type { SubscriptionSourceFilter, SubscriptionStatusFilter } from '../api/types';
import { EntitlementStatusBadge } from '../components/Badges';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/States';
import { SOURCE_LABEL, formatDate, formatDateTime, formatNumber, humanize, planName } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';
import { useUrlFilters } from '../lib/useSearchParamState';

const PAGE_SIZE = 25;
const STATUSES: readonly SubscriptionStatusFilter[] = ['all', 'active', 'canceled', 'expired', 'revoked', 'refunded'];
const SOURCES: readonly SubscriptionSourceFilter[] = ['all', 'play', 'admin', 'trial'];
const SOURCE_FILTER_LABEL: Record<SubscriptionSourceFilter, string> = {
  all: 'All',
  play: 'Google Play',
  admin: 'Admin grant',
  trial: 'Trial',
};
const DEFAULTS = { status: 'all', source: 'all' };

export function SubscriptionsPage() {
  usePageTitle('Subscriptions');
  const { get, page, set } = useUrlFilters<keyof typeof DEFAULTS>(DEFAULTS);
  const status = get('status', STATUSES);
  const source = get('source', SOURCES);
  const params = { status, source, page, pageSize: PAGE_SIZE };

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.subscriptions(params),
    queryFn: () => listSubscriptions(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle={data ? `${formatNumber(data.total)} entitlements` : 'Every Plus entitlement across users.'}
      />
      <div className="toolbar">
        <div className="field field-inline">
          <label htmlFor="sub-status">Status</label>
          <select id="sub-status" value={status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-inline">
          <label htmlFor="sub-source">Source</label>
          <select id="sub-source" value={source} onChange={(e) => set({ source: e.target.value })}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_FILTER_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isPending ? (
        <TableSkeleton columns={8} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No entitlements match">Try other filters.</EmptyState>
      ) : (
        <>
          <div className={`table-wrap ${isFetching ? 'is-fetching' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Source</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Start</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Auto-renew</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/users/${e.userId}`} className="cell-primary">
                        {e.userEmail}
                      </Link>
                    </td>
                    <td className="cell-nowrap">{SOURCE_LABEL[e.source]}</td>
                    <td>{planName(e.basePlanId, e.productId, e.expiresAt)}</td>
                    <td>
                      <EntitlementStatusBadge status={e.status} />
                    </td>
                    <td className="cell-nowrap" title={formatDateTime(e.startsAt)}>
                      {formatDate(e.startsAt)}
                    </td>
                    <td className="cell-nowrap">{e.expiresAt ? formatDate(e.expiresAt) : 'Never'}</td>
                    <td>{e.autoRenew ? 'Yes' : 'No'}</td>
                    <td className="cell-note">{e.note ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => set({ page: p })} />
        </>
      )}
    </>
  );
}
