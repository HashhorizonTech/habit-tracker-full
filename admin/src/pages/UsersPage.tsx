import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listUsers } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import type { AdminUserRow, PlanFilter, UserStatusFilter } from '../api/types';
import { AccountStatusBadge, PlanBadge } from '../components/Badges';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/States';
import { formatDate, formatNumber, formatRelative } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import { usePageTitle } from '../lib/usePageTitle';
import { useUrlFilters } from '../lib/useSearchParamState';

const PAGE_SIZE = 25;
const PLANS: readonly PlanFilter[] = ['all', 'plus', 'free'];
const STATUSES: readonly UserStatusFilter[] = ['all', 'active', 'disabled'];
const DEFAULTS = { q: '', plan: 'all', status: 'all' };

function UserRow({ u }: { u: AdminUserRow }) {
  const navigate = useNavigate();
  return (
    <tr className="row-link" onClick={() => navigate(`/users/${u.id}`)}>
      <td>
        <Link to={`/users/${u.id}`} className="cell-primary" onClick={(e) => e.stopPropagation()}>
          {u.name || '—'}
        </Link>
      </td>
      <td className="cell-muted">{u.email}</td>
      <td>
        <PlanBadge plus={u.plus} />
      </td>
      <td className="cell-nowrap">{formatDate(u.createdAt)}</td>
      <td className="cell-nowrap cell-muted">{u.lastSyncAt ? formatRelative(u.lastSyncAt) : 'Never'}</td>
      <td className="cell-num">{formatNumber(u.habitCount)}</td>
      <td>
        <AccountStatusBadge disabledAt={u.disabledAt} />
      </td>
    </tr>
  );
}

export function UsersPage() {
  usePageTitle('Users');
  const { params, get, page, set } = useUrlFilters<keyof typeof DEFAULTS>(DEFAULTS);
  const plan = get('plan', PLANS);
  const status = get('status', STATUSES);
  const urlQuery = params.get('q') ?? '';

  // The search box is local state; its debounced value is pushed to the URL (?q=).
  const [search, setSearch] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const debounced = useDebounced(search.trim(), 300);
  if (urlQuery !== seenUrlQuery) {
    // URL changed from outside (back/forward): reflect it in the input.
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== debounced) setSearch(urlQuery);
  }
  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    if (debounced !== urlQuery) set({ q: debounced });
  }, [debounced, urlQuery, set]);

  const listParams = { query: urlQuery, plan, status, page, pageSize: PAGE_SIZE };
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.users(listParams),
    queryFn: () => listUsers(listParams),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Users" subtitle={data ? `${formatNumber(data.total)} matching` : undefined} />
      <div className="toolbar" role="search">
        <div className="field field-inline grow">
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field field-inline">
          <label htmlFor="plan-filter">Plan</label>
          <select id="plan-filter" value={plan} onChange={(e) => set({ plan: e.target.value })}>
            <option value="all">All</option>
            <option value="plus">Plus</option>
            <option value="free">Free</option>
          </select>
        </div>
        <div className="field field-inline">
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={status} onChange={(e) => set({ status: e.target.value })}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {isPending ? (
        <TableSkeleton columns={7} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No users found">Try a different search or clear the filters.</EmptyState>
      ) : (
        <>
          <div className={`table-wrap ${isFetching ? 'is-fetching' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last sync</th>
                  <th scope="col" className="cell-num">
                    Habits
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <UserRow key={u.id} u={u} />
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
