import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirm built on the native <dialog> (focus trap, Esc, inert background for free). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && !confirmDisabled) onConfirm();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      {open && (
        <form onSubmit={submit} className="dialog-body">
          <h2 id="dialog-title" className="dialog-title">
            {title}
          </h2>
          <div className="dialog-content">{children}</div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              disabled={busy || confirmDisabled}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
