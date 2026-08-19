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
  /** Logótipo/emoji do projecto; `null` = sem ícone (a barra lateral cai nas 2 primeiras letras). */
  icon: ProjectIcon | null;
  /** O que o projecto é, por palavras do utilizador — memória permanente do projecto. */
  description: string;
  /** A pasta já tem código, ou o projecto começa do zero? */
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
  // Só true depois do utilizador tocar mesmo num swatch/input — sem isto TODOS os projectos
  // novos enviavam o mesmo laranja por omissão (draft.color já nasce com PROJECT_COLORS[0]),
  // e o fallback de cor por hash em `projectColor()` nunca chegava a disparar via UI.
  const [colorTouched, setColorTouched] = useState(false);
  // Picker NATIVO (Finder/Explorer) via backend /pick-folder — o browser não consegue dar o
  // caminho absoluto de uma pasta, o SO consegue. Enquanto o diálogo está aberto, o botão espera.
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Logótipos carregados nesta sessão do modal. Se o utilizador fechar sem gravar, nenhum projecto
  // os aponta e ficariam órfãos no servidor — apagam-se via `DELETE /icons/{nome}`.
  const pendingUploadsRef = useRef<string[]>([]);

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

  // Abre o diálogo nativo do SO e preenche o caminho automaticamente.
  const pickFolder = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    setError('');
    try {
      const res = await fetch('/pick-folder', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir o selector de pastas');
      if (data.path) {
        setDraft((current) => ({ ...current, path: data.path }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPicking(false);
    }
  }, [picking]);

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
        // No PATCH, `null` é o que limpa o ícone. Na criação não se manda nada quando não há.
        icon: draft.icon ?? (project ? null : undefined),
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
    // Gravado: o logótipo passou a estar em uso — já não é um upload por aplicar.
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
            <span className="project-modal-kicker">{isEditing ? 'Definições' : 'Novo'}</span>
            <h2 id="project-modal-title">{isEditing ? 'Editar projecto' : 'Criar projecto'}</h2>
          </div>
          <button className="project-modal-close" type="button" onClick={handleClose} aria-label="Fechar"><XIcon /></button>
        </div>

        {/* Um scroll só. Antes a grelha tinha `overflow:auto` própria e o bloco de edição (Git,
            Kit, Zona perigosa) ficava FORA dela — duas áreas de scroll empilhadas, a de cima a
            cortar a descrição a meio com espaço de sobra no diálogo. */}
        <div className="project-modal-body">
        <div className="project-modal-grid">
          <section className="project-modal-form" aria-label="Detalhes do projecto">
            <label className="project-field">
              <span>Nome</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={draft.path ? basename(draft.path) : 'O meu projecto'}
              />
            </label>

            <label className="project-field">
              <span>Pasta</span>
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
                  title="Abrir o explorador de ficheiros e escolher a pasta"
                >
                  <FolderIcon />
                  {picking ? 'A escolher…' : 'Procurar'}
                </button>
              </div>
            </label>

            <label className="project-field">
              <span>Descrição — é isto que os terminais deste projecto vão saber sobre ele</span>
              <textarea
                className="project-desc-input"
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Ex.: site da pastelaria, WordPress + WooCommerce. Falta a página de encomendas e melhorar os textos. Público: clientes locais."
              />
              <small className="project-field-hint">
                Opcional, mas vale a pena: quanto melhor explicares o que é e o que queres,
                menos perguntas te fazem depois.
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
              <span>Cor</span>
              <div className="project-color-row">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`project-color-dot ${colorTouched && draft.color === color ? 'active' : ''}`}
                    type="button"
                    style={{ '--project-color': color } as CSSProperties}
                    onClick={() => { setColorTouched(true); setDraft((current) => ({ ...current, color })); }}
                    aria-label={`Usar a cor ${color}`}
                  />
                ))}
              </div>
              <input
                className="project-color-custom"
                value={colorTouched ? draft.color : ''}
                onChange={(event) => { setColorTouched(true); setDraft((current) => ({ ...current, color: event.target.value })); }}
                placeholder={colorTouched ? '#ff4500' : 'Automática (por projecto)'}
                aria-label="Cor personalizada"
              />
            </div>

            <div className="project-field project-field--icon">
              <span>Ícone do projecto</span>
              <ProjectIconField
                icon={draft.icon ?? undefined}
                name={draft.name.trim() || basename(draft.path) || 'Projecto'}
                label="projecto"
                onChange={(icon) => {
                  if (icon?.type === 'image') pendingUploadsRef.current.push(icon.value);
                  setDraft((current) => ({ ...current, icon }));
                }}
              />
              <small className="project-field-hint">
                É isto que aparece na barra lateral quando está fechada.
              </small>
            </div>

            <div className="project-modal-preview" style={{ '--project-color': draft.color } as CSSProperties}>
              <span className="project-preview-dot" />
              <div>
                <strong>{draft.name.trim() || basename(draft.path) || 'Projecto novo'}</strong>
                <small>{draft.path ? shortPath(draft.path) : 'Escolhe a pasta — é onde os agentes vão trabalhar.'}</small>
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
                  <button className="db-project-card-btn db-project-card-btn--ghost" style={{ padding: '2px 8px', height: '22px', fontSize: '11px', marginTop: '6px' }} onClick={() => setEditingGithub(true)}>Mudar</button>
                </div>
              ) : (
                <div className="project-row-item">
                  <div>
                    <strong>Sem repositório associado</strong>
                    <small>Ligar um repo dá contexto de ramos e commits.</small>
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
                        Ligar {parseGithubRepo(gitInfo.remoteUrl)}
                      </button>
                    )}
                    <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setEditingGithub(true)}>Ligar à mão</button>
                  </div>
                </div>
              )}
              {gitInfo?.isRepository && (
                <div className="git-local-info">
                  <div className="git-local-title">Git local</div>
                  <dl className="settings-cli-meta" style={{ margin: 0, fontSize: '11px' }}>
                    <dt style={{ color: 'var(--text-muted)' }}>Ramo</dt>
                    <dd style={{ color: 'var(--text-bright)' }}>{gitInfo.branch || '…'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Commit</dt>
                    <dd style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={gitInfo.lastCommit}>{gitInfo.lastCommit || '…'}</dd>
                    <dt style={{ color: 'var(--text-muted)' }}>Estado</dt>
                    <dd style={{ color: gitInfo.statusSummary ? 'var(--yellow)' : 'var(--green)' }}>
                      {gitInfo.statusSummary ? `${gitInfo.statusSummary.split('\n').length} ficheiros por commitar` : 'Limpo'}
                    </dd>
                  </dl>
                </div>
              )}
            </section>

            <section className="project-field" aria-label="Skills e agentes exclusivos">
              <span>Kit exclusivo</span>
              <div className="project-row-item">
                <div>
                  <strong>
                    {toolkitCounts ? `${toolkitCounts.skills} skill${toolkitCounts.skills === 1 ? '' : 's'} · ${toolkitCounts.agents} agente${toolkitCounts.agents === 1 ? '' : 's'}` : '…'}
                  </strong>
                  <small>Skills e agentes que só existem neste projecto.</small>
                </div>
                <div className="project-row-actions">
                  <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setToolkitModalOpen(true)}>Gerir</button>
                </div>
              </div>
            </section>

            {(onArchiveProject || onRemoveProject) && (
              // Arquivar e remover liam-se como qualquer outro botão do diálogo. Aqui ganham bloco
              // próprio, tom vermelho e uma linha a dizer o que cada um faz — a diferença tem de
              // ser visível ANTES do clique, não depois.
              <section className="project-danger" aria-label="Zona perigosa">
                <span className="project-danger-title">Zona perigosa</span>
                <div className="project-danger-row">
                  {onArchiveProject && (
                    <div className="project-danger-item">
                      <div>
                        <strong>{project.archived ? 'Restaurar projecto' : 'Arquivar projecto'}</strong>
                        <small>{project.archived ? 'Volta a aparecer na barra lateral.' : 'Sai da barra lateral. Nada se perde — dá para restaurar.'}</small>
                      </div>
                      <button className="project-danger-btn" type="button" onClick={() => onArchiveProject(project.id, !project.archived)}>
                        {project.archived ? 'Restaurar' : 'Arquivar'}
                      </button>
                    </div>
                  )}
                  {onRemoveProject && (
                    <div className="project-danger-item">
                      <div>
                        <strong>Remover projecto</strong>
                        <small>Apaga-o do JOCA (conversa incluída). Os ficheiros na pasta ficam.</small>
                      </div>
                      {confirmRemove ? (
                        <div role="alert" className="project-danger-confirm">
                          <span>De certeza?</span>
                          <button className="project-danger-btn project-danger-btn--go" type="button" onClick={() => { onRemoveProject(project.id); handleClose(); }}>Remover</button>
                          <button ref={cancelRemoveRef} className="project-danger-btn" type="button" onClick={() => setConfirmRemove(false)}>Cancelar</button>
                        </div>
                      ) : (
                        <button className="project-danger-btn" type="button" onClick={() => setConfirmRemove(true)}>Remover</button>
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
          <button type="button" className="project-modal-secondary" onClick={handleClose}>Cancelar</button>
          <button type="button" className="project-modal-primary" onClick={submit} disabled={!canCreate}>
            {saving ? 'A guardar…' : isEditing ? 'Guardar' : 'Criar projecto'}
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
