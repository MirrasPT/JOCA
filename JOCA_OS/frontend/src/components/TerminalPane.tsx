import { useEffect, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { TerminalRef } from '../types';
import { captureDrop, dragRealPaths, dropHadFilesWithoutPath, resolveDrop, uploadPastedImages, quotePath } from '../lib/fileDrop';

interface Props {
  sessionId: string;
  isActive: boolean;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
}

const DARK_TERM_THEME = {
  background: '#0c0c0c',
  foreground: '#e0e0e0',
  cursor: '#ff4500',
  cursorAccent: '#0c0c0c',
  selectionBackground: 'rgba(255,69,0,0.18)',
  selectionForeground: '#ffffff',
  black: '#1a1a1a',
  red: '#f06a6a',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#a0a0a0',
  brightBlack: '#555555',
  brightRed: '#ff8888',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f5f5f5',
};

const LIGHT_TERM_THEME = {
  background: '#fbfaf7',
  foreground: '#2b2822',
  cursor: '#ff4500',
  cursorAccent: '#fbfaf7',
  selectionBackground: 'rgba(255,69,0,0.16)',
  selectionForeground: '#17140f',
  black: '#3c382f',
  red: '#c2410c',
  green: '#15803d',
  yellow: '#a16207',
  blue: '#1d4ed8',
  magenta: '#a21caf',
  cyan: '#0e7490',
  white: '#6c675d',
  brightBlack: '#8a8578',
  brightRed: '#dc2626',
  brightGreen: '#16a34a',
  brightYellow: '#b45309',
  brightBlue: '#2563eb',
  brightMagenta: '#c026d3',
  brightCyan: '#0891b2',
  brightWhite: '#17140f',
};

function currentTermTheme() {
  return document.documentElement.dataset.theme === 'light' ? LIGHT_TERM_THEME : DARK_TERM_THEME;
}

export default function TerminalPane({ sessionId, isActive, onInput, onResize, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Non-blocking hint when a drop carried files but the OS hid the real path (Explorer sandbox).
  const [dropHint, setDropHint] = useState(false);
  const dropHintTimer = useRef<number | null>(null);
  const flashDropHint = useCallback(() => {
    setDropHint(true);
    if (dropHintTimer.current) clearTimeout(dropHintTimer.current);
    dropHintTimer.current = window.setTimeout(() => setDropHint(false), 4000);
  }, []);
  useEffect(() => () => { if (dropHintTimer.current) clearTimeout(dropHintTimer.current); }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: currentTermTheme(),
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 2000000,
      allowTransparency: false,
      // Apps que imprimem branco truecolor/ANSI cru (fora da palette do theme) ficam
      // invisíveis num fundo claro — xterm ajusta o foreground por célula para manter
      // contraste mínimo, independente da cor pedida pela app.
      minimumContrastRatio: 4.5,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Terminal-friendly Ctrl+C / Ctrl+V (Cmd on macOS):
    //  • Ctrl+C WITH a selection → copy to clipboard (don't send ^C). No selection → let ^C through
    //    (interrupt), the standard Windows-Terminal behaviour.
    //  • Ctrl+Shift+V → paste clipboard text into the PTY (Ctrl+V alone stays free for xterm's own
    //    paste path, which also feeds the image-paste handler below).
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'c' || e.key === 'C')) {
        const sel = term.getSelection();
        if (sel && sel.length > 0) {
          navigator.clipboard?.writeText(sel).catch(() => {});
          return false; // handled: copy instead of interrupt
        }
        return true; // no selection → send ^C (interrupt)
      }
      if (mod && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        navigator.clipboard?.readText().then((t) => { if (t) onInput(sessionId, t); }).catch(() => {});
        return false;
      }
      return true;
    });

    term.onData((data) => onInput(sessionId, data));

    onReady(sessionId, {
      write: (data) => term.write(data),
      reset: () => term.reset(),
      clear: () => term.clear(),
      scrollToBottom: () => term.scrollToBottom(),
      fit: () => { fitAddon.fit(); onResize(sessionId, term.cols, term.rows); },
    });

    const doFit = () => {
      try {
        fitAddon.fit();
        onResize(sessionId, term.cols, term.rows);
      } catch {}
    };

    requestAnimationFrame(doFit);
    const t1 = setTimeout(doFit, 100);
    const t2 = setTimeout(doFit, 300);
    const t3 = setTimeout(doFit, 800);

    let resizeRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(doFit);
    });
    ro.observe(containerRef.current);
    resizeObserver.current = ro;

    const themeObserver = new MutationObserver(() => {
      term.options.theme = currentTermTheme();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      themeObserver.disconnect();
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

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      // Drag = reference the file by its real PATH (no copy). Only Ctrl+V saves to JOCA_Drops. The
      // browser hides OS-file-manager paths (Windows Explorer sandbox) → dragRealPaths is [] there;
      // dragging from JOCA's own file browser (or macOS Finder) provides the real path. See fileDrop.ts.
      const cap = captureDrop(e);
      const paths = dragRealPaths(cap);
      if (paths.length === 0) {
        if (dropHadFilesWithoutPath(cap)) {
          // Explorer drag (#3): no real path → upload a copy to JOCA_Drops and paste that path.
          flashDropHint();
          void resolveDrop(cap).then(({ paths: uploaded }) => {
            if (uploaded.length) { onInput(sessionId, uploaded.map(quotePath).join(' ')); termRef.current?.focus(); }
          });
        }
        return;
      }
      onInput(sessionId, paths.map(quotePath).join(' '));
      termRef.current?.focus();
    };

    // Ctrl+V of an image into the terminal: upload to JOCA_Drops and paste its path into the PTY.
    // Capture phase so we intercept before xterm's own paste handling; text pastes (no image
    // items) fall through untouched to xterm.
    const onPaste = async (e: ClipboardEvent) => {
      const imgs = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null);
      if (imgs.length === 0) return; // let xterm handle the text paste
      e.preventDefault();
      e.stopPropagation();
      const paths = await uploadPastedImages(imgs, Date.now());
      if (paths.length === 0) return;
      onInput(sessionId, paths.map(quotePath).join(' '));
      termRef.current?.focus();
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    el.addEventListener('paste', onPaste, true);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('paste', onPaste, true);
    };
  }, [sessionId, onInput, flashDropHint]);

  useLayoutEffect(() => {
    if (!isActive || !fitRef.current || !termRef.current) return;
    const doFit = () => {
      try {
        fitRef.current?.fit();
        if (termRef.current) {
          onResize(sessionId, termRef.current.cols, termRef.current.rows);
          termRef.current.focus();
        }
      } catch {}
    };
    requestAnimationFrame(doFit);
    const t1 = setTimeout(doFit, 100);
    const t2 = setTimeout(doFit, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isActive, sessionId, onResize]);

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={containerRef}
        className={`terminal-container ${dragOver ? 'drag-over' : ''}`}
      />
      {dropHint && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            top: 12,
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 24px)',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(232, 96, 28, 0.12)',
            border: '1px solid rgba(232, 96, 28, 0.35)',
            color: 'var(--text-bright)',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          }}
        >
          Arrasta do painel Ficheiros do JOCA ou usa Ctrl+V para anexar
        </div>
      )}
    </div>
  );
}
