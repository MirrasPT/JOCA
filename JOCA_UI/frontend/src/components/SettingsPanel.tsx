import { useCallback, useEffect, useState } from 'react';
import type { CliToolStatus, JocaLogicInfo, Project, RuntimeInfo, SessionInfo } from '../types';
import { shortPath } from '../lib/paths';

interface ServiceConnection {
  id: string;
  name: string;
  status: 'connected' | 'mock' | 'offline';
  scope: string;
}

interface Props {
  runtimeInfo: RuntimeInfo | null;
  jocaLogicInfo: JocaLogicInfo | null;
  sessions: SessionInfo[];
  projects: Project[];
  services: ServiceConnection[];
  events: { id: string; title: string; detail: string; timestamp: number }[];
  onReloadRuntime: () => void;
  onRunCommand: (command: string) => void;
  onClose: () => void;
}

function ChevronsRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  );
}

export default function SettingsPanel({ runtimeInfo, jocaLogicInfo, sessions, projects, services, events, onReloadRuntime, onRunCommand, onClose }: Props) {
  const [cliTools, setCliTools] = useState<CliToolStatus[]>([]);
  const [cliLoading, setCliLoading] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);

  useEffect(() => {
    fetch('/ui-settings').then(r => r.json()).then(s => setSkipPermissions(s.skipPermissions ?? false)).catch(() => {});
  }, []);

  const toggleSkipPermissions = useCallback(() => {
    const next = !skipPermissions;
    setSkipPermissions(next);
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipPermissions: next }) }).catch(() => {});
  }, [skipPermissions]);

  const reloadCliTools = useCallback(() => {
    setCliLoading(true);
    fetch('/cli-tools')
      .then((response) => response.json())
      .then(setCliTools)
      .catch(() => setCliTools([]))
      .finally(() => setCliLoading(false));
  }, []);

  useEffect(() => {
    reloadCliTools();
  }, [reloadCliTools]);

  return (
    <div className="settings-panel">
      <div className="files-view-header">
        <div>
          <span className="files-view-title settings-panel-title">Settings</span>
          <span className="files-view-subtitle">Local runtime</span>
        </div>
        <button className="files-view-close" onClick={onClose} aria-label="Collapse settings" data-tooltip="Fechar painel" data-tooltip-position="bottom">
          <ChevronsRight />
        </button>
      </div>
      <div className="settings-panel-body">
        {services.map((service) => (
          <div key={service.id} className="settings-service-card">
            <div className="settings-service-head">
              <span className={`status-pill status-pill--${service.status}`}>{service.status}</span>
              <span>{service.name}</span>
            </div>
            <p>{service.scope}</p>
          </div>
        ))}
        <div className="settings-service-card settings-service-card--runtime">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">runtime</span>
            <span>Local JOCA</span>
          </div>
          <dl className="settings-runtime-grid">
            <dt>Backend port</dt><dd>{runtimeInfo?.port ?? '...'}</dd>
            <dt>Claude</dt><dd>{runtimeInfo?.claudeBin ?? '...'}</dd>
            <dt>Shell</dt><dd>{runtimeInfo?.shell ?? '...'}</dd>
            <dt>Home</dt><dd>{runtimeInfo ? shortPath(runtimeInfo.home) : '...'}</dd>
            <dt>Sessions</dt><dd>{runtimeInfo?.sessionCount ?? sessions.length}</dd>
            <dt>Projects</dt><dd>{runtimeInfo?.projectCount ?? projects.length}</dd>
          </dl>
          <button className="db-project-card-btn" onClick={onReloadRuntime}>Refresh runtime</button>
        </div>
        {jocaLogicInfo && (
          <div className="settings-service-card">
            <div className="settings-service-head">
              <span className={`status-pill status-pill--${jocaLogicInfo.connected ? 'connected' : 'offline'}`}>
                {jocaLogicInfo.connected ? 'connected' : 'offline'}
              </span>
              <span>JOCA_Logic Engine</span>
            </div>
            <dl className="settings-runtime-grid">
              <dt>Path</dt><dd>{shortPath(jocaLogicInfo.path)}</dd>
              <dt>Skills</dt><dd>{jocaLogicInfo.skillCount}</dd>
              <dt>Agents</dt><dd>{jocaLogicInfo.agentCount}</dd>
              <dt>Commands</dt><dd>{jocaLogicInfo.commandCount}</dd>
              <dt>Memory Index</dt><dd>{jocaLogicInfo.hasMemoryIndex ? 'available' : 'missing'}</dd>
              <dt>Knowledge Graph</dt><dd>{jocaLogicInfo.hasGraph ? 'available' : 'missing'}</dd>
              <dt>Soul</dt><dd>{jocaLogicInfo.hasSoul ? 'loaded' : 'missing'}</dd>
            </dl>
          </div>
        )}
        <div className="settings-service-card">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">claude</span>
            <span>Claude Code</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={skipPermissions} onChange={toggleSkipPermissions} />
            <span>Skip permission prompts <code style={{ fontSize: '0.8em', opacity: 0.6 }}>--dangerously-skip-permissions</code></span>
          </label>
          <p style={{ fontSize: '0.75em', opacity: 0.5, margin: '4px 0 0' }}>Aplica-se a novas sessões. Sessões existentes não são afectadas.</p>
        </div>
        <div className="settings-service-card settings-service-card--cli">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">cli</span>
            <span>AI CLIs</span>
          </div>
          <p>Instalação, login e verificação rápida dos CLIs usados pelo JOCA.</p>
          <div className="settings-cli-list">
            {cliTools.map((tool) => (
              <article key={tool.id} className={`settings-cli-card settings-cli-card--${tool.installed ? 'installed' : 'missing'}`}>
                <div className="settings-cli-head">
                  <div>
                    <strong>{tool.name}</strong>
                    <span>{tool.provider} · <code>{tool.binary}</code></span>
                  </div>
                  <span className={`status-pill status-pill--${tool.installed ? 'connected' : 'offline'}`}>
                    {tool.installed ? 'installed' : 'missing'}
                  </span>
                </div>
                <dl className="settings-cli-meta">
                  <dt>Version</dt><dd>{tool.version || '...'}</dd>
                  <dt>Path</dt><dd>{tool.path ? shortPath(tool.path) : 'not found'}</dd>
                  <dt>Auth</dt><dd>{tool.authStatus}</dd>
                  <dt>Detail</dt><dd>{tool.authDetail || '...'}</dd>
                </dl>
                <div className="settings-cli-actions">
                  <button type="button" onClick={() => onRunCommand(tool.installCommand)}>Install</button>
                  <button type="button" onClick={() => onRunCommand(tool.loginCommand)} disabled={!tool.installed && tool.id !== 'agy'}>Login</button>
                  {tool.updateCommand && <button type="button" onClick={() => onRunCommand(tool.updateCommand!)} disabled={!tool.installed}>Update</button>}
                </div>
              </article>
            ))}
            {!cliLoading && cliTools.length === 0 && <p>Não foi possível ler o estado dos CLIs.</p>}
          </div>
          <button className="db-project-card-btn" onClick={reloadCliTools} disabled={cliLoading}>
            {cliLoading ? 'Checking...' : 'Refresh CLIs'}
          </button>
        </div>
        <div className="settings-service-card settings-service-card--activity">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">activity</span>
            <span>Notification Center</span>
          </div>
          <div className="settings-activity-list">
            {events.length === 0 ? (
              <p>Nada para mostrar. Eventos de sessões, projectos e ficheiros aparecem aqui.</p>
            ) : events.slice(0, 12).map((event) => (
              <div key={event.id} className="settings-activity-item">
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
                <small>{new Date(event.timestamp).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
