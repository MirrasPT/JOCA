import FilesView from './FilesView';
import SettingsPanel from './SettingsPanel';
import ToolkitPanel from './ToolkitPanel';
import type { JocaItems, JocaLogicInfo, Project, RightPanel, RuntimeInfo, SessionInfo } from '../types';

interface ServiceConnection {
  id: string;
  name: string;
  status: 'connected' | 'mock' | 'offline';
  scope: string;
}

interface Props {
  panel: RightPanel;
  width: string;
  activeSession: SessionInfo | null;
  runtimeInfo: RuntimeInfo | null;
  jocaLogicInfo: JocaLogicInfo | null;
  sessions: SessionInfo[];
  projects: Project[];
  services: ServiceConnection[];
  events: { id: string; title: string; detail: string; timestamp: number }[];
  jocaItems: JocaItems | null;
  onSetPanel: (panel: RightPanel) => void;
  onPastePath: (path: string) => void;
  onPreview: (path: string) => void;
  onLoadToolkit: () => void;
  onToolkitItemsChange: (items: JocaItems) => void;
  onInsertToolkit: (text: string) => void;
  onRunCommand: (command: string) => void;
  onReloadRuntime: () => void;
  selectedPath: string | null;
}

function RightTabIcon({ name }: { name: 'files' | 'toolkit' | 'settings' }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'files') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="m10 9 3 3-3 3" /></svg>;
  if (name === 'toolkit') return <svg {...common}><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8Z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>;
  return <svg {...common}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z" /></svg>;
}

export default function RightWorkspace({
  panel, width, activeSession, runtimeInfo, jocaLogicInfo, sessions, projects, services, events, jocaItems,
  onSetPanel, onPastePath, onPreview, onLoadToolkit, onToolkitItemsChange, onInsertToolkit, onRunCommand, onReloadRuntime, selectedPath
}: Props) {
  const expanded = panel !== null;
  const toggle = (next: Exclude<RightPanel, null>) => onSetPanel(panel === next ? null : next);

  return (
    <div
      className={`files-slot ${expanded ? 'files-slot--open' : 'files-slot--closed'}`}
      style={{ width, minWidth: width, maxWidth: width, flex: `0 0 ${width}` }}
    >
      {panel && (
        <div className="right-panel-content" key={panel}>
          {panel === 'files' ? (
            <FilesView onPastePath={onPastePath} onPreview={onPreview} initialPath={activeSession?.cwd ?? jocaLogicInfo?.path} selectedPath={selectedPath} onClose={() => onSetPanel(null)} />
          ) : panel === 'toolkit' ? (
            <ToolkitPanel
              items={jocaItems}
              onItemsChange={onToolkitItemsChange}
              onLoad={onLoadToolkit}
              onInsert={onInsertToolkit}
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
        {(['files', 'toolkit', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            className={`right-tab-btn right-tab-btn--${tab} ${panel === tab ? 'active' : ''}`}
            type="button"
            onClick={() => {
              toggle(tab);
              if (tab === 'toolkit') onLoadToolkit();
            }}
            aria-label={tab}
            aria-selected={panel === tab}
            title={tab}
          >
            <RightTabIcon name={tab} />
            <span>{tab}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
