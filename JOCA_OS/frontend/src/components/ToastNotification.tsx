// Toasts — the ephemeral warning in the corner of the screen.
//
// Two differences from the version that only announced finished sessions:
//   • the toast LEADS SOMEWHERE. It carries the same `meta` as the persistent notification and the
//     OS one, and the click resolves it by the same contract (session → terminal · project → workspace);
//   • a `priority: 'action'` toast does NOT auto-close. It is a block waiting for an answer;
//     evaporating after 5 seconds is losing the request, which is precisely the opposite of what
//     is asked of a thing marked "needs you".
import { useEffect } from 'react';
import type { NotificationPriority } from '../types';
import { hasNotificationTarget, type NotificationTarget } from '../lib/notify';
import './ToastNotification.css';

export interface ToastItem {
  id: string;
  sessionName: string;
  sessionId: string;
  timestamp: number;
  /** Toast header. By default "Session finished" — the historical origin of these warnings. */
  title?: string;
  /** 'action' = someone is blocked waiting for you; it never disappears on its own. */
  priority?: NotificationPriority;
  /** Click target. Without this the toast falls back to the old behavior: open `sessionId`. */
  target?: NotificationTarget;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onSelect: (sessionId: string) => void;
  /** Navigation shared with the inbox and with the OS notification. Without it, only `onSelect`. */
  onOpenTarget?: (target: NotificationTarget) => void;
}

const AUTO_DISMISS_MS = 5000;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Thin-stroke exclamation mark — the visual pair of the check, for the toast that asks for an answer.
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Toast({ item, onDismiss, onSelect, onOpenTarget }: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  onSelect: (sessionId: string) => void;
  onOpenTarget?: (target: NotificationTarget) => void;
}) {
  const acao = item.priority === 'action';

  useEffect(() => {
    // A block stays until someone touches it.
    if (acao) return;
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss, acao]);

  // Explicit target when there is one; otherwise, the usual behavior (open the toast's session).
  const podeAbrir = Boolean(
    (item.target && hasNotificationTarget(item.target) && onOpenTarget) || item.sessionId,
  );
  const abrir = () => {
    if (item.target && hasNotificationTarget(item.target) && onOpenTarget) onOpenTarget(item.target);
    else if (item.sessionId) onSelect(item.sessionId);
    onDismiss(item.id);
  };

  return (
    // `role="alert"` only for the informational one: a request for an answer is `alertdialog`-like,
    // but the content still lives in a focusable button — you reach it by Tab, without stealing focus.
    <div className={`toast ${acao ? 'toast--action' : 'toast--done'}`} role={acao ? 'status' : 'alert'}>
      <div className="toast-icon" aria-hidden>
        {acao ? <AlertIcon /> : <CheckIcon />}
      </div>

      {/* The whole body is the click target — it does not force you to hit a 60px button. It is a
          <button> sibling of the other two (never nested: a button inside a button is invalid HTML). */}
      <button
        type="button"
        className="toast-open"
        onClick={abrir}
        disabled={!podeAbrir}
      >
        <span className="toast-title">{item.title ?? 'Session finished'}</span>
        <span className="toast-session">{item.sessionName}</span>
      </button>

      {acao && <span className="toast-flag">needs you</span>}

      <button
        className="toast-dismiss"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss, onSelect, onOpenTarget }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} onSelect={onSelect} onOpenTarget={onOpenTarget} />
      ))}
    </div>
  );
}
