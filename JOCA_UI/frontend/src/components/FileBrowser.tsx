import { useState, useEffect, useCallback, useRef } from 'react';

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
}

const HOME = (() => {
  const m = navigator.userAgent.match(/Macintosh/) ? '/Users/' : '/home/';
  // Use the OS home from the backend default: fetch /files with no path returns os.homedir()
  return undefined; // resolved lazily on first load
})();

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

function fileIcon(kind: FileKind): string {
  switch (kind) {
    case 'fb-dir':          return '▸';
    case 'fb-up':           return '↑';
    case 'fb-file-code':    return '⟨⟩';
    case 'fb-file-img':     return '◐';
    case 'fb-file-doc':     return '≡';
    case 'fb-file-config':  return '⚙';
    case 'fb-file-style':   return '◑';
    case 'fb-file-markup':  return '◓';
    case 'fb-file-data':    return '⊞';
    case 'fb-file-pdf':     return '▣';
    case 'fb-file-media':   return '▷';
    case 'fb-file-audio':   return '♪';
    case 'fb-file-archive': return '◫';
    case 'fb-file-shell':   return '❯';
    default:                return '·';
  }
}

export default function FileBrowser({ onPastePath, onPreview, initialPath }: Props) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [homeDir, setHomeDir] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const prevInitialPath = useRef<string | undefined>(undefined);

  const navigate = useCallback(async (p: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/files?path=${encodeURIComponent(p)}&hidden=${showHidden}`);
      if (!res.ok) throw new Error('Cannot read directory');
      const data: DirListing = await res.json();
      setListing(data);
      // Discover home dir on first successful load (backend default = os.homedir())
      if (!homeDir) setHomeDir(data.path);
      return data;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [showHidden, homeDir]);

  // Initial load — use os.homedir() from backend (no path = default)
  useEffect(() => {
    navigate(initialPath ?? '');
    prevInitialPath.current = initialPath;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow active session's cwd when it changes
  useEffect(() => {
    if (initialPath !== undefined && initialPath !== prevInitialPath.current) {
      prevInitialPath.current = initialPath;
      navigate(initialPath);
    }
  }, [initialPath, navigate]);

  useEffect(() => {
    if (listing) navigate(listing.path);
  }, [showHidden]); // eslint-disable-line react-hooks/exhaustive-deps


  const segments = (listing?.path ?? '').split('/').filter(Boolean);
  const visibleSegs = segments.slice(-4);
  const hasMore = segments.length > 4;
  const effectiveHome = homeDir || '';

  const entries = listing?.entries ?? [];
  const count = entries.length;

  return (
    <div className="file-browser">
      {/* Breadcrumb */}
      <div className="fb-breadcrumb">
        <span
          className="fb-crumb fb-crumb-home"
          onClick={() => effectiveHome && navigate(effectiveHome)}
          title="Home"
        >⌂</span>
        {hasMore && <span className="fb-sep">…</span>}
        {visibleSegs.map((seg, i) => {
          const absIdx = segments.length - visibleSegs.length + i;
          const fullPath = '/' + segments.slice(0, absIdx + 1).join('/');
          const isLast = i === visibleSegs.length - 1;
          return (
            <span key={fullPath} style={{ display:'flex', alignItems:'center', gap:2, minWidth:0 }}>
              {(hasMore || i > 0) && <span className="fb-sep">/</span>}
              <span
                className="fb-crumb"
                style={isLast ? { color:'var(--text-normal)', fontWeight:500 } : {}}
                onClick={() => navigate(fullPath)}
                title={fullPath}
              >
                {shortName(seg)}
              </span>
            </span>
          );
        })}
      </div>

      {/* Entries */}
      <div className="fb-list">
        {listing && listing.parent !== listing.path && (
          <div className="fb-entry fb-up" onClick={() => navigate(listing.parent)}>
            <span className="fb-icon">↑</span>
            <span className="fb-name">..</span>
          </div>
        )}

        {loading && <div className="fb-loading">Loading…</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && entries.length === 0 && !error && (
          <div className="fb-empty">Empty directory</div>
        )}

        {!loading && entries.map((e) => {
          const kind = fileKind(e.name, e.isDir);
          return (
            <div
              key={e.path}
              className={`fb-entry ${kind}`}
              title={e.isDir ? 'Click to open · Drag to terminal to insert path' : 'Click to preview · Drag to terminal to insert path'}
              draggable
              onClick={() => { if (e.isDir) navigate(e.path); else onPreview(e.path); }}
              onDragStart={(ev) => {
                ev.dataTransfer.setData('text/plain', quotePath(e.path));
                ev.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="fb-icon">{fileIcon(kind)}</span>
              <span className="fb-name">{e.name}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="fb-footer">
        <span className="fb-count">{count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : ''}</span>
        <button
          className={`fb-toggle ${showHidden ? 'active' : ''}`}
          onClick={() => setShowHidden(h => !h)}
          title="Toggle hidden files"
        >
          {showHidden ? '● dotfiles' : '○ dotfiles'}
        </button>
      </div>
    </div>
  );
}
