import { useEffect } from 'react';

export interface ToastItem {
  id: string;
  sessionName: string;
  sessionId: string;
  timestamp: number;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onSelect: (sessionId: string) => void;
}

const AUTO_DISMISS_MS = 5000;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
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

function Toast({ item, onDismiss, onSelect }: { item: ToastItem; onDismiss: (id: string) => void; onSelect: (sessionId: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div className="toast toast--done" role="alert">
      <div className="toast-icon" aria-hidden>
        <CheckIcon />
      </div>
      <div className="toast-body">
        <div className="toast-title">Session done</div>
        <div className="toast-session">{item.sessionName}</div>
      </div>
      <button
        className="toast-action"
        onClick={() => { onSelect(item.sessionId); onDismiss(item.id); }}
      >
        Open
      </button>
      <button
        className="toast-dismiss"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss, onSelect }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} onSelect={onSelect} />
      ))}
    </div>
  );
}
