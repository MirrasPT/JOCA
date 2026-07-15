import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JocaItems, ToolkitFilter, ToolkitRegistryItem, ToolkitType } from '../types';

interface SelectedToolkitItem extends ToolkitRegistryItem {
  type: ToolkitType;
}

interface Props {
  items: JocaItems | null;
  onItemsChange: (items: JocaItems) => void;
  onLoad: () => void;
  onInsert: (text: string) => void;
  onClose: () => void;
}

function ChevronsRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

const EMPTY_CONTENT = {
  commands: '# Command\n\nDescribe what this command does.\n',
  agents: '---\nname: new-agent\ndescription: Describe the agent.\n---\n\nAgent instructions.\n',
  skills: '---\nname: new-skill\ndescription: Describe when to use this skill.\n---\n\n# Skill\n\nInstructions.\n',
};

function typeLabel(type: ToolkitType) {
  if (type === 'commands') return 'Command';
  if (type === 'skills') return 'Skill';
  return 'Agent';
}

export default function ToolkitPanel({ items, onItemsChange, onLoad, onInsert, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ToolkitFilter>('all');
  const [selected, setSelected] = useState<SelectedToolkitItem | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<ToolkitType>('skills');
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState('created-skills');
  const [createContent, setCreateContent] = useState(EMPTY_CONTENT.skills);

  const toolkitItems = useMemo<SelectedToolkitItem[]>(() => {
    const all = [
      ...(items?.commands ?? []).map((item) => ({ ...item, type: 'commands' as const, category: item.category ?? 'commands' })),
      ...(items?.skills ?? []).map((item) => ({ ...item, type: 'skills' as const, category: item.category ?? 'skills' })),
      ...(items?.agents ?? []).map((item) => ({ ...item, type: 'agents' as const, category: item.category ?? 'agents' })),
    ];
    const needle = query.trim().toLowerCase();
    return all.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (!needle) return true;
      return `${item.name} ${item.category ?? ''} ${item.description ?? ''}`.toLowerCase().includes(needle);
    });
  }, [filter, items, query]);

  useEffect(() => {
    if (!items) onLoad();
  }, [items, onLoad]);

  useEffect(() => {
    setCreateContent(EMPTY_CONTENT[createType]);
    if (createType !== 'skills') setCreateCategory('');
    else setCreateCategory((current) => current || 'created-skills');
  }, [createType]);

  const loadContent = useCallback(async (item: SelectedToolkitItem) => {
    setSelected(item);
    setLoadingContent(true);
    setError('');
    try {
      const res = await fetch(`/toolkit-item?path=${encodeURIComponent(item.path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open item');
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/toolkit-item', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selected.path, type: selected.type, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save item');
      onItemsChange(data.items);
      setOriginalContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const createItem = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/toolkit-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createType,
          name: createName,
          category: createType === 'skills' ? createCategory : undefined,
          content: createContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create item');
      onItemsChange(data.items);
      setCreateOpen(false);
      setCreateName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    const confirmed = window.confirm(`Delete ${selected.name}? This removes the real file.`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/toolkit-item', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selected.path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete item');
      onItemsChange(data.items);
      setSelected(null);
      setContent('');
      setOriginalContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const dirty = content !== originalContent;

  return (
    <div className="toolkit-panel">
      <div className="files-view-header">
        <div>
          <span className="files-view-title toolkit-panel-title">Toolkit</span>
          <span className="files-view-subtitle">Skills, agentes e comandos reais</span>
        </div>
        <button className="files-view-close" onClick={onClose} aria-label="Collapse toolkit" data-tooltip="Fechar painel" data-tooltip-position="bottom">
          <ChevronsRight />
        </button>
      </div>

      <div className="toolkit-library">
        {!selected ? (
          <aside className="toolkit-browser" aria-label="Toolkit library" style={{ border: 'none', background: 'transparent', padding: 0 }}>
            <div className="toolkit-toolbar">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search toolkit" aria-label="Search toolkit" />
              <button onClick={onLoad}>Refresh</button>
            </div>

            <div className="toolkit-filters" role="tablist" aria-label="Toolkit filters">
              {(['all', 'commands', 'skills', 'agents'] as const).map((type) => (
                <button key={type} role="tab" aria-selected={filter === type} className={filter === type ? 'active' : ''} onClick={() => setFilter(type)}>
                  {type}
                </button>
              ))}
            </div>

            <button className="toolkit-create-toggle" type="button" onClick={() => setCreateOpen((value) => !value)}>
              {createOpen ? 'Close creator' : 'New toolkit item'}
            </button>

            {createOpen && (
              <div className="toolkit-create-card">
                <div className="toolkit-create-fields">
                  <select value={createType} onChange={(event) => setCreateType(event.target.value as ToolkitType)} aria-label="Toolkit item type">
                    <option value="skills">Skill</option>
                    <option value="commands">Command</option>
                    <option value="agents">Agent</option>
                  </select>
                  <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="file-name" aria-label="Toolkit item name" />
                  {createType === 'skills' && (
                    <input value={createCategory} onChange={(event) => setCreateCategory(event.target.value)} placeholder="category" aria-label="Skill category" />
                  )}
                </div>
                <textarea value={createContent} onChange={(event) => setCreateContent(event.target.value)} rows={8} aria-label="New toolkit item content" />
                <button onClick={createItem} disabled={saving || !createName.trim()}>Create file</button>
              </div>
            )}

            <div className="toolkit-list">
              {!items && <div className="toolkit-empty">A carregar toolkit real...</div>}
              {items && toolkitItems.length === 0 && <div className="toolkit-empty">Sem resultados. Cria um item ou limpa a pesquisa.</div>}
              {toolkitItems.map((item) => {
                const Icon = item.type === 'commands' ? TerminalIcon : item.type === 'skills' ? WrenchIcon : BotIcon;
                return (
                  <button
                    key={`${item.type}-${item.path}`}
                    className={`toolkit-item toolkit-item--${item.type}`}
                    onClick={() => loadContent(item)}
                  >
                    <div className="toolkit-item-header">
                      <span className="toolkit-item-badge">
                        <Icon />
                        <span>{typeLabel(item.type)}</span>
                      </span>
                      <span className="toolkit-item-category">{item.category ?? 'General'}</span>
                    </div>
                    <div className="toolkit-item-name">{item.name}</div>
                    {item.description && (
                      <div className="toolkit-item-description">{item.description}</div>
                    )}
                    <span
                      className="toolkit-item-insert"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onInsert(item.insert);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onInsert(item.insert);
                        }
                      }}
                    >
                      Insert
                    </span>
                  </button>
                );
              })}
            </div>

          </aside>
        ) : (
          <section className="toolkit-open-shell" aria-label={`${selected.name} toolkit editor`}>
            <div className="toolkit-open-topbar">
              <button className="toolkit-open-back" onClick={() => setSelected(null)}>
                <ChevronsRight />
                <span>Library</span>
              </button>
              <div className="toolkit-open-actions">
                <button className="toolkit-action toolkit-action--primary" onClick={() => onInsert(selected.insert)}>Insert</button>
                <button className="toolkit-action" onClick={saveSelected} disabled={saving || loadingContent || !dirty}>
                  {dirty ? 'Save' : 'Saved'}
                </button>
                <button className="toolkit-action toolkit-danger" onClick={deleteSelected} disabled={saving}>Delete</button>
              </div>
            </div>

            <div className="toolkit-open-meta">
              <span className={`toolkit-open-kind toolkit-open-kind--${selected.type}`}>{typeLabel(selected.type)}</span>
              <div className="toolkit-open-title-row">
                <h3>{selected.name}</h3>
                {dirty && <span className="toolkit-open-dirty">Unsaved</span>}
              </div>
              <div className="toolkit-open-path" title={selected.path}>
                <span>{selected.category ?? 'root'}</span>
                <code>{selected.path}</code>
              </div>
            </div>

            <div className="toolkit-editor-frame">
              <div className="toolkit-editor-toolbar">
                <span>Content</span>
                <span>{loadingContent ? 'Loading' : `${content.split(/\r?\n/).length} lines`}</span>
              </div>
              <textarea
                className="toolkit-editor"
                value={loadingContent ? 'Loading...' : content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
                aria-label={`${selected.name} content`}
              />
            </div>
          </section>
        )}
        {error && <div className="toolkit-error">{error}</div>}
      </div>
    </div>
  );
}
