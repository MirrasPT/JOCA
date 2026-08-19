// ProjectWorkspace — a vista de um projecto (mainView === 'project').
//
// O terminal é o palco. Em cima fica uma barra fina com a identidade do projecto e, logo abaixo,
// uma tab por terminal aberto; todo o resto da altura é terminal.
//
// O terminal em si é o `TerminalView`, o MESMO componente da vista em ecrã cheio: mesma barra de
// comandos (git, colar caminho, skills, anexos), mesmo drag&drop, mesmo autocomplete de `/`. Antes
// havia aqui um composer reduzido e paralelo — duas caixas de escrita com capacidades diferentes
// para o mesmo terminal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JocaItems, Project, ProjectMemory, SessionInfo, TerminalRef } from '../../types';
import { shortPath } from '../../lib/paths';
import { SettingsIcon } from '../dashboard/icons';
import TerminalView from '../TerminalView';
import TerminalTabs, { buildTabs } from './TerminalTabs';
import './project-workspace.css';

function TerminalGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  );
}

/** Tudo o que o `TerminalView` precisa e que vive no App — reencaminhado tal e qual. */
export interface TerminalBridge {
  activeId: string | null;
  activatedIds: Set<string>;
  terminalDraft: string;
  setTerminalDraft: (draft: string) => void;
  terminalHistory: string[];
  historyIndex: number | null;
  setHistoryIndex: (idx: number | null) => void;
  projectMemory: Record<string, ProjectMemory>;
  onSaveSession: () => void;
  onCompactSession: () => void;
  onInterruptSession: () => void;
  onRestartSession: (id: string) => void;
  submitTerminalDraft: (overrideText?: string) => void;
  onOpenCommandPalette: () => void;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  jocaItems: JocaItems | null;
  onLoadJocaItems: () => void;
}

interface Props {
  project: Project | null;
  projects: Project[];
  sessions: SessionInfo[];
  onEditProject: (project: Project) => void;
  /** Escolher o terminal de uma tab — muda o activo SEM sair da vista do projecto. */
  onSelectTerminal: (id: string) => void;
  /** Renomear a sessão de um terminal (duplo clique na tab). */
  onRenameSession?: (id: string, name: string) => void;
  /** Fecha a sessão de um terminal (mesmo handler da barra lateral). */
  onCloseSession: (id: string) => void;
  /** Abre um terminal novo neste projecto (o "+" das tabs). */
  onAddAgent: (project: Project, cli?: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  terminal: TerminalBridge;
}

export default function ProjectWorkspace({
  project, projects, sessions,
  onEditProject, onSelectTerminal, onRenameSession, onCloseSession, onAddAgent,
  onRenameProject, onInput, onResize, onReady, terminal,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const projectSessions = useMemo(
    () => (project ? sessions.filter((s) => s.projectId === project.id) : []),
    [project, sessions]
  );
  const tabs = useMemo(() => buildTabs(projectSessions), [projectSessions]);

  // A tab activa é o terminal activo do App, desde que pertença a este projecto; senão, a primeira.
  // Sem isto, entrar no projecto vindo de outro terminal mostrava o terminal errado.
  const activeTabId = tabs.some((t) => t.id === terminal.activeId)
    ? terminal.activeId
    : (tabs[0]?.id ?? null);

  useEffect(() => {
    if (activeTabId && activeTabId !== terminal.activeId) onSelectTerminal(activeTabId);
  }, [activeTabId, terminal.activeId, onSelectTerminal]);

  const handleCloseTerminal = useCallback((sessionId: string) => {
    onCloseSession(sessionId);
  }, [onCloseSession]);

  const commitName = useCallback(() => {
    if (!project) return;
    const t = nameDraft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditingName(false);
  }, [project, nameDraft, onRenameProject]);

  if (!project) {
    return (
      <div className="project-workspace project-workspace--empty">
        <p className="tk-drawer-empty">Escolhe um projecto na barra lateral.</p>
      </div>
    );
  }

  return (
    <div className="project-workspace">
      {/* Barra fina: o que era um cabeçalho de 90px com título grande, path e chips. A informação
          é a mesma; o espaço que ocupava é agora terminal. */}
      <div className="pw-bar">
        <span className="pw-bar-dot" style={{ background: project.color }} aria-hidden />
        {editingName ? (
          <input
            ref={nameInputRef}
            className="pw-bar-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
              e.stopPropagation();
            }}
            aria-label="Nome do projecto"
          />
        ) : (
          <button
            type="button"
            className="pw-bar-name"
            onDoubleClick={() => {
              setNameDraft(project.name);
              setEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 50);
            }}
            title={`${project.name} — duplo clique para renomear`}
          >
            {project.name}
          </button>
        )}
        <span className="pw-bar-path" title={project.path}>{shortPath(project.path)}</span>
        <span className="pw-bar-spacer" />
        <span className="pw-bar-stat">{tabs.length} terminal{tabs.length === 1 ? '' : 'is'}</span>
        <button
          className="pw-bar-settings"
          type="button"
          onClick={() => onEditProject(project)}
          aria-label="Configurações do projecto"
          title="Configurações do projecto"
        >
          <SettingsIcon />
        </button>
      </div>

      <TerminalTabs
        tabs={tabs}
        activeId={activeTabId}
        onSelect={onSelectTerminal}
        onClose={handleCloseTerminal}
        onRename={onRenameSession}
        onNew={(cli) => onAddAgent(project, cli)}
      />

      <div className="pw-stage">
        <div className="pw-terminal-slot">
          {tabs.length === 0 ? (
            // Palco vazio: a mensagem centra-se no espaço que sobra em vez de ficar encostada ao
            // canto, e traz a acção com ela — mandar procurar o "+" era trabalho para o leitor.
            <div className="pw-stage-empty">
              <TerminalGlyph />
              <p className="pw-stage-empty-title">Sem terminais abertos</p>
              <p className="pw-stage-empty-hint">Abre um terminal para trabalhar neste projecto.</p>
              <button type="button" className="pw-stage-empty-btn" onClick={() => onAddAgent(project)}>
                Abrir terminal
              </button>
            </div>
          ) : (
            <TerminalView
              sessions={projectSessions}
              projects={projects}
              activeId={activeTabId}
              activatedIds={terminal.activatedIds}
              terminalDraft={terminal.terminalDraft}
              setTerminalDraft={terminal.setTerminalDraft}
              terminalHistory={terminal.terminalHistory}
              historyIndex={terminal.historyIndex}
              setHistoryIndex={terminal.setHistoryIndex}
              selectedPath={null}
              onClearSelectedPath={() => {}}
              projectMemory={terminal.projectMemory}
              onSaveSession={terminal.onSaveSession}
              onCompactSession={terminal.onCompactSession}
              onInterruptSession={terminal.onInterruptSession}
              onRestartSession={terminal.onRestartSession}
              onInput={onInput}
              onResize={onResize}
              onReady={onReady}
              submitTerminalDraft={terminal.submitTerminalDraft}
              onOpenCommandPalette={terminal.onOpenCommandPalette}
              termRefs={terminal.termRefs}
              onNewSession={() => onAddAgent(project)}
              onNewSessionWithCli={(cli) => onAddAgent(project, cli)}
              jocaItems={terminal.jocaItems}
              onLoadJocaItems={terminal.onLoadJocaItems}
            />
          )}
        </div>
      </div>
    </div>
  );
}
