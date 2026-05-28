import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import type { SessionInfo, TerminalRef, ProjectMemory, JocaItems } from '../types';
import TerminalPane from './TerminalPane';
import { shortPath, basename } from '../lib/paths';
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
  jocaItems: JocaItems | null;
  onLoadJocaItems: () => void;
}

// ── Lucide SVG Icons ───────────────────────────────────────────────

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

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

export default function TerminalView({
  sessions, activeId, activatedIds, terminalDraft, setTerminalDraft, terminalHistory,
  historyIndex, setHistoryIndex, selectedPath, onClearSelectedPath, projectMemory,
  onSaveSession, onCompactSession, onInterruptSession,
  onRestartSession, onInput, onResize, onReady, submitTerminalDraft, onOpenCommandPalette, termRefs, onNewSession,
  jocaItems, onLoadJocaItems
}: Props) {
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<string[]>([]);

  interface RateLimits {
    model: string;
    context: { used_pct: number | null; input_tokens: number; output_tokens: number };
    five_hour: { used_pct: number | null; resets_at: number | null };
    seven_day: { used_pct: number | null; resets_at: number | null };
    updated_at: number;
  }
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;
    const poll = () => {
      fetch('/rate-limits', { signal: ac.signal })
        .then(r => r.json())
        // Endpoint returns multi-tool shape { claude, codex, agy }. The terminal bar only consumes the
        // Claude slice, which already matches the flat RateLimits shape used here.
        .then(d => { if (mounted) setRateLimits(d?.claude ?? null); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { mounted = false; clearInterval(id); ac.abort(); };
  }, []);

  const addAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((p) => p !== path));
  }, []);

  const [slashIndex, setSlashIndex] = useState(-1);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const slashItems = useMemo(() => {
    if (!terminalDraft.startsWith('/') || !jocaItems) return [];
    const query = terminalDraft.slice(1).toLowerCase();
    const all: { type: string; name: string; description?: string; insert: string }[] = [];
    for (const c of jocaItems.commands) all.push({ type: 'command', name: `/${c.name}`, description: c.description, insert: `/${c.name}` });
    for (const s of jocaItems.skills) all.push({ type: 'skill', name: s.name, description: s.description, insert: s.insert || s.name });
    for (const a of jocaItems.agents) all.push({ type: 'agent', name: a.name, description: a.description, insert: a.insert || a.name });
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          Array.from(files).forEach((f) => {
            if ((f as any).path) addAttachment((f as any).path);
            else addAttachment(f.name);
          });
          inputAreaRef.current?.focus();
          return;
        }
        const p = e.dataTransfer.getData('text/plain');
        if (p) {
          addAttachment(p);
          inputAreaRef.current?.focus();
        }
      }}
    >
      <div className="terminal-panel">
        <div className="terminal-titlebar">
          <div className="titlebar-dots" aria-hidden>
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="titlebar-info">
            <span className="titlebar-name">{activeSession?.name ?? 'Terminal'}</span>
            {activeSession && (
              <span className="titlebar-cwd">{shortPath(activeSession.cwd)}</span>
            )}
          </div>
          {activeSession && (
            <div className="titlebar-actions">
              <button className="titlebar-btn titlebar-btn--save" type="button" onClick={onSaveSession} data-tooltip="Guardar sessão (/save)" data-tooltip-position="bottom">
                <SaveIcon /> Save
              </button>
              <button className="titlebar-btn titlebar-btn--compact" type="button" onClick={onCompactSession} data-tooltip="Compactar contexto (/compact)" data-tooltip-position="bottom">
                <ZapIcon /> Compact
              </button>
              <button className="titlebar-btn titlebar-btn--restart" type="button" onClick={() => onRestartSession(activeSession.id)} data-tooltip="Reiniciar terminal" data-tooltip-position="bottom">
                <RefreshIcon /> Restart
              </button>
              <button className="titlebar-btn titlebar-btn--interrupt" type="button" onClick={onInterruptSession} data-tooltip="Parar processo (Ctrl-C)" data-tooltip-position="bottom">
                <StopIcon /> Stop
              </button>
            </div>
          )}
          <span className={`titlebar-badge titlebar-badge--${activeSession?.status ?? 'idle'}`}>{activeSession?.status ?? 'idle'}</span>
        </div>

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
            <button className="btn-new-large" type="button" onClick={onNewSession}>+ New Session</button>
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
      
      {rateLimits && (rateLimits.context?.used_pct != null || rateLimits.five_hour?.used_pct != null || rateLimits.seven_day?.used_pct != null) && (
        <div className="rate-limits-bar">
          <span className="rl-model">{rateLimits.model}</span>
          {rateLimits.context?.used_pct != null && (
            <span className="rl-item rl-ctx">
              ctx <span className="rl-bar"><span className="rl-bar-fill" style={{ width: `${Math.min(100, rateLimits.context.used_pct)}%` }} /></span>
              {Math.round(rateLimits.context.used_pct)}%
            </span>
          )}
          {rateLimits.five_hour?.used_pct != null && (
            <span className="rl-item rl-5h">
              5h <span className="rl-bar"><span className="rl-bar-fill rl-bar-fill--5h" style={{ width: `${Math.min(100, rateLimits.five_hour.used_pct)}%` }} /></span>
              {Math.round(rateLimits.five_hour.used_pct)}%
            </span>
          )}
          {rateLimits.seven_day?.used_pct != null && (
            <span className="rl-item rl-7d">
              7d <span className="rl-bar"><span className="rl-bar-fill rl-bar-fill--7d" style={{ width: `${Math.min(100, rateLimits.seven_day.used_pct)}%` }} /></span>
              {Math.round(rateLimits.seven_day.used_pct)}%
            </span>
          )}
        </div>
      )}

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

            <button type="button" onClick={onOpenCommandPalette} className="quick-command-btn quick-command-btn--plus" data-tooltip="Adicionar comando ou skill">+</button>
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
                if (files) Array.from(files).forEach((f) => addAttachment((f as any).path || f.name));
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
