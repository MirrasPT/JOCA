// NotificationsInbox — a caixa de entrada persistente (GET /notifications), agora como painel do
// rail direito (irmão de Files/Toolkit/Settings) em vez de um sino flutuante sobre o conteúdo.
// Era um elemento solto, fora do sistema de painéis: abria por cima do trabalho e tapava-o. Como
// separador do rail abre na mesma coluna, com o mesmo cabeçalho e o mesmo gesto de fechar.
//
// A mensagem WS 'notification' só incrementa um refreshKey no App (via useSessionSocket) — quem
// faz fetch e gere o estado de lido é este componente. A contagem por ler sobe ao App
// (`onUnreadChange`) para o separador do rail poder mostrar o badge com o painel FECHADO — se a
// contagem vivesse só aqui, desaparecia com o painel e ninguém saberia que há trabalho parado.
import { useCallback, useEffect, useState } from 'react';
import type { AppNotification, NotificationKind } from '../types';
import './notifications-inbox.css';

// Um glifo por tipo. Sem emojis (regra global do JOCA) — traço fino, como o resto dos ícones.
function KindIcon({ kind }: { kind: NotificationKind }) {
  const common = {
    width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  switch (kind) {
    case 'automation': // relógio: correu por agenda
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'task_question': // pausa: está bloqueado à espera de resposta
      return <svg {...common}><path d="M10 5v14M14 5v14" /></svg>;
    case 'session_done': // visto: acabou
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case 'heartbeat': // pulso: sinal de vida
      return <svg {...common}><path d="M3 12h4l2.5-7 5 14L17 12h4" /></svg>;
    case 'manager': // balão: o gestor falou
      return <svg {...common}><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" /></svg>;
    default: // aviso
      return <svg {...common}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5v.01" /></svg>;
  }
}

function ChevronsRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  );
}

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

interface Props {
  refreshKey: number;
  /** Sobe a contagem por ler para o badge do separador do rail. */
  onUnreadChange?: (unread: number) => void;
  /**
   * Abrir o sítio de onde a notificação veio. O `meta` já traz o contexto todo
   * (`sessionId`/`taskId`/`automationId`/`projectId`) — só nunca esteve ligado a um clique.
   * Quem sabe navegar é o `App.tsx`; aqui só se chama.
   */
  onOpenTarget: (target: AppNotification['meta']) => void;
  onClose: () => void;
}

export default function NotificationsInbox({ refreshKey, onUnreadChange, onOpenTarget, onClose }: Props) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { onUnreadChange?.(unread); }, [unread, onUnreadChange]);

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

  // Abrir = ir ao sítio + dar por vista. Quem clica já viu — deixar por ler obrigaria a um segundo
  // clique só para limpar o badge.
  const open = useCallback((n: AppNotification) => {
    if (!n.read) void markRead(n, true);
    onOpenTarget(n.meta);
  }, [markRead, onOpenTarget]);

  return (
    <div className="inbox-view">
      <div className="files-view-header">
        <div>
          <span className="files-view-title">Notificações</span>
          <span className="files-view-subtitle">{unread > 0 ? `${unread} por ler` : 'tudo lido'}</span>
        </div>
        <div className="inbox-view-head-actions">
          <button type="button" className="inbox-mark-all" onClick={markAll} disabled={unread === 0}>
            Marcar todas
          </button>
          <button className="files-view-close" onClick={onClose} aria-label="Fechar notificações" data-tooltip="Fechar painel" data-tooltip-position="bottom">
            <ChevronsRight />
          </button>
        </div>
      </div>

      <div className="inbox-list">
        {items.length === 0 && <div className="inbox-empty">Sem notificações.</div>}
        {/* Por responder primeiro. Uma pergunta bloqueada não pode afundar sob avisos
            informativos mais recentes — é a única categoria em que o tempo custa alguma coisa. */}
        {[...items]
          .sort((a, b) => {
            const act = (n: AppNotification) => (!n.read && n.priority === 'action' ? 1 : 0);
            return act(b) - act(a) || b.ts - a.ts;
          })
          .map((n) => {
            const blocking = !n.read && n.priority === 'action';
            const expanded = expandedId === n.id;
            return (
              <div
                key={n.id}
                className={`inbox-item ${n.read ? '' : 'inbox-item--unread'} ${blocking ? 'inbox-item--action' : ''}`}
              >
                <span className="inbox-item-icon" aria-hidden><KindIcon kind={n.kind} /></span>
                {/* Navegação = controlo real (<button>), não um div com onClick: tem de responder a
                    Enter/Espaço e aparecer na ordem de tabulação. Os botões de expandir/apagar são
                    IRMÃOS deste, nunca filhos — botão dentro de botão é HTML inválido. */}
                <button
                  type="button"
                  className="inbox-item-nav"
                  onClick={() => open(n)}
                  aria-label={`${blocking ? 'Precisa de ti: ' : 'Abrir: '}${n.title}`}
                >
                  <span className="inbox-item-top">
                    <span className="inbox-item-title">
                      {n.title}
                      {/* Um bloqueio por responder não pode ler-se igual a "está feito". */}
                      {blocking && <span className="inbox-badge inbox-badge--action">precisa de ti</span>}
                      {(n.count ?? 1) > 1 && (
                        <span className="inbox-badge inbox-badge--count">×{n.count}</span>
                      )}
                    </span>
                    <span className="inbox-item-time">{relTime(n.ts)}</span>
                  </span>
                  <span className={`inbox-item-text ${expanded ? 'inbox-item-text--expanded' : ''}`}>
                    {n.text}
                  </span>
                </button>
                <div className="inbox-item-actions">
                  <button
                    type="button"
                    onClick={() => setExpandedId((cur) => (cur === n.id ? null : n.id))}
                    aria-label={expanded ? 'Encolher texto' : 'Ver texto todo'}
                    aria-expanded={expanded}
                    data-tooltip={expanded ? 'Encolher' : 'Expandir'}
                    data-tooltip-position="bottom"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: expanded ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
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
            );
          })}
      </div>
    </div>
  );
}
