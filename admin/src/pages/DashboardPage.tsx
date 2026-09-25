import { useQuery } from '@tanstack/react-query';
import { getStats } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import type { AdminStats } from '../api/types';
import { BarChart } from '../components/BarChart';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorState, Skeleton } from '../components/States';
import { formatInr, formatNumber } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

const PLAN_ROWS: { key: keyof AdminStats['plus']['byPlan']; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'lifetime', label: 'Lifetime' },
  { key: 'admin', label: 'Admin grant' },
  { key: 'trial', label: 'Trial' },
];

function PlusBreakdown({ stats }: { stats: AdminStats }) {
  const total = stats.plus.active;
  return (
    <section className="card breakdown" aria-labelledby="breakdown-title">
      <h2 id="breakdown-title" className="card-label">
        Plus by plan
      </h2>
      <ul className="breakdown-list">
        {PLAN_ROWS.map(({ key, label }) => {
          const n = stats.plus.byPlan[key] ?? 0;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <li key={key} className="breakdown-row">
              <span className="breakdown-label">{label}</span>
              <span className="breakdown-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="breakdown-value">{formatNumber(n)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SocialRow({ social }: { social: NonNullable<AdminStats['social']> }) {
  const open = social.openReports;
  return (
    <section aria-labelledby="social-title">
      <h2 id="social-title" className="card-label section-label">
        Social
      </h2>
      <div className="stat-grid">
        <StatCard label="Friendships" value={formatNumber(social.friendships)} />
        <StatCard label="Invites joined · 30 days" value={formatNumber(social.invitesJoined30d)} />
        <StatCard label="Nudges · 7 days" value={formatNumber(social.nudges7d)} />
        <StatCard
          label="Open reports"
          value={formatNumber(open)}
          hint={open > 0 ? 'Review now →' : 'All clear'}
          to="/reports"
          highlight={open > 0}
        />
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard">
      <div className="stat-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="card stat-card">
            <Skeleton width="60%" />
            <Skeleton width="40%" height={30} />
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="card">
          <Skeleton height={160} width="100%" />
        </div>
        <div className="card">
          <Skeleton height={160} width="100%" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { data, error, isPending, refetch } = useQuery({ queryKey: qk.stats, queryFn: getStats });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Users, Plus, social and activity at a glance." />
      {isPending ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              label="Total users"
              value={formatNumber(data.users.total)}
              hint={data.users.disabled ? `${formatNumber(data.users.disabled)} disabled` : undefined}
            />
            <StatCard
              label="New · 7 days"
              value={formatNumber(data.users.new7d)}
              hint={`${formatNumber(data.users.new30d)} in 30 days`}
            />
            <StatCard label="Active · 7 days" value={formatNumber(data.users.active7d)} />
            <StatCard
              label="Plus users"
              value={formatNumber(data.plus.active)}
              hint={
                data.users.total > 0
                  ? `${((data.plus.active / data.users.total) * 100).toFixed(1)}% of users`
                  : undefined
              }
            />
            <StatCard
              label="Est. monthly revenue"
              value={formatInr(data.revenue.monthlyEstimateInr)}
              hint="Active Play subscriptions"
            />
          </div>
          {data.social && <SocialRow social={data.social} />}
          <div className="dash-grid">
            <BarChart title="Sign-ups by day" data={data.signupsByDay} color="a1" />
            <BarChart title="Active users by day" data={data.activeByDay} color="a2" />
            <PlusBreakdown stats={data} />
          </div>
        </>
      )}
    </>
  );
}
