// TaskDetail — painel de detalhe de uma tarefa do Kanban.
//
// Porquê drawer lateral (à direita) e não modal centrado: o board é horizontal e com scroll; um modal
// grande tapava as colunas e fazia perder o contexto de onde a tarefa está. O drawer mantém o quadro
// visível à esquerda, é alto (bom para a thread de notas, que é uma conversa) e encosta ao mesmo sítio
// que os restantes painéis laterais da app. Escape fecha, foco fica preso dentro (role="dialog").
//
// Este ficheiro é também a casa dos tipos partilhados com o TasksView (não podemos tocar em types.ts);
// a dependência é só num sentido — TasksView importa daqui, nunca o contrário.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CliProfileInfo, Project } from '../types';

// ── Schema (espelha backend/src/tasks/store.ts) ───────────────────────────────
export type TaskStatus = 'a-definir' | 'a-executar' | 'em-execucao' | 'concluida' | 'arquivada';
export type TaskCommentAuthor = 'user' | 'worker' | 'judge' | 'system';

export interface TaskComment {
  id: string;
  author: TaskCommentAuthor;
  authorName?: string;
  text: string;
  ts: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectId?: string;
  order: number;
  skills?: string[];
  requireConfirm?: boolean;
  attachments?: string[];
  cli?: string;
  model?: string;
  sessionId?: string;
  comments?: TaskComment[];
  result?: string;
  testerResult?: string;
  lastStatus?: 'ok' | 'error' | 'running' | null;
  createdAt: number;
  updatedAt: number;
}

export interface JocaItem { name: string; description?: string; kind: 'skill' | 'agent' }

export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'a-definir', label: 'A Definir' },
  { status: 'a-executar', label: 'A Executar' },
  { status: 'em-execucao', label: 'Em Execução' },
  { status: 'concluida', label: 'Concluída' },
  { status: 'arquivada', label: 'Arquivada' },
];

export const statusLabel = (s: TaskStatus) => COLUMNS.find((c) => c.status === s)?.label ?? s;

/** Coluna seguinte de `s`, ou null se já for a última ('arquivada'). */
export function nextColumn(s: TaskStatus): { status: TaskStatus; label: string } | null {
  const i = COLUMNS.findIndex((c) => c.status === s);
  return i >= 0 && i < COLUMNS.length - 1 ? COLUMNS[i + 1] : null;
}

/** Uma tarefa acabou mas o veredicto foi negativo — o caso "completa mas com erro". */
export const isFailed = (t: Task) => t.status === 'concluida' && t.lastStatus === 'error';

const LAST_STATUS_LABEL: Record<'ok' | 'error' | 'running', string> = {
  ok: 'Sucesso',
  error: 'Erro',
  running: 'A correr',
};

const AUTHOR_META: Record<TaskCommentAuthor, { icon: string; label: string }> = {
  user: { icon: '👤', label: 'Eu' },
  worker: { icon: '🖥', label: 'Worker' },
  judge: { icon: '⚖', label: 'Juiz' },
  system: { icon: '⚙', label: 'Sistema' },
};

// Basename de um caminho absoluto (Windows \ ou POSIX /).
const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

/** Tempo relativo curto em pt-PT ("agora mesmo", "há 5 min", "há 2 h", "ontem", data). */
export function relTime(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 0) return 'agora mesmo';
  if (s < 45) return 'agora mesmo';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'há 1 hora' : `há ${h} horas`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Data completa (tooltip / bloco de datas). */
export const fullDate = (ts: number) =>
  new Date(ts).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Ícones inline (sem dependência de icon lib, igual ao resto do projecto).
