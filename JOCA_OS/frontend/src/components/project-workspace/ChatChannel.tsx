import { useCallback, useEffect, useRef, useState } from 'react';
import type { CliProfileInfo, PooledWorker, SessionInfo, TerminalRef } from '../../types';
import TerminalPane from '../TerminalPane';
import WorkersChannel from './WorkersChannel';
import { uploadPastedImages, uploadPickedFiles } from '../../lib/fileDrop';

interface Props {
  projectId: string;
  refreshKey: number;
  onWorkersChange: (workers: PooledWorker[]) => void;
  projectSessions: SessionInfo[];
  workers: PooledWorker[];
  /** Escape hatch explícito (ícone de expandir) — sai do workspace, ecrã cheio, como antes. */
  onExpandSession: (id: string) => void;
  /** Fecha a sessão de um agente (mata o terminal). */
  onCloseSession: (id: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  /** Renomear um agente do projecto (duplo-clique no nome). */
  onRenameAgent?: (id: string, name: string) => void;
  /** Abrir um agente novo neste projecto (o "+" da secção Agentes). `cli` vazio = claude. */
  onNewAgent: (cli?: string) => void;
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 7h10v10" /><path d="M7 17 17 7" />
    </svg>
  );
}

// Comandos pré-adicionados do composer — os mesmos atalhos da vista expandida.
const QUICK_COMMANDS = ['save', 'compact', 'clear'];

/**
 * Dashboard do projecto: AGENTES à esquerda (lista + criar novo), ESCRITA à direita — a mesma
 * experiência da vista expandida em mais pequeno: o terminal do agente seleccionado + um composer
 * com anexos fáceis e botões de comandos. O gestor abre sozinho com o projecto, mas é um terminal
 * normal (fecha como os outros).
 */
