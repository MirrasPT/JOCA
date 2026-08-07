import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import type { SessionInfo, TerminalRef, ProjectMemory, JocaItems, CliProfileInfo, Project } from '../types';
import TerminalPane from './TerminalPane';
import { basename } from '../lib/paths';
import { captureDrop, dragRealPaths, dropHadFilesWithoutPath, resolveDrop, uploadPickedFiles, uploadPastedImages } from '../lib/fileDrop';
import './TerminalView.css';

interface Props {
  sessions: SessionInfo[];
  activeId: string | null;
  activatedIds: Set<string>;
  terminalDraft: string;
  setTerminalDraft: (draft: string) => void;
  terminalHistory: string[];
  historyIndex: number | null;
  setHistoryIndex: (idx: number | null) => void;
  selectedPath: string | null;
  onClearSelectedPath: () => void;
  /** Para o botão `Resume` saber a pasta do projecto da sessão activa. */
  projects: Project[];
  projectMemory: Record<string, ProjectMemory>;
  onSaveSession: () => void;
  onCompactSession: () => void;
  onInterruptSession: () => void;
  onRestartSession: (id: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  submitTerminalDraft: (overrideText?: string) => void;
  onOpenCommandPalette: () => void;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  onNewSession: () => void;
  onNewSessionWithCli: (cli: string) => void;
  /** Abre um terminal novo com `--remote-control` (ver o botão na barra de comandos). */
  onNewRemoteControlSession: () => void;
  jocaItems: JocaItems | null;
  onLoadJocaItems: () => void;
}

// ── Lucide SVG Icons ───────────────────────────────────────────────

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function RemoteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M5 12a7 7 0 0 1 14 0" /><path d="M2 12a10 10 0 0 1 20 0" />
      <circle cx="12" cy="18" r="2" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" />
    </svg>
  );
}

function GitPushIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function GitPullIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// Built-in Claude Code slash commands (shown alongside JOCA's own /commands).
const CLAUDE_BASE_COMMANDS: { name: string; description: string }[] = [
  { name: 'add-dir', description: 'Add a working directory' },
  { name: 'agents', description: 'Manage custom subagents' },
  { name: 'bug', description: 'Report a bug to Anthropic' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Compact conversation to save context' },
  { name: 'config', description: 'Open settings' },
  { name: 'context', description: 'Show token / context usage' },
  { name: 'cost', description: 'Show token cost of this session' },
  { name: 'doctor', description: 'Diagnose Claude Code setup' },
  { name: 'export', description: 'Export the conversation' },
  { name: 'help', description: 'Show help and available commands' },
  { name: 'hooks', description: 'Manage hooks' },
  { name: 'ide', description: 'Connect to an IDE' },
  { name: 'init', description: 'Generate a CLAUDE.md for the project' },
  { name: 'login', description: 'Switch Anthropic account' },
  { name: 'logout', description: 'Sign out' },
  { name: 'mcp', description: 'Manage MCP servers' },
  { name: 'memory', description: 'Edit Claude memory files' },
  { name: 'model', description: 'Change the active model' },
  { name: 'output-style', description: 'Change the output style' },
  { name: 'permissions', description: 'Manage tool permissions' },
  { name: 'pr-comments', description: 'Get comments from a GitHub PR' },
  { name: 'release-notes', description: 'Show release notes' },
  { name: 'resume', description: 'Resume a previous conversation' },
  { name: 'review', description: 'Review a pull request' },
  { name: 'status', description: 'Show account & system status' },
  { name: 'terminal-setup', description: 'Configure terminal key bindings' },
  { name: 'vim', description: 'Toggle vim editing mode' },
];

export default function TerminalView({
  sessions, activeId, activatedIds, terminalDraft, setTerminalDraft, terminalHistory,
  historyIndex, setHistoryIndex, selectedPath, onClearSelectedPath, projects, projectMemory,
  onSaveSession, onCompactSession, onInterruptSession,
  onRestartSession, onInput, onResize, onReady, submitTerminalDraft, onOpenCommandPalette, termRefs, onNewSession,
  onNewSessionWithCli, onNewRemoteControlSession, jocaItems, onLoadJocaItems
}: Props) {
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<string[]>([]);


  const addAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((p) => p !== path));
  }, []);

  // Model quick-switch (#20): sends `/model <alias>` straight into the active Claude Code terminal.
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelWrapRef = useRef<HTMLDivElement>(null);
  const setModel = useCallback((alias: string) => {
    if (!activeId) return;
    onInput(activeId, `/model ${alias}\r`);
    setModelMenuOpen(false);
  }, [activeId, onInput]);
  // Close the model menu on an outside click.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (modelWrapRef.current && !modelWrapRef.current.contains(ev.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [modelMenuOpen]);

  // Split-button do empty state: "+ New Session" abre no claude; o "▾" ao lado deixa escolher o CLI
  // (codex/agy/opencode). Perfis são carregados lazy na primeira abertura do menu.
  const [cliMenuOpen, setCliMenuOpen] = useState(false);
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[] | null>(null);
  const cliWrapRef = useRef<HTMLDivElement>(null);
  const openCliMenu = useCallback(() => {
    setCliMenuOpen((o) => !o);
    if (cliProfiles === null) {
      fetch('/cli-profiles').then((r) => r.json())
        .then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : []))
        .catch(() => setCliProfiles([]));
    }
  }, [cliProfiles]);
  useEffect(() => {
    if (!cliMenuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (cliWrapRef.current && !cliWrapRef.current.contains(ev.target as Node)) setCliMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [cliMenuOpen]);

  // Non-blocking hint shown when a drop carried files but the OS hid the real path (Explorer sandbox).
  const [dropHint, setDropHint] = useState(false);
  const dropHintTimer = useRef<number | null>(null);
  const flashDropHint = useCallback(() => {
    setDropHint(true);
    if (dropHintTimer.current) clearTimeout(dropHintTimer.current);
    dropHintTimer.current = window.setTimeout(() => setDropHint(false), 4000);
  }, []);
  useEffect(() => () => { if (dropHintTimer.current) clearTimeout(dropHintTimer.current); }, []);

  const [slashIndex, setSlashIndex] = useState(-1);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const slashItems = useMemo(() => {
    if (!terminalDraft.startsWith('/')) return [];
    const query = terminalDraft.slice(1).toLowerCase();
    const all: { type: string; name: string; description?: string; insert: string }[] = [];
    const jocaCommandNames = new Set<string>();
    if (jocaItems) {
      for (const c of jocaItems.commands) { jocaCommandNames.add(c.name.toLowerCase()); all.push({ type: 'command', name: `/${c.name}`, description: c.description, insert: `/${c.name}` }); }
      for (const s of jocaItems.skills) all.push({ type: 'skill', name: s.name, description: s.description, insert: s.insert || s.name });
      for (const a of jocaItems.agents) all.push({ type: 'agent', name: a.name, description: a.description, insert: a.insert || a.name });
    }
    // Base Claude Code commands — skip any name a JOCA command already provides.
    for (const b of CLAUDE_BASE_COMMANDS) {
      if (jocaCommandNames.has(b.name)) continue;
      all.push({ type: 'claude', name: `/${b.name}`, description: b.description, insert: `/${b.name}` });
    }
    if (!query) return all.slice(0, 12);
    return all.filter((i) => i.name.toLowerCase().includes(query)).slice(0, 12);
  }, [terminalDraft, jocaItems]);

  const [slashDismissed, setSlashDismissed] = useState(false);
  const showSlashMenu = terminalDraft.startsWith('/') && slashItems.length > 0 && !slashDismissed;

  useEffect(() => {
    if (showSlashMenu) setSlashIndex(0);
    else setSlashIndex(-1);
  }, [showSlashMenu, terminalDraft]);

  // Reset dismissal whenever the draft changes (user typing reopens the menu).
  useEffect(() => { setSlashDismissed(false); }, [terminalDraft]);

  useEffect(() => {
    if (terminalDraft.startsWith('/') && !jocaItems) onLoadJocaItems();
  }, [terminalDraft, jocaItems, onLoadJocaItems]);

  const acceptSlashItem = useCallback((item: { insert: string }) => {
    setTerminalDraft(item.insert + ' ');
    inputAreaRef.current?.focus();
  }, [setTerminalDraft]);

  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [terminalDraft]);

  const sendSelectedPath = useCallback(() => {
    if (!activeId || !selectedPath) return;
    onInput(activeId, selectedPath + ' ');
    onClearSelectedPath();
    inputAreaRef.current?.focus();
  }, [activeId, selectedPath, onInput, onClearSelectedPath]);

  const gitPush = useCallback(() => {
    if (!activeId || !activeSession?.projectId) return;
    onInput(activeId, 'git push\r');
  }, [activeId, activeSession?.projectId, onInput]);

  const gitPull = useCallback(() => {
    if (!activeId || !activeSession?.projectId) return;
    onInput(activeId, 'git pull\r');
  }, [activeId, activeSession?.projectId, onInput]);

  // Pasta do projecto da sessão activa — o argumento do resume.
  const activeProjectPath = useMemo(() => {
    if (!activeSession?.projectId) return null;
    return projects.find((p) => p.id === activeSession.projectId)?.path ?? null;
  }, [projects, activeSession?.projectId]);

  /**
   * Reenvia à MÃO o comando de contexto do arranque: `/resume "<pasta do projecto>"`.
   *
   * O backend já o manda sozinho quando o terminal nasce (session-manager, runStartupSequence),
   * mas isso depende de apanhar a TUI pronta — num arranque lento, ou com o prompt "trust this
   * folder?" pelo meio, o comando pode perder-se e o terminal fica sem saber em que projecto está.
   * Este botão é a saída manual desse caso: mesma forma de comando, mesma pasta.
   */
  const resumeProject = useCallback(() => {
    if (!activeId || !activeProjectPath) return;
    // A forma do comando vem do perfil do CLI (`/resume` no claude, `resume` nos outros) porque é
    // sobreponível em cli-profiles.json; o fallback só cobre o profile ainda não ter carregado.
    const profile = cliProfiles?.find((p) => p.id === (activeSession?.cli ?? 'claude'));
    const verb = profile?.resumeCmd ?? (activeSession?.cli && activeSession.cli !== 'claude' ? 'resume' : '/resume');
    onInput(activeId, `${verb} "${activeProjectPath}"\r`);
  }, [activeId, activeProjectPath, activeSession?.cli, cliProfiles, onInput]);

  // Fetch quick commands from project memory
  const quickCommands = useMemo(() => {
    if (!activeSession?.projectId) return ['save', 'compact', 'clear', 'plan'];
    const memory = projectMemory[activeSession.projectId];
    return memory?.quickCommands ?? ['save', 'compact', 'clear', 'plan'];
  }, [activeSession, projectMemory]);

  const runQuickCommand = useCallback((cmd: string) => {
    if (!activeId) return;
    if (cmd === 'save') onSaveSession();
    else if (cmd === 'compact') onCompactSession();
    else if (cmd === 'clear') {
      onInput(activeId, 'clear\r');
      termRefs.current.get(activeId)?.clear?.();
    }
    else if (cmd === 'plan') {
      setTerminalDraft('/plan');
      inputAreaRef.current?.focus();
    }
    else {
      onInput(activeId, `/${cmd}\r`);
    }
  }, [activeId, onSaveSession, onCompactSession, onInput, setTerminalDraft, termRefs]);

  return (
    <div
      className="terminal-area"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        // Drag = referência ao caminho real do ficheiro (sem cópia). Só o Ctrl+V grava em JOCA_Drops.
        // O browser esconde o path de drags do explorador do SO → dragRealPaths fica vazio nesses
        // casos; arrastar do file browser do JOCA (ou Finder) dá o caminho. Ver lib/fileDrop.ts.
        const cap = captureDrop(e.nativeEvent);
        const paths = dragRealPaths(cap);
        if (paths.length > 0) {
          // Real path available (JOCA Files panel / Finder) → attach the ORIGINAL, no copy.
          paths.forEach((p) => addAttachment(p));
          inputAreaRef.current?.focus();
        } else if (dropHadFilesWithoutPath(cap)) {
          // Explorer drag: the browser sandbox hides the real path (#3). Fall back to uploading a copy
          // to JOCA_Drops and attach that path, so the drop WORKS instead of doing nothing.
          flashDropHint();
          void resolveDrop(cap).then(({ paths: uploaded }) => {
            uploaded.forEach((p) => addAttachment(p));
            if (uploaded.length) inputAreaRef.current?.focus();
          });
        }
      }}
    >
      {dropHint && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            top: 56,
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 32px)',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(232, 96, 28, 0.12)',
            border: '1px solid rgba(232, 96, 28, 0.35)',
            color: 'var(--text-bright)',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          }}
        >
          A copiar para JOCA_Drops e anexar… (o Explorer não expõe o caminho original)
        </div>
      )}
      <div className="terminal-panel">
        {sessions.length === 0 ? (
          <div className="terminal-empty-state">
            <div className="terminal-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.15 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <p>No active sessions</p>
            <div className="cli-split" ref={cliWrapRef}>
              <button className="btn-new-large cli-split-main" type="button" onClick={onNewSession}>+ New Session</button>
              <button
                className="btn-new-large cli-split-caret"
                type="button"
                onClick={openCliMenu}
                aria-haspopup="menu"
                aria-expanded={cliMenuOpen}
                aria-label="Escolher CLI para a nova sessão"
                data-tooltip="Escolher CLI"
              >
                ▾
              </button>
              {cliMenuOpen && (
                <div className="cli-split-menu" role="menu" aria-label="CLIs disponíveis">
                  {(cliProfiles ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className="cli-split-item"
                      disabled={!p.available}
                      onClick={() => { setCliMenuOpen(false); onNewSessionWithCli(p.id); }}
                    >
                      {p.label}{p.available ? '' : ' (não instalado)'}
                    </button>
                  ))}
                  {cliProfiles === null && <div className="cli-split-item cli-split-item--loading">A carregar…</div>}
                  {cliProfiles?.length === 0 && <div className="cli-split-item cli-split-item--loading">Sem perfis CLI.</div>}
                </div>
              )}
            </div>
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="terminal-wrapper"
              style={{ display: s.id === activeId ? 'flex' : 'none' }}
            >
              {activatedIds.has(s.id) && (
                <TerminalPane
                  sessionId={s.id}
                  isActive={s.id === activeId}
                  onInput={onInput}
                  onResize={onResize}
                  onReady={onReady}
                />
              )}
            </div>
          ))
        )}
      </div>
      

      {activeSession && (
        <div className="terminal-command-bar">
          <div className="quick-command-row">
            {quickCommands.map((cmd) => (
              <button key={cmd} type="button" onClick={() => runQuickCommand(cmd)} className="quick-command-btn">
                {cmd}
              </button>
            ))}

            {activeSession?.projectId && (
              <>
                <div className="command-bar-divider" />
                <button type="button" onClick={gitPull} className="quick-command-btn quick-command-btn--git" data-tooltip="git pull">
                  <GitPullIcon /> Pull
                </button>
                <button type="button" onClick={gitPush} className="quick-command-btn quick-command-btn--git" data-tooltip="git push">
                  <GitPushIcon /> Push
                </button>
              </>
            )}

            {selectedPath && (
              <>
                <div className="command-bar-divider" />
                <button type="button" onClick={sendSelectedPath} className="quick-command-btn quick-command-btn--highlight" data-tooltip="Colar caminho do ficheiro">
                  <LinkIcon /> Paste Path
                </button>
              </>
            )}

            <div className="command-bar-divider" />
            <div ref={modelWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                className="quick-command-btn"
                onClick={() => setModelMenuOpen((o) => !o)}
                disabled={!activeId}
                data-tooltip="Mudar o modelo do Claude (/model)"
              >
                Model ▾
              </button>
              {modelMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 30,
                    display: 'flex', flexDirection: 'column', minWidth: 120, padding: 4, gap: 2,
                    background: 'var(--surface-panel, #1c1917)', border: '1px solid var(--border-bento, rgba(255,255,255,0.08))',
                    borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                  }}
                >
                  {[
                    { alias: 'opus', label: 'Opus' },
                    { alias: 'sonnet', label: 'Sonnet' },
                    { alias: 'haiku', label: 'Haiku' },
                    { alias: 'fable', label: 'Fable' },
                    { alias: 'default', label: 'Default' },
                  ].map((m) => (
                    <button
                      key={m.alias}
                      type="button"
                      role="menuitem"
                      className="quick-command-btn"
                      style={{ justifyContent: 'flex-start', width: '100%' }}
                      onClick={() => setModel(m.alias)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={onOpenCommandPalette} className="quick-command-btn quick-command-btn--plus" data-tooltip="Adicionar comando ou skill" aria-label="Adicionar comando ou skill">+</button>

            {/* Vieram da barra de título, que foi removida por ocupar uma faixa inteira para
                repetir o que já estava aqui. Só estes três: `Save` e `Compact` de lá eram os
                mesmos `save`/`compact` que abrem esta fila. */}
            <div className="command-bar-divider" />
            {/* Rede de segurança para quando o `/resume` do arranque não chega ao CLI (TUI lenta,
                prompt "trust this folder?"): reenvia o mesmo comando, com a mesma pasta. */}
            {activeProjectPath && (
              <button
                type="button"
                className="quick-command-btn"
                onClick={resumeProject}
                data-tooltip={`Carregar o contexto do projecto (${basename(activeProjectPath)}) — se o resume automático falhou`}
                aria-label="Reenviar o resume do projecto"
              >
                <ResumeIcon /> Resume
              </button>
            )}
            <button
              type="button"
              className="quick-command-btn"
              onClick={() => activeSession && onRestartSession(activeSession.id)}
              data-tooltip="Reiniciar terminal"
            >
              <RefreshIcon /> Restart
            </button>
            <button
              type="button"
              className="quick-command-btn quick-command-btn--stop"
              onClick={onInterruptSession}
              data-tooltip="Parar processo (Ctrl-C)"
            >
              <StopIcon /> Stop
            </button>
            {/* `--remote-control` é uma flag de ARRANQUE do Claude Code: não há como ligá-la a meio
                de uma conversa. Por isso este botão abre um terminal NOVO com ela — em vez de matar
                a conversa aberta para a relançar, que é o que "ligar aqui" obrigaria a fazer. */}
            <button
              type="button"
              className="quick-command-btn"
              onClick={onNewRemoteControlSession}
              data-tooltip="Abrir um terminal novo com Remote Control ligado"
              aria-label="Abrir um terminal novo com Remote Control ligado"
            >
              <RemoteIcon /> Remote
            </button>
            <button
              type="button"
              className="quick-command-btn"
              onClick={() => activeId && termRefs.current.get(activeId)?.scrollToBottom?.()}
              data-tooltip="Ir para o fim do terminal"
              aria-label="Ir para o fim do terminal"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>

            {/* O estado vivia no canto da barra de título; sem ele não se via daqui se o terminal
                está a trabalhar. Empurrado para a direita, longe dos botões. */}
            <span className={`cmd-bar-status cmd-bar-status--${activeSession.status}`}>
              {activeSession.status === 'working' ? 'a trabalhar' : 'parado'}
            </span>
          </div>

          {attachments.length > 0 && (
            <div className="attachment-row">
              {attachments.map((att) => (
                <span key={att} className="attachment-chip">
                  <PaperclipIcon />
                  <span className="attachment-chip-name" title={att}>{basename(att)}</span>
                  <button type="button" className="attachment-chip-remove" onClick={() => removeAttachment(att)}>&times;</button>
                </span>
              ))}
            </div>
          )}

          <div className="terminal-command-input-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (files) void uploadPickedFiles(Array.from(files)).then((paths) => paths.forEach(addAttachment));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="terminal-command-attach"
              onClick={() => fileInputRef.current?.click()}
              data-tooltip="Anexar ficheiro"
            >
              <PaperclipIcon />
            </button>
            {showSlashMenu && (
              <div className="slash-menu" id="slash-listbox" ref={slashMenuRef} role="listbox" aria-label="Comandos disponíveis">
                {slashItems.map((item, i) => (
                  <div
                    key={`${item.type}-${item.name}`}
                    id={`slash-opt-${item.type}-${item.name}`}
                    className={`slash-menu-item ${i === slashIndex ? 'slash-menu-item--active' : ''}`}
                    role="option"
                    aria-selected={i === slashIndex}
                    onMouseDown={(e) => { e.preventDefault(); acceptSlashItem(item); }}
                    onMouseEnter={() => setSlashIndex(i)}
                  >
                    <span className={`slash-menu-badge slash-menu-badge--${item.type}`}>{item.type}</span>
                    <span className="slash-menu-name">{item.name}</span>
                    {item.description && <span className="slash-menu-desc">{item.description.slice(0, 60)}</span>}
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={inputAreaRef}
              className="terminal-command-input"
              value={terminalDraft}
              placeholder="Escrever mensagem ou comando..."
              aria-label="Mensagem ou comando"
              role="combobox"
              aria-expanded={showSlashMenu}
              aria-controls={showSlashMenu ? 'slash-listbox' : undefined}
              aria-activedescendant={showSlashMenu && slashItems[slashIndex] ? `slash-opt-${slashItems[slashIndex].type}-${slashItems[slashIndex].name}` : undefined}
              rows={4}
              onChange={(e) => setTerminalDraft(e.target.value)}
              onPaste={(e) => {
                // Ctrl+V of an image (screenshot / copied picture) → upload to JOCA_Drops and add its
                // saved path as an attachment. Text pastes fall through to the normal textarea handler.
                const imgs = Array.from(e.clipboardData?.items ?? [])
                  .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
                  .map((it) => it.getAsFile())
                  .filter((f): f is File => f !== null);
                if (imgs.length === 0) return;
                e.preventDefault();
                void uploadPastedImages(imgs, Date.now()).then((paths) => paths.forEach(addAttachment));
              }}
              onKeyDown={(e) => {
                if (showSlashMenu) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, slashItems.length - 1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return; }
                  if ((e.key === 'Tab' || e.key === 'Enter') && slashIndex >= 0 && slashItems[slashIndex]) {
                    e.preventDefault(); acceptSlashItem(slashItems[slashIndex]); return;
                  }
                  if (e.key === 'Escape') { e.preventDefault(); setSlashDismissed(true); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (attachments.length > 0) {
                    const paths = attachments.map((a) => `"${a}"`).join(' ');
                    const full = terminalDraft.trim() ? `${terminalDraft.trim()} ${paths}` : paths;
                    setAttachments([]);
                    submitTerminalDraft(full);
                  } else {
                    submitTerminalDraft();
                  }
                }
                if (e.key === 'ArrowUp' && terminalHistory.length > 0) {
                  e.preventDefault();
                  const nextIndex = historyIndex === null
                    ? terminalHistory.length - 1
                    : Math.max(0, historyIndex - 1);
                  setHistoryIndex(nextIndex);
                  setTerminalDraft(terminalHistory[nextIndex] ?? '');
                }
                if (e.key === 'ArrowDown' && historyIndex !== null) {
                  e.preventDefault();
                  const nextIndex = historyIndex + 1;
                  if (nextIndex >= terminalHistory.length) {
                    setHistoryIndex(null);
                    setTerminalDraft('');
                  } else {
                    setHistoryIndex(nextIndex);
                    setTerminalDraft(terminalHistory[nextIndex] ?? '');
                  }
                }
              }}
            />
            <button
              className="terminal-command-send"
              type="button"
              onClick={() => {
                if (attachments.length > 0) {
                  const paths = attachments.map((a) => `"${a}"`).join(' ');
                  const full = terminalDraft.trim() ? `${terminalDraft.trim()} ${paths}` : paths;
                  setAttachments([]);
                  submitTerminalDraft(full);
                } else {
                  submitTerminalDraft();
                }
              }}
              disabled={!activeId || (!terminalDraft.trim() && attachments.length === 0)}
              data-tooltip="Enviar para o terminal"
            >
              enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
