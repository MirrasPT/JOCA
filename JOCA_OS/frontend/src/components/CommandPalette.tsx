import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { JocaItems, Project, SessionInfo, ToolkitRegistryItem } from '../types';

interface CommandPaletteProps {
  sessions: SessionInfo[];
  projects: Project[];
  jocaItems: JocaItems | null;
  onClose: () => void;
  onShowDashboard: () => void;
  onOpenSettings: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onShowProject: (id: string) => void;
  onCreateProject: () => void;
  onInsert: (text: string) => void;
}

// Uma entrada da palete, já achatada: o que se mostra e o que acontece ao escolher.
interface PaletteEntry {
  key: string;
  label: string;
  /** Nome normalizado, para saber se a procura bateu no nome ou só na descrição. */
  nameKey: string;
  description?: string;
  /** Texto normalizado onde a procura corre (nome + categoria + descrição). */
  haystack: string;
  run: () => void;
}

interface PaletteSection {
  title: string;
  entries: PaletteEntry[];
}

// Minúsculas + sem acentos, para que "sessao" encontre "Sessão".
const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toEntry = (
  item: ToolkitRegistryItem,
  kind: string,
  onInsert: (text: string) => void,
): PaletteEntry => ({
  key: `${kind}:${item.category ?? ''}:${item.name}`,
  label: item.name,
  nameKey: normalize(item.name),
  description: item.description,
  haystack: normalize([item.name, item.category ?? '', item.description ?? ''].join(' ')),
  run: () => onInsert(item.insert),
});

// Destaca a primeira ocorrência do termo no nome. Só quando bate sem normalizar —
// com acentos o índice do texto normalizado não corresponde ao original, e nesse caso
// mostra-se o nome inteiro sem destaque (a entrada aparece na mesma).
function highlight(label: string, needle: string) {
  if (!needle) return label;
  const at = label.toLowerCase().indexOf(needle);
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark className="command-palette-match">{label.slice(at, at + needle.length)}</mark>
      {label.slice(at + needle.length)}
    </>
  );
}

