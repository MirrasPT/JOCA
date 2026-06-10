import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { splitPath, joinPath } from '../lib/paths';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface DirListing {
  path: string;
  parent: string;
  entries: FileEntry[];
}

interface Props {
  onPastePath: (path: string) => void;
  onPreview: (path: string) => void;
  initialPath?: string;
  selectedPath?: string | null;
  /** Project-scoped embed: drops terminal-oriented chrome (path/cd insert,
   *  favorites/drives strips, home) that has no target in the dashboard. */
  embedded?: boolean;
}

function quotePath(p: string) {
  return p.includes(' ') ? `"${p}"` : p;
}

function shortName(seg: string) {
  return seg.length > 14 ? seg.slice(0, 12) + '…' : seg;
}

type FileKind =
  | 'fb-dir' | 'fb-up'
  | 'fb-file-code' | 'fb-file-img' | 'fb-file-doc' | 'fb-file-config'
  | 'fb-file-style' | 'fb-file-markup' | 'fb-file-data' | 'fb-file-pdf'
  | 'fb-file-media' | 'fb-file-audio' | 'fb-file-archive' | 'fb-file-shell'
  | 'fb-file-default';

function fileKind(name: string, isDir: boolean): FileKind {
  if (isDir) return 'fb-dir';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['ts','tsx','js','jsx','mjs','cjs','py','rb','go','rs','java','cpp','c','h','cs','swift','kt','dart'].includes(ext)) return 'fb-file-code';
  if (['png','jpg','jpeg','gif','webp','svg','ico','heic','avif','bmp','tiff'].includes(ext)) return 'fb-file-img';
  if (['md','mdx','txt','rst','rtf'].includes(ext)) return 'fb-file-doc';
  if (['json','yaml','yml','toml','env','ini','conf','config','lock'].includes(ext)) return 'fb-file-config';
  if (['css','scss','sass','less','styl'].includes(ext)) return 'fb-file-style';
  if (['html','htm','xml','vue'].includes(ext)) return 'fb-file-markup';
  if (['csv','sql','db','sqlite'].includes(ext)) return 'fb-file-data';
  if (['pdf'].includes(ext)) return 'fb-file-pdf';
  if (['mp4','mov','webm','avi','mkv','m4v'].includes(ext)) return 'fb-file-media';
  if (['mp3','wav','ogg','flac','m4a','aac'].includes(ext)) return 'fb-file-audio';
  if (['zip','tar','gz','bz2','7z','rar','xz'].includes(ext)) return 'fb-file-archive';
  if (['sh','bash','zsh','fish','ps1'].includes(ext)) return 'fb-file-shell';
  return 'fb-file-default';
}

type BrowserIconName =
  | 'home' | 'refresh' | 'folder' | 'file' | 'eye' | 'corner-down-left'
  | 'plus' | 'edit' | 'copy' | 'trash' | 'external' | 'arrow-up'
  | 'file-code' | 'file-image' | 'file-text' | 'settings' | 'music' | 'film'
  | 'archive' | 'terminal' | 'file-spreadsheet' | 'move';

function fileIcon(kind: FileKind): BrowserIconName {
  switch (kind) {
    case 'fb-dir':          return 'folder';
    case 'fb-up':           return 'arrow-up';
    case 'fb-file-code':    return 'file-code';
    case 'fb-file-img':     return 'file-image';
    case 'fb-file-doc':     return 'file-text';
    case 'fb-file-config':  return 'settings';
    case 'fb-file-style':   return 'file-code';
    case 'fb-file-markup':  return 'file-code';
    case 'fb-file-data':    return 'file-spreadsheet';
    case 'fb-file-pdf':     return 'file-text';
    case 'fb-file-media':   return 'film';
    case 'fb-file-audio':   return 'music';
    case 'fb-file-archive': return 'archive';
    case 'fb-file-shell':   return 'terminal';
    default:                return 'file';
  }
}

