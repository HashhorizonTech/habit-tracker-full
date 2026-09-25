import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { listReports, resolveReport } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import type { AdminReport, ReportParty, ReportStatusFilter } from '../api/types';
import { ReportReasonBadge, ReportStatusBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/States';
import { formatDateTime, formatNumber, formatRelative, humanize } from '../lib/format';
import { useAdminMutation } from '../lib/useAdminMutation';
import { usePageTitle } from '../lib/usePageTitle';
import { useUrlFilters } from '../lib/useSearchParamState';

const PAGE_SIZE = 25;
const STATUSES: readonly ReportStatusFilter[] = ['open', 'resolved', 'all'];
const DEFAULTS = { status: 'open' };

const EMPTY_TEXT: Record<ReportStatusFilter, [string, string]> = {
  open: ['No open reports', 'Nothing needs review right now.'],
  resolved: ['No resolved reports', 'Reports you resolve will show up here.'],
  all: ['No reports yet', 'When users report someone, it will show up here.'],
};

function Party({ party }: { party: ReportParty }) {
  return (
    <Link to={`/users/${party.userId}`} className="party">
      <span className="cell-primary">{party.name || party.email}</span>
      {party.name && <span className="party-email">{party.email}</span>}
    </Link>
  );
}

export function ReportsPage() {
  usePageTitle('Reports');
  const uid = useId();
  const { get, page, set } = useUrlFilters<keyof typeof DEFAULTS>(DEFAULTS);
  const status = get('status', STATUSES);
  const params = { status, page, pageSize: PAGE_SIZE };

  const [target, setTarget] = useState<AdminReport | null>(null);
  const [note, setNote] = useState('');
  const closeDialog = () => {
    setTarget(null);
    setNote('');
  };

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.reports(params),
    queryFn: () => listReports(params),
    placeholderData: keepPreviousData,
  });

  const mutation = useAdminMutation({
    mutationFn: (v: { id: string; note: string }) => resolveReport(v.id, v.note || undefined),
    success: 'Report resolved',
    onSuccess: closeDialog,
  });

  const [emptyTitle, emptyText] = EMPTY_TEXT[status];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          data ? `${formatNumber(data.total)} ${status === 'all' ? '' : `${status} `}reports` : 'Users reported by other users.'
        }
      />
      <div className="toolbar">
        <fieldset className="segmented">
          <legend className="sr-only">Status</legend>
          {STATUSES.map((s) => (
            <label key={s} className={`segment ${status === s ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={`${uid}-status`}
                value={s}
                checked={status === s}
                onChange={() => set({ status: s })}
              />
              <span>{humanize(s)}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {isPending ? (
        <TableSkeleton columns={7} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyText}</EmptyState>
      ) : (
        <>
          <div className={`table-wrap ${isFetching ? 'is-fetching' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Reporter</th>
                  <th scope="col">Reported user</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Details</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-nowrap" title={formatDateTime(r.createdAt)}>
                      {formatRelative(r.createdAt)}
                    </td>
                    <td>
                      <Party party={r.reporter} />
                    </td>
                    <td>
                      <Party party={r.target} />
                    </td>
                    <td>
                      <ReportReasonBadge reason={r.reason} />
                    </td>
                    <td className="cell-note">{r.details || <span className="muted">—</span>}</td>
                    <td title={r.resolvedAt ? `Resolved ${formatDateTime(r.resolvedAt)}` : undefined}>
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <Link
                          to={`/users/${r.target.userId}`}
                          className="btn btn-ghost btn-sm"
                          title="Open the reported user (disable or delete from there)"
                        >
                          Review user
                        </Link>
                        {r.status === 'open' && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setTarget(r)}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => set({ page: p })} />
        </>
      )}
      <ConfirmDialog
        open={target !== null}
        title="Resolve report?"
        confirmLabel="Resolve"
        busy={mutation.isPending}
        onCancel={closeDialog}
        onConfirm={() => target && mutation.mutate({ id: target.id, note: note.trim() })}
      >
        {target && (
          <>
            <p>
              <strong>{target.reporter.name || target.reporter.email}</strong> reported{' '}
              <strong>{target.target.name || target.target.email}</strong> for{' '}
              <strong>{humanize(target.reason).toLowerCase()}</strong>. Resolving closes the report; it doesn't change
              either account. To disable the reported user,{' '}
              <Link to={`/users/${target.target.userId}`} onClick={closeDialog}>
                open their page
              </Link>
              .
            </p>
            <div className="field">
              <label htmlFor={`${uid}-resolve-note`}>
                Note <span className="muted">(optional)</span>
              </label>
              <input
                id={`${uid}-resolve-note`}
                type="text"
                maxLength={500}
                placeholder="e.g. Warned user, disabled account, no action needed"
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
              />
            </div>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