type IconName = 'x' | 'arrow-right' | 'pencil' | 'trash-2' | 'send' | 'rotate' | 'paperclip' | 'check';
function Icon({ name }: { name: IconName }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'x') return <svg {...c}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'arrow-right') return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === 'pencil') return <svg {...c}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l4 4" /></svg>;
  if (name === 'send') return <svg {...c}><path d="M4 12 20 4l-8 16-2-6-6-2z" /></svg>;
  if (name === 'rotate') return <svg {...c}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
  if (name === 'paperclip') return <svg {...c}><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" /></svg>;
  if (name === 'check') return <svg {...c}><path d="m5 13 4 4L19 7" /></svg>;
  return <svg {...c}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>; // trash-2
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Props {
  task: Task;
  projects: Project[];
  cliProfiles: CliProfileInfo[];
  jocaItems: JocaItem[];
  onClose: () => void;
  /** Refaz o fetch das tarefas (o backend também faz broadcast, mas não confiamos só nisso). */
  onRefresh: () => void;
  /** Actualização local optimista, para o painel reflectir a mudança sem esperar pelo fetch. */
  onPatchLocal: (id: string, patch: Partial<Task>) => void;
}

export function TaskDetail({ task, projects, cliProfiles, jocaItems, onClose, onRefresh, onPatchLocal }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // ── Escape + focus trap ────────────────────────────────────────────────────
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); el.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? el.contains(active) : false;
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  // ── Edição ─────────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [eTitle, setETitle] = useState(task.title);
  const [eDescription, setEDescription] = useState(task.description ?? '');
  const [eProjectId, setEProjectId] = useState(task.projectId ?? '');
  const [eSkills, setESkills] = useState<string[]>(task.skills ?? []);
  const [eSkillQuery, setESkillQuery] = useState('');
  const [eRequireConfirm, setERequireConfirm] = useState(Boolean(task.requireConfirm));
  const [eCli, setECli] = useState(task.cli ?? 'claude');
  const [eModel, setEModel] = useState(task.model ?? '');

  const knownNames = useMemo(() => new Set(jocaItems.map((i) => i.name)), [jocaItems]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const project = task.projectId ? projectsById.get(task.projectId) : undefined;

  const startEditing = useCallback(() => {
    // Só semeia o rascunho ao entrar em edição — assim um refresh de fundo não pisa o que se escreveu.
    setETitle(task.title);
    setEDescription(task.description ?? '');
    setEProjectId(task.projectId ?? '');
    setESkills(task.skills ?? []);
    setESkillQuery('');
    setERequireConfirm(Boolean(task.requireConfirm));
    setECli(task.cli ?? 'claude');
    setEModel(task.model ?? '');
    setEditError('');
    setEditing(true);
  }, [task]);

  const addSkill = useCallback((raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setESkills((s) => (s.includes(v) ? s : [...s, v]));
    setESkillQuery('');
  }, []);

  const save = useCallback(async () => {
    if (!eTitle.trim()) { setEditError('O título não pode ficar vazio.'); return; }
    setSaving(true);
    setEditError('');
    // Campos limpos vão como string vazia (e não `undefined`): JSON.stringify apaga as chaves
    // `undefined` e o PATCH usa `'campo' in body` para decidir se mexe — omitir = não limpar.
    const body = {
      title: eTitle.trim(),
      description: eDescription.trim(),
      projectId: eProjectId,
      skills: eSkills,
      requireConfirm: eRequireConfirm,
      cli: eCli === 'claude' ? '' : eCli,
      model: eModel.trim(),
    };
    try {
      const res = await fetch(`/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // Em erro mantemos o rascunho intacto — o utilizador não perde o que escreveu.
        setEditError((d as { error?: string }).error || `Não foi possível guardar (HTTP ${res.status}).`);
        return;
      }
      const updated = (await res.json().catch(() => null)) as Task | null;
      onPatchLocal(task.id, updated && updated.id ? updated : {
        title: body.title,
        description: body.description || undefined,
        projectId: body.projectId || undefined,
        skills: eSkills.length ? eSkills : undefined,
        requireConfirm: eRequireConfirm || undefined,
        cli: body.cli || undefined,
        model: body.model || undefined,
      });
      setEditing(false);
      onRefresh();
    } catch {
      setEditError('Erro de rede ao guardar. Tenta outra vez.');
    } finally {
      setSaving(false);
    }
  }, [eTitle, eDescription, eProjectId, eSkills, eRequireConfirm, eCli, eModel, task.id, onPatchLocal, onRefresh]);

  // ── Acções (avançar / re-executar) ─────────────────────────────────────────
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);
  const next = nextColumn(task.status);

  const advance = useCallback(async () => {
    if (!next) return;
    setActing(true);
    setActionError('');
    try {
      const res = await fetch(`/tasks/${task.id}/advance`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError((d as { error?: string }).error || 'Não foi possível avançar a tarefa.');
        return;
      }
      onPatchLocal(task.id, { status: next.status });
      onRefresh();
    } catch {
      setActionError('Erro de rede ao avançar a tarefa.');
    } finally { setActing(false); }
  }, [next, task.id, onPatchLocal, onRefresh]);

  const retry = useCallback(async () => {
    setActing(true);
    setActionError('');
    try {
      const res = await fetch(`/tasks/${task.id}/retry`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError((d as { error?: string }).error || 'Não foi possível re-executar.');
        return;
      }
      onPatchLocal(task.id, { status: 'a-executar', lastStatus: null, result: undefined });
      onRefresh();
    } catch {
      setActionError('Erro de rede ao re-executar.');
    } finally { setActing(false); }
  }, [task.id, onPatchLocal, onRefresh]);

  // ── Notas / comentários ────────────────────────────────────────────────────
  const comments = useMemo(() => [...(task.comments ?? [])].sort((a, b) => a.ts - b.ts), [task.comments]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [comments.length]);

  const sendNote = useCallback(async () => {
    const text = note.trim();
    if (!text || sending) return;
    setSending(true);
    setNoteError('');
    try {
      const res = await fetch(`/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNoteError((d as { error?: string }).error || `Não foi possível enviar a nota (HTTP ${res.status}).`);
        return;
      }
      const created = (await res.json().catch(() => null)) as TaskComment | null;
      if (created && created.id) onPatchLocal(task.id, { comments: [...(task.comments ?? []), created] });
      setNote('');
      onRefresh();
    } catch {
      setNoteError('Erro de rede ao enviar a nota.');
    } finally { setSending(false); }
  }, [note, sending, task.id, task.comments, onPatchLocal, onRefresh]);

  const deleteNote = useCallback(async (commentId: string) => {
    setConfirmDelete(null);
    setNoteError('');
    try {
      const res = await fetch(`/tasks/${task.id}/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) { setNoteError('Não foi possível apagar a nota.'); return; }
      onPatchLocal(task.id, { comments: (task.comments ?? []).filter((c) => c.id !== commentId) });
      onRefresh();
    } catch {
      setNoteError('Erro de rede ao apagar a nota.');
    }
  }, [task.id, task.comments, onPatchLocal, onRefresh]);

  const cliLabel = useMemo(() => {
    const id = task.cli ?? 'claude';
    return cliProfiles.find((p) => p.id === id)?.label ?? id;
  }, [task.cli, cliProfiles]);

  const failed = isFailed(task);

  return (
    <div className="tk-drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        ref={panelRef}
        className="tk-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-drawer-title"
        tabIndex={-1}
      >
        <header className="tk-drawer-head">
          <div className="tk-drawer-head-main">
            <div className="tk-drawer-badges">
              <span className="tk-tag tk-drawer-col">{statusLabel(task.status)}</span>
              {task.lastStatus && (
                <span className={`tk-status tk-status-${task.lastStatus}`}>{LAST_STATUS_LABEL[task.lastStatus]}</span>
              )}
              {failed && <span className="tk-drawer-failed">⚠ concluída com erro</span>}
            </div>
            <h2 id="tk-drawer-title">{task.title}</h2>
          </div>
          <button type="button" className="tk-drawer-close" onClick={onClose} aria-label="Fechar detalhe">
            <Icon name="x" />
          </button>
        </header>

        <div className="tk-drawer-toolbar">
          {!editing && (
            <button type="button" className="tk-drawer-btn" onClick={startEditing}>
              <Icon name="pencil" /> Editar
            </button>
          )}
          {next && (
            <button
              type="button"
              className="tk-drawer-btn"
              onClick={advance}
              disabled={acting}
              title={`Mover para ${next.label}`}
              aria-label={`Mover para ${next.label}`}
            >
              <Icon name="arrow-right" /> Mover para {next.label}
            </button>
          )}
          {failed && (
            <button type="button" className="tk-drawer-btn tk-drawer-btn--retry" onClick={retry} disabled={acting}>
              <Icon name="rotate" /> Re-executar
            </button>
          )}
        </div>
        {actionError && <div className="tk-drawer-error" role="alert">{actionError}</div>}

        <div className="tk-drawer-body">
          {editing ? (
            <section className="tk-drawer-section" aria-label="Editar tarefa">
              <label className="tk-field">
                <span>Título</span>
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              </label>
              <label className="tk-field">
                <span>Objectivo (o que o worker faz)</span>
                <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={6} />
              </label>
              <div className="tk-row">
                <label className="tk-field tk-inline">
                  <span>Projecto</span>
                  <select value={eProjectId} onChange={(e) => setEProjectId(e.target.value)}>
                    <option value="">— sem projecto —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="tk-field tk-inline">
                  <span>CLI</span>
                  <select value={eCli} onChange={(e) => setECli(e.target.value)}>
                    {cliProfiles.length === 0 && <option value="claude">Claude Code</option>}
                    {cliProfiles.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.available && p.id !== task.cli}>
                        {p.label}{p.available ? '' : ' (não instalado)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tk-field tk-inline">
                  <span>Modelo (opcional)</span>
                  <input value={eModel} onChange={(e) => setEModel(e.target.value)} placeholder="sonnet (default)" />
                </label>
              </div>
              <div className="tk-row">
                <label className="tk-field tk-inline">
                  <span>Skills/agentes a usar</span>
                  <input
                    list="tk-detail-joca-items"
                    value={eSkillQuery}
                    onChange={(e) => { const v = e.target.value; if (knownNames.has(v)) addSkill(v); else setESkillQuery(v); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(eSkillQuery); } }}
                    placeholder="procurar skill/agente do JOCA…"
                  />
                  <datalist id="tk-detail-joca-items">
                    {jocaItems.map((i) => (
                      <option key={`${i.kind}:${i.name}`} value={i.name}>
                        {i.kind === 'agent' ? 'agente' : 'skill'} · {(i.description ?? '').slice(0, 70)}
                      </option>
                    ))}
                  </datalist>
                  {eSkills.length > 0 && (
                    <div className="tk-chips">
                      {eSkills.map((s) => (
                        <button type="button" key={s} className="tk-chip" onClick={() => setESkills((x) => x.filter((y) => y !== s))}>{s} ✕</button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="tk-field tk-inline tk-check">
                  <input type="checkbox" checked={eRequireConfirm} onChange={(e) => setERequireConfirm(e.target.checked)} />
                  <span>Confirmar antes de acções irreversíveis</span>
                </label>
              </div>
              {editError && <div className="tk-drawer-error" role="alert">{editError}</div>}
              <div className="tk-drawer-edit-actions">
                <button type="button" className="tk-btn-primary" onClick={save} disabled={saving || !eTitle.trim()}>
                  <Icon name="check" /> {saving ? 'A guardar…' : 'Guardar alterações'}
                </button>
                <button type="button" className="tk-drawer-btn" onClick={() => { setEditing(false); setEditError(''); }} disabled={saving}>
                  Cancelar
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className="tk-drawer-section" aria-label="Informação da tarefa">
                <dl className="tk-drawer-facts">
                  <div>
                    <dt>Projecto</dt>
                    <dd>
                      {project
                        ? <span className="tk-tag" style={project.color ? { borderColor: project.color, color: project.color } : undefined}>{project.name}</span>
                        : <span className="tk-drawer-empty">— sem projecto —</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Último run</dt>
                    <dd>
                      {task.lastStatus
                        ? <span className={`tk-status tk-status-${task.lastStatus}`}>{LAST_STATUS_LABEL[task.lastStatus]}</span>
                        : <span className="tk-drawer-empty">ainda não correu</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>CLI · modelo</dt>
                    <dd>{cliLabel}{task.model ? ` · ${task.model}` : ' · modelo por omissão'}</dd>
                  </div>
                  <div>
                    <dt>Confirmação</dt>
                    <dd>{task.requireConfirm ? '✋ pede confirmação antes de acções irreversíveis' : 'não pede confirmação'}</dd>
                  </div>
                  <div>
                    <dt>Criada</dt>
                    <dd title={fullDate(task.createdAt)}>{fullDate(task.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Actualizada</dt>
                    <dd title={fullDate(task.updatedAt)}>{relTime(task.updatedAt)} · {fullDate(task.updatedAt)}</dd>
                  </div>
                  {task.sessionId && (
                    <div>
                      <dt>Sessão</dt>
                      <dd className="tk-drawer-mono">{task.sessionId}</dd>
                    </div>
                  )}
                </dl>

                {task.skills?.length ? (
                  <div className="tk-drawer-block">
                    <h3>Skills / agentes</h3>
                    <div className="tk-card-meta">
                      {task.skills.map((s) => <span key={s} className="tk-tag">{s}</span>)}
                    </div>
                  </div>
                ) : null}

                {task.attachments?.length ? (
                  <div className="tk-drawer-block">
                    <h3>Anexos</h3>
                    <ul className="tk-drawer-attachments">
                      {task.attachments.map((p) => (
                        <li key={p}>
                          <Icon name="paperclip" />
                          <strong>{baseName(p)}</strong>
                          <span className="tk-drawer-mono">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="tk-drawer-section" aria-label="Objectivo">
                <h3>Objectivo</h3>
                {task.description
                  ? <p className="tk-drawer-text">{task.description}</p>
                  : <p className="tk-drawer-empty">Sem descrição. Usa “Editar” para escrever o objectivo do worker.</p>}
              </section>

              {(task.result || task.testerResult) && (
                <section className={`tk-drawer-section tk-drawer-verdict ${failed ? 'is-error' : ''}`} aria-label="Veredicto">
                  <h3>Veredicto do juiz</h3>
                  <p className="tk-drawer-text">{task.result ?? task.testerResult}</p>
                </section>
              )}
            </>
          )}

          {/* ── Thread de notas: conversa partilhada entre humano e agentes ─────── */}
          <section className="tk-drawer-section tk-thread" aria-label="Notas da tarefa">
            <h3>Notas <span className="tk-thread-count">{comments.length}</span></h3>
            {comments.length === 0 && (
              <p className="tk-drawer-empty">Sem notas. Escreve abaixo — o worker também escreve aqui quando termina.</p>
            )}
            <ol className="tk-thread-list">
              {comments.map((c) => {
                const meta = AUTHOR_META[c.author] ?? AUTHOR_META.system;
                return (
                  <li key={c.id} className={`tk-note tk-note--${c.author}`}>
                    <div className="tk-note-head">
                      <span className="tk-note-icon" aria-hidden>{meta.icon}</span>
                      <span className="tk-note-author">{c.authorName || meta.label}</span>
                      {c.authorName && <span className="tk-note-role">{meta.label}</span>}
                      <time className="tk-note-time" dateTime={new Date(c.ts).toISOString()} title={fullDate(c.ts)}>{relTime(c.ts)}</time>
                      {confirmDelete === c.id ? (
                        <span className="tk-note-confirm">
                          Apagar?
                          <button type="button" className="tk-note-yes" onClick={() => deleteNote(c.id)}>Sim</button>
                          <button type="button" onClick={() => setConfirmDelete(null)}>Não</button>
                        </span>
                      ) : (
                        <button type="button" className="tk-note-del" onClick={() => setConfirmDelete(c.id)} aria-label="Apagar nota">
                          <Icon name="trash-2" />
                        </button>
                      )}
                    </div>
                    <p className="tk-note-text">{c.text}</p>
                  </li>
                );
              })}
            </ol>
            <div ref={threadEndRef} />

            {noteError && <div className="tk-drawer-error" role="alert">{noteError}</div>}
            <div className="tk-note-compose">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendNote(); } }}
                rows={3}
                placeholder="Escrever uma nota… (Enter envia, Shift+Enter nova linha)"
                aria-label="Escrever uma nota"
              />
              <button type="button" className="tk-btn-primary" onClick={sendNote} disabled={sending || !note.trim()}>
                <Icon name="send" /> {sending ? 'A enviar…' : 'Enviar'}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default TaskDetail;
