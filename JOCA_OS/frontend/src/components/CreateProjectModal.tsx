import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Project } from '../types';
import { shortPath, basename } from '../lib/paths';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface FileListResponse {
  path: string;
  parent: string;
  entries: FileEntry[];
}

interface ProjectDraft {
  name: string;
  path: string;
  color: string;
}

interface Props {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

const PROJECT_COLORS = [
  '#ff4500', '#ff7a1a', '#f2c94c', '#58d879',
  '#25c2a0', '#6da8ff', '#3a7cff', '#a98cff',
  '#d779ff', '#ff6b9a', '#ef4444', '#94a3b8',
  '#f97316', '#84cc16', '#14b8a6', '#0ea5e9',
  '#8b5cf6', '#ec4899',
];

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

export default function CreateProjectModal({ open, project, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ProjectDraft>({ name: '', path: '', color: PROJECT_COLORS[0] });
  const [browserPath, setBrowserPath] = useState('');
  const [fileList, setFileList] = useState<FileListResponse | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visibleDirs = useMemo(() => fileList?.entries.filter((entry) => entry.isDir) ?? [], [fileList]);
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
    });
    setBrowserPath(project?.path ?? '');
    setFileList(null);
    setError('');
  }, [open, project]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (browserPath) params.set('path', browserPath);
    if (showHidden) params.set('hidden', 'true');

    fetch(`/files?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not read folder');
        return data as FileListResponse;
      })
      .then((data) => {
        setFileList(data);
        setBrowserPath(data.path);
        setDraft((current) => current.path ? current : { ...current, path: data.path });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || String(err));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [browserPath, open, showHidden]);

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
        color: normalizeColor(draft.color),
      }),
    });

    const data = await res.json().catch(() => ({ error: 'Erro ao guardar projecto' }));

    if (!res.ok) {
      setError(data.error || 'Erro ao criar projecto');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved(data as Project);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="project-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <div className="project-modal-header">
          <div>
            <span className="project-modal-kicker">{isEditing ? 'Workspace settings' : 'New workspace'}</span>
            <h2 id="project-modal-title">{isEditing ? 'Edit Project' : 'Create Project'}</h2>
          </div>
          <button className="project-modal-close" type="button" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="project-modal-grid">
          <section className="project-modal-form" aria-label="Project details">
            <label className="project-field">
              <span>Name</span>
              <input
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={draft.path ? basename(draft.path) : 'My Project'}
              />
            </label>

            <label className="project-field">
              <span>Folder</span>
              <input
                value={draft.path}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, path: event.target.value }));
                  setBrowserPath(event.target.value);
                }}
                onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
                placeholder="~/projects/..."
              />
            </label>

            <div className="project-field">
              <span>Project color</span>
              <div className="project-color-row">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`project-color-dot ${draft.color === color ? 'active' : ''}`}
                    type="button"
                    style={{ '--project-color': color } as CSSProperties}
                    onClick={() => setDraft((current) => ({ ...current, color }))}
                    aria-label={`Use color ${color}`}
                  />
                ))}
              </div>
              <input
                className="project-color-custom"
                value={draft.color}
                onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                placeholder="#ff4500"
                aria-label="Custom project color"
              />
            </div>

            <div className="project-modal-preview" style={{ '--project-color': draft.color } as CSSProperties}>
              <span className="project-preview-dot" />
              <div>
                <strong>{draft.name.trim() || basename(draft.path) || 'New Project'}</strong>
                <small>{draft.path ? shortPath(draft.path) : 'Choose a folder to attach real files and sessions.'}</small>
              </div>
            </div>
          </section>

          <section className="project-folder-browser" aria-label="Folder browser">
            <div className="project-browser-toolbar">
              <button type="button" onClick={() => fileList?.parent && setBrowserPath(fileList.parent)}>Up</button>
              <button type="button" onClick={() => setBrowserPath('')}>Home</button>
              <button type="button" onClick={() => fileList && setDraft((current) => ({ ...current, path: fileList.path }))}>
                Use current
              </button>
              <label className="project-hidden-toggle">
                <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
                dotfiles
              </label>
            </div>

            <div className="project-browser-path">{fileList ? shortPath(fileList.path) : 'Loading home...'}</div>

            <div className="project-browser-list">
              {loading && <div className="project-browser-empty">Loading folders...</div>}
              {!loading && visibleDirs.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={`project-browser-row ${draft.path === entry.path ? 'active' : ''}`}
                  onClick={() => {
                    setBrowserPath(entry.path);
                    setDraft((current) => ({ ...current, path: entry.path }));
                  }}
                >
                  <span><FolderIcon /></span>
                  <strong>{entry.name}</strong>
                </button>
              ))}
              {!loading && visibleDirs.length === 0 && <div className="project-browser-empty">No folders here</div>}
            </div>
          </section>
        </div>

        {error && <div className="project-modal-error">{error}</div>}

        <div className="project-modal-actions">
          <button type="button" className="project-modal-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="project-modal-primary" onClick={submit} disabled={!canCreate}>
            {saving ? 'Saving...' : isEditing ? 'Save Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
