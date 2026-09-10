import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Project, ProjectIcon } from '../types';
import { shortPath, basename } from '../lib/paths';
import { PROJECT_COLORS } from '../lib/projectColor';
import { GithubIcon } from './dashboard/icons';
import ProjectToolkitModal from './ProjectToolkitModal';
import { ProjectIconField } from './SessionSidebar';
import './project-modal.css';

interface GitInfo {
  isRepository: boolean;
  remoteUrl?: string;
  branch?: string;
  statusSummary?: string;
  lastCommit?: string;
}

function parseGithubRepo(url?: string): string {
  if (!url) return '';
  const clean = url.trim().replace(/\.git$/, '');
  const match = clean.match(/(?:github\.com[:/])([^/]+\/[^/]+)$/);
  return match ? match[1] : '';
}

interface ProjectDraft {
  name: string;
  path: string;
  color: string;
  /** Project logo/emoji; `null` = no icon (the sidebar falls back to the first 2 letters). */
  icon: ProjectIcon | null;
  /** What the project is, in the user's own words — the project's permanent memory. */
  description: string;
  /** Does the folder already have code, or does the project start from scratch? */
  hasCode: boolean;
}

interface Props {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
  onUpdateProject?: (id: string, patch: Partial<Project>) => Promise<void>;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onRemoveProject?: (id: string) => void;
}