function BrowserIcon({ name }: { name: BrowserIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'home') return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-5h5v5" /></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M20 11a8.1 8.1 0 0 0-14.4-4L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8.1 8.1 0 0 0 14.4 4L20 15" /><path d="M20 20v-5h-5" /></svg>;
  if (name === 'folder') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>;
  if (name === 'eye') return <svg {...common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>;
  if (name === 'corner-down-left') return <svg {...common}><path d="m9 10-4 4 4 4" /><path d="M20 6v4a4 4 0 0 1-4 4H5" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'edit') return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  if (name === 'copy') return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>;
  if (name === 'trash') return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>;
  if (name === 'external') return <svg {...common}><path d="M14 3h7v7" /><path d="m10 14 11-11" /><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" /></svg>;
  if (name === 'arrow-up') return <svg {...common}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
  if (name === 'file-code') return <svg {...common}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
  if (name === 'file-image') return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
  if (name === 'file-text') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  if (name === 'music') return <svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === 'film') return <svg {...common}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></svg>;
  if (name === 'archive') return <svg {...common}><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>;
  if (name === 'terminal') return <svg {...common}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
  if (name === 'file-spreadsheet') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>;
  if (name === 'move') return <svg {...common}><path d="M12 2v20M17 5l-5-5-5 5M5 19l5 5 5-5M2 12h20M5 7l-5 5 5 5M19 17l5-5-5-5" /></svg>;
  return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}

