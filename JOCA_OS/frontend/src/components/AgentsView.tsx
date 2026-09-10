// AgentsView — every agent/terminal in a single view, outside any project.
//
// Until now agents were only visible inside a project (the workspace side panel) or as loose tabs
// in the sidebar: there was no place for "I want an agent right now, for a one-off thing" nor to
// see at a glance what is running on the machine. This view gives both — opening a new agent (with
// or without a project, on whichever CLI you want) and managing the ones that exist.
//
// It reuses the visual language of the workspace agent rows (.pw-worker*): same status dot, same
// "working" animation, same actions. It is the same entity, it does not deserve a second visual
// vocabulary.
import { useEffect, useMemo, useState } from 'react';
import type { CliProfileInfo, Project, SessionInfo } from '../types';
import { shortPath } from '../lib/paths';
import InlineName from './InlineName';
import './agents-view.css';

interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  /** Opens the agent's terminal in full screen. */
  onOpenSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  /** New agent without a project; empty `cli` = claude. */
  onNewSession: (cli: string) => void;
  /** Jumps to the project workspace (terminals). */
  onOpenProject: (project: Project) => void;
  /** Rename an agent (double-click on the name). */
  onRenameSession?: (id: string, name: string) => void;
}

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

export default function AgentsView({ sessions, projects, onOpenSession, onCloseSession, onNewSession, onOpenProject, onRenameSession }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cli, setCli] = useState('claude');
  // Single source for "which CLIs exist" — it respects `available` (installed or not), instead of
  // a fixed list that includes CLIs the machine does not even have.
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[]>([]);
  useEffect(() => {
    fetch('/cli-profiles').then((r) => r.json())
      .then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : []))
      .catch(() => setCliProfiles([]));
  }, []);
  const byProject = useMemo(() => projects.map((p) => ({
    project: p,
    list: sessions.filter((s) => s.projectId === p.id),
  })).filter((g) => g.list.length > 0), [projects, sessions]);

  const loose = useMemo(
    () => sessions.filter((s) => !s.projectId || !projects.some((p) => p.id === s.projectId)),
    [sessions, projects]
  );
  const working = sessions.filter((s) => s.status === 'working').length;

  // The row is `role="button"` and not `<button>` because it has the open/close buttons as
  // interactive SIBLINGS — a button inside a button is invalid HTML (the browser closes the outer
  // one early) and AT handles "interactive control nested in another" inconsistently (axe-core: serious).
  const row = (s: SessionInfo) => {
    const confirming = confirmId === s.id;
    return (
      <li key={s.id}>
        <div
          role="button"
          tabIndex={0}
          className={`pw-worker${s.status === 'working' ? ' is-working' : ''}${confirming ? ' is-confirming' : ''}`}
          onClick={() => onOpenSession(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession(s.id); } }}
          title="Open this agent"
        >
          <span className={`pw-worker-dot pw-worker-dot--${s.status}`} aria-hidden />
          <InlineName
            value={s.name}
            onRename={onRenameSession ? (name) => onRenameSession(s.id, name) : undefined}
            onActivate={() => onOpenSession(s.id)}
            className="pw-worker-area"
            inputClassName="pw-worker-name-input"
          />
          {confirming ? (
            <span className="pw-worker-confirm" onClick={(e) => e.stopPropagation()}>
              <span className="pw-worker-confirm-q">Close?</span>
              <button type="button" className="pw-worker-confirm-yes" onClick={(e) => { e.stopPropagation(); setConfirmId(null); onCloseSession(s.id); }}>Yes</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}>No</button>
            </span>
          ) : (
            <>
              {s.cli && s.cli !== 'claude' && <span className="ag-cli">{s.cli}</span>}
              <span className="pw-worker-job" title={s.cwd}>{shortPath(s.cwd)}</span>
              <span className="pw-worker-time">{s.status === 'working' ? 'working' : 'idle'}</span>
              <button
                type="button"
                className="pw-worker-btn"
                title="Open in full screen"
                aria-label={`Open ${s.name}`}
                onClick={(e) => { e.stopPropagation(); onOpenSession(s.id); }}
              >
                <OpenIcon />
              </button>
              <button
                type="button"
                className="pw-worker-btn pw-worker-btn--close"
                title="Close this agent"
                aria-label={`Close ${s.name}`}
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
          <h1 className="vp-title">Agents_</h1>
          <p className="vp-desc">
            Every terminal open on the machine — with or without a project. For one-off work, open one here.
          </p>
        </div>
        <div className="pw-head-stats">
          <span className="pw-head-stat">{sessions.length} open</span>
          <span className="pw-head-stat">{working} working</span>
        </div>
        <div className="header-actions ag-new">
          <select
            className="ag-cli-select"
            value={cli}
            onChange={(e) => setCli(e.target.value)}
            aria-label="CLI for the new agent"
            title="Which CLI runs in this agent"
          >
            {cliProfiles.filter((p) => p.available).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="f-btn" type="button" onClick={() => onNewSession(cli)}>
            + New agent
          </button>
        </div>
      </div>

      <div className="ag-body">
        {sessions.length === 0 && (
          <p className="tk-drawer-empty">
            No agent open. Open one above — without a project, for a one-off thing — or go into a project and open a terminal there.
          </p>
        )}

        {loose.length > 0 && (
          <section className="ag-group">
            <div className="ag-group-head">
              <span className="section-title">No project</span>
              <span className="ag-group-count">{loose.length}</span>
            </div>
            <ul className="pw-workers">{loose.map(row)}</ul>
          </section>
        )}

        {byProject.map(({ project, list }) => (
          <section className="ag-group" key={project.id}>
            <div className="ag-group-head">
              <button type="button" className="ag-group-link" onClick={() => onOpenProject(project)} title="Open this project's workspace">
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
