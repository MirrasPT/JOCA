import NotificationsInbox from './NotificationsInbox';
import SettingsPanel from './SettingsPanel';
import type { AppNotification, JocaItems, JocaLogicInfo, Project, RightPanel, RuntimeInfo, SessionInfo } from '../types';
import './notifications-inbox.css';

interface ServiceConnection {
  id: string;
  name: string;
  status: 'connected' | 'mock' | 'offline';
  scope: string;
}

interface Props {
  panel: RightPanel;
  width: string;
  runtimeInfo: RuntimeInfo | null;
  jocaLogicInfo: JocaLogicInfo | null;
  sessions: SessionInfo[];
  projects: Project[];
  services: ServiceConnection[];
  events: { id: string; title: string; detail: string; timestamp: number }[];
  jocaItems: JocaItems | null;
  onSetPanel: (panel: RightPanel) => void;
  onLoadToolkit: () => void;
  onToolkitItemsChange: (items: JocaItems) => void;
  onInsertToolkit: (text: string) => void;
  onRunCommand: (command: string) => void;
  onReloadRuntime: () => void;
  /** Notificações: refetch a cada evento WS + contagem por ler para o badge do separador. */
  notificationsRefresh: number;
  unreadNotifications: number;
  onUnreadNotificationsChange: (unread: number) => void;
  /** Clicar numa notificação leva ao sítio de onde veio. Quem sabe navegar é o App. */
  onOpenNotificationTarget: (target: AppNotification['meta']) => void;
}

function RightTabIcon({ name }: { name: 'toolkit' | 'settings' | 'inbox' }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'inbox') return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
  if (name === 'toolkit') return <svg {...common}><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8Z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>;
  return <svg {...common}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z" /></svg>;
}

// Nome legível de cada separador (tooltip + leitor de ecrã). O texto do rail continua a ser a
// chave curta, que é o que cabe na coluna.
const TAB_LABEL: Record<'inbox' | 'toolkit' | 'settings', string> = {
  inbox: 'Notificações',
  toolkit: 'Kit',
  settings: 'Definições',
};

export default function RightWorkspace({
  panel, width, runtimeInfo, jocaLogicInfo, sessions, projects, services, events, jocaItems,
  onSetPanel, onLoadToolkit, onToolkitItemsChange, onInsertToolkit, onRunCommand, onReloadRuntime,
  notificationsRefresh, unreadNotifications, onUnreadNotificationsChange, onOpenNotificationTarget,
}: Props) {
  const expanded = panel !== null;
  const toggle = (next: Exclude<RightPanel, null>) => onSetPanel(panel === next ? null : next);

  return (
    <div
      className={`files-slot ${expanded ? 'files-slot--open' : 'files-slot--closed'}`}
      style={{ width, minWidth: width, maxWidth: width, flex: `0 0 ${width}` }}
    >
      {panel && (
        <div className="right-panel-content" key={panel} id="right-panel" role="tabpanel" aria-labelledby={`tab-${panel}`}>
          {panel === 'inbox' ? (
            <NotificationsInbox
              refreshKey={notificationsRefresh}
              onUnreadChange={onUnreadNotificationsChange}
              onOpenTarget={onOpenNotificationTarget}
              onClose={() => onSetPanel(null)}
            />
          ) : (
            <SettingsPanel
              runtimeInfo={runtimeInfo}
              jocaLogicInfo={jocaLogicInfo}
              sessions={sessions}
              projects={projects}
              services={services}
              events={events}
              onReloadRuntime={onReloadRuntime}
              onRunCommand={onRunCommand}
              onClose={() => onSetPanel(null)}
            />
          )}
        </div>
      )}

      <div className="right-tab-rail" role="tablist" aria-label="Workspace tabs">
        {/* Inbox primeiro: é o separador que reclama atenção (badge por-ler). O separador Kit
            (toolkit) foi removido a pedido do dono — ninguém o consultava; as skills continuam
            acessíveis pelo autocomplete `/` do composer e pela palete de comandos. */}
        {(['inbox', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            className={`right-tab-btn right-tab-btn--${tab} ${panel === tab ? 'active' : ''}`}
            type="button"
            onClick={() => toggle(tab)}
            aria-label={
              tab === 'inbox' && unreadNotifications > 0
                ? `${TAB_LABEL[tab]} (${unreadNotifications} por ler)`
                : TAB_LABEL[tab]
            }
            aria-selected={panel === tab}
            aria-expanded={panel === tab}
            aria-controls="right-panel"
            title={TAB_LABEL[tab]}
          >
            <RightTabIcon name={tab} />
            <span>{tab}</span>
            {/* O badge é decorativo: a contagem já vai no aria-label do separador. */}
            {tab === 'inbox' && unreadNotifications > 0 && (
              <span className="right-tab-badge" aria-hidden>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