// ⌘K command palette: jump to workspace panels, sessions, projects, and insert toolkit items.
// Pure presentational — all behaviour comes in via props (the parent owns open/close + the actions).
// A caixa de procura filtra todas as secções ao mesmo tempo; secções sem resultados desaparecem.
// Escape é tratado no App.tsx (listener de captura na window) — não se duplica aqui.
export default function CommandPalette({
  sessions, projects, jocaItems, onClose,
  onShowDashboard, onOpenSettings,
  onSelectSession, onNewSession, onShowProject, onCreateProject, onInsert,
}: CommandPaletteProps) {
  const [rawQuery, setRawQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const allSections = useMemo<PaletteSection[]>(() => [
    {
      title: 'Workspace',
      entries: [
        { key: 'ws:dashboard', label: 'Dashboard', nameKey: 'dashboard', haystack: 'dashboard painel workspace', run: onShowDashboard },
        { key: 'ws:settings', label: 'Open Settings', nameKey: 'open settings', haystack: 'open settings definicoes workspace', run: onOpenSettings },
      ],
    },
    {
      title: 'Sessions',
      entries: sessions.length > 0
        ? sessions.map((session) => ({
          key: `session:${session.id}`,
          label: session.name,
          nameKey: normalize(session.name),
          haystack: normalize(`${session.name} sessao session`),
          run: () => onSelectSession(session.id),
        }))
        : [{ key: 'session:new', label: 'New Session', nameKey: 'new session', haystack: 'new session nova sessao', run: onNewSession }],
    },
    {
      title: 'Projects',
      entries: projects.length > 0
        ? projects.map((project) => ({
          key: `project:${project.id}`,
          label: project.name,
          nameKey: normalize(project.name),
          haystack: normalize(`${project.name} projecto project`),
          run: () => onShowProject(project.id),
        }))
        : [{ key: 'project:new', label: 'Create Project', nameKey: 'create project', haystack: 'create project criar projecto', run: onCreateProject }],
    },
    { title: 'Comandos', entries: (jocaItems?.commands ?? []).map((item) => toEntry(item, 'command', onInsert)) },
    { title: 'Skills', entries: (jocaItems?.skills ?? []).map((item) => toEntry(item, 'skill', onInsert)) },
    { title: 'Agentes', entries: (jocaItems?.agents ?? []).map((item) => toEntry(item, 'agent', onInsert)) },
  ], [
    sessions, projects, jocaItems,
    onShowDashboard, onOpenSettings, onSelectSession, onNewSession, onShowProject, onCreateProject, onInsert,
  ]);

  const query = normalize(rawQuery.trim());

  const sections = useMemo(() => {
    if (!query) return allSections.filter((section) => section.entries.length > 0);
    return allSections
      .map((section) => ({ ...section, entries: section.entries.filter((entry) => entry.haystack.includes(query)) }))
      .filter((section) => section.entries.length > 0);
  }, [allSections, query]);

  const flat = useMemo(() => sections.flatMap((section) => section.entries), [sections]);

  // Mantém a entrada activa visível quando se navega com as setas.
  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-palette-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, sections]);

  const handleSearchKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      flat[Math.min(activeIndex, flat.length - 1)]?.run();
    }
  };

  let index = -1;

  return (
    <div className="create-skill-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="command-palette-modal" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        {/* A caixa de procura vem primeiro no DOM de propósito: o App.tsx dá o foco ao
            primeiro elemento focável do modal ao abrir, e é ela que queremos focada. */}
        <div className="command-palette-search">
          <svg className="command-palette-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input
            className="command-palette-input"
            type="text"
            value={rawQuery}
            onChange={(e) => { setRawQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleSearchKeys}
            placeholder="Procurar comandos, skills, agentes..."
            aria-label="Procurar na palete de comandos"
            autoComplete="off"
            spellCheck={false}
          />
          {rawQuery && (
            <button
              type="button"
              className="command-palette-clear"
              onClick={() => { setRawQuery(''); setActiveIndex(0); }}
              aria-label="Limpar procura"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="command-palette-bar">
          <span className="create-skill-title" id="command-palette-title">Comandos, Skills, Agentes</span>
          <span className="command-palette-count" aria-live="polite">
            {query ? `${flat.length} ${flat.length === 1 ? 'resultado' : 'resultados'}` : `${flat.length} entradas`}
          </span>
          <button className="create-skill-close command-palette-close" onClick={onClose} aria-label="Fechar palete de comandos">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!jocaItems && <p className="create-skill-hint command-palette-loading">A carregar registry JOCA...</p>}

        {flat.length > 0 ? (
          <div className="command-palette-grid" ref={gridRef}>
            {sections.map((section) => (
              <div key={section.title}>
                <h3>
                  {section.title}
                  <span className="command-palette-section-count">{section.entries.length}</span>
                </h3>
                {section.entries.map((entry) => {
                  index += 1;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={entry.key}
                      data-palette-index={index}
                      className={isActive ? 'is-active' : undefined}
                      onClick={entry.run}
                    >
                      <span className="command-palette-item-name">{highlight(entry.label, query)}</span>
                      {/* O excerto só aparece quando a procura bateu na descrição e não no
                          nome: serve para explicar porque é que a entrada está na lista. */}
                      {query && entry.description && !entry.nameKey.includes(query) && (
                        <span className="command-palette-item-why">{entry.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="command-palette-empty">
            {jocaItems
              ? <>Sem resultados para <strong>{rawQuery.trim()}</strong>. Tenta parte do nome, ou a categoria (ex.: deploy, design, wordpress).</>
              : 'A carregar registry JOCA...'}
          </p>
        )}

        <div className="command-palette-legend">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navegar</span>
          <span><kbd>Enter</kbd> escolher</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
