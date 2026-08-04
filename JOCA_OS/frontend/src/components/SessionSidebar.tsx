import { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MainView, SessionInfo, Project, ProjectIcon, ProjectGroup as ProjectGroupData } from '../types';
import { iconInitials, projectIconUrl } from '../types';
import { projectColor } from '../lib/projectColor';



interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  projectGroups: ProjectGroupData[];
  /** O tipo vem de `types.ts` — repetir a união aqui fazia-a divergir (foi assim que `'agents'`
   *  passou a existir em todo o lado menos na barra que o tem de marcar como activo). */
  mainView: MainView;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onShowDashboard: () => void;
  onShowAutomations: () => void;
  onShowTasks: () => void;
  onShowJoca: () => void;
  /** Vista global de agentes (todos os projectos num sítio só). */
  onShowAgents: () => void;
  onShowProject: (projectId: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onOpenProject: (p: Project) => void;
  onCreateProject: () => void;
  onInput: (sessionId: string, data: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onReorderProjects?: (orderedIds: string[]) => void;
  onGroupProjects?: (draggedId: string, targetId: string) => void;
  onUngroupProject?: (id: string) => void;
  onRenameGroup?: (id: string, name: string) => void;
  /** `null` limpa o ícone do grupo (o backend recolhe o ficheiro se mais ninguém o apontar). */
  onSetGroupIcon?: (id: string, icon: ProjectIcon | null) => void;
  onToggleGroupCollapsed?: (id: string, collapsed: boolean) => void;
}

type LucideName =
  | 'layout-dashboard' | 'plus' | 'folder-plus' | 'message-square'
  | 'terminal' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down'
  | 'sparkles' | 'zap' | 'chevrons-left' | 'search' | 'x'
  | 'check' | 'refresh' | 'command' | 'chevrons-right' | 'chevron-left' | 'info'
  | 'grip' | 'archive' | 'archive-restore' | 'cpu' | 'list-checks' | 'arrow-up-down' | 'link';

function LucideIcon({ name }: { name: LucideName }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'layout-dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'folder-plus') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M12 10v6M9 13h6" /></svg>;
  if (name === 'message-square') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
  if (name === 'terminal') return <svg {...common}><path d="m5 7 5 5-5 5" /><path d="M12 19h7" /></svg>;
  if (name === 'folder') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>;
  if (name === 'folder-open') return <svg {...common}><path d="M6 17.5A2.5 2.5 0 0 1 3.5 15V6.5A2.5 2.5 0 0 1 6 4h3.5l2 2H18a2 2 0 0 1 2 2v1" /><path d="M4 17.5 6.2 10h15.3l-2.2 7.5A2 2 0 0 1 17.4 19H5.9A2 2 0 0 1 4 17.5Z" /></svg>;
  if (name === 'chevron-down') return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === 'sparkles') return <svg {...common}><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8Z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>;
  if (name === 'zap') return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7Z" /></svg>;
  if (name === 'chevrons-left') return <svg {...common}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>;
  if (name === 'chevrons-right') return <svg {...common}><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></svg>;
  if (name === 'chevron-left') return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === 'chevron-right') return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === 'x') return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'check') return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>;
  if (name === 'command') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></svg>;
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  if (name === 'grip') return <svg {...common}><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>;
  if (name === 'archive') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>;
  if (name === 'archive-restore') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h4" /><path d="M19 8v3" /><path d="m15 18 4-4 4 4" /><path d="M19 22v-8" /></svg>;
  if (name === 'cpu') return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></svg>;
  if (name === 'list-checks') return <svg {...common}><path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8" /></svg>;
  if (name === 'arrow-up-down') return <svg {...common}><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></svg>;
  if (name === 'link') return <svg {...common}><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
  return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
}

// ── Identidade visual (logótipo · emoji · monograma) ───────────────
// Cascata única para projectos E grupos: logótipo carregado → emoji escolhido → 2 primeiras letras
// do nome. Com a barra fechada o nome está escondido, por isso nenhum dos ramos pode cair num
// quadrado vazio — era isso que acontecia aos grupos, que nem sequer tinham elemento de ícone.
// O monograma vem em `data-mono` e só o CSS o troca pelo svg quando a barra está fechada (o ícone
// de pasta continua no DOM para a barra aberta).

function ProjectAvatar({ icon, name }: { icon?: ProjectIcon; name: string }) {
  if (icon?.type === 'image') {
    return (
      <span className="project-group-icon project-icon--image">
        {/* Decorativa: o nome acessível já vem do botão que a envolve. */}
        <img src={projectIconUrl(icon)} alt="" />
      </span>
    );
  }
  if (icon?.type === 'emoji') {
    return <span className="project-group-icon project-icon--emoji" aria-hidden>{icon.value}</span>;
  }
  return (
    <span className="project-group-icon" data-mono={iconInitials(name)}>
      <LucideIcon name="folder" />
    </span>
  );
}

