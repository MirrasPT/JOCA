import { useCallback, useEffect, useRef, useState } from 'react';
import type { CliProfileInfo, CliToolStatus, HeartbeatConfig, JocaLogicInfo, Project, RuntimeInfo, SessionInfo } from '../types';
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const [optimizeProvider, setOptimizeProvider] = useState('claude');
  const [optimizeModel, setOptimizeModel] = useState('');
  const [providers, setProviders] = useState<{ id: string; label: string; available: boolean; defaultModel: string; detail: string }[]>([]);
  // CLI por defeito para novas sessões (PATCH /ui-settings { defaultCli }).
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[]>([]);
  const [defaultCli, setDefaultCli] = useState<CliProfileInfo['id']>('claude');
  const [defaultCliSaved, setDefaultCliSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch('/cli-profiles').then(r => r.json()).then((list: CliProfileInfo[]) => {
      if (Array.isArray(list)) setCliProfiles(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/ui-settings').then(r => r.json()).then(s => {
      setSkipPermissions(s.skipPermissions ?? false);
      // `defaultCli` pode ainda não existir no backend — undefined = claude.
      if (s.defaultCli === 'claude' || s.defaultCli === 'codex' || s.defaultCli === 'agy' || s.defaultCli === 'opencode') {
        setDefaultCli(s.defaultCli);
      }
      if (s.theme === 'light' || s.theme === 'dark') {
        setTheme(s.theme);
        if (s.theme === 'light') document.documentElement.dataset.theme = 'light';
        else delete document.documentElement.dataset.theme;
        try { localStorage.setItem('joca-theme', s.theme); } catch { /* ignore */ }
      }
      setOptimizeProvider(s.optimizeProvider ?? 'claude');
      setOptimizeModel(s.optimizeModel ?? '');
    }).catch(() => {});
    fetch('/llm-providers').then(r => r.json()).then(setProviders).catch(() => {});
  }, []);

  const patchSettings = useCallback((patch: Record<string, unknown>) => {
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => {});
  }, []);
  const selectOptimizeProvider = useCallback((id: string) => { setOptimizeProvider(id); patchSettings({ optimizeProvider: id }); }, [patchSettings]);

  const selectDefaultCli = useCallback((id: CliProfileInfo['id']) => {
    setDefaultCli(id);
    setDefaultCliSaved(false);
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultCli: id }) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); setDefaultCliSaved(true); })
      .catch(() => {})
      .finally(() => {
        if (savedTimer.current) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setDefaultCliSaved(false), 2200);
      });
  }, []);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('joca-theme', next); } catch { /* ignore */ }
    patchSettings({ theme: next });
  }, [theme, patchSettings]);

  const toggleSkipPermissions = useCallback(() => {
    const next = !skipPermissions;
    setSkipPermissions(next);
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipPermissions: next }) }).catch(() => {});
  }, [skipPermissions]);

  // ── Heartbeat (proactividade) ────────────────────────────────────────────────
  const [heartbeat, setHeartbeat] = useState<HeartbeatConfig | null>(null);
  const [beatTesting, setBeatTesting] = useState(false);
  const [beatResult, setBeatResult] = useState<{ decision: string; text: string } | null>(null);
  const hbTimer = useRef<number | null>(null);
  // Feedback de gravação: o PATCH é debounced, sem isto o utilizador não sabe se ficou guardado.
  const [hbStatus, setHbStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hbStatusTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch('/heartbeat').then((r) => r.json()).then(setHeartbeat).catch(() => {});
    return () => {
      if (hbTimer.current) window.clearTimeout(hbTimer.current);
      if (hbStatusTimer.current) window.clearTimeout(hbStatusTimer.current);
    };
  }, []);

  // Actualiza o estado local já e envia o PATCH com um debounce simples (evita um pedido por tecla
  // no scratch/model; toggles também passam por aqui — 400ms é imperceptível).
  const patchHeartbeat = useCallback((patch: Partial<HeartbeatConfig>) => {
    setHeartbeat((cur) => (cur ? { ...cur, ...patch } : cur));
    setHbStatus('saving');
    if (hbStatusTimer.current) window.clearTimeout(hbStatusTimer.current);
    if (hbTimer.current) window.clearTimeout(hbTimer.current);
    hbTimer.current = window.setTimeout(() => {
      fetch('/heartbeat', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg: HeartbeatConfig | null) => {
          if (cfg) setHeartbeat(cfg);
          setHbStatus(cfg ? 'saved' : 'error');
        })
        .catch(() => setHbStatus('error'))
        .finally(() => {
          hbStatusTimer.current = window.setTimeout(() => setHbStatus('idle'), 2200);
        });
    }, 400);
  }, []);

  const testHeartbeat = useCallback(() => {
    setBeatTesting(true);
    setBeatResult(null);
    fetch('/heartbeat/run', { method: 'POST' })
      .then((r) => r.json())
      .then((d: { decision?: string; text?: string; error?: string }) => {
        setBeatResult({ decision: d.decision ?? 'error', text: d.text ?? d.error ?? '' });
        // O beat manual actualiza lastRunAt/lastDecision server-side — re-sincroniza.
        return fetch('/heartbeat').then((r) => r.json()).then(setHeartbeat);
      })
      .catch(() => setBeatResult({ decision: 'error', text: 'Falhou a chamada ao servidor.' }))
      .finally(() => setBeatTesting(false));
  }, []);

  // Tempo relativo curto para o último beat.
  const relTime = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `há ${h} h`;
    return `há ${Math.round(h / 24)} d`;
  };

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
        <div className="settings-service-card">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">aparência</span>
            <span>Tema</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} />
            <span>Light mode</span>
          </label>
        </div>
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
              <span>JOCA_Brain Engine</span>
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
        <div className="settings-service-card">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">optimizar</span>
            <span>Optimizações — Provider</span>
          </div>
          <p style={{ fontSize: '0.76em', opacity: 0.55, margin: '0 0 10px' }}>
            SDK + modelo do botão "Optimizar" (reescrita de texto). Sem ferramentas — só reescreve.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{ id: 'claude', label: 'Claude · Agent SDK', detail: 'Subscrição, sem ferramentas' }, { id: 'ollama', label: 'Ollama · local', detail: 'Grátis, local' }].map((p) => {
              const selectable = p.id === 'claude' || (providers.find((x) => x.id === 'ollama')?.available ?? false);
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)',
                    border: `1px solid ${optimizeProvider === p.id ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                    background: optimizeProvider === p.id ? 'var(--accent-soft)' : 'transparent',
                    cursor: selectable ? 'pointer' : 'not-allowed', opacity: selectable ? 1 : 0.45,
                  }}
                >
                  <input type="radio" name="optimize-provider" value={p.id} checked={optimizeProvider === p.id} disabled={!selectable} onChange={() => selectOptimizeProvider(p.id)} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-bright)' }}>{p.label}</span>
                    <span style={{ display: 'block', fontSize: '0.72em', opacity: 0.55 }}>{p.detail}{p.id === 'ollama' && !selectable ? ' — não detectado em :11434' : ''}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            <span style={{ fontSize: '0.75em', opacity: 0.6 }}>Modelo (opcional)</span>
            <input
              type="text" value={optimizeModel} placeholder={optimizeProvider === 'ollama' ? 'ex: qwen2.5 · llama3.1' : 'ex: haiku · sonnet (default)'}
              onChange={(e) => setOptimizeModel(e.target.value)}
              onBlur={(e) => { const m = e.target.value.trim(); setOptimizeModel(m); patchSettings({ optimizeModel: m }); }}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-sm)', color: 'var(--text-bright)', padding: '6px 9px', fontSize: '0.85em', fontFamily: 'var(--font-mono)' }}
            />
          </label>
        </div>
        <div className="settings-service-card settings-service-card--heartbeat">
          <div className="settings-service-head">
            <span className={`status-pill status-pill--${heartbeat?.enabled ? 'connected' : 'offline'}`}>
              {heartbeat?.enabled ? 'activo' : 'parado'}
            </span>
            <span>💓 Heartbeat</span>
            {hbStatus !== 'idle' && (
              <span className={`settings-save-flag settings-save-flag--${hbStatus}`} role="status">
                {hbStatus === 'saving' ? 'a guardar…' : hbStatus === 'saved' ? 'guardado ✓' : 'falhou ao guardar'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.76em', opacity: 0.55, margin: '0 0 10px' }}>
            Proactividade: a cada intervalo o JOCA lê a checklist e o estado do sistema e avisa-te só quando algo merece atenção.
          </p>
          {heartbeat ? (
            <div className="hb-body">
              <label className="hb-check">
                <input type="checkbox" checked={heartbeat.enabled} onChange={(e) => patchHeartbeat({ enabled: e.target.checked })} />
                <span>Heartbeat ligado (corre automaticamente)</span>
              </label>
              <label className="hb-field hb-field--inline" title="Intervalo entre beats. O mínimo é 5 minutos.">
                <span>Intervalo entre beats (minutos, mín. 5)</span>
                <input
                  type="number" min={5} value={heartbeat.everyMinutes}
                  onChange={(e) => patchHeartbeat({ everyMinutes: Math.max(5, Number(e.target.value) || 5) })}
                />
              </label>
              <label className="hb-check">
                <input
                  type="checkbox"
                  checked={!heartbeat.activeHours}
                  onChange={(e) => patchHeartbeat({ activeHours: e.target.checked ? null : { start: '09:00', end: '22:00' } })}
                />
                <span>Correr a qualquer hora (sem janela horária)</span>
              </label>
              {heartbeat.activeHours && (
                <div className="hb-hours">
                  <label className="hb-field hb-field--inline">
                    <span>Início</span>
                    <input type="time" value={heartbeat.activeHours.start}
                      onChange={(e) => patchHeartbeat({ activeHours: { start: e.target.value, end: heartbeat.activeHours!.end } })} />
                  </label>
                  <label className="hb-field hb-field--inline">
                    <span>Fim</span>
                    <input type="time" value={heartbeat.activeHours.end}
                      onChange={(e) => patchHeartbeat({ activeHours: { start: heartbeat.activeHours!.start, end: e.target.value } })} />
                  </label>
                </div>
              )}
              <label className="hb-field" title="Modelo usado em cada beat. Vazio = haiku (mais barato e rápido). Grava ao sair do campo.">
                <span>Modelo (vazio = haiku)</span>
                <input
                  type="text" value={heartbeat.model} placeholder="haiku"
                  onChange={(e) => setHeartbeat((cur) => (cur ? { ...cur, model: e.target.value } : cur))}
                  onBlur={(e) => patchHeartbeat({ model: e.target.value.trim() })}
                />
              </label>
              <label className="hb-field" title="Uma linha por item. É isto que o JOCA verifica em cada beat. Grava ao sair do campo.">
                <span>Checklist — o que vigiar em cada beat (grava ao sair do campo)</span>
                <textarea
                  rows={4} value={heartbeat.scratch}
                  placeholder={'- verificar se há tarefas bloqueadas\n- lembrar-me do backup semanal'}
                  onChange={(e) => setHeartbeat((cur) => (cur ? { ...cur, scratch: e.target.value } : cur))}
                  onBlur={(e) => patchHeartbeat({ scratch: e.target.value })}
                />
              </label>
              <div className="hb-last">
                <strong>Último beat:</strong>{' '}
                {heartbeat.lastRunAt
                  ? <>
                      <span className={`hb-decision hb-decision--${heartbeat.lastDecision ?? 'ok'}`}>{heartbeat.lastDecision ?? '—'}</span>
                      {' '}· {relTime(heartbeat.lastRunAt)}
                      {heartbeat.lastText ? <span className="hb-last-text">{heartbeat.lastText.slice(0, 200)}</span> : null}
                    </>
                  : 'nunca correu'}
              </div>
              <button className="db-project-card-btn" type="button" onClick={testHeartbeat} disabled={beatTesting}>
                {beatTesting ? 'A testar…' : 'Testar agora'}
              </button>
              {beatResult && (
                <div className="hb-last">
                  <span className={`hb-decision hb-decision--${beatResult.decision}`}>{beatResult.decision}</span>
                  {beatResult.text ? <span className="hb-last-text">{beatResult.text.slice(0, 300)}</span> : null}
                </div>
              )}
            </div>
          ) : (
            <p>A carregar…</p>
          )}
        </div>
        <div className="settings-service-card settings-service-card--cli">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">cli</span>
            <span>AI CLIs</span>
          </div>
          <p>Instalação, login e verificação rápida dos CLIs usados pelo JOCA.</p>
          <div className="settings-default-cli">
            <div className="settings-default-cli-row">
              <label className="settings-default-cli-label" htmlFor="default-cli-select">CLI por defeito</label>
              <select
                id="default-cli-select"
                className="settings-default-cli-select"
                value={defaultCli}
                disabled={cliProfiles.length === 0}
                onChange={(e) => selectDefaultCli(e.target.value as CliProfileInfo['id'])}
                title="CLI usado ao abrir novas sessões e terminais quando não escolhes outro."
              >
                {cliProfiles.length === 0 ? (
                  <option value={defaultCli}>A carregar…</option>
                ) : cliProfiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    disabled={!profile.available && profile.id !== defaultCli}
                  >
                    {profile.label}{profile.available ? '' : ' (não instalado)'}
                  </option>
                ))}
              </select>
              {defaultCliSaved && <span className="settings-save-flag settings-save-flag--saved" role="status">guardado ✓</span>}
            </div>
            <p className="settings-default-cli-hint">
              Usado ao abrir novas sessões e terminais. Sessões já abertas não são afectadas.
              {cliProfiles.some((p) => !p.available) && ' Os CLIs marcados como "não instalado" podem ser instalados nos cartões abaixo.'}
            </p>
          </div>
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
