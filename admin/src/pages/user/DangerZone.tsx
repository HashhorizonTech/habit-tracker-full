import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deleteUser, setUserDisabled } from '../../api/endpoints';
import { qk } from '../../api/queryKeys';
import type { AdminUserRow } from '../../api/types';
import { useAdmin } from '../../auth/context';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAdminMutation } from '../../lib/useAdminMutation';

type Pending = 'toggle' | 'delete' | null;

export function DangerZone({ user }: { user: AdminUserRow }) {
  const uid = useId();
  const me = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState('');
  const isSelf = me.id === user.id;
  const disabled = user.disabledAt !== null;

  const close = () => {
    setPending(null);
    setTyped('');
  };

  const toggle = useAdminMutation({
    mutationFn: (disable: boolean) => setUserDisabled(user.id, disable),
    success: (_r, disable) => (disable ? `Disabled ${user.email}` : `Enabled ${user.email}`),
    onSuccess: close,
  });

  const remove = useAdminMutation({
    mutationFn: () => deleteUser(user.id),
    success: `Deleted ${user.email}`,
    onSuccess: () => {
      close();
      queryClient.removeQueries({ queryKey: qk.user(user.id) });
      navigate('/users', { replace: true });
    },
  });

  const emailMatches = typed.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <section className="card danger-zone" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="card-label danger-label">
        Danger zone
      </h2>
      {isSelf && <p className="field-hint">You can't disable or delete your own account here.</p>}
      <div className="danger-row">
        <div>
          <p className="danger-title">{disabled ? 'Enable account' : 'Disable account'}</p>
          <p className="muted">
            {disabled
              ? 'Lets the user sign in and sync again.'
              : 'Blocks sign-in and sync and signs the user out on all devices. Data is kept.'}
          </p>
        </div>
        <button
          type="button"
          className={disabled ? 'btn btn-ghost' : 'btn btn-danger-ghost'}
          disabled={isSelf}
          onClick={() => setPending('toggle')}
        >
          {disabled ? 'Enable…' : 'Disable…'}
        </button>
      </div>
      <div className="danger-row">
        <div>
          <p className="danger-title">Delete account</p>
          <p className="muted">Permanently deletes the account and all of its data. This can't be undone.</p>
        </div>
        <button type="button" className="btn btn-danger" disabled={isSelf} onClick={() => setPending('delete')}>
          Delete…
        </button>
      </div>

      <ConfirmDialog
        open={pending === 'toggle'}
        title={disabled ? 'Enable this account?' : 'Disable this account?'}
        confirmLabel={disabled ? 'Enable' : 'Disable'}
        tone={disabled ? 'primary' : 'danger'}
        busy={toggle.isPending}
        onCancel={close}
        onConfirm={() => toggle.mutate(!disabled)}
      >
        <p>
          {disabled ? (
            <>
              <strong>{user.email}</strong> will be able to sign in again.
            </>
          ) : (
            <>
              <strong>{user.email}</strong> will be signed out everywhere and blocked from signing in.
            </>
          )}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending === 'delete'}
        title="Delete this account?"
        confirmLabel="Delete forever"
        tone="danger"
        busy={remove.isPending}
        confirmDisabled={!emailMatches}
        onCancel={close}
        onConfirm={() => remove.mutate(undefined)}
      >
        <p>
          All habits, check-ins, tasks, focus sessions, moods and entitlements for <strong>{user.email}</strong> will be
          deleted permanently.
        </p>
        <div className="field">
          <label htmlFor={`${uid}-confirm-email`}>Type the email to confirm</label>
          <input
            id={`${uid}-confirm-email`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={user.email}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}