/**
 * Campo de escolha de ícone (carregar logótipo · emoji · remover), partilhado pela linha de grupo
 * na barra lateral e pelo modal de projecto. Vive aqui, e não num ficheiro próprio, porque os dois
 * únicos consumidores são estes dois módulos — a alternativa era criar um terceiro ficheiro só para
 * uma função de ~60 linhas.
 *
 * O upload segue o contrato de `POST /icons`: bytes crus no corpo, extensão só como pista. O
 * servidor é a autoridade sobre formato/tamanho — aqui só se traduz o erro para PT-PT.
 */
export function ProjectIconField({ icon, name, label, onChange }: {
  icon?: ProjectIcon;
  /** Nome do projecto/grupo — alimenta o monograma da pré-visualização. */
  name: string;
  /** Como o alvo se chama nos rótulos acessíveis (ex.: "grupo Marketing"). */
  label: string;
  onChange: (icon: ProjectIcon | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emojiDraft, setEmojiDraft] = useState(icon?.type === 'emoji' ? icon.value : '');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
      const res = await fetch('/icons', {
        method: 'POST',
        headers: ext ? { 'x-file-ext': ext } : undefined,
        body: file,
      });
      const data = await res.json().catch(() => ({} as { error?: string; icon?: ProjectIcon }));
      if (!res.ok || !data.icon) {
        setError(data.error || (res.status === 413 ? 'Imagem demasiado grande (máximo 2 MB).' : 'Não foi possível carregar a imagem.'));
        return;
      }
      onChange(data.icon);
      setEmojiDraft('');
    } catch {
      setError('Não foi possível carregar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const applyEmoji = () => {
    const value = emojiDraft.trim();
    if (!value) return;
    // Validação leve — quem decide mesmo é o servidor (1 grapheme pictográfico).
    if (!/\p{Extended_Pictographic}/u.test(value)) { setError('Escreve um único emoji.'); return; }
    setError('');
    onChange({ type: 'emoji', value });
  };

  return (
    <div className="icon-field">
      <span className="icon-field-preview" aria-hidden>
        {icon?.type === 'image' ? <img src={projectIconUrl(icon)} alt="" />
          : icon?.type === 'emoji' ? <span className="icon-field-emoji">{icon.value}</span>
            : <span className="icon-field-mono">{iconInitials(name)}</span>}
      </span>
      <div className="icon-field-controls">
        <input
          ref={fileRef}
          type="file"
          className="icon-field-file"
          accept="image/png,image/jpeg,image/webp"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="icon-field-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'A carregar…' : 'Carregar logótipo'}
        </button>
        <label className="icon-field-emoji-input">
          <span>Emoji</span>
          <input
            value={emojiDraft}
            maxLength={8}
            aria-label={`Emoji do ${label}`}
            onChange={(e) => setEmojiDraft(e.target.value)}
            onBlur={applyEmoji}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyEmoji(); }
              // Escape segue caminho: é quem fecha o modal/flyout que envolve o campo.
              if (e.key !== 'Escape') e.stopPropagation();
            }}
          />
        </label>
        {icon && (
          <button
            type="button"
            className="icon-field-btn icon-field-btn--ghost"
            onClick={() => { setEmojiDraft(''); setError(''); onChange(null); }}
          >
            Remover ícone
          </button>
        )}
      </div>
      <p className={`icon-field-hint${error ? ' icon-field-hint--error' : ''}`} role="status">
        {error || 'PNG, JPEG ou WEBP até 2 MB. Sem ícone, ficam as duas primeiras letras do nome.'}
      </p>
    </div>
  );
}

// ── Ordenação de projectos ─────────────────────────────────────────
// Os projectos não têm data de criação — usamos a posição no array (a ordem `order`
// devolvida por GET /projects) como proxy: o último da lista é o mais recente.
// As ordenações não-manuais são só uma VISTA (não gravam nada no servidor); há um
// botão "Fixar ordem" que persiste explicitamente via onReorderProjects → PUT /projects/order.

type ProjectSort = 'manual' | 'name-asc' | 'name-desc' | 'recent' | 'oldest';

const PROJECT_SORT_KEY = 'joca:project-sort';

const PROJECT_SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: 'manual', label: 'Manual (arrastar)' },
  { value: 'name-asc', label: 'Nome A→Z' },
  { value: 'name-desc', label: 'Nome Z→A' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
];

