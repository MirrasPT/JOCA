// AgentsView — todos os agentes/terminais numa vista só, fora de qualquer projecto.
//
// Até aqui os agentes só se viam dentro de um projecto (painel lateral do workspace) ou como
// separadores soltos na barra lateral: não havia sítio para "quero um agente já, para uma coisa
// avulsa" nem para ver de uma vez o que está a correr na máquina. Esta vista dá as duas coisas —
// abrir um agente novo (com ou sem projecto, no CLI que se quiser) e gerir os que existem.
//
// Reaproveita a linguagem visual das linhas de agente do workspace (.pw-worker*): mesmo ponto de
// estado, mesma animação de "a trabalhar", mesmas acções. É a mesma entidade, não vale um segundo
// vocabulário visual.
import { useEffect, useMemo, useState } from 'react';
import type { PooledWorker, Project, SessionInfo } from '../types';
import { shortPath } from '../lib/paths';
import InlineName from './InlineName';
import './agents-view.css';

interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  /** Abre o terminal do agente em ecrã cheio. */
  onOpenSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  /** Agente novo sem projecto; `cli` vazio = claude. */
  onNewSession: (cli: string) => void;
  /** Salta para o workspace do projecto (contexto completo: gestor, tarefas, pasta). */
  onOpenProject: (project: Project) => void;
  /** Renomear um agente (duplo-clique no nome). */
  onRenameSession?: (id: string, name: string) => void;
  /** Muda a cada evento de sessão/gestor — dispara o refetch da pool. */
  refreshKey: number;
}

const CLIS = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'agy', label: 'Antigravity' },
  { id: 'opencode', label: 'OpenCode' },
];

function OpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 7h10v10" /><path d="M7 17 17 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export default function AgentsView({ sessions, projects, onOpenSession, onCloseSession, onNewSession, onOpenProject, onRenameSession, refreshKey }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cli, setCli] = useState('claude');
  // O que cada agente está a fazer vive na pool do gestor, não na lista de sessões (que só sabe
  // nome e caminho — igual para todos os agentes do mesmo projecto, portanto inútil aqui).
  const [pool, setPool] = useState<PooledWorker[]>([]);

  useEffect(() => {
    let cancelado = false;
    fetch('/manager/workers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { workers: PooledWorker[] }) => { if (!cancelado) setPool(Array.isArray(d.workers) ? d.workers : []); })
      .catch(() => { if (!cancelado) setPool([]); });
    // Uma resposta lenta a chegar depois de um refetch mais recente reporia uma pool velha.
    return () => { cancelado = true; };
  }, [refreshKey, sessions.length]);

  const jobBySession = useMemo(() => {
    const m = new Map<string, PooledWorker>();
    for (const w of pool) m.set(w.sessionId, w);
    return m;
  }, [pool]);

  const byProject = useMemo(() => projects.map((p) => ({
    project: p,
    list: sessions.filter((s) => s.projectId === p.id),
  })).filter((g) => g.list.length > 0), [projects, sessions]);

  const loose = useMemo(
    () => sessions.filter((s) => !s.projectId || !projects.some((p) => p.id === s.projectId)),
    [sessions, projects]
  );
  const working = sessions.filter((s) => s.status === 'working').length;

  // A linha é `role="button"` e não `<button>` porque tem os botões de abrir/fechar como IRMÃOS
  // interactivos — botão dentro de botão é HTML inválido (o browser fecha o de fora cedo) e a AT
  // trata "controlo interactivo aninhado noutro" de forma inconsistente (axe-core: serious).
  const row = (s: SessionInfo) => {
    const confirming = confirmId === s.id;
    const w = jobBySession.get(s.id);
    // "à espera de trabalho" é informação: um worker da pool livre não é o mesmo que um terminal
    // que abri à mão e onde estou a escrever.
    const job = w ? (w.currentJob || (w.busy ? 'a trabalhar…' : 'à espera de trabalho')) : '';
    return (
      <li key={s.id}>
        <div
          role="button"
          tabIndex={0}
          className={`pw-worker${s.status === 'working' ? ' is-working' : ''}${confirming ? ' is-confirming' : ''}`}
          onClick={() => onOpenSession(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession(s.id); } }}
          title="Abrir este agente"
        >
          <span className={`pw-worker-dot pw-worker-dot--${s.status}`} aria-hidden />
          <InlineName
            value={s.name}
            onRename={onRenameSession ? (name) => onRenameSession(s.id, name) : undefined}
            className="pw-worker-area"
            inputClassName="pw-worker-name-input"
          />
          {confirming ? (
            <span className="pw-worker-confirm" onClick={(e) => e.stopPropagation()}>
              <span className="pw-worker-confirm-q">Fechar?</span>
              <button type="button" className="pw-worker-confirm-yes" onClick={(e) => { e.stopPropagation(); setConfirmId(null); onCloseSession(s.id); }}>Sim</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}>Não</button>
            </span>
          ) : (
            <>
              {w?.area && <span className="ag-area">{w.area}</span>}
              {s.cli && s.cli !== 'claude' && <span className="ag-cli">{s.cli}</span>}
              {s.origin === 'auto' && <span className="ag-origin" title="Aberto pelo gestor, não por ti">gestor</span>}
              <span className="pw-worker-job" title={job ? `${job}\n${s.cwd}` : s.cwd}>
                {job || shortPath(s.cwd)}
              </span>
              <span className="pw-worker-time">{s.status === 'working' ? 'a trabalhar' : 'parado'}</span>
              <button
                type="button"
                className="pw-worker-btn"
                title="Abrir em ecrã cheio"
                aria-label={`Abrir ${s.name}`}
                onClick={(e) => { e.stopPropagation(); onOpenSession(s.id); }}
              >
                <OpenIcon />
              </button>
              <button
                type="button"
                className="pw-worker-btn pw-worker-btn--close"
                title="Fechar este agente"
                aria-label={`Fechar ${s.name}`}
                onClick={(e) => { e.stopPropagation(); setConfirmId(s.id); }}
              >
                <CloseIcon />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="dashboard-view agents-view">
      <div className="vp-header">
        <div className="pw-head-main">
          <h1 className="vp-title">Agentes_</h1>
          <p className="vp-desc">
            Todos os terminais abertos na máquina — com ou sem projecto. Para trabalho avulso, abre um aqui.
          </p>
        </div>
        <div className="pw-head-stats">
          <span className="pw-head-stat">{sessions.length} aberto{sessions.length === 1 ? '' : 's'}</span>
          <span className="pw-head-stat">{working} a trabalhar</span>
        </div>
        <div className="header-actions ag-new">
          <select
            className="ag-cli-select"
            value={cli}
            onChange={(e) => setCli(e.target.value)}
            aria-label="CLI do agente novo"
            title="Que CLI corre neste agente"
          >
            {CLIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="f-btn" type="button" onClick={() => onNewSession(cli)}>
            + Novo agente
          </button>
        </div>
      </div>

      <div className="ag-body">
        {sessions.length === 0 && (
          <p className="tk-drawer-empty">
            Nenhum agente aberto. Abre um acima — sem projecto, para uma coisa avulsa — ou entra num projecto e pede ao gestor.
          </p>
        )}

        {loose.length > 0 && (
          <section className="ag-group">
            <div className="ag-group-head">
              <span className="section-title">Sem projecto</span>
              <span className="ag-group-count">{loose.length}</span>
            </div>
            <ul className="pw-workers">{loose.map(row)}</ul>
          </section>
        )}

        {byProject.map(({ project, list }) => (
          <section className="ag-group" key={project.id}>
            <div className="ag-group-head">
              <button type="button" className="ag-group-link" onClick={() => onOpenProject(project)} title="Abrir o workspace deste projecto">
                <span className="section-title">{project.name}</span>
              </button>
              <span className="ag-group-count">{list.length}</span>
            </div>
            <ul className="pw-workers">{list.map(row)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
