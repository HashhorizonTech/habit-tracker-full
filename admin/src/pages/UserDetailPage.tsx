import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getUser } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { usePageTitle } from '../lib/usePageTitle';
import { CountsCard } from './user/CountsCard';
import { DangerZone } from './user/DangerZone';
import { EntitlementsTable } from './user/EntitlementsTable';
import { GrantPlusForm } from './user/GrantPlusForm';
import { PlusCard } from './user/PlusCard';
import { UserHeader } from './user/UserHeader';

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading user" className="stack">
      <Skeleton width={260} height={32} />
      <Skeleton width={200} />
      <div className="detail-grid">
        <div className="card">
          <Skeleton width="100%" height={120} />
        </div>
        <div className="card">
          <Skeleton width="100%" height={120} />
        </div>
      </div>
    </div>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { data, error, isPending, refetch } = useQuery({ queryKey: qk.user(id), queryFn: () => getUser(id) });
  usePageTitle(data ? data.user.email : 'User');

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/users">← Users</Link>
      </nav>
      {isPending ? (
        <DetailSkeleton />
      ) : error ? (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="User not found">It may have been deleted.</EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )
      ) : (
        <>
          <UserHeader user={data.user} />
          <div className="detail-grid">
            <CountsCard counts={data.counts} profile={data.profile} />
            <PlusCard plus={data.user.plus} />
          </div>
          <GrantPlusForm user={data.user} />
          <EntitlementsTable entitlements={data.entitlements} />
          <DangerZone user={data.user} />
        </>
      )}
    </>
  );
}
