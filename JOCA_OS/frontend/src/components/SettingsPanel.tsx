import { useCallback, useEffect, useRef, useState } from 'react';
import type { CliProfileInfo, CliToolStatus, JocaLogicInfo, Project, RuntimeInfo, SessionInfo } from '../types';
import { shortPath } from '../lib/paths';
import { readThemeSettings, resolveTheme } from '../lib/theme';
import type { ThemeMode } from '../lib/theme';
import { saveThemeSettings } from '../hooks/useAutoTheme';
import { BRAND_THEMES, applyBrand, readBrand } from '../lib/brand';

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
  onReloadRuntime: () => void;
  onRunCommand: (command: string) => void;
  onClose: () => void;
}

// `authStatus` comes from the API as a stable key ('logged-in' | 'not-logged-in' | 'unknown'); the
// translation lives here, in the layer that shows it.
const AUTH_LABEL: Record<string, string> = {
  'logged-in': 'signed in',
  'not-logged-in': 'signed out',
  unknown: 'to be confirmed',
};

const THEME_MODE_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Dynamic' },
];


// Settings is a modal: it closes, it does not collapse to the side. The `»` that used to be here is
// the ToolkitPanel gesture (a side panel that shrinks) and read as "push to the right".
function FecharX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function SettingsPanel({ runtimeInfo, jocaLogicInfo, sessions, projects, services, onReloadRuntime, onRunCommand, onClose }: Props) {
  const [cliTools, setCliTools] = useState<CliToolStatus[]>([]);
  const [cliLoading, setCliLoading] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);
  // Theme: the chosen mode + the dynamic mode's schedule. The App's `useAutoTheme` is what applies
  // it live; here the choice is only written.
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeSettings().mode);
  const [dayStart, setDayStart] = useState(() => readThemeSettings().dayStart);
  const [nightStart, setNightStart] = useState(() => readThemeSettings().nightStart);
  // Active brand theme (appearance + name only).
  const [brandId, setBrandId] = useState(() => readBrand().id);
  // Default CLI for new sessions (PATCH /ui-settings { defaultCli }).
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
      // `defaultCli` may not exist in the backend yet — undefined = claude.
      if (s.defaultCli === 'claude' || s.defaultCli === 'codex' || s.defaultCli === 'agy' || s.defaultCli === 'opencode') {
        setDefaultCli(s.defaultCli);
      }
      // `useAutoTheme` has already synced server→localStorage and applied it; here it is only
      // re-read so the fields show what is really saved.
      const stored = readThemeSettings();
      setThemeMode(stored.mode);
      setDayStart(stored.dayStart);
      setNightStart(stored.nightStart);
      // localStorage is what rules at startup (index.html needs it before the paint); the server
      // only reconciles what arrives from another machine.
      if (typeof s.brandTheme === 'string' && s.brandTheme !== readBrand().id) {
        setBrandId(s.brandTheme);
        applyBrand(s.brandTheme);
      }
    }).catch(() => {});
  }, []);

  const patchSettings = useCallback((patch: Record<string, unknown>) => {
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => {});
  }, []);
  // Applies immediately (CSS + an event for whoever is mounted) and mirrors it on the server, like the theme mode.
  const selectBrand = useCallback((id: string) => {
    setBrandId(id);
    applyBrand(id);
    patchSettings({ brandTheme: id });
  }, [patchSettings]);

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

  // The preview ("right now it would be light/dark") has to age with the clock: without this, it
  // ended up saying the opposite of what is on screen if the panel crossed the switching hour.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (themeMode !== 'auto') return;
    const t = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [themeMode]);

  const selectThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    saveThemeSettings(mode, dayStart, nightStart);
  }, [dayStart, nightStart]);

  // An empty `<input type="time">` (mid-edit) must not wipe the saved schedule — the field follows
  // what is typed, but it is only saved when it is a complete time.
  const changeDayStart = useCallback((value: string) => {
    setDayStart(value);
    if (/^\d{2}:\d{2}$/.test(value)) saveThemeSettings(themeMode, value, nightStart);
  }, [themeMode, nightStart]);

  const changeNightStart = useCallback((value: string) => {
    setNightStart(value);
    if (/^\d{2}:\d{2}$/.test(value)) saveThemeSettings(themeMode, dayStart, value);
  }, [themeMode, dayStart]);

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
          <span className="files-view-subtitle">This machine</span>
        </div>
        <button className="files-view-close" onClick={onClose} aria-label="Close settings" data-tooltip="Close" data-tooltip-position="bottom">
          <FecharX />
        </button>
      </div>
      <div className="settings-panel-body">
        <div className="settings-service-card">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">appearance</span>
            <span>Theme</span>
          </div>
          {/* A real radiogroup: ONE tab stop (roving tabindex) and arrows to navigate — in a
              radiogroup Tab enters and leaves the group, it does not walk the options one by one. */}
          <div className="theme-mode-row" role="radiogroup" aria-label="Theme mode">
            {THEME_MODE_OPTIONS.map((opt, i) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={themeMode === opt.id}
                tabIndex={themeMode === opt.id ? 0 : -1}
                className={`theme-mode-btn${themeMode === opt.id ? ' is-active' : ''}`}
                onClick={() => selectThemeMode(opt.id)}
                onKeyDown={(e) => {
                  const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                    : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                  if (!delta) return;
                  e.preventDefault();
                  const next = THEME_MODE_OPTIONS[(i + delta + THEME_MODE_OPTIONS.length) % THEME_MODE_OPTIONS.length];
                  selectThemeMode(next.id);
                  // Focus has to follow the selection, otherwise it stays on a button that has become tabIndex=-1.
                  const group = e.currentTarget.parentElement;
                  (group?.querySelectorAll('.theme-mode-btn')[THEME_MODE_OPTIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {themeMode === 'auto' && (
            <div className="theme-schedule">
              <label className="theme-schedule-field">
                <span>Switches to light</span>
                <input type="time" value={dayStart} onChange={(e) => changeDayStart(e.target.value)} />
              </label>
              <label className="theme-schedule-field">
                <span>Switches to dark</span>
                <input type="time" value={nightStart} onChange={(e) => changeNightStart(e.target.value)} />
              </label>
              <p className="theme-schedule-hint">
                Right now it would be <strong>{resolveTheme('auto', dayStart, nightStart) === 'light' ? 'light' : 'dark'}</strong>.
                {' '}It switches by itself at the set time, with the app open.
              </p>
            </div>
          )}

          {/* Brand themes — an axis separate from the light/dark above: each brand brings both modes. */}
          <div className="brand-theme-block">
            <span className="brand-theme-label">Brand themes</span>
            <p className="brand-theme-hint">
              Changes the name, the logo and the colors. Appearance only — the brain, the memory and
              the work stay exactly the same.
            </p>
            <div className="brand-theme-row" role="radiogroup" aria-label="Brand theme">
              {BRAND_THEMES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={brandId === b.id}
                  className={`brand-theme-opt${brandId === b.id ? ' is-active' : ''}`}
                  onClick={() => selectBrand(b.id)}
                >
                  <span className="brand-theme-opt-mark" aria-hidden>
                    {b.logo ? <img src={b.logo} alt="" /> : <span className="brand-theme-opt-rings" />}
                  </span>
                  <span className="brand-theme-opt-text">
                    <span className="brand-theme-opt-name">{b.label}</span>
                    <span className="brand-theme-opt-detail">{b.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {services.map((service) => (
          <div key={service.id} className="settings-service-card">
            <div className="settings-service-head">
              <span className={`status-pill status-pill--${service.status}`}>
              {service.status === 'connected' ? 'connected' : service.status === 'offline' ? 'disconnected' : service.status}
            </span>
              <span>{service.name}</span>
            </div>
            <p>{service.scope}</p>
          </div>
        ))}
        <div className="settings-service-card settings-service-card--runtime">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">status</span>
            <span>This installation</span>
          </div>
          <dl className="settings-runtime-grid">
            <dt>Backend port</dt><dd>{runtimeInfo?.port ?? '...'}</dd>
            <dt>Claude</dt><dd>{runtimeInfo?.claudeBin ?? '...'}</dd>
            <dt>Shell</dt><dd>{runtimeInfo?.shell ?? '...'}</dd>
            <dt>Home folder</dt><dd>{runtimeInfo ? shortPath(runtimeInfo.home) : '...'}</dd>
            <dt>Terminals</dt><dd>{runtimeInfo?.sessionCount ?? sessions.length}</dd>
            <dt>Projects</dt><dd>{runtimeInfo?.projectCount ?? projects.length}</dd>
          </dl>
          <button className="db-project-card-btn" onClick={onReloadRuntime}>Update</button>
        </div>
        {jocaLogicInfo && (
          <div className="settings-service-card">
            <div className="settings-service-head">
              <span className={`status-pill status-pill--${jocaLogicInfo.connected ? 'ligado' : 'desligado'}`}>
                {jocaLogicInfo.connected ? 'connected' : 'disconnected'}
              </span>
              <span>JOCA_Brain</span>
            </div>
            <dl className="settings-runtime-grid">
              <dt>Folder</dt><dd>{shortPath(jocaLogicInfo.path)}</dd>
              <dt>Skills</dt><dd>{jocaLogicInfo.skillCount}</dd>
              <dt>Agents</dt><dd>{jocaLogicInfo.agentCount}</dd>
              <dt>Commands</dt><dd>{jocaLogicInfo.commandCount}</dd>
              <dt>Memory index</dt><dd>{jocaLogicInfo.hasMemoryIndex ? 'present' : 'missing'}</dd>
              <dt>Knowledge graph</dt><dd>{jocaLogicInfo.hasGraph ? 'present' : 'missing'}</dd>
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
            <span>Skip the permission prompts <code style={{ fontSize: '0.8em', opacity: 0.6 }}>--dangerously-skip-permissions</code></span>
          </label>
          <p style={{ fontSize: '0.75em', opacity: 0.5, margin: '4px 0 0' }}>Applies to new sessions. Existing sessions are not affected.</p>
        </div>
        {/* The model is chosen in the terminal itself (/model) or in the default CLI below. */}
        <div className="settings-service-card settings-service-card--cli">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">cli</span>
            <span>AI CLIs</span>
          </div>
          <p>Installation, login and a quick check of the CLIs used by JOCA.</p>
          <div className="settings-default-cli">
            <div className="settings-default-cli-row">
              <label className="settings-default-cli-label" htmlFor="default-cli-select">Default CLI</label>
              <select
                id="default-cli-select"
                className="settings-default-cli-select"
                value={defaultCli}
                disabled={cliProfiles.length === 0}
                onChange={(e) => selectDefaultCli(e.target.value as CliProfileInfo['id'])}
                title="CLI used when opening new sessions and terminals when you do not choose another."
              >
                {cliProfiles.length === 0 ? (
                  <option value={defaultCli}>Loading…</option>
                ) : cliProfiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    disabled={!profile.available && profile.id !== defaultCli}
                  >
                    {profile.label}{profile.available ? '' : ' (not installed)'}
                  </option>
                ))}
              </select>
              {defaultCliSaved && <span className="settings-save-flag settings-save-flag--saved" role="status">saved ✓</span>}
            </div>
            <p className="settings-default-cli-hint">
              Used when opening new sessions and terminals. Sessions already open are not affected.
              {cliProfiles.some((p) => !p.available) && ' The CLIs marked as "not installed" can be installed in the cards below.'}
            </p>
          </div>
          <div className="settings-cli-list">
            {cliTools.map((tool) => (
              <article key={tool.id} className={`settings-cli-card settings-cli-card--${tool.installed ? 'instalado' : 'em falta'}`}>
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
                  <dt>Folder</dt><dd>{tool.path ? shortPath(tool.path) : 'not found'}</dd>
                  <dt>Session</dt><dd>{AUTH_LABEL[tool.authStatus] ?? tool.authStatus}</dd>
                  <dt>Detail</dt><dd>{tool.authDetail || '...'}</dd>
                </dl>
                <div className="settings-cli-actions">
                  <button type="button" onClick={() => onRunCommand(tool.installCommand)}>Install</button>
                  <button type="button" onClick={() => onRunCommand(tool.loginCommand)} disabled={!tool.installed && tool.id !== 'agy'}>Sign in</button>
                  {tool.updateCommand && <button type="button" onClick={() => onRunCommand(tool.updateCommand!)} disabled={!tool.installed}>Update</button>}
                </div>
              </article>
            ))}
            {!cliLoading && cliTools.length === 0 && <p>Could not read the CLIs' status.</p>}
          </div>
          <button className="db-project-card-btn" onClick={reloadCliTools} disabled={cliLoading}>
            {cliLoading ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </div>
    </div>
  );
}
