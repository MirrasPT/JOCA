import { useRef, useMemo, useCallback } from 'react';
import type { SessionInfo, TerminalRef, ProjectMemory } from '../types';
import TerminalPane from './TerminalPane';
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
  pinOutput: boolean;
  onTogglePinOutput: () => void;
  onSaveSession: () => void;
  onCompactSession: () => void;
  onInterruptSession: () => void;
  onRestartSession: (id: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  submitTerminalDraft: () => void;
  onOpenCommandPalette: () => void;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  onNewSession: () => void;
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

function ClearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.28a2 2 0 0 1-.78 1.24l-2.78 3.48A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="term-svg-icon">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
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

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

export default function TerminalView({
  sessions, activeId, activatedIds, terminalDraft, setTerminalDraft, terminalHistory,
  historyIndex, setHistoryIndex, selectedPath, onClearSelectedPath, projectMemory,
  pinOutput, onTogglePinOutput, onSaveSession, onCompactSession, onInterruptSession,
  onRestartSession, onInput, onResize, onReady, submitTerminalDraft, onOpenCommandPalette, termRefs, onNewSession
}: Props) {
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const inputAreaRef = useRef<HTMLTextAreaElement>(null);

  // Expose terminal actions
  const clearTerminalUI = useCallback(() => {
    if (activeId) {
      termRefs.current.get(activeId)?.clear?.();
    }
  }, [activeId, termRefs]);

  const scrollTerminalToBottom = useCallback(() => {
    if (activeId) {
      termRefs.current.get(activeId)?.scrollToBottom?.();
    }
  }, [activeId, termRefs]);

  const copyLastCommand = useCallback(() => {
    if (terminalHistory.length === 0) return;
    const lastCmd = terminalHistory[terminalHistory.length - 1];
    navigator.clipboard?.writeText(lastCmd).catch(() => {});
    // Toast notification can trigger internally or via global state
  }, [terminalHistory]);

  const sendSelectedPath = useCallback(() => {
    if (!activeId || !selectedPath) return;
    onInput(activeId, selectedPath + ' ');
    onClearSelectedPath();
    inputAreaRef.current?.focus();
  }, [activeId, selectedPath, onInput, onClearSelectedPath]);

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
      clearTerminalUI();
    }
    else if (cmd === 'plan') {
      setTerminalDraft('/plan');
      inputAreaRef.current?.focus();
    }
    else {
      // General quick command in project memory
      onInput(activeId, `/${cmd}\r`);
    }
  }, [activeId, onSaveSession, onCompactSession, onInput, clearTerminalUI, setTerminalDraft]);

  return (
    <div
      className="terminal-area"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const p = e.dataTransfer.getData('text/plain');
        if (p && activeId) onInput(activeId, p);
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
      
      {activeSession && (
        <div className="terminal-command-bar">
          <div className="quick-command-row">
            {/* Project Quick Commands */}
            {quickCommands.map((cmd) => (
              <button key={cmd} type="button" onClick={() => runQuickCommand(cmd)} className="quick-command-btn">
                {cmd}
              </button>
            ))}
            
            <div className="command-bar-divider" />
            
            {/* Terminal UX Enhancement Controls */}
            <button type="button" onClick={clearTerminalUI} className="quick-command-btn quick-command-btn--ux" data-tooltip="Limpar ecrã">
              <ClearIcon /> Clear UI
            </button>
            <button type="button" onClick={copyLastCommand} className="quick-command-btn quick-command-btn--ux" disabled={terminalHistory.length === 0} data-tooltip="Copiar último comando">
              <CopyIcon /> Copy Last
            </button>
            <button type="button" onClick={scrollTerminalToBottom} className="quick-command-btn quick-command-btn--ux" data-tooltip="Descer até ao fim">
              <ArrowDownIcon /> Scroll
            </button>
            <button
              type="button"
              onClick={onTogglePinOutput}
              className={`quick-command-btn quick-command-btn--ux ${pinOutput ? 'active' : ''}`}
              data-tooltip="Rolar automaticamente"
            >
              <PinIcon /> Pin {pinOutput ? 'On' : 'Off'}
            </button>

            {/* Selected File Path Insertion */}
            {selectedPath && (
              <button type="button" onClick={sendSelectedPath} className="quick-command-btn quick-command-btn--highlight" data-tooltip="Colar caminho do ficheiro">
                <LinkIcon /> Paste Path
              </button>
            )}

            <button type="button" onClick={onOpenCommandPalette} className="quick-command-btn quick-command-btn--plus" data-tooltip="Adicionar comando ou skill">+</button>
          </div>
          <div className="terminal-command-input-wrap">
            <span className="terminal-command-prompt">&gt;</span>
            <textarea
              ref={inputAreaRef}
              className="terminal-command-input"
              value={terminalDraft}
              placeholder="Escrever mensagem ou comando para inserir no terminal..."
              rows={1}
              onChange={(e) => setTerminalDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitTerminalDraft();
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
              onClick={submitTerminalDraft}
              disabled={!activeId || !terminalDraft.trim()}
              data-tooltip="Enviar comando para o terminal"
            >
              enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