function normalizeColor(color: string) {
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : PROJECT_COLORS[0];
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="m10 9 3 3-3 3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function CreateProjectModal({
  open, project, onClose, onSaved, onUpdateProject, onCreateProjectSkill, onArchiveProject, onRemoveProject,
}: Props) {
  const [draft, setDraft] = useState<ProjectDraft>({ name: '', path: '', color: PROJECT_COLORS[0], icon: null, description: '', hasCode: false });
  // Only true after the user really touches a swatch/input — without this EVERY new project sent
  // the same orange by default (draft.color is already born with PROJECT_COLORS[0]), and the
  // hash-based color fallback in `projectColor()` never got to fire through the UI.
  const [colorTouched, setColorTouched] = useState(false);
  // NATIVE picker (Finder/Explorer) via the backend /pick-folder — the browser cannot give the
  // absolute path of a folder, the OS can. While the dialog is open, the button waits.
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Logos uploaded in this modal session. If the user closes without saving, no project points at
  // them and they would be orphaned on the server — they are deleted via `DELETE /icons/{nome}`.
  const pendingUploadsRef = useRef<string[]>([]);

  // ── Extra sections of edit mode (Git / Skills / Danger zone) ─────────────────────────────
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [githubRepoDraft, setGithubRepoDraft] = useState('');
  const [editingGithub, setEditingGithub] = useState(false);
  const [toolkitCounts, setToolkitCounts] = useState<{ skills: number; agents: number } | null>(null);
  const [toolkitModalOpen, setToolkitModalOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const cancelRemoveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmRemove) cancelRemoveRef.current?.focus();
  }, [confirmRemove]);

  useEffect(() => {
    if (!open || !project) { setGitInfo(null); setToolkitCounts(null); return; }
    fetch(`/projects/${project.id}/git`).then((r) => r.json()).then(setGitInfo).catch(() => setGitInfo(null));
    fetch(`/projects/${project.id}/toolkit`).then((r) => r.json())
      .then((d) => setToolkitCounts({ skills: d?.skills?.length || 0, agents: d?.agents?.length || 0 }))
      .catch(() => setToolkitCounts(null));
    setGithubRepoDraft(project.githubRepo || '');
    setEditingGithub(false);
    setConfirmRemove(false);
  }, [open, project]);

  const saveGithubRepo = useCallback(async () => {
    if (project && onUpdateProject) {
      await onUpdateProject(project.id, { githubRepo: githubRepoDraft.trim() || undefined });
      setEditingGithub(false);
    }
  }, [project, onUpdateProject, githubRepoDraft]);

  const isEditing = Boolean(project);
  const colorOptions = useMemo(() => (
    draft.color && !PROJECT_COLORS.includes(draft.color)
      ? [draft.color, ...PROJECT_COLORS]
      : PROJECT_COLORS
  ), [draft.color]);

  useEffect(() => {
    if (!open) return;
    setDraft({
      name: project?.name ?? '',
      path: project?.path ?? '',
      color: project?.color || PROJECT_COLORS[0],
      icon: project?.icon ?? null,
      description: project?.description ?? '',
      hasCode: Boolean(project?.hasCode),
    });
    pendingUploadsRef.current = [];
    setError('');
    setColorTouched(Boolean(project?.color));
  }, [open, project]);

  // Opens the native OS dialog and fills in the path automatically.
  const pickFolder = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    setError('');
    try {
      const res = await fetch('/pick-folder', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not open the folder picker');
      if (data.path) {
        setDraft((current) => ({ ...current, path: data.path }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPicking(false);
    }
  }, [picking]);

  // Real focus-trap: `aria-modal="true"` promises the rest of the document goes inert, but without
  // this Tab kept walking the sidebar behind the overlay (the same pattern already used in the
  // CommandPalette in App.tsx — reused here, not reinvented).
  // It uses its own ref (not `document.querySelector('.project-modal')`) — with the nested Skills
  // modal open on top, BOTH elements share that class and querySelector always caught the first
  // one (this one, the one underneath), trapping Tab here even with the top modal active.
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // A ref, not an effect dependency: `onClose` arrives as an inline arrow from the caller (a new
  // identity on every render) — putting it in the deps made the effect re-run on EVERY render while open.
  const handleClose = useCallback(() => {
    const applied = project?.icon?.type === 'image' ? project.icon.value : '';
    for (const filename of pendingUploadsRef.current) {
      if (filename !== applied) fetch(`/icons/${filename}`, { method: 'DELETE' }).catch(() => {});
    }
    pendingUploadsRef.current = [];
    onClose();
  }, [project, onClose]);

  const onCloseRef = useRef(handleClose);
  onCloseRef.current = handleClose;

  // Capture the opener + focus the 1st field only on the REAL open:false→true transition —
  // separate from the trap effect (which also depends on `toolkitModalOpen`) so that extra
  // dependency never rewrites `openerRef.current` mid-flight (otherwise, on closing the nested
  // Skills modal, this effect repeated and stored whatever was focused AT THAT instant — a button
  // inside it — instead of the original opener).
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const first = modal.querySelector<HTMLElement>('button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      first?.focus();
    });
    return () => {
      if (openerRef.current) { openerRef.current.focus(); openerRef.current = null; }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // The nested Skills modal has its own trap/Escape — while it is open, this one (the one
      // underneath) has to stay silent, otherwise the two fight over the same Tab/Escape.
      if (toolkitModalOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusables = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, toolkitModalOpen]);

  const canCreate = draft.path.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError('');
    const res = await fetch(project ? `/projects/${project.id}` : '/projects', {
      method: project ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim() || undefined,
        path: draft.path.trim(),
        // With no touch on the picker: it sends no color at all — the hash fallback (projectColor())
        // takes care of giving the project a distinct color as soon as it has an `id`, instead of
        // all of them falling into the same orange by default.
        color: colorTouched ? normalizeColor(draft.color) : undefined,
        // In the PATCH, `null` is what clears the icon. On creation nothing is sent when there is none.
        icon: draft.icon ?? (project ? null : undefined),
        // Always sent (even empty): in the PATCH this is how a description that no longer serves is deleted.
        description: draft.description.trim(),
        hasCode: draft.hasCode,
      }),
    });

    const data = await res.json().catch(() => ({ error: 'Error saving project' }));

    if (!res.ok) {
      setError(data.error || 'Error creating project');
      setSaving(false);
      return;
    }

    setSaving(false);
    // Saved: the logo is now in use — it is no longer an upload waiting to be applied.
    pendingUploadsRef.current = [];
    onSaved(data as Project);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="project-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
      <div ref={modalRef} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <div className="project-modal-header">
          <div>
            <span className="project-modal-kicker">{isEditing ? 'Settings' : 'New'}</span>
            <h2 id="project-modal-title">{isEditing ? 'Edit project' : 'Create project'}</h2>
          </div>
          <button className="project-modal-close" type="button" onClick={handleClose} aria-label="Close"><XIcon /></button>
        </div>

        {/* A single scroll. Before, the grid had its own `overflow:auto` and the edit block (Git,
            Kit, Danger zone) sat OUTSIDE it — two stacked scroll areas, the top one cutting the
            description in half with room to spare in the dialog. */}
        <div className="project-modal-body">
        <div className="project-modal-grid">
          <section className="project-modal-form" aria-label="Project details">
            <label className="project-field">
              <span>Name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={draft.path ? basename(draft.path) : 'My project'}
              />
            </label>

            <label className="project-field">
              <span>Folder</span>
              <div className="project-path-row">
                <input
                  value={draft.path}
                  onChange={(event) => setDraft((current) => ({ ...current, path: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
                  placeholder="~/projects/..."
                />
                <button
                  type="button"
                  className="project-pick-folder-btn"
                  onClick={pickFolder}
                  disabled={picking}
                  title="Open the file browser and choose the folder"
                >
                  <FolderIcon />
                  {picking ? 'Choosing…' : 'Browse'}
                </button>
              </div>
            </label>

            <label className="project-field">
              <span>Description — this is what this project's terminals will know about it</span>
              <textarea
                className="project-desc-input"
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="E.g.: the bakery's site, WordPress + WooCommerce. The orders page is missing and the copy needs improving. Audience: local customers."
              />
              <small className="project-field-hint">
                Optional, but worth it: the better you explain what it is and what you want,
                the fewer questions you get asked later.
              </small>
            </label>

            <div className="project-field">
              <span>Does it already have code?</span>
              <div className="project-hascode-row">
                <label className={`project-hascode-option ${!draft.hasCode ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="project-has-code"
                    checked={!draft.hasCode}
                    onChange={() => setDraft((current) => ({ ...current, hasCode: false }))}
                  />
                  <span>
                    <strong>Starts from scratch</strong>
                    <small>The folder is empty or only has notes and materials.</small>
                  </span>
                </label>
                <label className={`project-hascode-option ${draft.hasCode ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="project-has-code"
                    checked={draft.hasCode}
                    onChange={() => setDraft((current) => ({ ...current, hasCode: true }))}
                  />
                  <span>
                    <strong>Already has code</strong>
                    <small>There is a project running — the workers start by reading it.</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="project-field">
              <span>Color</span>
              <div className="project-color-row">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`project-color-dot ${colorTouched && draft.color === color ? 'active' : ''}`}
                    type="button"
                    style={{ '--project-color': color } as CSSProperties}
                    onClick={() => { setColorTouched(true); setDraft((current) => ({ ...current, color })); }}
                    aria-label={`Use the color ${color}`}
                  />
                ))}
              </div>
              <input
                className="project-color-custom"
                value={colorTouched ? draft.color : ''}
                onChange={(event) => { setColorTouched(true); setDraft((current) => ({ ...current, color: event.target.value })); }}
                placeholder={colorTouched ? '#ff4500' : 'Automatic (per project)'}
                aria-label="Custom color"
              />
            </div>

            <div className="project-field project-field--icon">
              <span>Project icon</span>
              <ProjectIconField
                icon={draft.icon ?? undefined}
                name={draft.name.trim() || basename(draft.path) || 'Project'}
                label="project"
                onChange={(icon) => {
                  if (icon?.type === 'image') pendingUploadsRef.current.push(icon.value);
                  setDraft((current) => ({ ...current, icon }));
                }}
              />
              <small className="project-field-hint">
                This is what shows in the sidebar when it is collapsed.
              </small>
            </div>

            <div className="project-modal-preview" style={{ '--project-color': draft.color } as CSSProperties}>
              <span className="project-preview-dot" />
              <div>
                <strong>{draft.name.trim() || basename(draft.path) || 'New project'}</strong>
                <small>{draft.path ? shortPath(draft.path) : 'Choose the folder — it is where the agents will work.'}</small>
              </div>
            </div>
          </section>

        </div>

        {isEditing && project && (
          <div className="project-modal-extra">
            <section className="project-field" aria-label="GitHub">
              <span>Git</span>
              {editingGithub ? (
                <div className="github-edit-row">
                  <input
                    type="text"
                    className="github-input"
                    value={githubRepoDraft}
                    onChange={(e) => setGithubRepoDraft(e.target.value)}
                    placeholder="username/repo"
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="f-btn f-btn--sm" type="button" onClick={saveGithubRepo}>Save</button>
                    <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setEditingGithub(false)}>Cancel</button>
                  </div>
                </div>
              ) : project.githubRepo ? (
                <div className="github-repo-link-wrap">
                  <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noopener noreferrer" className="github-link">
                    <GithubIcon />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.githubRepo}</span>
                  </a>
                  <button className="db-project-card-btn db-project-card-btn--ghost" style={{ padding: '2px 8px', height: '22px', fontSize: '11px', marginTop: '6px' }} onClick={() => setEditingGithub(true)}>Change</button>
                </div>
              ) : (
                <div className="project-row-item">
                  <div>
                    <strong>No repository linked</strong>
                    <small>Linking a repo gives branch and commit context.</small>
                  </div>
                  <div className="project-row-actions">
                    {gitInfo?.isRepository && gitInfo.remoteUrl && parseGithubRepo(gitInfo.remoteUrl) && (
                      <button
                        className="f-btn f-btn--sm"
                        type="button"
                        onClick={async () => {
                          const autoRepo = parseGithubRepo(gitInfo.remoteUrl);
                          if (autoRepo && onUpdateProject) await onUpdateProject(project.id, { githubRepo: autoRepo });
                        }}
                      >
                        Link {parseGithubRepo(gitInfo.remoteUrl)}
                      </button>
                    )}
                    <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setEditingGithub(true)}>Link by hand</button>
                  </div>
                </div>
              )}
              {gitInfo?.isRepository && (
                <div className="git-local-info">
                  <div className="git-local-title">Local Git</div>
                  <dl className="settings-cli-meta" style={{ margin: 0, fontSize: '11px' }}>
                    <dt style={{ color: 'var(--text-muted)' }}>Branch</dt>
                    <dd style={{ color: 'var(--text-bright)' }}>{gitInfo.branch || '…'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Commit</dt>
                    <dd style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={gitInfo.lastCommit}>{gitInfo.lastCommit || '…'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Status</dt>
                    <dd style={{ color: gitInfo.statusSummary ? 'var(--yellow)' : 'var(--green)' }}>
                      {gitInfo.statusSummary ? `${gitInfo.statusSummary.split('\n').length} files to commit` : 'Clean'}
                    </dd>
                  </dl>
                </div>
              )}
            </section>

            <section className="project-field" aria-label="Exclusive skills and agents">
              <span>Exclusive kit</span>
              <div className="project-row-item">
                <div>
                  <strong>
                    {toolkitCounts ? `${toolkitCounts.skills} skill${toolkitCounts.skills === 1 ? '' : 's'} · ${toolkitCounts.agents} agent${toolkitCounts.agents === 1 ? '' : 's'}` : '…'}
                  </strong>
                  <small>Skills and agents that only exist in this project.</small>
                </div>
                <div className="project-row-actions">
                  <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setToolkitModalOpen(true)}>Manage</button>
                </div>
              </div>
            </section>

            {(onArchiveProject || onRemoveProject) && (
              // Archive and remove read like any other button in the dialog. Here they get their
              // own block, a red tone and a line saying what each one does — the difference has to
              // be visible BEFORE the click, not after.
              <section className="project-danger" aria-label="Danger zone">
                <span className="project-danger-title">Danger zone</span>
                <div className="project-danger-row">
                  {onArchiveProject && (
                    <div className="project-danger-item">
                      <div>
                        <strong>{project.archived ? 'Restore project' : 'Archive project'}</strong>
                        <small>{project.archived ? 'It shows up in the sidebar again.' : 'It leaves the sidebar. Nothing is lost — it can be restored.'}</small>
                      </div>
                      <button className="project-danger-btn" type="button" onClick={() => onArchiveProject(project.id, !project.archived)}>
                        {project.archived ? 'Restore' : 'Archive'}
                      </button>
                    </div>
                  )}
                  {onRemoveProject && (
                    <div className="project-danger-item">
                      <div>
                        <strong>Remove project</strong>
                        <small>Deletes it from JOCA (conversation included). The files in the folder stay.</small>
                      </div>
                      {confirmRemove ? (
                        <div role="alert" className="project-danger-confirm">
                          <span>Are you sure?</span>
                          <button className="project-danger-btn project-danger-btn--go" type="button" onClick={() => { onRemoveProject(project.id); handleClose(); }}>Remove</button>
                          <button ref={cancelRemoveRef} className="project-danger-btn" type="button" onClick={() => setConfirmRemove(false)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="project-danger-btn" type="button" onClick={() => setConfirmRemove(true)}>Remove</button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
        </div>

        {error && <div className="project-modal-error">{error}</div>}

        <div className="project-modal-actions">
          <button type="button" className="project-modal-secondary" onClick={handleClose}>Cancel</button>
          <button type="button" className="project-modal-primary" onClick={submit} disabled={!canCreate}>
            {saving ? 'Saving…' : isEditing ? 'Save' : 'Create project'}
          </button>
        </div>
      </div>

      {isEditing && project && (
        <ProjectToolkitModal
          open={toolkitModalOpen}
          project={project}
          onClose={() => setToolkitModalOpen(false)}
          onCreateProjectSkill={onCreateProjectSkill}
        />
      )}
    </div>
  );
}
