// MasterTasksBoard — 4º bloco do Master: mini-Kanban RECOLHÍVEL ao lado do chat (vive dentro do
// mc-body, ao lado do StatRail). Colunas compactas (A Definir → A Executar → Em Execução → Concluída)
// com cartões minúsculos (título + dot de status). Mover um cartão para a coluna seguinte (›) faz
// POST /tasks/:id/move; correr (▶) uma tarefa em 'a-executar' faz POST /tasks/:id/run. Estado em
// disco no backend (tasks.json, escrita atómica); aqui só lemos GET /tasks (em refreshKey) e mutamos.
import { useCallback, useEffect, useState } from 'react';
import './MasterTasksBoard.css';

// Espelha backend/src/tasks/store.ts (a integração das rotas é feita à parte).
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

// Colunas visíveis, por ordem do fluxo. 'arquivada' não tem coluna própria (é o destino de "limpar").
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'a-definir', label: 'A Definir' },
  { status: 'a-executar', label: 'A Executar' },
  { status: 'em-execucao', label: 'Em Execução' },
  { status: 'concluida', label: 'Concluída' },
];

// Coluna seguinte no fluxo (botão ›). concluida → arquivada limpa o cartão do board.
const NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  'a-definir': 'a-executar',
  'a-executar': 'em-execucao',
  'em-execucao': 'concluida',
  'concluida': 'arquivada',
};

const STORE_KEY = 'joca:masterTasksBoard:collapsed';

// Minimal inline-SVG icons (sem lucide-react no projecto, igual ao AutomationsView).
type IconName = 'chevron-right' | 'play' | 'loader' | 'columns' | 'chevrons-right';
function Icon({ name }: { name: IconName }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'chevron-right') return <svg {...c}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'play') return <svg {...c}><path d="M7 5v14l11-7z" /></svg>;
  if (name === 'loader') return <svg {...c}><path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
  if (name === 'chevrons-right') return <svg {...c}><path d="m6 17 5-5-5-5M13 17l5-5-5-5" /></svg>;
  return <svg {...c}><path d="M3 4h6v16H3zM15 4h6v16h-6z" /></svg>; // columns
}

export default function MasterTasksBoard({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORE_KEY) === '1'; } catch { return false; }
  });

  const reload = useCallback(() => {
    fetch('/tasks').then((r) => r.json()).then((d) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, []);
  useEffect(() => { reload(); }, [reload, refreshKey]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Mover o cartão para a coluna seguinte (reversível → sem confirmação).
  const move = useCallback(async (t: Task) => {
    const status = NEXT[t.status];
    if (!status) return;
    setBusy(t.id);
    try {
      await fetch(`/tasks/${t.id}/move`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    } finally { setBusy(null); reload(); }
  }, [reload]);

  // Forçar execução imediata (só faz sentido em 'a-executar').
  const run = useCallback(async (t: Task) => {
    setBusy(t.id);
    try {
      await fetch(`/tasks/${t.id}/run`, { method: 'POST' });
    } finally { setBusy(null); reload(); }
  }, [reload]);

  const active = tasks.filter((t) => t.status !== 'arquivada').length;

  // ── Recolhido: barra fina vertical com botão para abrir + contador ──
  if (collapsed) {
    return (
      <aside className="mtb mtb--collapsed" aria-label="Tarefas (recolhido)">
        <button type="button" className="mtb-rail-btn" onClick={toggleCollapsed} aria-label="Abrir tarefas" aria-expanded={false}>
          <Icon name="columns" />
        </button>
        {active > 0 && <span className="mtb-rail-count" aria-label={`${active} tarefas`}>{active}</span>}
        <span className="mtb-rail-title" aria-hidden>Tarefas</span>
      </aside>
    );
  }

  // ── Aberto: mini-kanban com colunas compactas ──
  return (
    <aside className="mtb" aria-label="Tarefas">
      <header className="mtb-head">
        <span className="mtb-head-title">Tarefas</span>
        <span className="mtb-head-count">{active}</span>
        <button type="button" className="mtb-collapse" onClick={toggleCollapsed} aria-label="Recolher tarefas" aria-expanded data-tooltip="Recolher">
          <Icon name="chevrons-right" />
        </button>
      </header>

      <div className="mtb-cols">
        {COLUMNS.map((col) => {
          const cards = tasks
            .filter((t) => t.status === col.status)
            .sort((a, b) => a.order - b.order);
          return (
            <section key={col.status} className="mtb-col">
              <div className="mtb-col-head">
                <span className={`mtb-dot mtb-dot--${col.status}`} aria-hidden />
                <span className="mtb-col-label">{col.label}</span>
                <span className="mtb-col-num">{cards.length}</span>
              </div>
              <div className="mtb-col-body">
                {cards.length === 0 ? (
                  <p className="mtb-col-empty">—</p>
                ) : (
                  cards.map((t) => {
                    const canRun = t.status === 'a-executar';
                    const canMove = !!NEXT[t.status];
                    const isBusy = busy === t.id;
                    return (
                      <article key={t.id} className={`mtb-card${isBusy ? ' mtb-card--busy' : ''}`} title={t.description || t.title}>
                        <span className={`mtb-dot mtb-dot--${t.status}${t.lastStatus === 'error' ? ' mtb-dot--error' : ''}`} aria-hidden />
                        <span className="mtb-card-title">{t.title}</span>
                        <span className="mtb-card-actions">
                          {canRun && (
                            <button type="button" className="mtb-act" onClick={() => run(t)} disabled={isBusy} aria-label="Correr agora" data-tooltip="Correr">
                              <Icon name={isBusy ? 'loader' : 'play'} />
                            </button>
                          )}
                          {canMove && (
                            <button type="button" className="mtb-act" onClick={() => move(t)} disabled={isBusy} aria-label="Avançar coluna" data-tooltip="Avançar">
                              <Icon name="chevron-right" />
                            </button>
                          )}
                        </span>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
