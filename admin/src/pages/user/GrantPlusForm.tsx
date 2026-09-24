import { useId, useState, type FormEvent } from 'react';
import { grantPlus } from '../../api/endpoints';
import type { AdminUserRow, GrantBody } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDateTime } from '../../lib/format';
import { useAdminMutation } from '../../lib/useAdminMutation';

type Choice = { kind: 'months'; months: number } | { kind: 'days' } | { kind: 'lifetime' };

const QUICK: { id: string; label: string; choice: Choice }[] = [
  { id: 'm1', label: '1 month', choice: { kind: 'months', months: 1 } },
  { id: 'm3', label: '3 months', choice: { kind: 'months', months: 3 } },
  { id: 'm6', label: '6 months', choice: { kind: 'months', months: 6 } },
  { id: 'm12', label: '12 months', choice: { kind: 'months', months: 12 } },
  { id: 'days', label: 'Custom days', choice: { kind: 'days' } },
  { id: 'life', label: 'Lifetime', choice: { kind: 'lifetime' } },
];

function parseDays(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 366 ? n : null;
}

function describe(body: GrantBody): string {
  if ('lifetime' in body) return 'lifetime Plus';
  if ('months' in body) return `${body.months} month${body.months === 1 ? '' : 's'} of Plus`;
  return `${body.days} day${body.days === 1 ? '' : 's'} of Plus`;
}

export function GrantPlusForm({ user }: { user: AdminUserRow }) {
  const uid = useId();
  const [selected, setSelected] = useState('m1');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const choice = QUICK.find((q) => q.id === selected)?.choice ?? { kind: 'lifetime' };
  const daysValue = parseDays(days);
  const trimmedNote = note.trim().slice(0, 500);
  const withNote = trimmedNote ? { note: trimmedNote } : {};

  let body: GrantBody | null = null;
  if (choice.kind === 'months') body = { months: choice.months, ...withNote };
  else if (choice.kind === 'days') body = daysValue ? { days: daysValue, ...withNote } : null;
  else body = { lifetime: true, ...withNote };

  const mutation = useAdminMutation({
    mutationFn: (b: GrantBody) => grantPlus(user.id, b),
    success: (_r, b) => `Granted ${describe(b)} to ${user.email}`,
    onSuccess: () => {
      setConfirming(false);
      setNote('');
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body) setConfirming(true);
  };

  const stacking = user.plus.active && user.plus.expiresAt !== null;

  return (
    <section className="card" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="card-label">
        Grant Plus
      </h2>
      <form onSubmit={submit} className="stack">
        <fieldset className="segmented">
          <legend className="sr-only">Duration</legend>
          {QUICK.map((q) => (
            <label key={q.id} className={`segment ${selected === q.id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={`${uid}-duration`}
                value={q.id}
                checked={selected === q.id}
                onChange={() => setSelected(q.id)}
              />
              <span>{q.label}</span>
            </label>
          ))}
        </fieldset>
        {choice.kind === 'days' && (
          <div className="field">
            <label htmlFor={`${uid}-days`}>Days (1–366)</label>
            <input
              id={`${uid}-days`}
              type="number"
              inputMode="numeric"
              min={1}
              max={366}
              step={1}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={daysValue === null}
              aria-describedby={`${uid}-days-hint`}
            />
            <span id={`${uid}-days-hint`} className={`field-hint ${daysValue === null ? 'is-error' : ''}`}>
              {daysValue === null ? 'Enter a whole number from 1 to 366.' : `${daysValue} days of Plus.`}
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${uid}-note`}>
            Note <span className="muted">(optional, visible in history and audit log)</span>
          </label>
          <input
            id={`${uid}-note`}
            type="text"
            maxLength={500}
            placeholder="e.g. beta tester, support goodwill"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <p className="field-hint">
          {user.plus.active && user.plus.expiresAt === null
            ? 'This user already has lifetime Plus.'
            : stacking && user.plus.expiresAt
              ? `Starts when current Plus ends (${formatDateTime(user.plus.expiresAt)}).`
              : 'Starts now.'}
        </p>
        <div>
          <button type="submit" className="btn btn-primary" disabled={!body || mutation.isPending}>
            Grant Plus…
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming && body !== null}
        title="Grant Plus?"
        confirmLabel="Grant"
        busy={mutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => body && mutation.mutate(body)}
      >
        {body && (
          <p>
            Give <strong>{user.email}</strong> {describe(body)}
            {stacking ? ', starting when their current Plus ends' : ', starting now'}.
            {trimmedNote && (
              <>
                <br />
                Note: <em>{trimmedNote}</em>
              </>
            )}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
