import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent, KeyboardEvent } from 'react';
import type { MasterEntry } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { captureDrop, resolveDrop, uploadPastedImages, uploadPickedFiles, quotePath } from '../lib/fileDrop';
import MasterTasksBoard from './MasterTasksBoard';
import './MasterChatView.css';

export interface MasterStats {
  workersWorking: number;
  workersIdle: number;
  sessionsTotal: number;
  projects: number;
  limits?: {
    fiveHour: { pct: number | null; resetAt: number | null } | null;
    sevenDay: { pct: number | null; resetAt: number | null } | null;
    sonnet: { pct: number | null; resetAt: number | null } | null;
  } | null;
}

interface Props {
  entries: MasterEntry[];
  pending: number;     // in-flight Master runs; >0 shows the bottom activity indicator (input stays enabled)
  activity?: string | null; // latest live action text ("A abrir worker…") for the bottom indicator
  brainLabel?: string;       // provider/model shown in the header pill (from Settings)
  onSend: (text: string) => void;
  onBack?: () => void; // when set, renders a back button — the Master runs full-screen
  stats?: MasterStats; // live counts for the side rail (workers, sessions, projects)
  tasksRefreshKey?: number; // bumps on WS tasks_changed → the collapsible tasks board refetches
}

const EXAMPLES = [
  'Cria um worker que corra os testes do backend e resume o resultado.',
  'No projeto UniTV, lista os ficheiros do servidor de streaming.',
  'Arranja o lint do frontend e depois faz type-check.',
];

