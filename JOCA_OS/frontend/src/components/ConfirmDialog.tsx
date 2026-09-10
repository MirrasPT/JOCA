// ConfirmDialog — the mandatory stop before an action that cannot be undone.
//
// It exists because the sidebar can now remove projects: there is no "Danger zone" there framing
// the button, and a trash can one click away, right next to archiving, deletes work by mistake.
// The dialog says WHAT is lost and WHAT stays BEFORE the click — the difference has to be visible
// before, not after.
//
// Accessibility handled as in the project modal: `role="alertdialog"` (it is a warning, not a
// form), initial focus on the SAFE button (Cancel) and not on the destructive one, a real Tab
// focus-trap — `aria-modal` promises the rest goes inert but does not implement it — and
// Escape/click outside to cancel. Enter in a dialog like this never confirms by itself: whoever
// confirms presses the button.
import { useCallback, useEffect, useRef } from 'react';
import './confirm-dialog.css';

export default function ConfirmDialog({
  title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // In refs so the keyboard effect runs only once: without this, a handler recreated on every
  // render removes and re-adds the listener and the focus jumps.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current(); return; }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onOverlayDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  return (
    <div className="confirm-overlay" onMouseDown={onOverlayDown}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
      >
        <div className="confirm-dialog-head">
          <span className="confirm-dialog-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" /><path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </span>
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <div id="confirm-dialog-body" className="confirm-dialog-body">{children}</div>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="confirm-btn" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="confirm-btn confirm-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
