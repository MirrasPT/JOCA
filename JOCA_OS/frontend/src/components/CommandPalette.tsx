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

// One palette entry, already flattened: what is shown and what happens when it is picked.
interface PaletteEntry {
  key: string;
  label: string;
  /** Normalized name, to know whether the search hit the name or only the description. */
  nameKey: string;
  description?: string;
  /** Normalized text the search runs over (name + category + description). */
  haystack: string;
  run: () => void;
}

interface PaletteSection {
  title: string;
  entries: PaletteEntry[];
}

// Lowercase + no accents, so that "sessao" finds "Sessão".
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

// Highlights the first occurrence of the term in the name. Only when it hits without normalizing —
// with accents the index of the normalized text does not match the original, and in that case
// the whole name is shown without highlight (the entry still appears).
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
// Pure presentational — all behavior comes in via props (the parent owns open/close + the actions).
// The search box filters every section at the same time; sections with no results disappear.
// Escape is handled in App.tsx (capture listener on the window) — it is not duplicated here.
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
        { key: 'ws:dashboard', label: 'Dashboard', nameKey: 'dashboard', haystack: 'dashboard panel workspace', run: onShowDashboard },
        { key: 'ws:settings', label: 'Open Settings', nameKey: 'open settings', haystack: 'open settings workspace', run: onOpenSettings },
      ],
    },
    {
      title: 'Sessions',
      entries: sessions.length > 0
        ? sessions.map((session) => ({
          key: `session:${session.id}`,
          label: session.name,
          nameKey: normalize(session.name),
          haystack: normalize(`${session.name} session`),
          run: () => onSelectSession(session.id),
        }))
        : [{ key: 'session:new', label: 'New Session', nameKey: 'new session', haystack: 'new session', run: onNewSession }],
    },
    {
      title: 'Projects',
      entries: projects.length > 0
        ? projects.map((project) => ({
          key: `project:${project.id}`,
          label: project.name,
          nameKey: normalize(project.name),
          haystack: normalize(`${project.name} project`),
          run: () => onShowProject(project.id),
        }))
        : [{ key: 'project:new', label: 'Create Project', nameKey: 'create project', haystack: 'create project', run: onCreateProject }],
    },
    { title: 'Commands', entries: (jocaItems?.commands ?? []).map((item) => toEntry(item, 'command', onInsert)) },
    { title: 'Skills', entries: (jocaItems?.skills ?? []).map((item) => toEntry(item, 'skill', onInsert)) },
    { title: 'Agents', entries: (jocaItems?.agents ?? []).map((item) => toEntry(item, 'agent', onInsert)) },
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

  // Keeps the active entry visible when navigating with the arrow keys.
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
        {/* The search box comes first in the DOM deliberately: App.tsx gives focus to the first
            focusable element of the modal on open, and this is the one we want focused. */}
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
            placeholder="Search commands, skills, agents..."
            aria-label="Search the command palette"
            autoComplete="off"
            spellCheck={false}
          />
          {rawQuery && (
            <button
              type="button"
              className="command-palette-clear"
              onClick={() => { setRawQuery(''); setActiveIndex(0); }}
              aria-label="Clear search"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="command-palette-bar">
          <span className="create-skill-title" id="command-palette-title">Commands, Skills, Agents</span>
          <span className="command-palette-count" aria-live="polite">
            {query ? `${flat.length} ${flat.length === 1 ? 'result' : 'results'}` : `${flat.length} entries`}
          </span>
          <button className="create-skill-close command-palette-close" onClick={onClose} aria-label="Close command palette">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!jocaItems && <p className="create-skill-hint command-palette-loading">Loading JOCA registry...</p>}

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
                      {/* The excerpt only appears when the search hit the description and not the
                          name: it is there to explain why the entry is in the list. */}
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
              ? <>No results for <strong>{rawQuery.trim()}</strong>. Try part of the name, or the category (e.g. deploy, design, wordpress).</>
              : 'Loading JOCA registry...'}
          </p>
        )}

        <div className="command-palette-legend">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
          <span><kbd>Enter</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
