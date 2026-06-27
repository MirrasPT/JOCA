import { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { TerminalRef } from '../types';
import { captureDrop, resolveDrop, uploadPastedImages, quotePath } from '../lib/fileDrop';

interface Props {
  sessionId: string;
  isActive: boolean;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
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
      },
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 2000000,
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

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
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

      // Capture synchronously (dataTransfer expires after await), then resolve to absolute paths:
      // real path if the source gave one, otherwise upload the file/folder content and use the
      // saved-copy path. See lib/fileDrop.ts.
      const cap = captureDrop(e);
      const { paths } = await resolveDrop(cap);
      if (paths.length === 0) return;
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
  }, [sessionId, onInput]);

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
    <div
      ref={containerRef}
      className={`terminal-container ${dragOver ? 'drag-over' : ''}`}
    />
  );
}
