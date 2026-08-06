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

// `authStatus` vem da API como chave estável ('logged-in' | 'not-logged-in' | 'unknown'); a
// tradução vive aqui, na camada que mostra.
const AUTH_LABEL: Record<string, string> = {
  'logged-in': 'com sessão iniciada',
  'not-logged-in': 'sem sessão',
  unknown: 'por confirmar',
};

const THEME_MODE_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'auto', label: 'Dinâmico' },
];


function ChevronsRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  );
}

export default function SettingsPanel({ runtimeInfo, jocaLogicInfo, sessions, projects, services, onReloadRuntime, onRunCommand, onClose }: Props) {
  const [cliTools, setCliTools] = useState<CliToolStatus[]>([]);
  const [cliLoading, setCliLoading] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);
  // Tema: o modo escolhido + os horários do modo dinâmico. O `useAutoTheme` do App é que aplica
  // ao vivo; aqui só se escreve a escolha.
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeSettings().mode);
  const [dayStart, setDayStart] = useState(() => readThemeSettings().dayStart);
  const [nightStart, setNightStart] = useState(() => readThemeSettings().nightStart);
  const [optimizeProvider, setOptimizeProvider] = useState('claude');
  const [optimizeModel, setOptimizeModel] = useState('');
  // Tema de marca activo (só aparência + nome).
  const [brandId, setBrandId] = useState(() => readBrand().id);
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
      // O `useAutoTheme` já sincronizou servidor→localStorage e aplicou; aqui só se relê para os
      // campos mostrarem o que está mesmo guardado.
      const stored = readThemeSettings();
      setThemeMode(stored.mode);
      setDayStart(stored.dayStart);
      setNightStart(stored.nightStart);
      setOptimizeProvider(s.optimizeProvider ?? 'claude');
      setOptimizeModel(s.optimizeModel ?? '');
      // O localStorage é que manda no arranque (o index.html precisa dele antes do paint); o
      // servidor só reconcilia quem chega de outra máquina.
      if (typeof s.brandTheme === 'string' && s.brandTheme !== readBrand().id) {
        setBrandId(s.brandTheme);
        applyBrand(s.brandTheme);
      }
    }).catch(() => {});
    fetch('/llm-providers').then(r => r.json()).then(setProviders).catch(() => {});
  }, []);

  const patchSettings = useCallback((patch: Record<string, unknown>) => {
    fetch('/ui-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => {});
  }, []);
  // Aplica já (CSS + evento para quem está montado) e espelha no servidor, como o modo do tema.
  const selectBrand = useCallback((id: string) => {
    setBrandId(id);
    applyBrand(id);
    patchSettings({ brandTheme: id });
  }, [patchSettings]);
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

  // A pré-visualização ("agora seria claro/escuro") tem de envelhecer com o relógio: sem isto,
  // ficava a dizer o contrário do que está no ecrã se o painel atravessasse a hora da troca.
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

  // Um `<input type="time">` vazio (a meio da edição) não pode apagar o horário guardado — o campo
  // acompanha o que se escreve, mas só se grava quando é uma hora completa.
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
          <span className="files-view-title settings-panel-title">Definições</span>
          <span className="files-view-subtitle">Esta máquina</span>
        </div>
        <button className="files-view-close" onClick={onClose} aria-label="Fechar definições" data-tooltip="Fechar" data-tooltip-position="bottom">
          <ChevronsRight />
        </button>
      </div>
      <div className="settings-panel-body">
        <div className="settings-service-card">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">aparência</span>
            <span>Tema</span>
          </div>
          {/* Radiogroup a sério: UM tab stop (roving tabindex) e setas a navegar — num radiogroup
              o Tab entra e sai do grupo, não percorre as opções uma a uma. */}
          <div className="theme-mode-row" role="radiogroup" aria-label="Modo do tema">
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
                  // O foco tem de seguir a selecção, senão fica num botão que passou a tabIndex=-1.
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
                <span>Passa a claro</span>
                <input type="time" value={dayStart} onChange={(e) => changeDayStart(e.target.value)} />
              </label>
              <label className="theme-schedule-field">
                <span>Passa a escuro</span>
                <input type="time" value={nightStart} onChange={(e) => changeNightStart(e.target.value)} />
              </label>
              <p className="theme-schedule-hint">
                Agora seria <strong>{resolveTheme('auto', dayStart, nightStart) === 'light' ? 'claro' : 'escuro'}</strong>.
                {' '}Troca sozinho à hora marcada, com a app aberta.
              </p>
            </div>
          )}

          {/* Temas de marca — eixo separado do claro/escuro acima: cada marca traz os dois modos. */}
          <div className="brand-theme-block">
            <span className="brand-theme-label">Temas de marca</span>
            <p className="brand-theme-hint">
              Muda o nome, o logo e as cores. Só aparência — o cérebro, a memória e o trabalho
              ficam exactamente iguais.
            </p>
            <div className="brand-theme-row" role="radiogroup" aria-label="Tema de marca">
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
              {service.status === 'connected' ? 'ligado' : service.status === 'offline' ? 'desligado' : service.status}
            </span>
              <span>{service.name}</span>
            </div>
            <p>{service.scope}</p>
          </div>
        ))}
        <div className="settings-service-card settings-service-card--runtime">
          <div className="settings-service-head">
            <span className="status-pill status-pill--connected">estado</span>
            <span>Esta instalação</span>
          </div>
          <dl className="settings-runtime-grid">
            <dt>Porta do backend</dt><dd>{runtimeInfo?.port ?? '...'}</dd>
            <dt>Claude</dt><dd>{runtimeInfo?.claudeBin ?? '...'}</dd>
            <dt>Shell</dt><dd>{runtimeInfo?.shell ?? '...'}</dd>
            <dt>Pasta pessoal</dt><dd>{runtimeInfo ? shortPath(runtimeInfo.home) : '...'}</dd>
            <dt>Terminais</dt><dd>{runtimeInfo?.sessionCount ?? sessions.length}</dd>
            <dt>Projectos</dt><dd>{runtimeInfo?.projectCount ?? projects.length}</dd>
          </dl>
          <button className="db-project-card-btn" onClick={onReloadRuntime}>Actualizar</button>
        </div>
        {jocaLogicInfo && (
          <div className="settings-service-card">
            <div className="settings-service-head">
              <span className={`status-pill status-pill--${jocaLogicInfo.connected ? 'ligado' : 'desligado'}`}>
                {jocaLogicInfo.connected ? 'ligado' : 'desligado'}
              </span>
              <span>JOCA_Brain</span>
            </div>
            <dl className="settings-runtime-grid">
              <dt>Pasta</dt><dd>{shortPath(jocaLogicInfo.path)}</dd>
              <dt>Skills</dt><dd>{jocaLogicInfo.skillCount}</dd>
              <dt>Agentes</dt><dd>{jocaLogicInfo.agentCount}</dd>
              <dt>Comandos</dt><dd>{jocaLogicInfo.commandCount}</dd>
              <dt>Índice de memória</dt><dd>{jocaLogicInfo.hasMemoryIndex ? 'presente' : 'em falta'}</dd>
              <dt>Grafo de conhecimento</dt><dd>{jocaLogicInfo.hasGraph ? 'presente' : 'em falta'}</dd>
              <dt>Soul</dt><dd>{jocaLogicInfo.hasSoul ? 'carregado' : 'em falta'}</dd>
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
            <span>Saltar os pedidos de permissão <code style={{ fontSize: '0.8em', opacity: 0.6 }}>--dangerously-skip-permissions</code></span>
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
        {/* O modelo escolhe-se no próprio terminal (/model) ou no CLI por defeito abaixo. */}
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
              <article key={tool.id} className={`settings-cli-card settings-cli-card--${tool.installed ? 'instalado' : 'em falta'}`}>
                <div className="settings-cli-head">
                  <div>
                    <strong>{tool.name}</strong>
                    <span>{tool.provider} · <code>{tool.binary}</code></span>
                  </div>
                  <span className={`status-pill status-pill--${tool.installed ? 'connected' : 'offline'}`}>
                    {tool.installed ? 'instalado' : 'em falta'}
                  </span>
                </div>
                <dl className="settings-cli-meta">
                  <dt>Versão</dt><dd>{tool.version || '...'}</dd>
                  <dt>Pasta</dt><dd>{tool.path ? shortPath(tool.path) : 'não encontrado'}</dd>
                  <dt>Sessão</dt><dd>{AUTH_LABEL[tool.authStatus] ?? tool.authStatus}</dd>
                  <dt>Detalhe</dt><dd>{tool.authDetail || '...'}</dd>
                </dl>
                <div className="settings-cli-actions">
                  <button type="button" onClick={() => onRunCommand(tool.installCommand)}>Instalar</button>
                  <button type="button" onClick={() => onRunCommand(tool.loginCommand)} disabled={!tool.installed && tool.id !== 'agy'}>Entrar</button>
                  {tool.updateCommand && <button type="button" onClick={() => onRunCommand(tool.updateCommand!)} disabled={!tool.installed}>Actualizar</button>}
                </div>
              </article>
            ))}
            {!cliLoading && cliTools.length === 0 && <p>Não foi possível ler o estado dos CLIs.</p>}
          </div>
          <button className="db-project-card-btn" onClick={reloadCliTools} disabled={cliLoading}>
            {cliLoading ? 'A verificar…' : 'Verificar de novo'}
          </button>
        </div>
      </div>
    </div>
  );
}