const PROJECT_SORT_HINT =
  'Ordenação da lista de projectos. "Mais recentes"/"Mais antigos" usam a posição na lista como '
  + 'aproximação da data (os projectos não guardam data de criação — o último adicionado fica no fim). '
  + 'Só "Manual (arrastar)" permite reordenar por drag; as outras são apenas uma vista, até carregares em "Fixar ordem".';

function readProjectSort(): ProjectSort {
  try {
    const raw = localStorage.getItem(PROJECT_SORT_KEY);
    return PROJECT_SORT_OPTIONS.some((o) => o.value === raw) ? (raw as ProjectSort) : 'manual';
  } catch { return 'manual'; }
}

function sortProjects(list: Project[], sort: ProjectSort): Project[] {
  // 'manual' e 'oldest' são a ordem tal como vem do servidor (mais antigo primeiro).
  if (sort === 'manual' || sort === 'oldest') return list;
  const out = [...list];
  if (sort === 'recent') return out.reverse();
  const dir = sort === 'name-desc' ? -1 : 1;
  return out.sort((a, b) => dir * a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
}

// ── Project row ────────────────────────────────────────────────────
// Um projecto é um item de rail (estilo lista de servidores) — dot de cor, nome, badge de
// "a trabalhar", acções reveladas a hover. As sessões do projecto já não aparecem aqui: vivem no
// canal Workers do ProjectWorkspace, que é para onde `onDashboard` leva. Remover projecto já não
// vive aqui (era redundante com a "Zona perigosa" do Overview) — só Nova sessão + Arquivar.
//
// Largar a bolinha de cor de OUTRO projecto sobre esta agrupa os dois (onGroupDrop) — distinto de
// largar no resto da linha, que reordena (onDrop). A bolinha intercepta o próprio evento
// (stopPropagation) para as duas acções nunca dispararem ao mesmo tempo.

function ProjectRow({
  project, sessions, onOpen, onDashboard, onRenameProject,
  onArchive, onUngroup, indented, isDragOver, dragEnabled, onDragStart, onDragEnter, onDragEnd, onDrop, onMoveUp, onMoveDown,
  dotDragOver, onDotDragEnter, onDotDragLeave, onGroupDrop, groupCandidates, onGroupWith,
}: {
  project: Project;
  sessions: SessionInfo[];
  onOpen: () => void;
  onDashboard: () => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchive?: () => void;
  onUngroup?: () => void;
  indented?: boolean;
  isDragOver?: boolean;
  dragEnabled?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dotDragOver?: boolean;
  onDotDragEnter?: () => void;
  onDotDragLeave?: () => void;
  onGroupDrop?: () => void;
  /** Alternativa por teclado ao arrastar-a-bolinha (WCAG 2.1.1 — o drag nativo não é operável por
   *  teclado/toque). Outros projectos activos, para escolher com quem agrupar este. */
  groupCandidates?: { id: string; name: string; groupName?: string }[];
  onGroupWith?: (targetId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [grouping, setGrouping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupSelectRef = useRef<HTMLSelectElement>(null);
  const workingCount = sessions.filter(s => s.status === 'working').length;

  useEffect(() => {
    if (grouping) groupSelectRef.current?.focus();
  }, [grouping]);

  useEffect(() => {
    if (editing) {
      setDraft(project.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, project.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditing(false);
  };

  return (
    <div
      className={[
        'project-group',
        indented ? 'project-group--indented' : '',
        isDragOver ? 'project-group--dragover' : '',
        dragging ? 'project-group--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--project-color': projectColor(project) } as CSSProperties}
      onDragOver={dragEnabled ? (e) => { e.preventDefault(); onDragEnter?.(); } : undefined}
      onDrop={dragEnabled ? (e) => { e.preventDefault(); onDrop?.(); } : undefined}
    >
      <div className="project-group-header">
        {dragEnabled && (
          <span
            className="project-group-grip"
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(e) => { e.stopPropagation(); setDragging(true); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
            onDragEnd={(e) => { e.stopPropagation(); setDragging(false); onDragEnd?.(); }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onMoveUp?.(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onMoveDown?.(); }
            }}
            title="Arrastar ou usar ↑/↓ para reordenar"
            aria-label={`Reordenar ${project.name} — setas para cima/baixo`}
          >
            <LucideIcon name="grip" />
          </span>
        )}
        {editing ? (
          <>
            <ProjectAvatar icon={project.icon} name={project.name} />
            <span
              className="project-group-color"
              style={{ '--project-color': projectColor(project) } as CSSProperties}
              aria-hidden
            />
            <input
              ref={inputRef}
              className="session-item-name-input"
              style={{ fontSize: '11px', height: '20px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px', width: '120px' }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(project.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <button
            type="button"
            className="project-group-label"
            onClick={onDashboard}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`${project.name} — abrir workspace (duplo-clique renomeia)`}
            aria-label={`Abrir workspace de ${project.name}`}
          >
            <ProjectAvatar icon={project.icon} name={project.name} />
            <span
              className={`project-group-color${dotDragOver ? ' project-group-color--dragover' : ''}`}
              style={{ '--project-color': projectColor(project) } as CSSProperties}
              aria-hidden
              onDragOver={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDotDragEnter?.(); } : undefined}
              onDragLeave={onGroupDrop ? (e) => { e.stopPropagation(); onDotDragLeave?.(); } : undefined}
              onDrop={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onGroupDrop(); } : undefined}
            />
            <span className="project-group-name">{project.name}</span>
          </button>
        )}
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        <div className="project-group-actions">
          <button className="project-group-action" type="button" aria-label={`Nova sessão em ${project.name}`} onClick={(e) => { e.stopPropagation(); onOpen(); }} data-tooltip="Nova sessão no projeto" data-tooltip-position="bottom"><LucideIcon name="plus" /></button>
          {groupCandidates && groupCandidates.length > 0 && onGroupWith && (
            <button className="project-group-action" type="button" aria-label={`Agrupar ${project.name} com outro projecto`} onClick={(e) => { e.stopPropagation(); setGrouping(true); }} data-tooltip="Agrupar com…" data-tooltip-position="bottom"><LucideIcon name="link" /></button>
          )}
          {onUngroup && <button className="project-group-action" type="button" aria-label={`Retirar ${project.name} do grupo`} onClick={(e) => { e.stopPropagation(); onUngroup(); }} data-tooltip="Retirar do grupo" data-tooltip-position="bottom"><LucideIcon name="x" /></button>}
          {onArchive && <button className="project-group-action" type="button" aria-label={`Arquivar projeto ${project.name}`} onClick={(e) => { e.stopPropagation(); onArchive(); }} data-tooltip="Arquivar projeto" data-tooltip-position="bottom"><LucideIcon name="archive" /></button>}
        </div>
      </div>
      {grouping && groupCandidates && onGroupWith && (
        <div className="project-group-picker" onClick={(e) => e.stopPropagation()}>
          <select
            ref={groupSelectRef}
            aria-label={`Agrupar ${project.name} com…`}
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              setGrouping(false);
              if (id) onGroupWith(id);
            }}
            onBlur={() => setGrouping(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setGrouping(false); } }}
          >
            <option value="" disabled>Agrupar com…</option>
            {groupCandidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.groupName ? ` (grupo: ${c.groupName})` : ''}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Project folder (grupo) ──────────────────────────────────────────
// Linha colapsável que representa um grupo de projectos (agrupamento puramente visual — largar a
// bolinha de um projecto sobre a de outro cria/junta a este). Expandida, mostra os projectos-membro
// indentados por baixo, cada um como uma ProjectRow normal.

function ProjectFolder({
  group, members, sessions, expanded, collapsed, onToggle, onRenameGroup, onSetIcon, onOpenMember, renderMember,
  dotDragOver, onDotDragEnter, onDotDragLeave, onGroupDrop,
}: {
  group: ProjectGroupData;
  members: Project[];
  sessions: SessionInfo[];
  expanded: boolean;
  /** Barra lateral fechada — a linha vira um quadrado e o clique abre o flyout em vez de colapsar. */
  collapsed: boolean;
  onToggle: () => void;
  onRenameGroup?: (name: string) => void;
  onSetIcon?: (icon: ProjectIcon | null) => void;
  /** Abrir um projecto do grupo a partir do flyout. */
  onOpenMember: (project: Project) => void;
  /** Mesma wiring (drag/agrupar/arquivar/…) que uma ProjectRow solta — construído pelo caller
   *  (SessionSidebar) para nunca divergir entre linha solta e linha aninhada. */
  renderMember: (project: Project) => ReactNode;
  dotDragOver?: boolean;
  onDotDragEnter?: () => void;
  onDotDragLeave?: () => void;
  onGroupDrop?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [iconPanel, setIconPanel] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  // Ref própria, não `document.querySelector('.group-flyout')`: com dois grupos na barra o selector
  // por classe apanharia sempre o primeiro painel e o Tab ficaria preso no flyout errado.
  const flyoutRef = useRef<HTMLDivElement>(null);
  const workingCount = members.reduce(
    (n, p) => n + sessions.filter((s) => s.projectId === p.id && s.status === 'working').length,
    0,
  );

  useEffect(() => {
    if (editing) { setDraft(group.name); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, group.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== group.name && onRenameGroup) onRenameGroup(t);
    setEditing(false);
  };

  const closeFlyout = useCallback(() => {
    setFlyoutOpen(false);
    labelRef.current?.focus();
  }, []);

  // Abrir a barra deixa o flyout sem sítio (a lista do grupo passa a estar inline).
  useEffect(() => { if (!collapsed) setFlyoutOpen(false); }, [collapsed]);

  useEffect(() => {
    if (!flyoutOpen) return;
    flyoutRef.current?.querySelector<HTMLElement>('.group-flyout-item')?.focus();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (flyoutRef.current?.contains(target) || labelRef.current?.contains(target)) return;
      // Clique fora só fecha — devolver o foco aqui roubá-lo-ia a quem o utilizador acabou de clicar.
      setFlyoutOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [flyoutOpen]);

  const onFlyoutKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFlyout(); return; }
    if (e.key !== 'Tab' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(flyoutRef.current?.querySelectorAll<HTMLElement>('.group-flyout-item') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const back = e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey);
    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (back) next = current <= 0 ? items.length - 1 : current - 1;
    else next = current < 0 || current === items.length - 1 ? 0 : current + 1;
    items[next].focus();
  };

  return (
    <div className={`project-folder${flyoutOpen ? ' project-folder--flyout-open' : ''}`}>
      <div className="project-group-header project-folder-header">
        <button
          type="button"
          className="project-group-grip project-folder-chevron"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Colapsar' : 'Expandir'} grupo ${group.name}`}
        >
          <LucideIcon name={expanded ? 'chevron-down' : 'chevron-right'} />
        </button>
        {editing ? (
          <>
            <ProjectAvatar icon={group.icon} name={group.name} />
            <span
              className="project-group-color"
              style={{ '--project-color': projectColor(group) } as CSSProperties}
              aria-hidden
            />
            <input
              ref={inputRef}
              className="session-item-name-input"
              style={{ fontSize: '11px', height: '20px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px', width: '120px' }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(group.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <button
            ref={labelRef}
            type="button"
            className="project-group-label"
            // Fechada, a lista de membros não cabe inline — o clique (e o Enter/Espaço, que num
            // <button> disparam o mesmo onClick) abre o flyout em vez de colapsar/expandir.
            onClick={collapsed ? () => setFlyoutOpen((v) => !v) : onToggle}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={collapsed
              ? `${group.name} — ${members.length} projectos (abrir lista)`
              : `${group.name} — ${members.length} projectos (duplo-clique renomeia)`}
            aria-label={collapsed
              ? `Grupo ${group.name}, ${members.length} projectos — abrir lista`
              : `Grupo ${group.name}, ${members.length} projectos`}
            aria-haspopup={collapsed ? 'dialog' : undefined}
            aria-expanded={collapsed ? flyoutOpen : expanded}
          >
            <ProjectAvatar icon={group.icon} name={group.name} />
            <span
              className={`project-group-color${dotDragOver ? ' project-group-color--dragover' : ''}`}
              style={{ '--project-color': projectColor(group) } as CSSProperties}
              aria-hidden
              onDragOver={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDotDragEnter?.(); } : undefined}
              onDragLeave={onGroupDrop ? (e) => { e.stopPropagation(); onDotDragLeave?.(); } : undefined}
              onDrop={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onGroupDrop(); } : undefined}
            />
            <span className="project-group-name">{group.name}</span>
            <span className="project-folder-count">{members.length}</span>
          </button>
        )}
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        {onSetIcon && (
          <div className="project-group-actions">
            <button
              className="project-group-action"
              type="button"
              aria-label={`Ícone do grupo ${group.name}`}
              aria-expanded={iconPanel}
              onClick={(e) => { e.stopPropagation(); setIconPanel((v) => !v); }}
              data-tooltip="Ícone do grupo"
              data-tooltip-position="bottom"
            >
              <LucideIcon name="sparkles" />
            </button>
          </div>
        )}
      </div>
      {/* Painel próprio em vez de o meter no modo de renome: o input de nome grava em `onBlur`,
          e tocar nos botões do ícone fechava a edição por baixo dos pés do utilizador. */}
      {iconPanel && onSetIcon && (
        <div className="project-folder-icon-panel">
          <ProjectIconField
            icon={group.icon}
            name={group.name}
            label={`grupo ${group.name}`}
            onChange={onSetIcon}
          />
        </div>
      )}
      {expanded && !collapsed && (
        <div className="project-folder-members">
          {members.map((project) => renderMember(project))}
        </div>
      )}
      {collapsed && flyoutOpen && (
        <div
          ref={flyoutRef}
          className="group-flyout"
          role="dialog"
          aria-label={`Projectos do grupo ${group.name}`}
          onKeyDown={onFlyoutKeyDown}
        >
          <p className="group-flyout-title">{group.name}</p>
          <ul className="group-flyout-list">
            {members.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="group-flyout-item"
                  style={{ '--project-color': projectColor(project) } as CSSProperties}
                  onClick={() => { setFlyoutOpen(false); onOpenMember(project); }}
                >
                  <ProjectAvatar icon={project.icon} name={project.name} />
                  <span className="group-flyout-item-name">{project.name}</span>
                </button>
              </li>
            ))}
            {members.length === 0 && <li className="group-flyout-empty">Grupo sem projectos</li>}
          </ul>
        </div>
      )}
    </div>
  );
}



// ── Main sidebar ───────────────────────────────────────────────────

export default function SessionSidebar({
  sessions, projects, projectGroups, mainView, collapsed, onToggleCollapsed, onShowDashboard, onShowAutomations, onShowTasks, onShowJoca, onShowAgents, onShowProject,
  onClose, onNew, onOpenProject, onCreateProject, onInput, onRenameProject,
  onArchiveProject, onReorderProjects, onGroupProjects, onUngroupProject, onRenameGroup, onSetGroupIcon, onToggleGroupCollapsed,
}: Props) {
  const [confirmCloseIdle, setConfirmCloseIdle] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dotOverId, setDotOverId] = useState<string | null>(null);
  const [projectSort, setProjectSort] = useState<ProjectSort>(readProjectSort);
  const sortRowRef = useRef<HTMLDivElement>(null);

  // Na tira mobile (38dvh, já perto do limite antes disto) abrir a barra empurra a lista de
  // projectos toda para fora do fold, sem pista nenhuma de que há mais para baixo — traz a barra
  // para a vista assim que abre.
  useEffect(() => {
    if (sortMenuOpen) sortRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [sortMenuOpen]);

  const idleSessions = sessions.filter(s => s.status === 'idle');

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const sortedProjects = sortProjects(activeProjects, projectSort);
  const sortedArchivedProjects = sortProjects(archivedProjects, projectSort);

  // Top-level items da lista: projectos soltos tal-qual, e um item único por grupo (na posição do
  // seu primeiro membro na ordenação corrente) — o agrupamento é só visual, não altera `order`.
  type SidebarItem =
    | { kind: 'project'; project: Project }
    | { kind: 'group'; group: ProjectGroupData; members: Project[] };
  const emittedGroups = new Set<string>();
  const sidebarItems: SidebarItem[] = [];
  for (const project of sortedProjects) {
    if (project.groupId) {
      if (emittedGroups.has(project.groupId)) continue;
      const group = projectGroups.find(g => g.id === project.groupId);
      if (!group) { sidebarItems.push({ kind: 'project', project }); continue; }
      emittedGroups.add(project.groupId);
      sidebarItems.push({
        kind: 'group',
        group,
        members: sortedProjects.filter(p => p.groupId === project.groupId),
      });
    } else {
      sidebarItems.push({ kind: 'project', project });
    }
  }

  const handleGroupDrop = (targetId: string) => {
    if (dragId && onGroupProjects) onGroupProjects(dragId, targetId);
    setDragId(null);
    setOverId(null);
    setDotOverId(null);
  };

  // Arrastar só faz sentido na vista manual — noutra ordenação a posição largada seria descartada.
  const dragEnabled = !!onReorderProjects && activeProjects.length > 1 && projectSort === 'manual';
  const canPinOrder = !!onReorderProjects && activeProjects.length > 1 && projectSort !== 'manual';
  const canSort = activeProjects.length > 1 || archivedProjects.length > 1;

  const changeProjectSort = (value: ProjectSort) => {
    setProjectSort(value);
    try { localStorage.setItem(PROJECT_SORT_KEY, value); } catch { /* ignore */ }
  };

  // "Fixar ordem": grava a ordem actualmente visível e volta ao modo manual.
  const pinCurrentOrder = () => {
    if (!onReorderProjects) return;
    onReorderProjects(sortedProjects.map(p => p.id));
    changeProjectSort('manual');
  };

  const commitReorder = (targetId: string) => {
    if (!dragId || dragId === targetId || !onReorderProjects) { setDragId(null); setOverId(null); return; }
    const ids = activeProjects.map(p => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderProjects(ids);
    setDragId(null);
    setOverId(null);
  };

  // Keyboard reorder (↑/↓ on the grip): swap with the adjacent project.
  const moveProject = (id: string, dir: 'up' | 'down') => {
    if (!onReorderProjects) return;
    const ids = activeProjects.map(p => p.id);
    const i = ids.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorderProjects(ids);
  };

  const closeIdleSessions = () => {
    idleSessions.forEach(s => onClose(s.id));
    setConfirmCloseIdle(false);
  };

  // Props partilhadas por uma ProjectRow, quer esteja solta na lista quer aninhada dentro de uma
  // ProjectFolder — extraído para não haver 2 sítios a wire-ar drag/agrupamento de forma divergente
  // (bug apanhado ao testar: as linhas aninhadas não tinham handler de "largar na bolinha" nenhum).
  const projectRowProps = (project: Project) => ({
    project,
    sessions: sessions.filter(s => s.projectId === project.id),
    onOpen: () => onOpenProject(project),
    onDashboard: () => onShowProject(project.id),
    onRenameProject,
    onArchive: onArchiveProject ? () => onArchiveProject(project.id, true) : undefined,
    onUngroup: project.groupId && onUngroupProject ? () => onUngroupProject(project.id) : undefined,
    dragEnabled,
    isDragOver: overId === project.id && dragId !== project.id,
    onDragStart: () => setDragId(project.id),
    onDragEnter: () => setOverId(project.id),
    onDragEnd: () => { setDragId(null); setOverId(null); },
    onDrop: () => commitReorder(project.id),
    onMoveUp: () => moveProject(project.id, 'up'),
    onMoveDown: () => moveProject(project.id, 'down'),
    dotDragOver: dotOverId === project.id,
    onDotDragEnter: () => setDotOverId(project.id),
    onDotDragLeave: () => setDotOverId((v: string | null) => v === project.id ? null : v),
    onGroupDrop: onGroupProjects ? () => handleGroupDrop(project.id) : undefined,
    // Alternativa por teclado ao arrastar-a-bolinha (drag nativo não é operável por teclado/toque).
    groupCandidates: onGroupProjects
      ? activeProjects.filter((p) => p.id !== project.id).map((p) => ({
        id: p.id,
        name: p.name,
        groupName: p.groupId ? projectGroups.find((g) => g.id === p.groupId)?.name : undefined,
      }))
      : undefined,
    onGroupWith: onGroupProjects ? (targetId: string) => onGroupProjects(project.id, targetId) : undefined,
  });

  return (
    <aside className={`session-sidebar ${collapsed ? 'session-sidebar--collapsed' : ''}`} aria-label="Projects">
      <div className="sidebar-main-bento">
        <div className="sb-header">
          <div className="sb-brand">
            <div className="sb-logo-rings" aria-hidden />
            <span className="sb-logo-text">JOCA <span style={{opacity:0.45,fontWeight:500,fontSize:'0.75em',letterSpacing:'0.05em'}}>0.4.0</span></span>
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
            data-tooltip={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            data-tooltip-position="bottom"
          >
            <span className="sidebar-collapse-glyph">
              <LucideIcon name={collapsed ? 'chevrons-right' : 'chevrons-left'} />
            </span>
          </button>
        </div>

        <div className="nav-menu">
          <button
            className={`nav-btn ${mainView === 'dashboard' ? 'active' : ''}`}
            type="button"
            onClick={onShowDashboard}
            aria-label="Dashboard"
            aria-current={mainView === 'dashboard' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="layout-dashboard" /></span>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'tasks' ? 'active' : ''}`}
            type="button"
            onClick={onShowTasks}
            aria-label="Tarefas Globais"
            aria-current={mainView === 'tasks' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="list-checks" /></span>
            <span>Tarefas Globais</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'automations' ? 'active' : ''}`}
            type="button"
            onClick={onShowAutomations}
            aria-label="Automações"
            aria-current={mainView === 'automations' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="zap" /></span>
            <span>Automações</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'agents' ? 'active' : ''}`}
            type="button"
            onClick={onShowAgents}
            aria-label="Agentes"
            aria-current={mainView === 'agents' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="terminal" /></span>
            <span>Agentes</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'joca' ? 'active' : ''}`}
            type="button"
            onClick={onShowJoca}
            aria-label="Joca"
            aria-current={mainView === 'joca' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="sparkles" /></span>
            <span>Joca</span>
          </button>
        </div>

        <div className="session-sidebar-header">
          <span className="sidebar-title">Projects</span>
          <div className="sidebar-header-actions">
            {canSort && (
              <button
                className={`sidebar-btn-sort${sortMenuOpen ? ' is-active' : ''}`}
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                data-tooltip="Ordenar projectos"
                data-tooltip-position="bottom"
                aria-label="Ordenar projectos"
                aria-expanded={sortMenuOpen}
                aria-controls="sidebar-sort-row"
              ><LucideIcon name="arrow-up-down" /></button>
            )}
          </div>
        </div>

        {sortMenuOpen && canSort && (
          <div className="sidebar-sort-row" id="sidebar-sort-row" ref={sortRowRef}>
            <select
              className="sidebar-sort-select"
              value={projectSort}
              onChange={(e) => changeProjectSort(e.target.value as ProjectSort)}
              title={PROJECT_SORT_HINT}
              aria-label="Ordenar projetos"
            >
              {PROJECT_SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {canPinOrder && (
              <button
                className="sidebar-sort-pin"
                type="button"
                onClick={pinCurrentOrder}
                data-tooltip="Gravar esta ordem como ordem manual"
                data-tooltip-position="bottom"
              >
                Fixar
              </button>
            )}
          </div>
        )}

        <div className="session-sidebar-list">
          {sidebarItems.map((item) => item.kind === 'project' ? (
            <ProjectRow key={item.project.id} {...projectRowProps(item.project)} />
          ) : (
            <ProjectFolder
              key={item.group.id}
              group={item.group}
              members={item.members}
              sessions={sessions}
              expanded={!item.group.collapsed}
              collapsed={collapsed}
              onToggle={() => onToggleGroupCollapsed?.(item.group.id, !item.group.collapsed)}
              onRenameGroup={onRenameGroup ? (name) => onRenameGroup(item.group.id, name) : undefined}
              onSetIcon={onSetGroupIcon ? (icon) => onSetGroupIcon(item.group.id, icon) : undefined}
              onOpenMember={(p) => onShowProject(p.id)}
              renderMember={(p) => <ProjectRow key={p.id} indented {...projectRowProps(p)} />}
              dotDragOver={dotOverId === item.group.id}
              onDotDragEnter={() => setDotOverId(item.group.id)}
              onDotDragLeave={() => setDotOverId((v) => v === item.group.id ? null : v)}
              onGroupDrop={onGroupProjects ? () => handleGroupDrop(item.members[0]?.id ?? '') : undefined}
            />
          ))}

          {projects.length > 0 && (
            <button type="button" className="sidebar-add-project-row" onClick={onCreateProject}>
              <LucideIcon name="folder-plus" /> Novo projecto
            </button>
          )}

          {archivedProjects.length > 0 && (
            <div className="sidebar-archived">
              <button
                className="sidebar-archived-toggle"
                type="button"
                onClick={() => setShowArchived(v => !v)}
                aria-expanded={showArchived}
              >
                <span className="sidebar-archived-icon"><LucideIcon name="archive" /></span>
                <span className="sidebar-archived-label">Arquivados</span>
                <span className="sidebar-archived-count">{archivedProjects.length}</span>
                <span className="sidebar-archived-chevron"><LucideIcon name={showArchived ? 'chevron-down' : 'chevron-right'} /></span>
              </button>
              {showArchived && (
                <div className="sidebar-archived-list">
                  {sortedArchivedProjects.map(project => (
                    <div key={project.id} className="archived-item" style={{ '--project-color': projectColor(project) } as CSSProperties}>
                      <span className="archived-item-color" aria-hidden />
                      <button
                        className="archived-item-name"
                        type="button"
                        onClick={() => onShowProject(project.id)}
                        title={`Abrir dashboard de ${project.name}`}
                      >
                        {project.name}
                      </button>
                      {onArchiveProject && (
                        <button
                          className="archived-item-restore"
                          type="button"
                          onClick={() => onArchiveProject(project.id, false)}
                          data-tooltip="Restaurar para a barra"
                          data-tooltip-position="bottom"
                          aria-label={`Restaurar projeto ${project.name}`}
                        >
                          <LucideIcon name="archive-restore" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {projects.length === 0 && (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon"><LucideIcon name="info" /></div>
              <p>Sem projectos</p>
              <button className="sidebar-btn-new-large" onClick={onCreateProject}>+ Criar projecto</button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="sidebar-quick-session-btn"
          onClick={onNew}
          data-tooltip="Sessão rápida — agente sem projecto"
          data-tooltip-position="top"
        >
          <LucideIcon name="terminal" /> Sessão rápida
        </button>

        <div className="session-bulk-actions">
          {confirmCloseIdle ? (
            <div className="bulk-confirm-row">
              <span>Fechar {idleSessions.length} inativas?</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="confirm-yes" onClick={closeIdleSessions}>Sim</button>
                <button type="button" className="confirm-no" onClick={() => setConfirmCloseIdle(false)}>Não</button>
              </div>
            </div>
          ) : (
            <button
              className="bulk-select-btn"
              type="button"
              disabled={idleSessions.length === 0}
              onClick={() => setConfirmCloseIdle(true)}
              data-tooltip="Fechar todas as sessões inativas"
              data-tooltip-position="bottom"
            >
              <LucideIcon name="x" /> Fechar inativas ({idleSessions.length})
            </button>
          )}
        </div>
      </div>

    </aside>
  );
}
