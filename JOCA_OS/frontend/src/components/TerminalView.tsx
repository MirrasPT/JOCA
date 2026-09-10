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
  /** So the `Resume` button knows the project folder of the active session. */
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
  jocaItems: JocaItems | null;
  onLoadJocaItems: () => void;
}

// The same threshold as the `TerminalView.css` media query — the composer is measured differently
// below it (see the effect that adjusts the textarea height).
const ECRA_ESTREITO = '(max-width: 860px)';

/**
 * Collapsed composer — a GLOBAL preference (not per terminal) and stored in the browser.
 * It goes to `localStorage` and not to `/ui-settings` deliberately: it is a view choice, on a par
 * with the sidebar's project ordering, and does not need to travel between machines.
 */
const CAIXA_COLAPSADA_KEY = 'joca.composer.colapsado';

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

// Rocket — start the project (`/start`). Distinct from Resume (play), which picks up what exists.
function StartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// Eraser — clear the TEXT in the box, not the terminal screen nor the process.
function EraserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M7 21h13" />
      <path d="m16 6-9.5 9.5a2.1 2.1 0 0 0 0 3l2 2h4l7.5-7.5a2.1 2.1 0 0 0 0-3L18 6a2.1 2.1 0 0 0-3 0Z" />
    </svg>
  );
}

/** Bar menus. `/model` and `/effort` are real Claude Code 2.1.237 commands (verified in the
 *  binary); the effort levels are the ones `claude --help` announces, plus the `auto` default. */
const MODELOS: { valor: string; label: string }[] = [
  { valor: 'opus', label: 'Opus' },
  { valor: 'sonnet', label: 'Sonnet' },
  { valor: 'haiku', label: 'Haiku' },
  { valor: 'fable', label: 'Fable' },
  { valor: 'default', label: 'Default' },
];