export default function ChatChannel({
  projectId, refreshKey, onWorkersChange,
  projectSessions, workers, onExpandSession, onCloseSession, onInput, onResize, onReady,
  onNewAgent, onRenameAgent,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newAgentCli, setNewAgentCli] = useState('claude');
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[]>([]);
  useEffect(() => {
    fetch('/cli-profiles').then((r) => r.json())
      .then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : []))
      .catch(() => setCliProfiles([]));
  }, []);

  // A pool de workers vem do GET do chat — é também o que garante o arranque do gestor no backend.
  useEffect(() => {
    fetch(`/projects/${projectId}/chat?limit=1`)
      .then((r) => r.json())
      .then((data: { workers?: PooledWorker[] }) => onWorkersChange(data.workers ?? []))
      .catch(() => {});
  }, [projectId, refreshKey, onWorkersChange]);

  // Trocar de projecto limpa a selecção (o componente não remonta; sem isto ficava a olhar para o
  // terminal de um agente do projecto anterior).
  useEffect(() => { setSelectedId(null); }, [projectId]);

  // Selecção por omissão: o gestor, se estiver aberto; senão o primeiro agente que exista.
  const liveWorkers = workers.filter((w) => w.status !== 'closed');
  const managerWorker = liveWorkers.find((w) => w.manager);
  const fallbackId = managerWorker?.sessionId ?? liveWorkers[0]?.sessionId ?? projectSessions[0]?.id ?? null;
  // Se o seleccionado morreu (fechado), volta ao fallback.
  const selectedAlive = selectedId !== null
    && (liveWorkers.some((w) => w.sessionId === selectedId) || projectSessions.some((s) => s.id === selectedId));
  const activeId = selectedAlive ? selectedId : fallbackId;
  const activeWorker = liveWorkers.find((w) => w.sessionId === activeId);
  const activeLabel = activeWorker?.manager
    ? 'Gestor de Projecto'
    : (activeWorker?.area ?? projectSessions.find((s) => s.id === activeId)?.name ?? 'Terminal');

  // ── Composer (mensagem + anexos + comandos rápidos) ────────────────────────
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const send = useCallback(() => {
    if (!activeId) return;
    const paths = attachments.map((a) => `"${a}"`).join(' ');
    const text = [draft.trim(), paths].filter(Boolean).join(' ');
    if (!text) return;
    onInput(activeId, `${text}\r`);
    setDraft('');
    setAttachments([]);
    inputRef.current?.focus();
  }, [activeId, draft, attachments, onInput]);

  const runQuick = useCallback((cmd: string) => {
    if (!activeId) return;
    onInput(activeId, `/${cmd}\r`);
  }, [activeId, onInput]);

  return (
    <div className="pw-chat-layout">
      {/* ── Coluna ESQUERDA: os agentes do projecto ── */}
      <div className="pw-chat-side">
        <div className="project-dashboard-block pw-chat-side-block pw-chat-side-block--workers">
          <div className="pw-side-head">
            <span className="section-title">Agentes</span>
            <select
              className="ag-cli-select"
              value={newAgentCli}
              onChange={(e) => setNewAgentCli(e.target.value)}
              aria-label="CLI do agente novo"
              title="Que CLI corre no agente novo"
            >
              {cliProfiles.filter((p) => p.available).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="pw-add-agent"
              onClick={() => onNewAgent(newAgentCli)}
              title="Abrir um agente novo neste projecto"
              aria-label="Abrir um agente novo neste projecto"
            >+</button>
          </div>
          <WorkersChannel
            onRenameAgent={onRenameAgent}
            projectSessions={projectSessions}
            workers={workers}
            selectedId={activeId}
            onSelectAgent={(id) => setSelectedId(id)}
            onExpandAgent={onExpandSession}
            onCloseAgent={(id) => {
              if (selectedId === id) setSelectedId(null);
              onCloseSession(id);
            }}
          />
        </div>
      </div>

      {/* ── Coluna DIREITA: escrita — terminal do agente seleccionado + composer ── */}
      <div className="pw-chat-main">
        {activeId ? (
          <>
            <div className="pw-chat-agent-bar">
              <span className={`pw-worker-dot pw-worker-dot--${activeWorker?.status === 'working' || activeWorker?.busy ? 'working' : 'idle'}`} aria-hidden />
              <span className="pw-chat-agent-label">{activeLabel}</span>
              <button
                type="button"
                className="pw-chat-expand-btn"
                onClick={() => onExpandSession(activeId)}
                title="Abrir este agente em ecrã cheio"
              >
                <ExpandIcon /> Expandir
              </button>
            </div>
            <div className="pw-chat-terminal-wrap">
              <TerminalPane
                key={activeId}
                sessionId={activeId}
                isActive
                onInput={onInput}
                onResize={onResize}
                onReady={onReady}
              />
            </div>
            <div className="pw-composer">
              <div className="pw-composer-quick">
                {QUICK_COMMANDS.map((cmd) => (
                  <button key={cmd} type="button" className="quick-command-btn" onClick={() => runQuick(cmd)}>
                    {cmd}
                  </button>
                ))}
              </div>
              {attachments.length > 0 && (
                <div className="attachment-row">
                  {attachments.map((att) => (
                    <span key={att} className="attachment-chip">
                      <PaperclipIcon />
                      <span className="attachment-chip-name" title={att}>{att.split('/').pop()}</span>
                      <button type="button" className="attachment-chip-remove" aria-label={`Remover anexo ${att}`} onClick={() => setAttachments((prev) => prev.filter((p) => p !== att))}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="pw-composer-input-row">
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
                  className="pw-composer-attach"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Anexar ficheiro"
                  title="Anexar ficheiro"
                >
                  <PaperclipIcon />
                </button>
                <textarea
                  ref={inputRef}
                  className="pw-composer-input"
                  rows={2}
                  value={draft}
                  placeholder={`Escrever para ${activeLabel}…`}
                  aria-label={`Mensagem para ${activeLabel}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={(e) => {
                    const imgs = Array.from(e.clipboardData?.items ?? [])
                      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
                      .map((it) => it.getAsFile())
                      .filter((f): f is File => f !== null);
                    if (imgs.length === 0) return;
                    e.preventDefault();
                    void uploadPastedImages(imgs, Date.now()).then((paths) => paths.forEach(addAttachment));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
                <button
                  type="button"
                  className="pw-composer-send"
                  onClick={send}
                  disabled={!draft.trim() && attachments.length === 0}
                >
                  enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="tk-drawer-empty">Sem terminais abertos. Abre um agente no "+" da coluna ao lado.</p>
        )}
      </div>
    </div>
  );
}