function Markdown({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div className="mc-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function EntryRow({ entry }: { entry: MasterEntry }) {
  if (entry.role === 'user') {
    return (
      <div className="mc-row mc-row--user">
        <div className="mc-bubble mc-bubble--user">{entry.text}</div>
      </div>
    );
  }
  // The final answer of a run (worker_summary). Intermediate narration/steps are hidden.
  if (entry.role === 'summary') {
    return (
      <div className="mc-row mc-row--assistant">
        <div className={`mc-bubble mc-bubble--assistant ${entry.isError ? 'mc-bubble--error' : ''}`}>
          <Markdown text={entry.text} />
          {entry.costUsd > 0 && <span className="mc-cost">${entry.costUsd.toFixed(4)}</span>}
        </div>
      </div>
    );
  }
  if (entry.role === 'error') {
    return (
      <div className="mc-row mc-row--assistant">
        <div className="mc-bubble mc-bubble--assistant mc-bubble--error">{entry.text}</div>
      </div>
    );
  }
  return null; // assistant/step entries are not surfaced in the chat
}

// Time until a usage window resets, from its epoch-seconds timestamp.
function fmtReset(resetAt: number | null): string | null {
  if (!resetAt) return null;
  const secs = resetAt - Math.floor(Date.now() / 1000);
  if (secs <= 0) return 'a renovar';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function LimitBar({ label, data }: { label: string; data: { pct: number | null; resetAt: number | null } | null }) {
  if (!data || data.pct == null) return null;
  const v = Math.max(0, Math.min(100, Math.round(data.pct)));
  const level = v >= 90 ? 'danger' : v >= 70 ? 'warn' : 'ok';
  const reset = fmtReset(data.resetAt);
  return (
    <div className="mc-limit">
      <div className="mc-limit-head">
        <span className="mc-limit-label">{label}</span>
        <span className="mc-limit-pct">{v}%</span>
      </div>
      <div className="mc-limit-track">
        <span className={`mc-limit-fill mc-limit-fill--${level}`} style={{ width: `${v}%` }} />
      </div>
      {reset && <span className="mc-limit-reset">reset em {reset}</span>}
    </div>
  );
}

function StatRail({ stats, pending }: { stats?: MasterStats; pending: number }) {
  if (!stats) return null;
  const lim = stats.limits;
  const hasLimits = !!lim && (lim.fiveHour != null || lim.sevenDay != null || lim.sonnet != null);
  return (
    <aside className="mc-rail" aria-label="Estado dos workers">
      <div className="mc-stat-card">
        <span className="mc-stat-label">Workers</span>
        <div className="mc-stat-rows">
          <div className="mc-stat-row">
            <span className="status-dot status-dot--working status-dot--md" aria-hidden />
            <span className="mc-stat-row-label">A trabalhar</span>
            <span className="mc-stat-row-num">{stats.workersWorking}</span>
          </div>
          <div className="mc-stat-row">
            <span className="status-dot status-dot--idle status-dot--md" aria-hidden />
            <span className="mc-stat-row-label">Idle</span>
            <span className="mc-stat-row-num">{stats.workersIdle}</span>
          </div>
        </div>
      </div>

      <div className="mc-stat-grid">
        <div className="mc-stat-mini">
          <span className="mc-stat-num">{stats.sessionsTotal}</span>
          <span className="mc-stat-cap">Sessões</span>
        </div>
        <div className="mc-stat-mini">
          <span className="mc-stat-num">{stats.projects}</span>
          <span className="mc-stat-cap">Projectos</span>
        </div>
      </div>

      {hasLimits && (
        <div className="mc-stat-card">
          <span className="mc-stat-label">Limites Claude</span>
          <div className="mc-limit-rows">
            <LimitBar label="5 horas" data={lim!.fiveHour} />
            <LimitBar label="7 dias" data={lim!.sevenDay} />
            <LimitBar label="Sonnet · 7 dias" data={lim!.sonnet} />
          </div>
        </div>
      )}

      <div className={`mc-stat-card mc-stat-pulse${pending > 0 ? ' mc-stat-pulse--on' : ''}`}>
        <span className="mc-stat-label">Orquestração</span>
        <div className="mc-stat-pulse-body">
          {pending > 0 ? (
            <>
              <span className="mc-busy-dot" aria-hidden />
              <span className="mc-stat-pulse-text">{pending} {pending === 1 ? 'tarefa a correr' : 'tarefas a correr'}</span>
            </>
          ) : (
            <span className="mc-stat-pulse-idle">Em espera</span>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function MasterChatView({ entries, pending, activity, brainLabel, onSend, onBack, stats, tasksRefreshKey }: Props) {
  const [draft, setDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, pending]);

  // Auto-grow the textarea up to its max-height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // Close the attach menu on outside click / Escape.
  useEffect(() => {
    if (!attachOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!attachRef.current?.contains(e.target as Node)) setAttachOpen(false);
    };
    const onEsc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setAttachOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [attachOpen]);

  const insertPaths = (paths: string[]) => {
    if (!paths.length) return;
    const insert = paths.map(quotePath).join(' ');
    setDraft((d) => (d ? `${d} ${insert}` : insert));
    inputRef.current?.focus();
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;            // input stays enabled even while runs are in flight
    onSend(text);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Native file picker (the "+" attach menu). Uploads to JOCA_Drops and inserts the saved paths.
  const openPicker = (accept: string) => {
    setAttachOpen(false);
    const el = fileInputRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  };
  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    if (!files.length) return;
    setUploading(true);
    try { insertPaths(await uploadPickedFiles(files)); }
    finally { setUploading(false); }
  };

  // Drag-drop files/images/folders onto the Master: resolve to absolute paths (upload when the
  // browser hides the path) and append them to the draft, so the Master can hand them to a worker.
  const onDragOver = (e: ReactDragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };
  const onDragLeave = (e: ReactDragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };
  const onDrop = async (e: ReactDragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const cap = captureDrop(e.nativeEvent);
    setUploading(true);
    try {
      const { paths } = await resolveDrop(cap);
      insertPaths(paths);
    } finally {
      setUploading(false);
    }
  };

  // Ctrl+V of an image (screenshot, copied picture): upload it to JOCA_Drops and insert its path.
  // Plain-text pastes have no image items and fall through to the textarea unchanged.
  const onPaste = async (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imgs.length === 0) return;
    e.preventDefault();
    setUploading(true);
    try {
      insertPaths(await uploadPastedImages(imgs, Date.now()));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      className={`master-chat${dragOver ? ' master-chat--dragover' : ''}`}
      aria-label="Master orchestrator"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="mc-header">
        <div className="mc-header-inner">
          {onBack && (
            <button type="button" className="mc-back" onClick={onBack} aria-label="Voltar">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="mc-id">
            <span className="mc-id-dot" aria-hidden />
            <h1 className="mc-id-name">Master</h1>
            <span className="mc-id-model">{brainLabel || 'Sonnet'}</span>
          </div>
        </div>
      </header>

      {dragOver && <div className="mc-drop-veil" aria-hidden>Larga para anexar</div>}

      <div className="mc-body">
        <div className="mc-main">
          <div className="mc-log" ref={logRef} aria-live="polite">
            <div className="mc-thread">
              {entries.length === 0 ? (
                <div className="mc-hero">
                  <span className="mc-hero-orb" aria-hidden />
                  <p className="mc-hero-eyebrow">JOCA Master</p>
                  <h2 className="mc-hero-title">O que vamos orquestrar?</h2>
                  <p className="mc-hero-sub">
                    Diz o que queres feito. Eu decomponho, abro os workers e acompanho-os por trás. Aqui vês só a resposta final.
                  </p>
                  <div className="mc-examples">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} type="button" className="mc-example" onClick={() => { setDraft(ex); inputRef.current?.focus(); }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)
              )}
            </div>
          </div>

          {pending > 0 && (
            <div className="mc-activity" role="status" aria-live="polite">
              <span className="mc-activity-dots" aria-hidden><i /><i /><i /></span>
              <span className="mc-activity-text">{activity || 'A pensar…'}</span>
              {pending > 1 && <span className="mc-activity-count">{pending} a correr</span>}
            </div>
          )}

          <div className="mc-composer">
            <div className="mc-composer-inner">
              <textarea
                ref={inputRef}
                className="mc-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                placeholder={uploading ? 'A carregar ficheiro(s)…' : 'Instrução para o Master…'}
                aria-label="Instrução para o Master"
                rows={1}
              />
              <div className="mc-composer-bar">
                <div className="mc-attach" ref={attachRef}>
                  <button
                    type="button"
                    className={`mc-attach-btn${attachOpen ? ' mc-attach-btn--open' : ''}`}
                    onClick={() => setAttachOpen((v) => !v)}
                    aria-label="Anexar"
                    aria-haspopup="menu"
                    aria-expanded={attachOpen}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  {attachOpen && (
                    <div className="mc-attach-menu" role="menu">
                      <button type="button" role="menuitem" className="mc-attach-item" onClick={() => openPicker('')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        Anexar ficheiros
                      </button>
                      <button type="button" role="menuitem" className="mc-attach-item" onClick={() => openPicker('image/*')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                        </svg>
                        Anexar imagem
                      </button>
                      <p className="mc-attach-hint">ou arrasta ficheiros/pastas, ou cola imagem (Ctrl+V)</p>
                    </div>
                  )}
                </div>

                <span className="mc-composer-hint">Enter envia · Shift+Enter nova linha</span>

                <button
                  className="mc-send"
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim()}
                  aria-label="Enviar instrução"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <StatRail stats={stats} pending={pending} />

        <MasterTasksBoard refreshKey={tasksRefreshKey ?? 0} />
      </div>

      <input ref={fileInputRef} type="file" multiple hidden onChange={onPickFiles} aria-hidden tabIndex={-1} />
    </section>
  );
}
