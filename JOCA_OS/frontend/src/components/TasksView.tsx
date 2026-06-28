// TasksView — Kanban board of tasks. A task is an objective the Master executes in a worker (cwd =
// the linked project). Five columns model the lifecycle: A Definir → A Executar → Em Execução →
// Concluída → Arquivada. Drag a card between columns to change its status (POST /tasks/:id/move) or
// reorder it inside a column (PUT /tasks/reorder). Mirrors AutomationsView's fetch/icon/pt-PT style.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project } from '../types';
import './TasksView.css';

// Minimal inline-SVG icons (the project has no shared icon module / lucide-react dep).
type IconName = 'plus' | 'x' | 'play' | 'loader' | 'trash-2' | 'archive' | 'rotate';
function LucideIcon({ name }: { name: IconName }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'plus') return <svg {...c}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'x') return <svg {...c}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'play') return <svg {...c}><path d="M7 5v14l11-7z" /></svg>;
  if (name === 'loader') return <svg {...c}><path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
  if (name === 'archive') return <svg {...c}><path d="M3 5h18v4H3zM5 9v10h14V9M9 13h6" /></svg>;
  if (name === 'rotate') return <svg {...c}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
  return <svg {...c}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>; // trash-2
}

// ── Schema (mirrors backend/src/tasks/store.ts) ───────────────────────────────
type TaskStatus = 'a-definir' | 'a-executar' | 'em-execucao' | 'concluida' | 'arquivada';
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectId?: string;
  order: number;
  provider?: string;
  model?: string;
  skills?: string[];
  requireConfirm?: boolean;
  sessionId?: string;
  result?: string;
  testerResult?: string;
  lastStatus?: 'ok' | 'error' | 'running' | null;
  createdAt: number;
  updatedAt: number;
}
interface ProviderInfo { id: string; label: string; available: boolean; wired: boolean }
interface JocaItem { name: string; description?: string; kind: 'skill' | 'agent' }

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'a-definir', label: 'A Definir' },
  { status: 'a-executar', label: 'A Executar' },
  { status: 'em-execucao', label: 'Em Execução' },
  { status: 'concluida', label: 'Concluída' },
  { status: 'arquivada', label: 'Arquivada' },
];

