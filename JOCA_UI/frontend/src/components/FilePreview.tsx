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
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, Math.round((window.innerWidth - 700) / 2)),
    y: 60,
  }));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ ox: number; oy: number }>({ ox: 0, oy: 0 });

  const fileName = filePath.split('/').pop() ?? filePath;
  const kind = getKind(fileName);
  const isText = ['code', 'text', 'markdown'].includes(kind);
  const url = `/file-content?path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    setText(null); setErr('');
    setViewMode('content');
    if (!isText) return;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => setText(t.slice(0, 600_000)))
      .catch((e) => setErr(String(e)));
  }, [filePath, isText, url]);

  useEffect(() => {
    if (viewMode !== 'diff') return;
    setDiffText(null); setErr('');
    fetch(`/file-diff?path=${encodeURIComponent(filePath)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => setDiffText(data.diff))
      .catch((e) => setErr(String(e)));
  }, [filePath, viewMode]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragRef.current.ox)),
        y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragRef.current.oy)),
      });
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    setDragging(true);
    e.preventDefault();
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
        <img src={url} alt={fileName} className="pv-img" />
      </div>
    );
    if (kind === 'audio') return (
      <div className="pv-media">
        <audio controls src={url} className="pv-audio" />
      </div>
    );
    if (kind === 'video') return (
      <div className="pv-media">
        <video controls src={url} className="pv-video" />
      </div>
    );
    if (kind === 'pdf') return <iframe src={url} className="pv-iframe" title={fileName} />;
    if (kind === 'html') return <iframe src={url} className="pv-iframe" title={fileName} sandbox="allow-scripts" />;
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
      className={`pv-window${dragging ? ' pv-window--dragging' : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="pv-header" onMouseDown={handleDragStart}>
        <span className="pv-drag-handle">⠿</span>
        <span className="pv-filename">{fileName}</span>
        <div className="pv-actions">
          {isText && (
            <>
              <button
                className={`pv-btn-open ${viewMode === 'content' ? 'active' : ''}`}
                onClick={() => setViewMode('content')}
              >
                Content
              </button>
              <button
                className={`pv-btn-open ${viewMode === 'diff' ? 'active' : ''}`}
                onClick={() => setViewMode('diff')}
              >
                Diff
              </button>
            </>
          )}
          <button className="pv-btn-open" onClick={handleOpen}>Open</button>
          <button className="pv-btn-close" onClick={onClose} aria-label="Close file preview" data-tooltip="Fechar visualização" data-tooltip-position="bottom"><CloseIcon /></button>
        </div>
      </div>
      <div className="pv-body">{body()}</div>
    </div>
  );
}
