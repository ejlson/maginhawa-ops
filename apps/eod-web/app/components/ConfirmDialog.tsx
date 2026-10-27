/**
 * Submitting locks records, so it's the one place we ask first
 * (HANDOFF.md §7: "Undo instead of confirm, except the final Submit"). Centred over a dimmed page;
 * Escape or a tap outside cancels. Used by the checklists' and the EOD's "Submit all".
 */
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ConfirmDialog({ title, children, action = 'Submit', busy, onConfirm, onCancel }: {
  title: string; children: ReactNode; action?: string; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const id = useId();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onCancel]);
  return createPortal(
    <div className="confirm-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-b`}>
        <h2 id={`${id}-t`}>{title}</h2>
        <div id={`${id}-b`} className="confirm-body">{children}</div>
        <div className="confirm-acts">
          <button type="button" className="confirm-btn" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm-btn pri" disabled={busy} onClick={onConfirm} autoFocus>{action}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
