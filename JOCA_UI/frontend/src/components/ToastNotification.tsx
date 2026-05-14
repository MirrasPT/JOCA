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

function Toast({ item, onDismiss, onSelect }: { item: ToastItem; onDismiss: (id: string) => void; onSelect: (sessionId: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div className="toast toast--done" role="alert">
      <div className="toast-icon" aria-hidden>✓</div>
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
        ×
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
