// TasksView — Kanban board of tasks. A task is an objective executed in a real Claude Code worker
// (one sequential worker per project). Five columns model the lifecycle: A Definir → A Executar →
// Em Execução → Concluída → Arquivada. Drag a card between columns to change its status (POST /tasks/:id/move) or
// reorder it inside a column (PUT /tasks/reorder). Mirrors AutomationsView's fetch/icon/pt-PT style.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CliProfileInfo, Project } from '../types';
import { uploadPickedFiles, uploadPastedImages } from '../lib/fileDrop';
import { TaskDetail, COLUMNS, isFailed, nextColumn, tarefaParada, duracaoCurta, LAST_STATUS_LABEL } from './TaskDetail';
import type { JocaItem, Task, TaskStatus } from './TaskDetail';
import './TasksView.css';

// Minimal inline-SVG icons (the project has no shared icon module / lucide-react dep).
type IconName = 'plus' | 'x' | 'play' | 'loader' | 'trash-2' | 'archive' | 'rotate' | 'paperclip' | 'arrow-right' | 'check-square' | 'merge';
function LucideIcon({ name }: { name: IconName }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'plus') return <svg {...c}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'x') return <svg {...c}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'play') return <svg {...c}><path d="M7 5v14l11-7z" /></svg>;
  if (name === 'loader') return <svg {...c}><path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
  if (name === 'archive') return <svg {...c}><path d="M3 5h18v4H3zM5 9v10h14V9M9 13h6" /></svg>;
  if (name === 'rotate') return <svg {...c}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
  if (name === 'paperclip') return <svg {...c}><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" /></svg>;
  if (name === 'arrow-right') return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === 'check-square') return <svg {...c}><path d="M20 11v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10M9 11l3 3 8-8" /></svg>;
  if (name === 'merge') return <svg {...c}><path d="M8 3v6a4 4 0 0 0 4 4h8M16 3v6a4 4 0 0 1-4 4H4M12 13v8" /></svg>;
  return <svg {...c}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>; // trash-2
}

// Basename de um caminho absoluto (Windows \ ou POSIX /), para o chip do anexo.
const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

// Uma tarefa prefixada com "[para ti]" é trabalho
// que ele te passou a ti. Merecem destaque no quadro, senão perdem-se entre as dos workers.
const isForUser = (title: string) => /^\s*\[para ti\]/i.test(title);

interface TasksViewProps {
  refreshKey: number;
  projects: Project[];
  /** Definido = quadro de UM projecto (embebido na vista de projecto): filtra e pré-selecciona. */
  projectId?: string;
}