const ESFORCOS: { valor: string; label: string }[] = [
  { valor: 'auto', label: 'Auto' },
  { valor: 'low', label: 'Low' },
  { valor: 'medium', label: 'Medium' },
  { valor: 'high', label: 'High' },
  { valor: 'xhigh', label: 'X-High' },
  { valor: 'max', label: 'Max' },
];

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
  // `projectMemory` lost its reader when the command row stopped coming from the project memory
  // and became fixed (save · resume · start). The prop stays so as not to touch the two callers.
  historyIndex, setHistoryIndex, selectedPath, onClearSelectedPath, projects, projectMemory: _projectMemory,
  onSaveSession: _onSaveSession, onCompactSession: _onCompactSession, onInterruptSession,
  onRestartSession, onInput, onResize, onReady, submitTerminalDraft, onOpenCommandPalette, termRefs, onNewSession,
  onNewSessionWithCli, jocaItems, onLoadJocaItems
}: Props) {
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const inputAreaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Collapsing the composer leaves the quick-shortcut row alone and gives ~110px back to the
   * terminal — the mode for whoever is only READING what the CLI does. It unmounts nothing (see
   * the `--oculta` class in the CSS): the draft, the attachments and the measured height stay put.
   */
  const [caixaColapsada, setCaixaColapsada] = useState<boolean>(() => {
    try { return localStorage.getItem(CAIXA_COLAPSADA_KEY) === '1'; } catch { return false; }
  });

  const alternarCaixa = useCallback(() => {
    setCaixaColapsada((prev) => {
      const proximo = !prev;
      try { localStorage.setItem(CAIXA_COLAPSADA_KEY, proximo ? '1' : '0'); } catch { /* ignore */ }
      return proximo;
    });
  }, []);

  /**
   * Anything that WRITES into the box reopens it first. Without this, pressing `save` or dropping
   * a file with the box closed put text/attachments in an invisible place — the gesture looked
   * like it had done nothing.
   */
  const abrirCaixa = useCallback(() => {
    setCaixaColapsada((prev) => {
      if (!prev) return prev;
      try { localStorage.setItem(CAIXA_COLAPSADA_KEY, '0'); } catch { /* ignore */ }
      return false;
    });
  }, []);

  /**
   * Entering a terminal puts the cursor IN THE MESSAGE BOX, not in the xterm.
   *
   * The box is the normal route for talking to the CLI (it has history, the `/` menu, attachments);
   * the xterm underneath is for reading. Without this, opening a conversation and starting to type
   * sent the keys straight to the process, bypassing all of that.
   *
   * `preventScroll` because focusing an element at the bottom of the page makes the container jump —
   * which pushed the terminal out of view in the very gesture of opening it.
   */
  useEffect(() => {
    // With the box collapsed there is nowhere to put the cursor — focusing a `display:none` is a
    // no-op that left the keyboard ownerless. Reopening passes here again and returns the focus.
    if (!activeId || caixaColapsada) return;
    const t = window.setTimeout(() => inputAreaRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(t);
  }, [activeId, caixaColapsada]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<string[]>([]);


  const addAttachment = useCallback((path: string) => {
    abrirCaixa();
    setAttachments((prev) => prev.includes(path) ? prev : [...prev, path]);
  }, [abrirCaixa]);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((p) => p !== path));
  }, []);

  /**
   * Model and Effort are the same gesture: choose from a short list and send `/<cmd> <value>` to
   * the CLI. A single state holds WHICH of the two is open — opening one closes the other, which
   * is what two menus side by side are expected to do (two independent booleans left them open at
   * the same time, overlapping).
   */
  const [barMenu, setBarMenu] = useState<null | 'model' | 'effort'>(null);
  const barMenuWrapRef = useRef<HTMLDivElement>(null);
  const sendBarMenuChoice = useCallback((cmd: string, valor: string) => {
    if (!activeId) return;
    onInput(activeId, `/${cmd} ${valor}\r`);
    setBarMenu(null);
  }, [activeId, onInput]);
  // Closes on outside click, and on Escape — a menu with no keyboard exit traps whoever navigates that way.
  useEffect(() => {
    if (!barMenu) return;
    const onDoc = (ev: MouseEvent) => {
      if (barMenuWrapRef.current && !barMenuWrapRef.current.contains(ev.target as Node)) setBarMenu(null);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setBarMenu(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [barMenu]);

  // Empty-state split button: "+ New Session" opens in claude; the "▾" beside it lets you choose
  // the CLI (codex/agy/opencode). Profiles are loaded lazily the first time the menu opens.
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

  // Non-blocking attachment warning: the original path hidden by the OS (Explorer sandbox) OR an
  // upload refused by the backend. `tone` separates information from failure — a silent refusal
  // made the clip button look dead (the error only went to the console).
  const [dropHint, setDropHint] = useState<{ text: string; tone: 'info' | 'erro' } | null>(null);
  const dropHintTimer = useRef<number | null>(null);
  const flashDropHint = useCallback((text: string, tone: 'info' | 'erro' = 'info') => {
    setDropHint({ text, tone });
    if (dropHintTimer.current) clearTimeout(dropHintTimer.current);
    dropHintTimer.current = window.setTimeout(() => setDropHint(null), tone === 'erro' ? 7000 : 4000);
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
    const ajusta = () => {
      // ⚠ `height:auto` on a textarea does NOT fall back to the CSS `min-height` — it falls back to
      // the intrinsic height of `rows` (rows=4 → 4×19.5 + 20 of padding = 98px), and that is the
      // value `scrollHeight` returns. So the 98px at rest were fixed on any screen: at 360×640 they
      // ate 61% of the terminal's vertical budget and left the xterm with ~61px. Measuring against
      // `0` gives `min-height` back the role of a real floor — and only then can the ≤860px media
      // query (which lowers that floor and puts the ceiling in `max-height`) change the height.
      // The desktop still measures against `auto`: the same height as always, measured.
      el.style.height = window.matchMedia(ECRA_ESTREITO).matches ? '0px' : 'auto';
      el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
    };
    ajusta();
    // Rotating the phone crosses the media query; without this the box kept the height of the
    // other mode until the next keystroke.
    const mq = window.matchMedia(ECRA_ESTREITO);
    mq.addEventListener('change', ajusta);
    return () => mq.removeEventListener('change', ajusta);
    // `caixaColapsada` is in the dependencies because reopening with a long draft does not touch
    // `terminalDraft`: without this the box came back at the rest height and cut the text off.
  }, [terminalDraft, caixaColapsada]);

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

  // Project folder of the active session — the resume's argument.
  const activeProjectPath = useMemo(() => {
    if (!activeSession?.projectId) return null;
    return projects.find((p) => p.id === activeSession.projectId)?.path ?? null;
  }, [projects, activeSession?.projectId]);

  /**
   * Resends the startup context command BY HAND: `/resume "<project folder>"`.
   *
   * The backend already sends it itself when the terminal is born (session-manager,
   * runStartupSequence), but that depends on catching the TUI ready — on a slow startup, or with
   * the "trust this folder?" prompt in the way, the command can be lost and the terminal no longer
   * knows which project it is in. This button is the manual way out: same command form, same folder.
   */
  const resumeProject = useCallback(() => {
    if (!activeId || !activeProjectPath) return;
    // The command form comes from the CLI profile (`/resume` in claude, `resume` in the others)
    // because it is overridable in cli-profiles.json; the fallback only covers a profile not loaded yet.
    const profile = cliProfiles?.find((p) => p.id === (activeSession?.cli ?? 'claude'));
    const verb = profile?.resumeCmd ?? (activeSession?.cli && activeSession.cli !== 'claude' ? 'resume' : '/resume');
    onInput(activeId, `${verb} "${activeProjectPath}"\r`);
  }, [activeId, activeProjectPath, activeSession?.cli, cliProfiles, onInput]);

  /**
   * `/start "<project folder>"` — the project startup (interview → PRD → stack → design).
   * It carries the folder for the same reason as the resume: it tells the command which project
   * it is in. It only exists with an active project; a loose session has no folder to give it.
   */
  const startProject = useCallback(() => {
    if (!activeId || !activeProjectPath) return;
    onInput(activeId, `/start "${activeProjectPath}"\r`);
  }, [activeId, activeProjectPath, onInput]);

  /**
   * Turns Remote Control on IN the open conversation: `/remote-control <project name>`.
   * With no active project it sends just `/remote-control` — the command takes no argument to invent.
   */
  const sendRemoteControl = useCallback(() => {
    if (!activeId) return;
    const name = projects.find((p) => p.id === activeSession?.projectId)?.name;
    onInput(activeId, name ? `/remote-control ${name}\r` : '/remote-control\r');
  }, [activeId, activeSession?.projectId, projects, onInput]);

  /**
   * Restart and stop are irreversible from the point of view of whoever is working there: Restart
   * kills the CLI and takes the conversation with it, Stop sends Ctrl-C to what is running. Both
   * sat one click away from harmless neighboring buttons.
   */
  const restartComAviso = useCallback(() => {
    if (!activeSession) return;
    const ok = window.confirm(
      `Restart the terminal "${activeSession.name}"?\n\nThe process running there is killed and the open conversation is lost.`,
    );
    if (ok) onRestartSession(activeSession.id);
  }, [activeSession, onRestartSession]);

  const interromperComAviso = useCallback(() => {
    if (!activeSession) return;
    const ok = window.confirm(
      `Stop what is running in "${activeSession.name}"?\n\nSends Ctrl-C to the process. The conversation stays, the work mid-flight is interrupted.`,
    );
    if (ok) onInterruptSession();
  }, [activeSession, onInterruptSession]);

  /**
   * Clears the line written INSIDE the terminal (the CLI's input), without interrupting anything.
   *
   * In a terminal the usual route is Ctrl-C, but that sends SIGINT: it clears the line AND stops
   * the running work — exactly what is not wanted. Here it sends `\x05` (Ctrl-E, go to the end of
   * the line) followed by `\x15` (Ctrl-U, delete to the start): it clears the whole line wherever
   * the cursor is, and neither of the two is a signal — they are line-editing operations.
   */
  const apagarTexto = useCallback(() => {
    if (!activeId) return;
    onInput(activeId, '\x05\x15');
  }, [activeId, onInput]);

  /**
   * What was being typed when the history was entered with the up arrow. Recovered on leaving the
   * history at the other end — without this, peeking at an earlier message threw away whatever had
   * been typed.
   */
  const rascunhoGuardado = useRef('');

  /**
   * A click on the quick access WRITES the command into the input field — it does not send it.
   * Whoever presses Enter is always the user: it gives them the chance to add arguments
   * (`/save tidied up the buttons`) or to give up without having sent anything to the CLI.
   *
   * `Resume` and `Start` are the deliberate exception: they carry the project folder and there is
   * nothing to add to them, so they go straight away (see `resumeProject`/`startProject`).
   */
  const runQuickCommand = useCallback((cmd: string) => {
    if (!activeId) return;
    abrirCaixa();
    setTerminalDraft(`/${cmd} `);
    inputAreaRef.current?.focus();
  }, [activeId, setTerminalDraft, abrirCaixa]);

  return (
    <div
      className="terminal-area"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        // Drag = reference to the file's real path (no copy). Only Ctrl+V writes into JOCA_Drops.
        // The browser hides the path of drags from the OS explorer → dragRealPaths is empty in
        // those cases; dragging from JOCA's file browser (or Finder) gives the path. See lib/fileDrop.ts.
        const cap = captureDrop(e.nativeEvent);
        const paths = dragRealPaths(cap);
        if (paths.length > 0) {
          // Real path available (JOCA Files panel / Finder) → attach the ORIGINAL, no copy.
          paths.forEach((p) => addAttachment(p));
          inputAreaRef.current?.focus();
        } else if (dropHadFilesWithoutPath(cap)) {
          // Explorer drag: the browser sandbox hides the real path (#3). Fall back to uploading a copy
          // to JOCA_Drops and attach that path, so the drop WORKS instead of doing nothing.
          flashDropHint('Copying to JOCA_Drops and attaching… (Explorer does not expose the original path)');
          void resolveDrop(cap).then(({ paths: uploaded, errors }) => {
            uploaded.forEach((p) => addAttachment(p));
            if (uploaded.length) inputAreaRef.current?.focus();
            if (errors.length) flashDropHint(`Not attached — ${errors.join(' · ')}`, 'erro');
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
            background: dropHint.tone === 'erro' ? 'color-mix(in srgb, var(--red) 14%, transparent)' : 'rgba(232, 96, 28, 0.12)',
            border: `1px solid ${dropHint.tone === 'erro' ? 'var(--red)' : 'rgba(232, 96, 28, 0.35)'}`,
            color: 'var(--text-bright)',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          }}
        >
          {dropHint.text}
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
                aria-label="Choose CLI for the new session"
                data-tooltip="Choose CLI"
              >
                ▾
              </button>
              {cliMenuOpen && (
                <div className="cli-split-menu" role="menu" aria-label="Available CLIs">
                  {(cliProfiles ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className="cli-split-item"
                      disabled={!p.available}
                      onClick={() => { setCliMenuOpen(false); onNewSessionWithCli(p.id); }}
                    >
                      {p.label}{p.available ? '' : ' (not installed)'}
                    </button>
                  ))}
                  {cliProfiles === null && <div className="cli-split-item cli-split-item--loading">Loading…</div>}
                  {cliProfiles?.length === 0 && <div className="cli-split-item cli-split-item--loading">No CLI profiles.</div>}
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
            {/* ORDER (decided by the owner, 2026-08-20):
                  with project: Save · Resume · Start | Pull · Push | Model · Effort | Stop · Restart · Remote · Clear | + · ↓
                  without project: Save | Model · Effort | Stop · Restart · Remote · Clear | + · ↓
                The groups separated by `|` are the `command-bar-divider`. What depends on there
                being a project (folder) disappears in loose sessions instead of sitting dead to the click. */}

            {/* Save writes into the field instead of sending: `/save <note>` is current usage, and
                sending on its own removed the chance to add the note. Resume and Start already
                carry the folder, have nothing to add, and go straight away. */}
            <button type="button" onClick={() => runQuickCommand('save')} className="quick-command-btn" data-tooltip="Write /save into the field (you can add a note)">
              save
            </button>

            {activeProjectPath && (
              <>
                {/* Safety net for loading the project context: the automatic send at startup was
                    removed, so this button is now the normal route for the resume. */}
                <button
                  type="button"
                  className="quick-command-btn"
                  onClick={resumeProject}
                  data-tooltip={`/resume "${basename(activeProjectPath)}" — load the project context`}
                  aria-label="Load the project context"
                >
                  <ResumeIcon /> Resume
                </button>
                <button
                  type="button"
                  className="quick-command-btn"
                  onClick={startProject}
                  data-tooltip={`/start "${basename(activeProjectPath)}" — start the project`}
                  aria-label="Start the project"
                >
                  <StartIcon /> Start
                </button>
              </>
            )}

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
                <button type="button" onClick={sendSelectedPath} className="quick-command-btn quick-command-btn--highlight" data-tooltip="Paste file path">
                  <LinkIcon /> Paste Path
                </button>
              </>
            )}

            <div className="command-bar-divider" />
            {/* Model and Effort share ONE container with the ref: the outside click closes when it
                leaves the pair, and not on every jump from one to the other. */}
            <div className="cmd-menu-group" ref={barMenuWrapRef}>
              <div className="cmd-menu-wrap">
                <button
                  type="button"
                  className="quick-command-btn"
                  onClick={() => setBarMenu((m) => (m === 'model' ? null : 'model'))}
                  disabled={!activeId}
                  aria-haspopup="menu"
                  aria-expanded={barMenu === 'model'}
                  data-tooltip="Change the model (/model)"
                >
                  Model ▾
                </button>
                {barMenu === 'model' && (
                  <div role="menu" className="cmd-menu" aria-label="Model">
                    {MODELOS.map((m) => (
                      <button key={m.valor} type="button" role="menuitem" className="cmd-menu-item" onClick={() => sendBarMenuChoice('model', m.valor)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="cmd-menu-wrap">
                <button
                  type="button"
                  className="quick-command-btn"
                  onClick={() => setBarMenu((m) => (m === 'effort' ? null : 'effort'))}
                  disabled={!activeId}
                  aria-haspopup="menu"
                  aria-expanded={barMenu === 'effort'}
                  data-tooltip="Change the effort level (/effort)"
                >
                  Effort ▾
                </button>
                {barMenu === 'effort' && (
                  <div role="menu" className="cmd-menu" aria-label="Effort">
                    {ESFORCOS.map((e) => (
                      <button key={e.valor} type="button" role="menuitem" className="cmd-menu-item" onClick={() => sendBarMenuChoice('effort', e.valor)}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="command-bar-divider" />
            <button
              type="button"
              className="quick-command-btn quick-command-btn--stop"
              onClick={interromperComAviso}
              data-tooltip="Stop what is running (Ctrl-C)"
            >
              <StopIcon /> Stop
            </button>
            <button
              type="button"
              className="quick-command-btn"
              onClick={restartComAviso}
              data-tooltip="Restart terminal (kills the process and the conversation)"
            >
              <RefreshIcon /> Restart
            </button>
            {/* Sends `/remote-control <project>` in the OPEN conversation — it does not open a new terminal. */}
            <button
              type="button"
              className="quick-command-btn"
              onClick={sendRemoteControl}
              data-tooltip="Turn on Remote Control in this terminal"
              aria-label="Turn on Remote Control in this terminal"
            >
              <RemoteIcon /> Remote
            </button>
            {/* Clears the input line INSIDE the terminal. It exists because the usual alternative
                (Ctrl-C) also kills the running work. */}
            <button
              type="button"
              className="quick-command-btn"
              onClick={apagarTexto}
              disabled={!activeId}
              data-tooltip="Clear the text written in the terminal (without interrupting what is running)"
              aria-label="Clear the text written in the terminal"
            >
              <EraserIcon /> Clear
            </button>

            <div className="command-bar-divider" />
            <button type="button" onClick={onOpenCommandPalette} className="quick-command-btn quick-command-btn--plus" data-tooltip="Commands, skills and agents" aria-label="Commands, skills and agents">+</button>
            <button
              type="button"
              className="quick-command-btn quick-command-btn--plus"
              onClick={() => activeId && termRefs.current.get(activeId)?.scrollToBottom?.()}
              data-tooltip="Go to the end of the terminal"
              aria-label="Go to the end of the terminal"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>
            {/* Collapse/show the composer. It sits at the end of the row because it is a VIEW
                control, not a command for the CLI — and because what it hides starts right below. */}
            <button
              type="button"
              className="quick-command-btn quick-command-btn--plus"
              onClick={alternarCaixa}
              aria-expanded={!caixaColapsada}
              aria-controls="caixa-de-escrita"
              data-tooltip={caixaColapsada ? 'Show the composer' : 'Hide the composer (only the shortcuts stay)'}
              aria-label={caixaColapsada ? 'Show the composer' : 'Hide the composer'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={caixaColapsada ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
              </svg>
            </button>

            {/* The state used to live in the corner of the title bar; without it you could not see
                from here whether the terminal is working. Pushed to the right, away from the buttons. */}
            <span className={`cmd-bar-status cmd-bar-status--${activeSession.status}`}>
              {activeSession.status === 'working' ? 'working' : 'idle'}
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

          <div
            id="caixa-de-escrita"
            className={`terminal-command-input-wrap${caixaColapsada ? ' terminal-command-input-wrap--oculta' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (files) void uploadPickedFiles(Array.from(files)).then(({ paths, errors }) => {
                  paths.forEach(addAttachment);
                  if (errors.length) flashDropHint(`Not attached — ${errors.join(' · ')}`, 'erro');
                });
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="terminal-command-attach"
              onClick={() => fileInputRef.current?.click()}
              data-tooltip="Attach file"
            >
              <PaperclipIcon />
            </button>
            {showSlashMenu && (
              <div className="slash-menu" id="slash-listbox" ref={slashMenuRef} role="listbox" aria-label="Available commands">
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
              placeholder="Write a message or command..."
              aria-label="Message or command"
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
                void uploadPastedImages(imgs, Date.now()).then(({ paths, errors }) => {
                  paths.forEach(addAttachment);
                  if (errors.length) flashDropHint(`Not attached — ${errors.join(' · ')}`, 'erro');
                });
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
                // Arrows: they move in the TEXT first, only at the ends do they move in the HISTORY.
                // Before, any ArrowUp jumped straight to the previous message — in a multi-line
                // draft it was impossible to go up one line to fix what had been typed.
                const campo = e.currentTarget;
                const antesDoCursor = campo.value.slice(0, campo.selectionStart ?? 0);
                const depoisDoCursor = campo.value.slice(campo.selectionEnd ?? 0);
                const naPrimeiraLinha = !antesDoCursor.includes('\n');
                const naUltimaLinha = !depoisDoCursor.includes('\n');

                if (e.key === 'ArrowUp' && naPrimeiraLinha && terminalHistory.length > 0) {
                  e.preventDefault();
                  // On ENTERING the history, it saves what was being typed — it is what the down
                  // arrow returns at the end, instead of throwing it away.
                  if (historyIndex === null) rascunhoGuardado.current = terminalDraft;
                  const nextIndex = historyIndex === null
                    ? terminalHistory.length - 1
                    : Math.max(0, historyIndex - 1);
                  setHistoryIndex(nextIndex);
                  setTerminalDraft(terminalHistory[nextIndex] ?? '');
                }
                if (e.key === 'ArrowDown' && naUltimaLinha && historyIndex !== null) {
                  e.preventDefault();
                  const nextIndex = historyIndex + 1;
                  if (nextIndex >= terminalHistory.length) {
                    setHistoryIndex(null);
                    setTerminalDraft(rascunhoGuardado.current);
                    rascunhoGuardado.current = '';
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
              data-tooltip="Send to the terminal"
            >
              send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
