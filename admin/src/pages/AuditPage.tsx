import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listAudit } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/States';
import { formatDateTime, formatRelative, humanize } from '../lib/format';
import { fullDetails, summarizeDetails } from '../lib/summarize';
import { usePageTitle } from '../lib/usePageTitle';
import { useUrlFilters } from '../lib/useSearchParamState';

const PAGE_SIZE = 50;
const DEFAULTS = {};

export function AuditPage() {
  usePageTitle('Audit log');
  const { page, set } = useUrlFilters<never>(DEFAULTS);
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.audit(page),
    queryFn: () => listAudit(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin write, newest first." />
      {isPending ? (
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing logged yet">Admin actions such as grants and revokes will show up here.</EmptyState>
      ) : (
        <>
          <div className={`table-wrap ${isFetching ? 'is-fetching' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Admin</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-nowrap" title={formatDateTime(a.createdAt)}>
                      {formatRelative(a.createdAt)}
                    </td>
                    <td className="cell-muted">{a.adminEmail}</td>
                    <td>
                      <span className="badge badge-muted">{humanize(a.action.replace(/[.:]/g, ' '))}</span>
                    </td>
                    <td>
                      {a.targetUserId ? (
                        <Link to={`/users/${a.targetUserId}`}>{a.targetEmail ?? a.targetUserId}</Link>
                      ) : (
                        (a.targetEmail ?? <span className="muted">—</span>)
                      )}
                    </td>
                    <td className="cell-note" title={fullDetails(a.details)}>
                      {summarizeDetails(a.details) || <span className="muted">—</span>}
                    </td>
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
