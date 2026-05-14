import { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { TerminalRef } from '../App';

interface Props {
  sessionId: string;
  isActive: boolean;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
}

function quotePath(p: string) {
  return p.includes(' ') ? `"${p}"` : p;
}

function extractPaths(e: DragEvent): string[] {
  const paths: string[] = [];

  // macOS Finder drag exposes file:// URIs in text/uri-list
  const uriList = e.dataTransfer?.getData('text/uri-list') ?? '';
  for (const line of uriList.split(/\r?\n/)) {
    const uri = line.trim();
    if (!uri || uri.startsWith('#')) continue;
    if (uri.startsWith('file://')) {
      try {
        paths.push(decodeURIComponent(new URL(uri).pathname));
      } catch {}
    }
  }

  // Fallback: plain text (e.g. path copied as text)
  if (paths.length === 0) {
    const text = e.dataTransfer?.getData('text/plain') ?? '';
    if (text.trim()) paths.push(text.trim());
  }

  // Last resort: file names only (no full path available in browser sandbox)
  if (paths.length === 0 && e.dataTransfer?.files.length) {
    for (const f of Array.from(e.dataTransfer.files)) {
      paths.push(f.name);
    }
  }

  return paths;
}

export default function TerminalPane({ sessionId, isActive, onInput, onResize, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#08060e',
        foreground: '#c8bfd8',
        cursor: '#e8601c',
        cursorAccent: '#08060e',
        selectionBackground: 'rgba(232,96,28,0.2)',
        selectionForeground: '#f0ecf4',
        black: '#3d3050',
        red: '#f06a6a',
        green: '#3dba7a',
        yellow: '#f59332',
        blue: '#9080c0',
        magenta: '#c080d0',
        cyan: '#50b8b0',
        white: '#9088a0',
        brightBlack: '#5a4870',
        brightRed: '#ff8888',
        brightGreen: '#50d490',
        brightYellow: '#f5a848',
        brightBlue: '#a090d0',
        brightMagenta: '#d090e0',
        brightCyan: '#60c8b8',
        brightWhite: '#f0ecf4',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13.5,
      lineHeight: 1.5,
      letterSpacing: 0.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 5000,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    term.onData((data) => onInput(sessionId, data));

    onReady(sessionId, {
      write: (data) => term.write(data),
      reset: () => term.reset(),
    });

    requestAnimationFrame(() => {
      fitAddon.fit();
      onResize(sessionId, term.cols, term.rows);
    });

    const ro = new ResizeObserver(() => {
      if (term.element?.offsetParent !== null) {
        fitAddon.fit();
        onResize(sessionId, term.cols, term.rows);
      }
    });
    ro.observe(containerRef.current);
    resizeObserver.current = ro;

    return () => {
      ro.disconnect();
      term.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-and-drop: paste file paths into the PTY
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    };

    const onDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setDragOver(false);
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      // Priority 1: image data (screenshot thumbnail, web image, etc.)
      const imageItem = Array.from(e.dataTransfer?.items ?? []).find(
        (i) => i.kind === 'file' && i.type.startsWith('image/')
      );
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          const ext = file.type.split('/')[1]?.split('+')[0] || 'png';
          const buf = await file.arrayBuffer();
          try {
            const res = await fetch('/upload', {
              method: 'POST',
              headers: {
                'Content-Type': file.type,
                'x-file-ext': ext,
                'x-file-name': file.name || '',
              },
              body: buf,
            });
            const { path: filePath } = await res.json() as { path: string };
            onInput(sessionId, quotePath(filePath));
            termRef.current?.focus();
          } catch {
            // fallback to filename if upload fails
            onInput(sessionId, quotePath(file.name));
          }
          return;
        }
      }

      // Priority 2: file:// URI from Finder drag
      const paths = extractPaths(e);
      if (paths.length === 0) return;
      const text = paths.map(quotePath).join(' ');
      onInput(sessionId, text);
      termRef.current?.focus();
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [sessionId, onInput]);

  useLayoutEffect(() => {
    if (isActive && fitRef.current && termRef.current) {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
        if (termRef.current) {
          onResize(sessionId, termRef.current.cols, termRef.current.rows);
          termRef.current.focus();
        }
      });
    }
  }, [isActive, sessionId, onResize]);

  return (
    <div
      ref={containerRef}
      className={`terminal-container ${dragOver ? 'drag-over' : ''}`}
    />
  );
}
