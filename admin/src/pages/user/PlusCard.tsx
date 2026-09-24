import type { PlusStatus } from '../../api/types';
import { PlanBadge } from '../../components/Badges';
import { formatDateTime, SOURCE_LABEL, planName } from '../../lib/format';

export function PlusCard({ plus }: { plus: PlusStatus }) {
  return (
    <section className="card" aria-labelledby="plus-title">
      <h2 id="plus-title" className="card-label">
        Plus status
      </h2>
      <div className="plus-status">
        <PlanBadge plus={plus} />
      </div>
      {plus.active ? (
        <dl className="kv">
          <div>
            <dt>Source</dt>
            <dd>{plus.source ? SOURCE_LABEL[plus.source] : '—'}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{planName(plus.basePlanId, plus.productId, plus.expiresAt)}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{plus.expiresAt ? formatDateTime(plus.expiresAt) : 'Never'}</dd>
          </div>
          <div>
            <dt>Auto-renew</dt>
            <dd>{plus.autoRenew ? 'On' : 'Off'}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">No active Plus entitlement.</p>
      )}
    </section>
  );
}
