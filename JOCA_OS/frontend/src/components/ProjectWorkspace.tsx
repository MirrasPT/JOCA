// ProjectWorkspace — a vista de um projecto (mainView === 'project').
//
// A ordem da página é a ordem da atenção: o utilizador fala com o GESTOR, e é só isso que tem de
// fazer. Por isso o chat ocupa o espaço nobre, logo a seguir ao cabeçalho. Depois vêm as tarefas
// (o que está combinado com ele), e só depois — fechado por defeito — os terminais, que passaram a
// ser máquinas dele e não coisas que se abram à mão. Os detalhes técnicos do projecto (toolkit
// exclusivo, git, pasta) continuam todos cá, no último bloco colapsável, via ProjectDetailView
// em modo `embedded`.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PooledWorker, Project, SessionInfo } from '../types';
import { shortPath } from '../lib/paths';
import ProjectDetailView from './dashboard/ProjectDetailView';
import ManagerChat from './ManagerChat';
import { TasksView } from './TasksView';
import { relTime } from './TaskDetail';
import { EditIcon, PlusIcon } from './dashboard/icons';

interface Props {
  project: Project | null;
  projects: Project[];
  sessions: SessionInfo[];
  /** Incrementa a cada `manager_message`/`manager_busy` no WebSocket. */
  managerRefresh: number;
  tasksRefresh: number;
  onEditProject: (project: Project) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onPreviewFile: (path: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, patch: Partial<Project>) => Promise<void>;
  onRenameSession?: (id: string, name: string) => void;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`pw-chevron${open ? ' is-open' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Bloco colapsável de segundo plano. `defaultOpen` decide o que merece a atenção inicial. */
function Section({
  title, hint, badge, defaultOpen = false, children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useRef(`pw-sec-${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <section className={`pw-section${open ? ' is-open' : ''}`}>
      <button type="button" className="pw-section-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <ChevronIcon open={open} />
        <span className="pw-section-title">{title}</span>
        {badge && <span className="pw-section-badge">{badge}</span>}
        {hint && <span className="pw-section-hint">{hint}</span>}
      </button>
      {open && <div className="pw-section-body" id={id}>{children}</div>}
    </section>
  );
}

