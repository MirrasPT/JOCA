// NotificationsInbox — persistent inbox (GET /notifications) behind a floating bell button pinned
// to the top-right of the app, just left of the right tab rail. The WS 'notification' message only
// bumps a refreshKey in App (via useSessionSocket) — this component owns fetch + read state.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppNotification, NotificationKind } from '../types';

const KIND_ICON: Record<NotificationKind, string> = {
  automation: '🤖',
  task_question: '⏸',
  session_done: '✅',
  heartbeat: '💓',
  system: '⚠',
};

// Tempo relativo curto em pt-PT ("agora", "5 min", "3 h", "2 d").
function relTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export default function NotificationsInbox({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    fetch('/notifications')
      .then((r) => r.json())
      .then((d: { unread: number; notifications: AppNotification[] }) => {
        setUnread(d.unread ?? 0);
        setItems(Array.isArray(d.notifications) ? d.notifications : []);
      })
      .catch(() => { /* inbox indisponível — mantém o estado actual */ });
  }, []);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  // Fecha o painel num clique fora (mesmo padrão do menu de modelos do TerminalView).
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = useCallback(async (n: AppNotification, read: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read } : x)));
    setUnread((u) => Math.max(0, u + (read ? -1 : 1)));
    await fetch(`/notifications/${n.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read }),
    }).catch(() => {});
  }, []);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await fetch('/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, []);

  const remove = useCallback(async (n: AppNotification) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    await fetch(`/notifications/${n.id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  return (
    <div className="inbox-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`inbox-bell ${unread > 0 ? 'inbox-bell--unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unread > 0 ? ` (${unread} por ler)` : ''}`}
        aria-expanded={open}
        data-tooltip="Notificações"
        data-tooltip-position="bottom"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="inbox-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="inbox-panel" role="dialog" aria-label="Notificações">
          <div className="inbox-panel-head">
            <span className="inbox-panel-title">Notificações</span>
            <button type="button" className="inbox-mark-all" onClick={markAll} disabled={unread === 0}>
              Marcar todas
            </button>
          </div>
          <div className="inbox-list">
            {items.length === 0 && <div className="inbox-empty">Sem notificações.</div>}
            {items.map((n) => (
              <div key={n.id} className={`inbox-item ${n.read ? '' : 'inbox-item--unread'}`}>
                <span className="inbox-item-icon" aria-hidden>{KIND_ICON[n.kind] ?? '⚠'}</span>
                <div className="inbox-item-body">
                  <div className="inbox-item-top">
                    <span className="inbox-item-title">{n.title}</span>
                    <span className="inbox-item-time">{relTime(n.ts)}</span>
                  </div>
                  <button
                    type="button"
                    className={`inbox-item-text ${expandedId === n.id ? 'inbox-item-text--expanded' : ''}`}
                    onClick={() => setExpandedId((cur) => (cur === n.id ? null : n.id))}
                    title={expandedId === n.id ? 'Encolher' : 'Expandir'}
                  >
                    {n.text}
                  </button>
                </div>
                <div className="inbox-item-actions">
                  {!n.read && (
                    <button type="button" onClick={() => markRead(n, true)} aria-label="Marcar como lida" data-tooltip="Marcar lida" data-tooltip-position="bottom">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                  )}
                  <button type="button" className="inbox-item-delete" onClick={() => remove(n)} aria-label="Apagar notificação">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
