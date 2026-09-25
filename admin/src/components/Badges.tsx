import type { EntitlementStatus, PlusStatus, ReportReason, ReportStatus } from '../api/types';
import { humanize, plusLabel } from '../lib/format';

export function PlanBadge({ plus }: { plus: PlusStatus }) {
  const { label, tone } = plusLabel(plus);
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function AccountStatusBadge({ disabledAt }: { disabledAt: number | null }) {
  return disabledAt ? (
    <span className="badge badge-danger">Disabled</span>
  ) : (
    <span className="badge badge-positive">Active</span>
  );
}

const STATUS_TONE: Record<EntitlementStatus, string> = {
  active: 'positive',
  grace: 'warn',
  on_hold: 'warn',
  paused: 'warn',
  canceled: 'muted',
  expired: 'muted',
  revoked: 'danger',
  refunded: 'danger',
};

export function EntitlementStatusBadge({ status }: { status: EntitlementStatus }) {
  return <span className={`badge badge-${STATUS_TONE[status]}`}>{humanize(status)}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  return role === 'admin' ? <span className="badge badge-plus">Admin</span> : <span className="badge badge-free">User</span>;
}

const REASON_TONE: Record<ReportReason, string> = {
  harassment: 'danger',
  inappropriate: 'danger',
  spam: 'warn',
  other: 'muted',
};

export function ReportReasonBadge({ reason }: { reason: ReportReason }) {
  return <span className={`badge badge-${REASON_TONE[reason] ?? 'muted'}`}>{humanize(reason)}</span>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return status === 'open' ? (
    <span className="badge badge-warn">Open</span>
  ) : (
    <span className="badge badge-positive">Resolved</span>
  );
}