export function TasksView({ refreshKey, projects, projectId }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // "Parada há X" envelhece sozinho: sem um tick, o aviso só aparecia quando algo mais forçasse um
  // render. Um minuto chega — os limiares são de meia hora e duas horas.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  // Detalhe (drawer), selecção múltipla + merge, confirmações inline por coluna.
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeKeepId, setMergeKeepId] = useState('');
  const [mergeTitle, setMergeTitle] = useState('');
  const [mergeError, setMergeError] = useState('');
  const [merging, setMerging] = useState(false);
  const [confirmCol, setConfirmCol] = useState<TaskStatus | null>(null);
  const [boardError, setBoardError] = useState('');
  // Um drag nativo pode disparar um click no fim — o flag (limpo em cada mousedown, ligado em
  // dragstart) evita abrir o detalhe só por se ter arrastado o cartão.
  const draggedRef = useRef(false);

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formProjectId, setFormProjectId] = useState(projectId ?? '');
  const [jocaItems, setJocaItems] = useState<JocaItem[]>([]);
  const [requireConfirm, setRequireConfirm] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Recusa do backend (extensão fora da allowlist, ficheiro grande demais): sem isto o botão
  // "Anexar ficheiros" não dava sinal nenhum e parecia avariado.
  const [attachError, setAttachError] = useState<string | null>(null);
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[]>([]);

  // Um só <input type=file> reutilizado: o alvo (form de criação vs cartão) fica no ref.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<{ kind: 'create' } | { kind: 'task'; id: string } | null>(null);

  const reload = useCallback(() => {
    fetch('/tasks').then((r) => r.json()).then((d: Task[]) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, []);
  useEffect(() => { reload(); }, [reload, refreshKey]);

  // Embebido num projecto: o projecto do formulário segue o projecto da vista (e não o contrário).
  useEffect(() => { if (projectId) setFormProjectId(projectId); }, [projectId]);

  // Uma tarefa pode desaparecer (apagada/fundida) enquanto está seleccionada — limpa os ids órfãos.
  useEffect(() => {
    setSelected((s) => {
      const alive = s.filter((id) => tasks.some((t) => t.id === id));
      return alive.length === s.length ? s : alive;
    });
  }, [tasks]);

  // JOCA_Brain skills + agents, for the "skills a usar" picker (don't make the user memorise names).
  useEffect(() => {
    fetch('/joca-items').then((r) => r.json()).then((o) => {
      const skills = (o.skills ?? []).map((s: { name: string; description?: string }) => ({ ...s, kind: 'skill' as const }));
      const agents = (o.agents ?? []).map((a: { name: string; description?: string }) => ({ ...a, kind: 'agent' as const }));
      setJocaItems([...skills, ...agents]);
    }).catch(() => setJocaItems([]));
  }, []);
  // CLIs disponíveis para o worker da tarefa (claude default; os outros só se instalados).
  useEffect(() => {
    fetch('/cli-profiles').then((r) => r.json()).then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : [])).catch(() => setCliProfiles([]));
  }, []);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  // Com `projectId` o quadro mostra só as tarefas desse projecto (o `tasks` completo continua a ser
  // a fonte para procurar por id — arrastar/mover não precisa de saber deste filtro).
  const visibleTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.projectId === projectId) : tasks),
    [tasks, projectId]
  );

  // Tasks of one column, ordered. Pure derivation from the single `tasks` array.
  const columnTasks = useCallback((status: TaskStatus) => (
    visibleTasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order)
  ), [visibleTasks]);

  const create = useCallback(async () => {
    if (!title.trim()) return;
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: 'a-definir' as TaskStatus,
      projectId: formProjectId || undefined,
      requireConfirm: requireConfirm || undefined,
      attachments: attachments.length ? attachments : undefined,
    };
    await fetch('/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setTitle(''); setDescription(''); setFormProjectId(projectId ?? ''); setRequireConfirm(false); setAttachments([]); setCreating(false);
    reload();
  }, [title, description, formProjectId, projectId, requireConfirm, attachments, reload]);

  // Persistir os anexos de uma tarefa existente (PATCH). Reversível → sem confirmação.
  const patchAttachments = useCallback(async (id: string, next: string[]) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, attachments: next.length ? next : undefined } : t)));
    await fetch(`/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attachments: next }) });
    reload();
  }, [reload]);

  // Abrir o picker apontado ao form de criação ou a uma tarefa concreta.
  const openPicker = useCallback((target: { kind: 'create' } | { kind: 'task'; id: string }) => {
    attachTarget.current = target;
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite re-escolher o mesmo ficheiro
    const target = attachTarget.current;
    attachTarget.current = null;
    if (!files.length || !target) return;
    setUploading(true);
    try {
      const { paths, errors } = await uploadPickedFiles(files);
      setAttachError(errors.length ? `Não anexado — ${errors.join(' · ')}` : null);
      if (!paths.length) return;
      if (target.kind === 'create') {
        setAttachments((a) => [...a, ...paths]);
      } else {
        const t = tasks.find((x) => x.id === target.id);
        await patchAttachments(target.id, [...(t?.attachments ?? []), ...paths]);
      }
    } finally { setUploading(false); }
  }, [tasks, patchAttachments]);

  // #12: Ctrl+V of an image while creating a task → upload to JOCA_Drops and add as an attachment.
  const onCreatePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imgs.length === 0) return; // let the text paste through
    e.preventDefault();
    setUploading(true);
    try {
      const { paths, errors } = await uploadPastedImages(imgs, Date.now());
      setAttachError(errors.length ? `Não anexado — ${errors.join(' · ')}` : null);
      if (paths.length) setAttachments((a) => [...a, ...paths]);
    } finally { setUploading(false); }
  }, []);

  // Move to another column (or reposition across columns). Optimistic, then reconcile via reload.
  const move = useCallback(async (id: string, status: TaskStatus, order?: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/tasks/${id}/move`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, order }) });
    reload();
  }, [reload]);

  // Reorder within a column (ids = the new full ordering of that column).
  const reorder = useCallback(async (status: TaskStatus, ids: string[]) => {
    setTasks((prev) => {
      const pos = new Map(ids.map((id, i) => [id, i]));
      return prev.map((t) => (t.status === status && pos.has(t.id) ? { ...t, order: pos.get(t.id)! } : t));
    });
    await fetch('/tasks/reorder', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, ids }) });
    reload();
  }, [reload]);

  const run = useCallback(async (t: Task) => {
    setBusy(t.id);
    try {
      await fetch(`/tasks/${t.id}/run`, { method: 'POST' });
    } finally { setBusy(null); reload(); }
  }, [reload]);

  const remove = useCallback(async (t: Task) => {
    await fetch(`/tasks/${t.id}`, { method: 'DELETE' });
    if (openId === t.id) setOpenId(null);
    setSelected((s) => s.filter((id) => id !== t.id));
    reload();
  }, [reload, openId]);

  // ── Detalhe / selecção / avanço / merge ─────────────────────────────────────
  // Patch local optimista: o backend faz broadcast `tasks_changed`, mas não dependemos só disso.
  const patchLocal = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const openTask = useMemo(() => tasks.find((t) => t.id === openId) ?? null, [tasks, openId]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected([]);
    setMergeOpen(false);
    setMergeError('');
  }, []);

  // Avança uma tarefa uma coluna para a direita.
  const advance = useCallback(async (t: Task) => {
    const next = nextColumn(t.status);
    if (!next) return;
    setBoardError('');
    patchLocal(t.id, { status: next.status });
    const res = await fetch(`/tasks/${t.id}/advance`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBoardError((d as { error?: string }).error || 'Não foi possível avançar a tarefa.');
    }
    reload();
  }, [patchLocal, reload]);

  // Move a coluna inteira um passo para a direita.
  const advanceColumn = useCallback(async (status: TaskStatus) => {
    setConfirmCol(null);
    setBoardError('');
    const res = await fetch('/tasks/advance-column', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBoardError((d as { error?: string }).error || 'Não foi possível mover a coluna.');
    }
    reload();
  }, [reload]);

  const retry = useCallback(async (t: Task) => {
    setBoardError('');
    const res = await fetch(`/tasks/${t.id}/retry`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBoardError((d as { error?: string }).error || 'Não foi possível re-executar a tarefa.');
    } else {
      patchLocal(t.id, { status: 'a-executar', lastStatus: null, result: undefined });
    }
    reload();
  }, [patchLocal, reload]);

  const doMerge = useCallback(async () => {
    if (selected.length < 2) return;
    setMerging(true);
    setMergeError('');
    try {
      const res = await fetch('/tasks/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ids: selected,
          keepId: mergeKeepId || undefined,
          title: mergeTitle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setMergeError(res.status === 409
          ? 'Não é possível fundir tarefas em execução. Espera que terminem ou tira-as da selecção.'
          : ((await res.json().catch(() => ({}))) as { error?: string }).error || `Não foi possível fundir (HTTP ${res.status}).`);
        return;
      }
      const merged = (await res.json().catch(() => null)) as Task | null;
      if (merged?.id) setOpenId(merged.id);
      exitSelectMode();
      reload();
    } catch {
      setMergeError('Erro de rede ao fundir as tarefas.');
    } finally { setMerging(false); }
  }, [selected, mergeKeepId, mergeTitle, exitSelectMode, reload]);

  // Escape fecha o diálogo de merge (o drawer de detalhe trata do seu próprio Escape).
  useEffect(() => {
    if (!mergeOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMergeOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mergeOpen]);

  // Abrir o diálogo de merge: por omissão fica a primeira seleccionada como principal.
  const openMergeDialog = useCallback(() => {
    setMergeKeepId(selected[0] ?? '');
    setMergeTitle('');
    setMergeError('');
    setMergeOpen(true);
  }, [selected]);

  // ── Drag & drop (native HTML5) ──────────────────────────────────────────────
  // Compute the drop into `status` at `index` (index = target slot, or end of column when omitted).
  const handleDrop = useCallback((status: TaskStatus, index?: number) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.status === status) {
      // Reorder inside the same column.
      const ids = columnTasks(status).map((t) => t.id).filter((x) => x !== id);
      const at = index === undefined ? ids.length : Math.min(index, ids.length);
      ids.splice(at, 0, id);
      void reorder(status, ids);
    } else {
      // Cross-column move; order = target slot (defaults to end of the destination column).
      const at = index === undefined ? columnTasks(status).length : index;
      void move(id, status, at);
    }
  }, [draggingId, tasks, columnTasks, reorder, move]);

  return (
    <div className={`tasks-view${projectId ? ' tasks-view--embedded' : ''}`}>
      <header className="tk-header">
        {!projectId && (
          <div>
            <h1>Tarefas</h1>
            <p>Quadro Kanban. Cada tarefa corre num worker Claude Code do projecto — um worker por projecto, tarefas em sequência. Arrasta entre colunas.</p>
          </div>
        )}
        <div className="tk-header-actions">
          <button
            className={`tk-select-toggle ${selectMode ? 'is-on' : ''}`}
            type="button"
            aria-pressed={selectMode}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            <LucideIcon name={selectMode ? 'x' : 'check-square'} /> {selectMode ? 'Sair da selecção' : 'Seleccionar'}
          </button>
          <button className="tk-btn-primary" type="button" onClick={() => setCreating((v) => !v)}>
            <LucideIcon name={creating ? 'x' : 'plus'} /> {creating ? 'Cancelar' : 'Nova tarefa'}
          </button>
        </div>
      </header>

      {boardError && (
        <div className="tk-board-error" role="alert">
          {boardError}
          <button type="button" onClick={() => setBoardError('')} aria-label="Dispensar aviso"><LucideIcon name="x" /></button>
        </div>
      )}

      {creating && (
        <div className="tk-form">
          <label className="tk-field">
            <span>Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Corrigir formulário de reservas" />
          </label>
          <label className="tk-field">
            <span>Objectivo</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              onPaste={onCreatePaste}
              placeholder="Revê o formulário de contacto, valida campos e melhora o CTA. (Ctrl+V cola imagens como anexo)" />
          </label>
          <div className="tk-row">
            {projectId ? (
              // Quadro de um projecto: a tarefa é dele, ponto — mostrar um selector só convidava a
              // criar tarefas que desapareciam da vista logo a seguir.
              <div className="tk-field tk-inline">
                <span>Projecto</span>
                <div className="tk-card-meta">
                  <span className="tk-tag">{projectsById.get(projectId)?.name ?? 'este projecto'}</span>
                </div>
              </div>
            ) : (
              <label className="tk-field tk-inline">
                <span>Projecto</span>
                <select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)}>
                  <option value="">— sem projecto —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="tk-row">
            <label className="tk-field tk-inline tk-check">
              <input type="checkbox" checked={requireConfirm} onChange={(e) => setRequireConfirm(e.target.checked)} />
              <span>Confirmar antes de acções irreversíveis</span>
            </label>
          </div>
          <div className="tk-field">
            <span>Anexos (opcional)</span>
            <div className="tk-attach-row">
              <button type="button" className="tk-attach-btn" onClick={() => openPicker({ kind: 'create' })} disabled={uploading}>
                <LucideIcon name="paperclip" /> {uploading ? 'A carregar…' : 'Anexar ficheiros'}
              </button>
              {attachments.length > 0 && (
                <div className="tk-attach-chips">
                  {attachments.map((p) => (
                    <button type="button" key={p} className="tk-attach-chip" title={p} onClick={() => setAttachments((a) => a.filter((x) => x !== p))}>
                      <LucideIcon name="paperclip" /><span className="tk-attach-name">{baseName(p)}</span> ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
            {attachError && (
              <div role="status" style={{ marginTop: 6, fontSize: 11, color: 'var(--red)' }}>{attachError}</div>
            )}
          </div>
          <button className="tk-btn-primary" type="button" onClick={create} disabled={!title.trim()}>
            Criar tarefa
          </button>
        </div>
      )}

      {/* Um só picker, reutilizado pelo form de criação e por cada cartão (alvo no ref). */}
      <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />

      {/* Quadro vazio: primeira pista de onboarding (auditoria #21). */}
      {COLUMNS.every((c) => columnTasks(c.status).length === 0) && (
        <p className="tk-board-onboarding">
          Ainda não há tarefas. Cria a primeira em "Nova tarefa". As de "A definir" ficam à espera
          de ti; assim que puseres uma em "A executar", ela corre num terminal do projecto — uma de
          cada vez, sempre no mesmo terminal.
        </p>
      )}

      {/* tabIndex: o quadro scrolla horizontalmente — sem foco, um utilizador só-teclado não
          alcança colunas fora do viewport (auditoria #14). */}
      <div className="tk-board" tabIndex={0} role="group" aria-label="Quadro de tarefas (scroll horizontal)">
        {COLUMNS.map((col) => {
          const cards = columnTasks(col.status);
          const colNext = nextColumn(col.status);
          // 'arquivada' é a última coluna; 'em-execucao' pertence ao worker → sem "Mover tudo".
          const canAdvanceAll = Boolean(colNext) && col.status !== 'em-execucao';
          const paradasNaColuna = cards.filter((t) => tarefaParada(t, agora)).length;
          return (
            <section
              key={col.status}
              className={`tk-col ${dragOverCol === col.status ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.status); }}
            >
              <div className="tk-col-head">
                <span className="tk-col-title">{col.label}</span>
                <span className="tk-col-count">{cards.length}</span>
                {paradasNaColuna > 0 && (
                  <span
                    className="tk-col-stale"
                    title={`${paradasNaColuna} ${paradasNaColuna === 1 ? 'tarefa parada' : 'tarefas paradas'} há muito tempo nesta coluna`}
                  >
                    ⏳ {paradasNaColuna}
                  </span>
                )}
                {canAdvanceAll && colNext && (
                  <button
                    type="button"
                    className="tk-col-advance"
                    onClick={() => setConfirmCol((c) => (c === col.status ? null : col.status))}
                    disabled={cards.length === 0}
                    title={`Mover todas as tarefas para ${colNext.label}`}
                    aria-label={`Mover todas as tarefas de ${col.label} para ${colNext.label}`}
                  >
                    Mover tudo <LucideIcon name="arrow-right" />
                  </button>
                )}
              </div>
              {confirmCol === col.status && colNext && (
                <div className="tk-col-confirm" role="alert">
                  <span>Mover {cards.length} {cards.length === 1 ? 'tarefa' : 'tarefas'} para {colNext.label}?</span>
                  <div className="tk-col-confirm-actions">
                    <button type="button" className="tk-confirm-yes" onClick={() => advanceColumn(col.status)}>Mover</button>
                    <button type="button" onClick={() => setConfirmCol(null)}>Cancelar</button>
                  </div>
                </div>
              )}
              <div className="tk-col-body">
                {cards.length === 0 && <div className="tk-col-empty">Sem tarefas aqui — arrasta um cartão para esta coluna</div>}
                {cards.map((t, i) => {
                  const proj = t.projectId ? projectsById.get(t.projectId) : undefined;
                  const failed = isFailed(t);
                  const cardNext = nextColumn(t.status);
                  const noteCount = t.comments?.length ?? 0;
                  const isSelected = selected.includes(t.id);
                  const forUser = isForUser(t.title);
                  const parada = tarefaParada(t, agora);
                  return (
                    <article
                      key={t.id}
                      className={`tk-card ${draggingId === t.id ? 'dragging' : ''} ${failed ? 'tk-card--failed' : ''} ${parada ? 'tk-card--stale' : ''} ${isSelected ? 'tk-card--selected' : ''} ${forUser ? 'tk-card--mine' : ''}`}
                      draggable
                      tabIndex={0}
                      aria-label={`Abrir detalhe da tarefa ${t.title}`}
                      onClick={() => {
                        if (draggedRef.current) return;
                        if (selectMode) toggleSelected(t.id); else setOpenId(t.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (selectMode) toggleSelected(t.id); else setOpenId(t.id);
                        }
                      }}
                      onMouseDown={() => { draggedRef.current = false; }}
                      onDragStart={() => { draggedRef.current = true; setDraggingId(t.id); }}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverCol(col.status); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(col.status, i); }}
                    >
                      <div className="tk-card-top">
                        {selectMode && (
                          <input
                            type="checkbox"
                            className="tk-card-check"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(t.id)}
                            aria-label={`Seleccionar ${t.title}`}
                          />
                        )}
                        <span className="tk-card-title">{t.title}</span>
                        {forUser && <span className="tk-card-mine-flag" title="Tarefa marcada para ti">👤 para ti</span>}
                        {failed && <span className="tk-card-fail-flag" title="Concluída mas com erro">⚠ erro</span>}
                        {parada && (
                          <span className="tk-card-stale-flag" title={`Parada há ${duracaoCurta(parada.ms)}. ${parada.motivo}`}>
                            ⏳ parada há {duracaoCurta(parada.ms)}
                          </span>
                        )}
                        {!failed && t.lastStatus && <span className={`tk-status tk-status-${t.lastStatus}`}>{LAST_STATUS_LABEL[t.lastStatus]}</span>}
                      </div>
                      {t.description && <p className="tk-card-desc">{t.description}</p>}
                      <div className="tk-card-meta">
                        {!projectId && proj && <span className="tk-tag" style={proj.color ? { borderColor: proj.color, color: proj.color } : undefined}>{proj.name}</span>}
                        {t.skills?.length ? <span className="tk-tag">skills: {t.skills.join(', ')}</span> : null}
                        {t.requireConfirm ? <span className="tk-tag">✋ confirma</span> : null}
                        {noteCount > 0 && (
                          <span className="tk-tag tk-note-badge" title={`${noteCount} ${noteCount === 1 ? 'nota' : 'notas'}`}>💬 {noteCount}</span>
                        )}
                      </div>
                      {t.attachments?.length ? (
                        <div className="tk-attach-chips">
                          {t.attachments.map((p) => (
                            <button
                              type="button"
                              key={p}
                              className="tk-attach-chip"
                              title={p}
                              onClick={(e) => { e.stopPropagation(); patchAttachments(t.id, (t.attachments ?? []).filter((x) => x !== p)); }}
                            >
                              <LucideIcon name="paperclip" /><span className="tk-attach-name">{baseName(p)}</span> ✕
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {(t.result || t.testerResult) && (
                        <div className="tk-card-result">{(t.result ?? t.testerResult ?? '').slice(0, 220)}</div>
                      )}
                      <div className="tk-card-actions" onClick={(e) => e.stopPropagation()}>
                        {t.status === 'a-executar' && (
                          <button type="button" className="tk-run" onClick={() => run(t)} disabled={busy === t.id} data-tooltip="Correr agora" aria-label={`Correr a tarefa ${t.title}`}>
                            <LucideIcon name={busy === t.id ? 'loader' : 'play'} /> Correr
                          </button>
                        )}
                        {failed && (
                          <button type="button" className="tk-retry" onClick={() => retry(t)} data-tooltip="Re-executar esta tarefa" aria-label={`Re-executar a tarefa ${t.title}`}>
                            <LucideIcon name="rotate" /> Re-executar
                          </button>
                        )}
                        {cardNext && (
                          <button
                            type="button"
                            onClick={() => advance(t)}
                            data-tooltip={`Mover para ${cardNext.label}`}
                            aria-label={`Mover a tarefa ${t.title} para ${cardNext.label}`}
                          >
                            <LucideIcon name="arrow-right" />
                          </button>
                        )}
                        <button type="button" onClick={() => openPicker({ kind: 'task', id: t.id })} disabled={uploading} data-tooltip="Anexar ficheiro" aria-label={`Anexar ficheiro à tarefa ${t.title}`}>
                          <LucideIcon name="paperclip" />
                        </button>
                        {t.status !== 'arquivada' ? (
                          <button type="button" onClick={() => move(t.id, 'arquivada')} data-tooltip="Arquivar" aria-label={`Arquivar a tarefa ${t.title}`}>
                            <LucideIcon name="archive" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => move(t.id, 'a-definir')} data-tooltip="Repor" aria-label={`Repor a tarefa ${t.title} em "A definir"`}>
                            <LucideIcon name="rotate" />
                          </button>
                        )}
                        <button type="button" onClick={() => remove(t)} data-tooltip="Apagar" aria-label={`Apagar a tarefa ${t.title}`} className="tk-danger">
                          <LucideIcon name="trash-2" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Barra de acção da selecção múltipla ─────────────────────────────── */}
      {selectMode && selected.length >= 2 && (
        <div className="tk-merge-bar" role="region" aria-label="Acções sobre a selecção">
          <span className="tk-merge-bar-count">{selected.length} tarefas seleccionadas</span>
          <button type="button" className="tk-btn-primary" onClick={openMergeDialog}>
            <LucideIcon name="merge" /> Fundir {selected.length} tarefas
          </button>
          <button type="button" className="tk-merge-bar-clear" onClick={() => setSelected([])}>Limpar selecção</button>
        </div>
      )}

      {/* ── Diálogo de merge ────────────────────────────────────────────────── */}
      {mergeOpen && (
        <div className="tk-merge-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setMergeOpen(false); }}>
          <div
            className="tk-merge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tk-merge-title"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setMergeOpen(false); } }}
          >
            <h2 id="tk-merge-title">Fundir {selected.length} tarefas</h2>
            <p className="tk-merge-hint">
              As notas e anexos das outras tarefas passam para a principal; as restantes são removidas.
            </p>
            <fieldset className="tk-merge-keep">
              <legend>Qual fica como principal?</legend>
              {selected.map((id) => {
                const t = tasks.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <label key={id} className="tk-merge-option">
                    <input
                      type="radio"
                      name="tk-merge-keep"
                      value={id}
                      checked={mergeKeepId === id}
                      onChange={() => setMergeKeepId(id)}
                    />
                    <span>{t.title}</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="tk-field">
              <span>Título final (opcional)</span>
              <input
                value={mergeTitle}
                onChange={(e) => setMergeTitle(e.target.value)}
                placeholder="deixa vazio para manter o título da principal"
              />
            </label>
            {mergeError && <div className="tk-drawer-error" role="alert">{mergeError}</div>}
            <div className="tk-merge-actions">
              <button type="button" className="tk-btn-primary" onClick={doMerge} disabled={merging || selected.length < 2}>
                {merging ? 'A fundir…' : 'Fundir'}
              </button>
              <button type="button" className="tk-drawer-btn" onClick={() => setMergeOpen(false)} disabled={merging}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer de detalhe ───────────────────────────────────────────────── */}
      {openTask && (
        <TaskDetail
          key={openTask.id}
          task={openTask}
          projects={projects}
          cliProfiles={cliProfiles}
          jocaItems={jocaItems}
          onClose={() => setOpenId(null)}
          onRefresh={reload}
          onPatchLocal={patchLocal}
        />
      )}
    </div>
  );
}
