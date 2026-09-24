import { useId, useState } from 'react';
import { revokeEntitlement } from '../../api/endpoints';
import type { Entitlement } from '../../api/types';
import { EntitlementStatusBadge } from '../../components/Badges';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/States';
import { SOURCE_LABEL, formatDate, formatDateTime, planName } from '../../lib/format';
import { useAdminMutation } from '../../lib/useAdminMutation';

const REVOCABLE = new Set<Entitlement['status']>(['active', 'grace', 'on_hold', 'paused']);

function isRevocable(e: Entitlement, now = Date.now()): boolean {
  return REVOCABLE.has(e.status) && (e.expiresAt === null || e.expiresAt > now);
}

export function EntitlementsTable({ entitlements }: { entitlements: Entitlement[] }) {
  const uid = useId();
  const [target, setTarget] = useState<Entitlement | null>(null);
  const [note, setNote] = useState('');
  const [now] = useState(() => Date.now());

  const mutation = useAdminMutation({
    mutationFn: (v: { id: string; note: string }) => revokeEntitlement(v.id, v.note || undefined),
    success: 'Entitlement revoked',
    onSuccess: () => {
      setTarget(null);
      setNote('');
    },
  });

  const sorted = [...entitlements].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="card" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="card-label">
        Entitlement history
      </h2>
      {sorted.length === 0 ? (
        <EmptyState title="No entitlements yet">This user has never had Plus.</EmptyState>
      ) : (
        <div className="table-wrap flush">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Start</th>
                <th scope="col">Expiry</th>
                <th scope="col">Auto-renew</th>
                <th scope="col">Note</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td className="cell-nowrap">{SOURCE_LABEL[e.source]}</td>
                  <td>{planName(e.basePlanId, e.productId, e.expiresAt)}</td>
                  <td>
                    <EntitlementStatusBadge status={e.status} />
                  </td>
                  <td className="cell-nowrap" title={formatDateTime(e.startsAt)}>
                    {formatDate(e.startsAt)}
                  </td>
                  <td className="cell-nowrap" title={e.expiresAt ? formatDateTime(e.expiresAt) : undefined}>
                    {e.expiresAt ? formatDate(e.expiresAt) : 'Never'}
                  </td>
                  <td>{e.autoRenew ? 'Yes' : 'No'}</td>
                  <td className="cell-note">{e.note ?? <span className="muted">—</span>}</td>
                  <td className="cell-actions">
                    {isRevocable(e, now) && (
                      <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setTarget(e)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={target !== null}
        title="Revoke entitlement?"
        confirmLabel="Revoke"
        tone="danger"
        busy={mutation.isPending}
        onCancel={() => {
          setTarget(null);
          setNote('');
        }}
        onConfirm={() => target && mutation.mutate({ id: target.id, note: note.trim() })}
      >
        {target && (
          <>
            <p>
              This ends the <strong>{SOURCE_LABEL[target.source]}</strong> entitlement (
              {planName(target.basePlanId, target.productId, target.expiresAt)}) immediately.
              {target.source.startsWith('play') &&
                ' It does not cancel or refund the Google Play purchase — do that in Play Console.'}
            </p>
            <div className="field">
              <label htmlFor={`${uid}-revoke-note`}>
                Note <span className="muted">(optional)</span>
              </label>
              <input
                id={`${uid}-revoke-note`}
                type="text"
                maxLength={500}
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
              />
            </div>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}