export function TasksView({ refreshKey, projects }: { refreshKey: number; projects: Project[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState('');
  const [jocaItems, setJocaItems] = useState<JocaItem[]>([]);
  const [skillQuery, setSkillQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [requireConfirm, setRequireConfirm] = useState(false);

  const reload = useCallback(() => {
    fetch('/tasks').then((r) => r.json()).then((d: Task[]) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, []);
  useEffect(() => { reload(); }, [reload, refreshKey]);

  // Which agents can run a task (Claude/Codex/Ollama wired; Antigravity blocked → disabled).
  useEffect(() => {
    fetch('/master-providers').then((r) => r.json()).then(setProviders).catch(() => setProviders([]));
  }, []);
  // JOCA_Brain skills + agents, for the "skills a usar" picker (don't make the user memorise names).
  useEffect(() => {
    fetch('/joca-items').then((r) => r.json()).then((o) => {
      const skills = (o.skills ?? []).map((s: { name: string; description?: string }) => ({ ...s, kind: 'skill' as const }));
      const agents = (o.agents ?? []).map((a: { name: string; description?: string }) => ({ ...a, kind: 'agent' as const }));
      setJocaItems([...skills, ...agents]);
    }).catch(() => setJocaItems([]));
  }, []);
  const knownNames = useMemo(() => new Set(jocaItems.map((i) => i.name)), [jocaItems]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const addSkill = useCallback((raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setSelectedSkills((s) => (s.includes(v) ? s : [...s, v]));
    setSkillQuery('');
  }, []);

  // Tasks of one column, ordered. Pure derivation from the single `tasks` array.
  const columnTasks = useCallback((status: TaskStatus) => (
    tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order)
  ), [tasks]);

  const create = useCallback(async () => {
    if (!title.trim()) return;
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: 'a-definir' as TaskStatus,
      projectId: projectId || undefined,
      provider,
      model: provider === 'claude' && model.trim() ? model.trim() : undefined,
      skills: selectedSkills.length ? selectedSkills : undefined,
      requireConfirm: requireConfirm || undefined,
    };
    await fetch('/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setTitle(''); setDescription(''); setProjectId(''); setModel(''); setSelectedSkills([]); setSkillQuery(''); setRequireConfirm(false); setCreating(false);
    reload();
  }, [title, description, projectId, provider, model, selectedSkills, requireConfirm, reload]);

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
    reload();
  }, [reload]);

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

  const provLabel = (id?: string) => providers.find((p) => p.id === id)?.label ?? (id ?? 'claude');

  return (
    <div className="tasks-view">
      <header className="tk-header">
        <div>
          <h1>Tarefas</h1>
          <p>Quadro Kanban. Cada tarefa é um objectivo que o Master executa num worker (cwd = projecto). Arrasta entre colunas.</p>
        </div>
        <button className="tk-btn-primary" type="button" onClick={() => setCreating((v) => !v)}>
          <LucideIcon name={creating ? 'x' : 'plus'} /> {creating ? 'Cancelar' : 'Nova tarefa'}
        </button>
      </header>

      {creating && (
        <div className="tk-form">
          <label className="tk-field">
            <span>Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Corrigir formulário de reservas" />
          </label>
          <label className="tk-field">
            <span>Objectivo (o que o worker faz)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Revê o formulário de contacto, valida campos e melhora o CTA." />
          </label>
          <div className="tk-row">
            <label className="tk-field tk-inline">
              <span>Projecto</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— sem projecto —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="tk-field tk-inline">
              <span>Agente</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {(providers.length ? providers : [{ id: 'claude', label: 'Claude', available: true, wired: true }]).map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.wired}>
                    {p.label}{!p.wired ? ' (indisponível)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {provider === 'claude' && (
              <label className="tk-field tk-inline">
                <span>Modelo (opcional)</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="sonnet (default)" />
              </label>
            )}
          </div>
          <div className="tk-row">
            <label className="tk-field tk-inline">
              <span>Skills/agentes a usar (opcional)</span>
              <input
                list="tk-joca-items"
                value={skillQuery}
                onChange={(e) => { const v = e.target.value; if (knownNames.has(v)) addSkill(v); else setSkillQuery(v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillQuery); } }}
                placeholder="procurar skill/agente do JOCA…"
              />
              <datalist id="tk-joca-items">
                {jocaItems.map((i) => (
                  <option key={`${i.kind}:${i.name}`} value={i.name}>{i.kind === 'agent' ? 'agente' : 'skill'} · {(i.description ?? '').slice(0, 70)}</option>
                ))}
              </datalist>
              {selectedSkills.length > 0 && (
                <div className="tk-chips">
                  {selectedSkills.map((s) => (
                    <button type="button" key={s} className="tk-chip" onClick={() => setSelectedSkills((x) => x.filter((y) => y !== s))}>{s} ✕</button>
                  ))}
                </div>
              )}
            </label>
            <label className="tk-field tk-inline tk-check">
              <input type="checkbox" checked={requireConfirm} onChange={(e) => setRequireConfirm(e.target.checked)} />
              <span>Confirmar antes de acções irreversíveis</span>
            </label>
          </div>
          <button className="tk-btn-primary" type="button" onClick={create} disabled={!title.trim()}>
            Criar tarefa
          </button>
        </div>
      )}

      <div className="tk-board">
        {COLUMNS.map((col) => {
          const cards = columnTasks(col.status);
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
              </div>
              <div className="tk-col-body">
                {cards.length === 0 && <div className="tk-col-empty">Vazio</div>}
                {cards.map((t, i) => {
                  const proj = t.projectId ? projectsById.get(t.projectId) : undefined;
                  return (
                    <article
                      key={t.id}
                      className={`tk-card ${draggingId === t.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => setDraggingId(t.id)}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverCol(col.status); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(col.status, i); }}
                    >
                      <div className="tk-card-top">
                        <span className="tk-card-title">{t.title}</span>
                        {t.lastStatus && <span className={`tk-status tk-status-${t.lastStatus}`}>{t.lastStatus}</span>}
                      </div>
                      {t.description && <p className="tk-card-desc">{t.description}</p>}
                      <div className="tk-card-meta">
                        {proj && <span className="tk-tag" style={proj.color ? { borderColor: proj.color, color: proj.color } : undefined}>{proj.name}</span>}
                        <span className="tk-tag tk-tag-agent">{provLabel(t.provider)}{t.model ? `·${t.model}` : ''}</span>
                        {t.skills?.length ? <span className="tk-tag">skills: {t.skills.join(', ')}</span> : null}
                        {t.requireConfirm ? <span className="tk-tag">✋ confirma</span> : null}
                      </div>
                      {(t.result || t.testerResult) && (
                        <div className="tk-card-result">{(t.result ?? t.testerResult ?? '').slice(0, 220)}</div>
                      )}
                      <div className="tk-card-actions">
                        {t.status === 'a-executar' && (
                          <button type="button" className="tk-run" onClick={() => run(t)} disabled={busy === t.id} data-tooltip="Correr agora">
                            <LucideIcon name={busy === t.id ? 'loader' : 'play'} /> Correr
                          </button>
                        )}
                        {t.status !== 'arquivada' ? (
                          <button type="button" onClick={() => move(t.id, 'arquivada')} data-tooltip="Arquivar">
                            <LucideIcon name="archive" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => move(t.id, 'a-definir')} data-tooltip="Repor">
                            <LucideIcon name="rotate" />
                          </button>
                        )}
                        <button type="button" onClick={() => remove(t)} data-tooltip="Apagar" className="tk-danger">
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
    </div>
  );
}
