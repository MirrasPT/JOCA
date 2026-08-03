import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Project } from '../types';
import { shortPath, basename } from '../lib/paths';
import { PROJECT_COLORS } from '../lib/projectColor';
import { GithubIcon } from './dashboard/icons';
import ProjectToolkitModal from './ProjectToolkitModal';

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
  /** O que o projecto é, por palavras do utilizador — é a memória permanente do gestor. */
  description: string;
  /** A pasta já tem código, ou o projecto começa do zero? Muda a forma como o gestor arranca. */
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
  const [draft, setDraft] = useState<ProjectDraft>({ name: '', path: '', color: PROJECT_COLORS[0], description: '', hasCode: false });
  // Só true depois do utilizador tocar mesmo num swatch/input — sem isto TODOS os projectos
  // novos enviavam o mesmo laranja por omissão (draft.color já nasce com PROJECT_COLORS[0]),
  // e o fallback de cor por hash em `projectColor()` nunca chegava a disparar via UI.
  const [colorTouched, setColorTouched] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [fileList, setFileList] = useState<FileListResponse | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Secções extra do modo edição (Git / Skills / Zona perigosa) ──────────────────────────
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
      description: project?.description ?? '',
      hasCode: Boolean(project?.hasCode),
    });
    setBrowserPath(project?.path ?? '');
    setFileList(null);
    setError('');
    setColorTouched(Boolean(project?.color));
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

  // Focus-trap real: `aria-modal="true"` promete que o resto do documento fica inerte, mas sem
  // isto o Tab continuava a percorrer a sidebar por trás do overlay (mesmo padrão já usado no
  // CommandPalette em App.tsx — reaproveitado aqui, não reinventado).
  // Usa uma ref própria (não `document.querySelector('.project-modal')`) — com o modal de Skills
  // aninhado aberto por cima, os DOIS elementos partilham essa classe e o querySelector apanhava
  // sempre o primeiro (este, o de baixo), prendendo o Tab aqui mesmo com o modal de cima activo.
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Ref, não dependência do efeito: `onClose` chega como arrow inline do caller (identidade nova a
  // cada render) — pô-la nas deps fazia o efeito re-executar em CADA render enquanto aberto.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Capturar o opener + focar o 1º campo só na transição REAL open:false→true — separado do efeito
  // do trap (que também depende de `toolkitModalOpen`) para essa dependência extra nunca reescrever
  // `openerRef.current` a meio (senão, ao fechar o modal de Skills aninhado, este efeito repetia e
  // gravava o que estava focado NAQUELE instante — um botão lá dentro — em vez do opener original).
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
      // O modal de Skills aninhado tem o seu próprio trap/Escape — enquanto está aberto, este
      // (o de baixo) tem de ficar em silêncio, senão os dois disputam o mesmo Tab/Escape.
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
        // Sem toque no picker: não manda cor nenhuma — o fallback por hash (projectColor()) trata
        // de dar uma cor distinta ao projecto assim que tiver `id`, em vez de todos caírem no
        // mesmo laranja por omissão.
        color: colorTouched ? normalizeColor(draft.color) : undefined,
        // Vai sempre (mesmo vazia): no PATCH é assim que se apaga uma descrição que já não serve.
        description: draft.description.trim(),
        hasCode: draft.hasCode,
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
      <div ref={modalRef} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
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

            <label className="project-field">
              <span>Descrição — é isto que o gestor vai saber sobre o projecto</span>
              <textarea
                className="project-desc-input"
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Ex.: site da pastelaria, WordPress + WooCommerce. Falta a página de encomendas e melhorar os textos. Público: clientes locais."
              />
              <small className="project-field-hint">
                Opcional, mas vale a pena: quanto melhor explicares o que é e o que queres,
                menos perguntas o gestor te faz depois.
              </small>
            </label>

            <div className="project-field">
              <span>Já tem código?</span>
              <div className="project-hascode-row">
                <label className={`project-hascode-option ${!draft.hasCode ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="project-has-code"
                    checked={!draft.hasCode}
                    onChange={() => setDraft((current) => ({ ...current, hasCode: false }))}
                  />
                  <span>
                    <strong>Começa do zero</strong>
                    <small>A pasta está vazia ou só tem notas e materiais.</small>
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
                    <strong>Já tem código</strong>
                    <small>Existe um projecto a correr — os workers começam por o ler.</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="project-field">
              <span>Project color</span>
              <div className="project-color-row">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`project-color-dot ${colorTouched && draft.color === color ? 'active' : ''}`}
                    type="button"
                    style={{ '--project-color': color } as CSSProperties}
                    onClick={() => { setColorTouched(true); setDraft((current) => ({ ...current, color })); }}
                    aria-label={`Use color ${color}`}
                  />
                ))}
              </div>
              <input
                className="project-color-custom"
                value={colorTouched ? draft.color : ''}
                onChange={(event) => { setColorTouched(true); setDraft((current) => ({ ...current, color: event.target.value })); }}
                placeholder={colorTouched ? '#ff4500' : 'Automática (por projecto)'}
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
                    <button className="f-btn f-btn--sm" type="button" onClick={saveGithubRepo}>Guardar</button>
                    <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setEditingGithub(false)}>Cancelar</button>
                  </div>
                </div>
              ) : project.githubRepo ? (
                <div className="github-repo-link-wrap">
                  <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noopener noreferrer" className="github-link">
                    <GithubIcon />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.githubRepo}</span>
                  </a>
                  <button className="db-project-card-btn db-project-card-btn--ghost" style={{ padding: '2px 8px', height: '22px', fontSize: '11px', marginTop: '6px' }} onClick={() => setEditingGithub(true)}>Edit Link</button>
                </div>
              ) : (
                <div className="github-no-link">
                  <p className="memory-empty-text">Sem repositório GitHub associado.</p>
                  {gitInfo?.isRepository && gitInfo.remoteUrl && parseGithubRepo(gitInfo.remoteUrl) && (
                    <button
                      className="db-project-card-btn"
                      style={{ margin: '8px 0', fontSize: '11px', padding: '6px 10px', width: '100%' }}
                      onClick={async () => {
                        const autoRepo = parseGithubRepo(gitInfo.remoteUrl);
                        if (autoRepo && onUpdateProject) await onUpdateProject(project.id, { githubRepo: autoRepo });
                      }}
                    >
                      Connect: {parseGithubRepo(gitInfo.remoteUrl)}
                    </button>
                  )}
                  <button className="db-project-card-btn db-project-card-btn--ghost" style={{ fontSize: '11px', padding: '4px 8px', width: '100%', marginTop: '4px' }} onClick={() => setEditingGithub(true)}>Add GitHub Link</button>
                </div>
              )}
              {gitInfo?.isRepository && (
                <div className="git-local-info">
                  <div className="git-local-title">Local Git Status</div>
                  <dl className="settings-cli-meta" style={{ margin: 0, fontSize: '11px' }}>
                    <dt style={{ color: 'var(--text-muted)' }}>Branch</dt>
                    <dd style={{ color: 'var(--text-bright)' }}>{gitInfo.branch || '...'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Commit</dt>
                    <dd style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={gitInfo.lastCommit}>{gitInfo.lastCommit || '...'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Status</dt>
                    <dd style={{ color: gitInfo.statusSummary ? 'var(--yellow)' : 'var(--green)' }}>
                      {gitInfo.statusSummary ? `${gitInfo.statusSummary.split('\n').length} files modified` : 'Clean'}
                    </dd>
                  </dl>
                </div>
              )}
            </section>

            <section className="project-field" aria-label="Skills e agentes exclusivos">
              <span>Kit exclusivo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="memory-empty-text" style={{ margin: 0 }}>
                  {toolkitCounts ? `${toolkitCounts.skills} skill${toolkitCounts.skills === 1 ? '' : 's'} · ${toolkitCounts.agents} agente${toolkitCounts.agents === 1 ? '' : 's'}` : '...'}
                </span>
                <button className="f-btn f-btn--secondary f-btn--sm" type="button" onClick={() => setToolkitModalOpen(true)}>Gerir Skills →</button>
              </div>
            </section>

            {(onArchiveProject || onRemoveProject) && (
              <section className="project-field" aria-label="Zona perigosa">
                <span>Zona perigosa</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {onArchiveProject && (
                    <button className="f-btn f-btn--secondary f-btn--sm" type="button" onClick={() => onArchiveProject(project.id, !project.archived)}>
                      {project.archived ? 'Restaurar projecto' : 'Arquivar projecto'}
                    </button>
                  )}
                  {onRemoveProject && (
                    confirmRemove ? (
                      <div role="alert" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Remover definitivamente?</span>
                        <button className="f-btn f-btn--sm" type="button" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }} onClick={() => { onRemoveProject(project.id); onClose(); }}>Confirmar</button>
                        <button ref={cancelRemoveRef} className="f-btn f-btn--secondary f-btn--sm" type="button" onClick={() => setConfirmRemove(false)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="f-btn f-btn--secondary f-btn--sm" type="button" onClick={() => setConfirmRemove(true)}>Remover projecto</button>
                    )
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {error && <div className="project-modal-error">{error}</div>}

        <div className="project-modal-actions">
          <button type="button" className="project-modal-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="project-modal-primary" onClick={submit} disabled={!canCreate}>
            {saving ? 'Saving...' : isEditing ? 'Save Project' : 'Create Project'}
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