export default function FileBrowser({ onPastePath, onPreview, initialPath, selectedPath, embedded }: Props) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [homeDir, setHomeDir] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);
  const showHiddenRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('joca:file-favorites') || '[]'); } catch { return []; }
  });
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('joca:file-recents') || '[]'); } catch { return []; }
  });
  const [roots, setRoots] = useState<{ path: string; label: string; isHome: boolean }[]>([]);
  const prevInitialPath = useRef<string | undefined>(undefined);
  const currentPathRef = useRef<string>('');

  useEffect(() => { showHiddenRef.current = showHidden; }, [showHidden]);

  const navigate = useCallback(async (p: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/files?path=${encodeURIComponent(p)}&hidden=${showHiddenRef.current}`);
      if (!res.ok) throw new Error('Cannot read directory');
      const data: DirListing = await res.json();
      setListing(data);
      currentPathRef.current = data.path;
      setRecentFolders((current) => {
        const next = [data.path, ...current.filter((item) => item !== data.path)].slice(0, 6);
        localStorage.setItem('joca:file-recents', JSON.stringify(next));
        return next;
      });
      if (!homeDir) setHomeDir(data.path);
      return data;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [homeDir]);

  const handleEntryKey = (event: KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };

  useEffect(() => {
    navigate(initialPath ?? '');
    prevInitialPath.current = initialPath;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/roots')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.roots) setRoots(data.roots); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialPath !== undefined && initialPath !== prevInitialPath.current) {
      prevInitialPath.current = initialPath;
      navigate(initialPath);
    }
  }, [initialPath, navigate]);

  useEffect(() => {
    if (listing) navigate(listing.path);
  }, [showHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFocus = () => { if (currentPathRef.current) navigate(currentPathRef.current); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [navigate]);

  const segments = splitPath(listing?.path ?? '');
  const visibleSegs = segments.slice(-4);
  const hasMore = segments.length > 4;
  const effectiveHome = homeDir || '';

  const entries = listing?.entries ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = normalizedQuery
    ? entries.filter((entry) => entry.name.toLowerCase().includes(normalizedQuery) || entry.path.toLowerCase().includes(normalizedQuery))
    : entries;
  const count = entries.length;
  const currentPath = listing?.path ?? '';
  const currentIsFavorite = currentPath ? favorites.includes(currentPath) : false;

  const toggleFavorite = () => {
    if (!currentPath) return;
    setFavorites((current) => {
      const next = current.includes(currentPath)
        ? current.filter((item) => item !== currentPath)
        : [currentPath, ...current].slice(0, 8);
      localStorage.setItem('joca:file-favorites', JSON.stringify(next));
      return next;
    });
  };

  const runFileOp = async (action: string, payload: Record<string, string>) => {
    const res = await fetch('/file-op', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({ error: 'Operation failed' }));
    if (!res.ok) {
      setError(data.error || 'Operation failed');
      return null;
    }
    if (listing?.path) navigate(listing.path);
    return data;
  };

  const createEntry = async (kind: 'create_file' | 'create_folder') => {
    if (!currentPath) return;
    const label = kind === 'create_file' ? 'file name' : 'folder name';
    const name = window.prompt(`New ${label}`);
    if (!name) return;
    await runFileOp(kind, { path: currentPath, name });
  };

  const renameEntry = async (entry: FileEntry) => {
    const name = window.prompt('Rename to', entry.name);
    if (!name || name === entry.name) return;
    await runFileOp('rename', { path: entry.path, name });
  };

  const deleteEntry = async (entry: FileEntry) => {
    const ok = window.confirm(`Delete ${entry.name}? This removes the real ${entry.isDir ? 'folder' : 'file'}.`);
    if (!ok) return;
    await runFileOp('delete', { path: entry.path });
  };

  const duplicateEntry = async (entry: FileEntry) => {
    await runFileOp('duplicate', { path: entry.path });
  };

  const moveEntry = async (entry: FileEntry) => {
    const targetFolder = window.prompt('Move file/folder to folder path:', currentPath);
    if (!targetFolder || targetFolder.trim() === currentPath) return;
    await runFileOp('move', { path: entry.path, targetPath: targetFolder.trim() });
  };

  const openExternalPath = async (p: string) => {
    await fetch('/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p }),
    }).catch(() => {});
  };

  const openExternal = (entry: FileEntry) => openExternalPath(entry.path);

  const copyRelativePath = async (entry: FileEntry) => {
    const relative = currentPath && entry.path.toLowerCase().startsWith(currentPath.toLowerCase())
      ? entry.path.slice(currentPath.length + 1)
      : entry.path;
    await navigator.clipboard?.writeText(relative).catch(() => {});
    onPastePath(relative);
  };

  return (
    <div className={`file-browser${embedded ? ' file-browser--embedded' : ''}`}>
      <div className="fb-toolbar">
        {!embedded && (
          <button
            className="fb-tool-btn"
            type="button"
            onClick={() => effectiveHome && navigate(effectiveHome)}
            disabled={!effectiveHome}
            data-tooltip="Pasta inicial"
            data-tooltip-position="bottom"
            aria-label="Home"
          >
            <BrowserIcon name="home" />
          </button>
        )}
        <button
          className="fb-tool-btn"
          type="button"
          onClick={() => currentPath && navigate(currentPath)}
          disabled={!currentPath || loading}
          data-tooltip="Recarregar"
          data-tooltip-position="bottom"
          aria-label="Refresh"
        >
          <BrowserIcon name="refresh" />
        </button>
        <button
          className={`fb-tool-btn fb-tool-btn--wide ${showHidden ? 'active' : ''}`}
          type="button"
          onClick={() => setShowHidden(h => !h)}
          data-tooltip="Toggle ficheiros ocultos"
          data-tooltip-position="bottom"
        >
          dotfiles
        </button>
        <button
          className="fb-tool-btn"
          type="button"
          onClick={() => createEntry('create_file')}
          disabled={!currentPath}
          data-tooltip="Criar ficheiro"
          data-tooltip-position="bottom"
          aria-label="Create file"
        >
          <BrowserIcon name="plus" />
        </button>
        <button
          className="fb-tool-btn"
          type="button"
          onClick={() => createEntry('create_folder')}
          disabled={!currentPath}
          data-tooltip="Criar pasta"
          data-tooltip-position="bottom"
          aria-label="Create folder"
        >
          <BrowserIcon name="folder" />
        </button>
      </div>

      <div className="fb-search-row">
        <input
          className="fb-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search current folder"
          aria-label="Search current folder"
        />
        {!embedded && (
          <button
            className={`fb-favorite-btn ${currentIsFavorite ? 'active' : ''}`}
            type="button"
            onClick={toggleFavorite}
            disabled={!currentPath}
            data-tooltip={currentIsFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            data-tooltip-position="bottom"
          >
            {currentIsFavorite ? 'saved' : 'save'}
          </button>
        )}
      </div>

      {!embedded && favorites.length > 0 && (
        <div className="fb-memory-strip" aria-label="File browser memory">
          {favorites.slice(0, 4).map((item) => (
            <button key={`fav-${item}`} type="button" onClick={() => navigate(item)} title={item}>fav · {shortName(splitPath(item).pop() || item)}</button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      {!embedded && roots.filter((r) => !r.isHome).length > 0 && (
        <div className="fb-memory-strip" aria-label="Drives">
          {roots.filter((r) => !r.isHome).map((r) => (
            <button key={`root-${r.path}`} type="button" onClick={() => navigate(r.path)} title={r.path}>{r.label}</button>
          ))}
        </div>
      )}

      <div className="fb-breadcrumb">
        <button
          className="fb-crumb fb-crumb-home"
          onClick={() => effectiveHome && navigate(effectiveHome)}
          title="Home"
          type="button"
        >~</button>
        {hasMore && <span className="fb-sep">…</span>}
        {visibleSegs.map((seg, i) => {
          const absIdx = segments.length - visibleSegs.length + i;
          const fullPath = joinPath(segments, absIdx + 1);
          const isLast = i === visibleSegs.length - 1;
          return (
            <span key={fullPath} style={{ display:'flex', alignItems:'center', gap:2, minWidth:0 }}>
              {(hasMore || i > 0) && <span className="fb-sep">/</span>}
              <button
                className="fb-crumb"
                style={isLast ? { color:'var(--text-normal)', fontWeight:500 } : {}}
                onClick={() => navigate(fullPath)}
                title={fullPath}
                type="button"
              >
                {shortName(seg)}
              </button>
            </span>
          );
        })}
      </div>

      {/* Entries */}
      <div className="fb-list">
        {listing && listing.parent !== listing.path && (
          <div
            className="fb-entry fb-up"
            role="button"
            tabIndex={0}
            onClick={() => navigate(listing.parent)}
            onKeyDown={(event) => handleEntryKey(event, () => navigate(listing.parent))}
          >
            <span className="fb-icon"><BrowserIcon name="arrow-up" /></span>
            <span className="fb-name">..</span>
          </div>
        )}

        {loading && <div className="fb-loading">Loading…</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && visibleEntries.length === 0 && !error && (
          <div className="fb-empty">Empty directory</div>
        )}

        {!loading && visibleEntries.map((e) => {
          const kind = fileKind(e.name, e.isDir);
          const isSelected = e.path === selectedPath;
          return (
            <div
              key={e.path}
              className={`fb-entry ${kind} ${isSelected ? 'fb-entry--selected' : ''}`}
              title={e.isDir ? 'Click to open · Drag to terminal to insert path' : 'Click to preview · Drag to terminal to insert path'}
              role="button"
              tabIndex={0}
              draggable
              onClick={() => { if (e.isDir) navigate(e.path); else onPreview(e.path); }}
              onKeyDown={(event) => handleEntryKey(event, () => {
                if (e.isDir) navigate(e.path);
                else onPreview(e.path);
              })}
              onDragStart={(ev) => {
                ev.dataTransfer.setData('text/plain', quotePath(e.path));
                ev.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="fb-icon">{e.isDir ? <BrowserIcon name="folder" /> : <BrowserIcon name={fileIcon(kind)} />}</span>
              <span className="fb-name">{e.name}</span>
              <span className="fb-entry-actions">
                {!e.isDir && (
                  <button
                    className="fb-action"
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onPreview(e.path);
                    }}
                    title="Preview"
                    aria-label={`Preview ${e.name}`}
                  >
                    <BrowserIcon name="eye" />
                  </button>
                )}
                {!embedded && (
                  <button
                    className="fb-action"
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onPastePath(quotePath(e.path));
                    }}
                    title="Insert path in terminal"
                    aria-label={`Insert ${e.name} path in terminal`}
                  >
                    <BrowserIcon name="corner-down-left" />
                  </button>
                )}
                <button
                  className="fb-action"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    copyRelativePath(e);
                  }}
                  title="Copy relative path"
                  aria-label={`Copy ${e.name} relative path`}
                >
                  <BrowserIcon name="copy" />
                </button>
                <button
                  className="fb-action"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    duplicateEntry(e);
                  }}
                  title="Duplicate"
                  aria-label={`Duplicate ${e.name}`}
                >
                  <BrowserIcon name="plus" />
                </button>
                <button
                  className="fb-action"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    moveEntry(e);
                  }}
                  title="Move"
                  aria-label={`Move ${e.name}`}
                >
                  <BrowserIcon name="move" />
                </button>
                <button
                  className="fb-action"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    renameEntry(e);
                  }}
                  title="Rename"
                  aria-label={`Rename ${e.name}`}
                >
                  <BrowserIcon name="edit" />
                </button>
                <button
                  className="fb-action"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openExternal(e);
                  }}
                  title="Open externally"
                  aria-label={`Open ${e.name} externally`}
                >
                  <BrowserIcon name="external" />
                </button>
                <button
                  className="fb-action fb-action--danger"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteEntry(e);
                  }}
                  title="Delete"
                  aria-label={`Delete ${e.name}`}
                >
                  <BrowserIcon name="trash" />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="fb-footer">
        <span className="fb-count">{count > 0 ? `${visibleEntries.length}/${count} item${count !== 1 ? 's' : ''}` : ''}</span>
        {!embedded && (
          <>
            <button
              className="fb-path-btn"
              type="button"
              onClick={() => currentPath && onPastePath(quotePath(currentPath))}
              disabled={!currentPath}
              title="Insert current folder path in terminal"
            >
              path
            </button>
            <button
              className="fb-path-btn"
              type="button"
              onClick={() => currentPath && onPastePath(`cd ${quotePath(currentPath)}\r`)}
              disabled={!currentPath}
              title="Run cd to current folder"
            >
              cd
            </button>
          </>
        )}
      </div>
    </div>
  );
}