export default function ProjectWorkspace({
  project, projects, sessions, managerRefresh, tasksRefresh,
  onEditProject, onOpenProject, onSwitchSession, onPreviewFile,
  onRenameProject, onUpdateProject, onRenameSession, onCreateProjectSkill,
}: Props) {
  const [workers, setWorkers] = useState<PooledWorker[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // A pool só é conhecida pelo GET do chat — o ManagerChat entrega-a a quem a mostra (aqui).
  const handleWorkers = useCallback((list: PooledWorker[]) => setWorkers(list), []);

  const projectSessions = useMemo(
    () => (project ? sessions.filter((s) => s.projectId === project.id) : []),
    [project, sessions]
  );

  // Workers da pool primeiro (têm área e trabalho actual); a seguir as sessões do projecto que não
  // pertencem a nenhuma área — terminais abertos à mão, que continuam a ser acessíveis daqui.
  const pooledIds = useMemo(() => new Set(workers.map((w) => w.sessionId)), [workers]);
  const looseSessions = useMemo(
    () => projectSessions.filter((s) => !pooledIds.has(s.id)),
    [projectSessions, pooledIds]
  );
  const liveWorkers = useMemo(() => workers.filter((w) => w.status !== 'closed'), [workers]);
  const terminalCount = liveWorkers.length + looseSessions.length;

  const commitName = useCallback(() => {
    if (!project) return;
    const t = nameDraft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditingName(false);
  }, [project, nameDraft, onRenameProject]);

  if (!project) {
    return (
      <div className="dashboard-view project-workspace">
        <div className="vp-header">
          <div>
            <h1 className="vp-title">Projecto_</h1>
            <p className="vp-desc">Escolhe um projecto na barra lateral para falar com o gestor dele.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-view project-workspace">
      <div className="vp-header">
        <div className="pw-head-main">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="pw-name-input"
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
            <h1
              className="vp-title"
              onDoubleClick={() => {
                setNameDraft(project.name);
                setEditingName(true);
                setTimeout(() => nameInputRef.current?.focus(), 50);
              }}
              title={`${project.name} — duplo clique para renomear`}
              style={{ cursor: 'pointer' }}
            >
              {project.name}_
            </h1>
          )}
          <p className="vp-desc">
            {shortPath(project.path)}
            {project.hasCode ? ' · já tem código' : ' · projecto do zero'}
          </p>
          {project.description && <p className="pw-project-desc">{project.description}</p>}
        </div>
        <div className="header-actions">
          <button className="f-btn f-btn--secondary" type="button" onClick={() => onEditProject(project)}>
            <EditIcon /> Editar projecto
          </button>
          <button className="f-btn" type="button" onClick={() => onOpenProject(project)}>
            <PlusIcon /> {project.initialized ? 'Nova sessão' : 'Inicializar projecto'}
          </button>
        </div>
      </div>

      {/* ── O bloco principal: falar com o gestor ────────────────────────────── */}
      <ManagerChat
        key={project.id}
        projectId={project.id}
        projectName={project.name}
        refreshKey={managerRefresh}
        onWorkersChange={handleWorkers}
      />

      {/* ── O que está combinado: as tarefas deste projecto ──────────────────── */}
      <Section
        title="Tarefas deste projecto"
        hint="as que o gestor criou e as tuas — nenhuma arranca sozinha"
        defaultOpen
      >
        <TasksView refreshKey={tasksRefresh} projects={projects} projectId={project.id} />
      </Section>

      {/* ── As máquinas do gestor: segundo plano, fechado por defeito ────────── */}
      <Section
        title="Terminais e workers"
        hint="quem está a fazer o trabalho — normalmente não precisas de abrir"
        badge={terminalCount > 0 ? String(terminalCount) : undefined}
      >
        {terminalCount === 0 ? (
          <p className="tk-drawer-empty">Nenhum terminal aberto neste projecto. O gestor abre um quando precisar.</p>
        ) : (
          <ul className="pw-workers">
            {liveWorkers.map((w) => (
              <li key={w.sessionId}>
                <button type="button" className="pw-worker" onClick={() => onSwitchSession(w.sessionId)}>
                  <span className={`pw-worker-dot pw-worker-dot--${w.busy || w.status === 'working' ? 'working' : 'idle'}`} aria-hidden />
                  <span className="pw-worker-area">{w.area}</span>
                  <span className="pw-worker-job">{w.currentJob || (w.busy ? 'a trabalhar…' : 'à espera de trabalho')}</span>
                  <span className="pw-worker-time">{relTime(w.lastUsedAt)}</span>
                </button>
              </li>
            ))}
            {looseSessions.map((s) => (
              <li key={s.id}>
                <button type="button" className="pw-worker" onClick={() => onSwitchSession(s.id)}>
                  <span className={`pw-worker-dot pw-worker-dot--${s.status}`} aria-hidden />
                  <span className="pw-worker-area">{s.name}</span>
                  <span className="pw-worker-job">terminal aberto por ti</span>
                  <span className="pw-worker-time">{s.status === 'working' ? 'a trabalhar' : 'parado'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Detalhes técnicos: continuam todos aqui, mas fora do caminho ─────── */}
      <Section title="Detalhes do projecto" hint="toolkit exclusivo, git/GitHub e pasta">
        <ProjectDetailView
          embedded
          project={project}
          sessions={sessions}
          onEditProject={onEditProject}
          onOpenProject={onOpenProject}
          onSwitchSession={onSwitchSession}
          onPreviewFile={onPreviewFile}
          onRenameProject={onRenameProject}
          onUpdateProject={onUpdateProject}
          onRenameSession={onRenameSession}
          onCreateProjectSkill={onCreateProjectSkill}
        />
      </Section>
    </div>
  );
}
