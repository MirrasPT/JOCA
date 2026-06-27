import { useState, useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';

interface Props {
  filePath: string;
  onClose: () => void;
}

type FileKind = 'image' | 'audio' | 'video' | 'pdf' | 'html' | 'markdown' | 'code' | 'text';

const EXT: Record<string, FileKind> = {
  html: 'html', htm: 'html',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', ico: 'image', bmp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio',
  pdf: 'pdf',
  md: 'markdown', mdx: 'markdown', markdown: 'markdown',
  txt: 'text', log: 'text', csv: 'text', tsv: 'text',
};

const LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  php: 'php', cs: 'csharp', cpp: 'cpp', c: 'c', swift: 'swift',
  kt: 'kotlin', sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  html: 'html', css: 'css', scss: 'scss', sql: 'sql', xml: 'xml',
};

function getKind(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT[ext] ?? 'code';
}

function getLang(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return LANG[ext] ?? 'plaintext';
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

marked.setOptions({ async: false });

const ALLOWED_URL_ATTRS = new Set(['href', 'src']);
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button']);

function sanitizeHtml(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if (ALLOWED_URL_ATTRS.has(name) && (value.startsWith('javascript:') || value.startsWith('data:text/html'))) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

export default function FilePreview({ filePath, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'content' | 'diff'>('content');
  const [err, setErr] = useState('');
  const [size, setSize] = useState(() => ({
    w: Math.min(900, window.innerWidth - 32),
    h: Math.min(640, window.innerHeight - 80),
  }));
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, Math.round((window.innerWidth - 900) / 2)),
    y: 60,
  }));
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ ox: number; oy: number }>({ ox: 0, oy: 0 });
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number }>({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [mediaErr, setMediaErr] = useState('');

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const fileName = filePath.split('/').pop() ?? filePath;
  const kind = getKind(fileName);
  const isText = ['code', 'text', 'markdown'].includes(kind);
  const url = `/file-content?path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    setText(null); setErr('');
    setViewMode('content');
    if (!isText) return;
    const ac = new AbortController();
    fetch(url, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => setText(t.slice(0, 600_000)))
      .catch((e) => { if (e.name !== 'AbortError') setErr(String(e)); });
    return () => ac.abort();
  }, [filePath, isText, url]);

  useEffect(() => {
    if (viewMode !== 'diff') return;
    setDiffText(null); setErr('');
    const ac = new AbortController();
    fetch(`/file-diff?path=${encodeURIComponent(filePath)}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => setDiffText(data.diff))
      .catch((e) => { if (e.name !== 'AbortError') setErr(String(e)); });
    return () => ac.abort();
  }, [filePath, viewMode]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Focus close button on mount (dialog focus management)
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  // Mouse-click into iframe content escapes the Tab focus trap (focus moves to the iframe element
  // which is outside our focusables list). Bounce it back to the close button immediately.
  useEffect(() => {
    const onFocus = () => {
      const active = document.activeElement;
      if (active && active.tagName === 'IFRAME' && windowRef.current?.contains(active)) {
        closeBtnRef.current?.focus();
      }
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  // Focus trap — Tab/Shift+Tab cycles within the dialog (WCAG 2.1.2 modal-trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = windowRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset media error when file changes
  useEffect(() => { setMediaErr(''); }, [filePath]);

  // Drag/resize listeners — installed once per drag/resize cycle. Use refs to read current pos/size,
  // avoiding listener thrashing (prior version re-bound ~60×/sec via pos.x/y in deps).
  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const newPos = {
          x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragRef.current.ox)),
          // Clamp using current size so the full window stays inside the viewport (not just the 40px header).
          y: Math.max(0, Math.min(window.innerHeight - sizeRef.current.h - 16, e.clientY - dragRef.current.oy)),
        };
        setPos(newPos);
      }
      if (resizing) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        const newSize = {
          w: Math.max(360, Math.min(window.innerWidth - posRef.current.x - 16, resizeRef.current.startW + dx)),
          h: Math.max(280, Math.min(window.innerHeight - posRef.current.y - 16, resizeRef.current.startH + dy)),
        };
        setSize(newSize);
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, resizing]);

  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    setDragging(true);
    e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    setResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOpen = () =>
    fetch('/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) });

  const body = () => {
    if (viewMode === 'diff') {
      if (err) return <div className="pv-err">{err}</div>;
      if (diffText === null) return <div className="pv-loading">Loading diff…</div>;
      if (!diffText.trim()) return <div className="pv-loading">No changes in git for this file.</div>;

      const lines = diffText.split('\n');
      return (
        <pre className="pv-code">
          <code>
            {lines.map((line, i) => {
              let className = '';
              if (line.startsWith('+') && !line.startsWith('+++')) className = 'diff-add';
              else if (line.startsWith('-') && !line.startsWith('---')) className = 'diff-sub';
              else if (line.startsWith('@@')) className = 'diff-chunk';

              return (
                <div key={i} className={className}>
                  {line}
                </div>
              );
            })}
          </code>
        </pre>
      );
    }

    if (kind === 'image') return (
      <div className="pv-img-wrap">
        {mediaErr ? <div className="pv-err">{mediaErr}</div> : (
          <img src={url} alt={fileName} className="pv-img" onError={() => setMediaErr(`Failed to load image: ${fileName}`)} />
        )}
      </div>
    );
    if (kind === 'audio') return (
      <div className="pv-media">
        {mediaErr ? <div className="pv-err">{mediaErr}</div> : (
          <audio controls src={url} className="pv-audio" onError={() => setMediaErr(`Failed to load audio: ${fileName}`)} />
        )}
      </div>
    );
    if (kind === 'video') return (
      <div className="pv-media">
        {mediaErr ? <div className="pv-err">{mediaErr}</div> : (
          <video controls src={url} className="pv-video" onError={() => setMediaErr(`Failed to load video: ${fileName}`)} />
        )}
      </div>
    );
    // PDF: Chrome's native viewer is loaded inside the iframe and requires allow-same-origin
    // to resolve its chrome:// resources. The PDF format itself does not execute web-page scripts
    // in a way that can reach our backend, so allow-same-origin is acceptable here.
    // tabIndex=-1 keeps the iframe out of the Tab cycle so the dialog focus trap is not bypassed
    // by Tab moving into the iframe's internal document (where parent listeners can't see it).
    if (kind === 'pdf') return <iframe src={url} className="pv-iframe" title={fileName} sandbox="allow-scripts allow-same-origin" tabIndex={-1} />;
    if (kind === 'html') return (
      <iframe
        src={url}
        className="pv-iframe"
        title={fileName}
        sandbox="allow-scripts allow-popups allow-forms allow-modals allow-presentation"
        allow="autoplay; fullscreen"
        tabIndex={-1}
      />
    );
    if (err) return <div className="pv-err">{err}</div>;
    if (text === null) return <div className="pv-loading">Loading…</div>;
    if (kind === 'markdown') {
      const html = sanitizeHtml(marked(text) as string);
      return <div className="pv-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    const lang = getLang(fileName);
    let highlighted = text;
    try { highlighted = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch {}
    return (
      <pre className="pv-code">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    );
  };

  return (
    <div
      ref={windowRef}
      className={`pv-window${dragging ? ' pv-window--dragging' : ''}${resizing ? ' pv-window--resizing' : ''}`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${fileName}`}
    >
      <div className="pv-header" onMouseDown={handleDragStart}>
        <span className="pv-drag-handle" aria-hidden="true">⠿</span>
        <span className="pv-filename">{fileName}</span>
        <div className="pv-actions">
          {isText && (
            <>
              <button
                className={`pv-btn-open ${viewMode === 'content' ? 'active' : ''}`}
                aria-pressed={viewMode === 'content'}
                onClick={() => setViewMode('content')}
              >
                Content
              </button>
              <button
                className={`pv-btn-open ${viewMode === 'diff' ? 'active' : ''}`}
                aria-pressed={viewMode === 'diff'}
                onClick={() => setViewMode('diff')}
              >
                Diff
              </button>
            </>
          )}
          <button className="pv-btn-open" onClick={handleOpen}>Open</button>
          <button ref={closeBtnRef} className="pv-btn-close" onClick={onClose} aria-label="Close file preview" data-tooltip="Fechar visualização" data-tooltip-position="bottom"><CloseIcon /></button>
        </div>
      </div>
      <div className="pv-body">{body()}</div>
      <div className="pv-resize-handle" onMouseDown={handleResizeStart} aria-hidden />
    </div>
  );
}
