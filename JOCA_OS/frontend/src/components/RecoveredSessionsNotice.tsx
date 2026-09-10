// The notice that JOCA restarted and took conversations down with it.
//
// The problem it solves: the backend restarts, the PTYs die, and the next `sessions_list` — which
// is the server's authoritative snapshot — prunes everything. The list empties silently and
// whoever was mid-conversation is left not understanding where it went. The pruning is right; what
// was missing was the explanation and the only honest way out: reading what the conversation had
// written. Reopening deliberately does not exist — it would start a NEW CLI, with no memory
// whatsoever of what had happened there.
//
// It is not a modal: it does not steal focus nor lock the app. A restart is not a decision to
// make, it is a thing to know — it stays at the top, waiting, until someone touches it. Only
// reading the output (which is a thing you go and READ, and takes up the screen) opens as a dialog.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import type { RecoveredSession, RecoveredSnapshot } from '../types';
import './recovered-sessions.css';

interface Props {
  snapshot: RecoveredSnapshot | null;
  onDismiss: () => void;
  onLoadTail: (sessionId: string) => Promise<string>;
}

// Selector for what is reachable by Tab — the same one the App uses in the Settings modal.
const FOCUSAVEIS = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Fallback geometry: a snapshot from a backend older than the `cols`/`rows` fields. The value is
 *  the size the backend creates each PTY with — see `sessions-snapshot.ts`, which normalizes the same. */
const GEOMETRIA_FALLBACK = { cols: 120, rows: 30 };

/** Lines kept above the screen. A tail is <= 256 KB, so this is never what cuts it. */
const SCROLLBACK = 10_000;

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** When the snapshot was saved. Absolute format deliberately: a "4 min ago" computed in the render
 *  ages on screen with nobody updating it, and lies to whoever left the tab open. */
function quando(savedAt?: number): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || savedAt <= 0) return null;
  try {
    return new Date(savedAt).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

function tamanho(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function RecoveredSessionsNotice({ snapshot, onDismiss, onLoadTail }: Props) {
  const [aLer, setALer] = useState<RecoveredSession | null>(null);

  const fecharLeitura = useCallback(() => setALer(null), []);

  if (!snapshot || snapshot.sessions.length === 0) return null;

  const total = snapshot.sessions.length;
  const data = quando(snapshot.savedAt);

  return (
    <>
      {/* `role="status"` (aria-live polite) — it announces itself to screen-reader users without
          interrupting whatever is being read. A restart is not an emergency. */}
      <section className="rec-notice" role="status" aria-label="Conversations closed by a restart">
        <header className="rec-notice-head">
          <span className="rec-notice-icon" aria-hidden><RestartIcon /></span>
          <div className="rec-notice-titles">
            <h2 className="rec-notice-title">JOCA restarted</h2>
            <p className="rec-notice-sub">
              {total === 1 ? 'One conversation was closed' : `${total} conversations were closed`}
              {data ? ` · ${data}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="rec-notice-x"
            onClick={onDismiss}
            aria-label="Dismiss the notice and delete the record of the closed conversations"
          >
            <CloseIcon />
          </button>
        </header>

        <p className="rec-notice-explain">
          Terminals do not survive a server restart. The output of each conversation was saved and
          you can read it here.
        </p>

        <ul className="rec-notice-list">
          {snapshot.sessions.map((s) => {
            const peso = tamanho(s.tailBytes);
            return (
              <li key={s.id} className="rec-row">
                <div className="rec-row-info">
                  <span className="rec-row-name">{s.name}</span>
                  <span className="rec-row-meta">
                    {s.cli && s.cli !== 'claude' ? <span className="rec-row-cli">{s.cli}</span> : null}
                    <span className="rec-row-cwd" title={s.cwd}>{s.cwd}</span>
                  </span>
                </div>
                <div className="rec-row-actions">
                  <button
                    type="button"
                    className="rec-btn"
                    onClick={() => setALer(s)}
                    disabled={!peso}
                    aria-label={`View the output of ${s.name}`}
                    title={peso ? `${peso} of saved output` : 'No saved output'}
                  >
                    View output
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="rec-notice-foot">
          <button type="button" className="rec-btn" onClick={onDismiss}>Dismiss</button>
        </footer>
      </section>

      {aLer && <TailDialog session={aLer} onLoadTail={onLoadTail} onClose={fecharLeitura} />}
    </>
  );
}

/**
 * The output the conversation had when it died, repainted by a real terminal.
 *
 * Why xterm and not a strip of the escapes: the default CLI is `claude`, a TUI, and a TUI does not
 * write lines — it redraws the screen by position (moves the cursor up, clears the line, writes
 * over it). Whoever strips the escapes and splits the text by `\n` sees dozens of visual lines glued
 * into a single chunk and keeps the last one, because the last `clear line` was the one that won.
 * Measured on a real 2767-character tail: the strip gave 150 characters over 2 lines; the same text
 * repainted in xterm, at the original geometry, gives the entire Claude Code screen (name, version,
 * model, folder, composer and status bar).
 *
 * The terminal is read-only — it is born with no input and no blinking cursor, and nothing goes
 * back: the PTYs died with the previous backend.
 */
function TailDialog({ session, onLoadTail, onClose }: {
  session: RecoveredSession;
  onLoadTail: (sessionId: string) => Promise<string>;
  onClose: () => void;
}) {
  const [cru, setCru] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const cols = session.cols ?? GEOMETRIA_FALLBACK.cols;
  const rows = session.rows ?? GEOMETRIA_FALLBACK.rows;

  useEffect(() => {
    let vivo = true;
    onLoadTail(session.id)
      .then((texto) => { if (vivo) setCru(texto); })
      .catch(() => { if (vivo) setErro('Could not read this conversation\'s saved output.'); });
    return () => { vivo = false; };
  }, [session.id, onLoadTail]);

  // Focus: capture whoever opened it BEFORE focusing anything at all, and give it back on close.
  // No `autoFocus` — competing with it is the known road to focus ending up on <body>.
  // Deliberately a separate effect from the keyboard one: if `onClose` changes identity, only the
  // listener is rebuilt; recapturing "who opened it" mid-flight would store the close button
  // instead of the trigger.
  useEffect(() => {
    const abriu = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    return () => { abriu?.focus?.(); };
  }, []);

  useEffect(() => {
    const aoTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const caixa = dialogRef.current;
      if (!caixa) return;
      const focaveis = [...caixa.querySelectorAll<HTMLElement>(FOCUSAVEIS)].filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primeiro || activo === caixa)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    // Capture phase, like the rest of the app: this box's Escape must not leak to the App's global
    // handlers (which would close something else entirely).
    document.addEventListener('keydown', aoTeclado, true);
    return () => document.removeEventListener('keydown', aoTeclado, true);
  }, [onClose]);

  return (
    <div
      className="rec-tail-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rec-tail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-tail-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="rec-tail-head">
          <div className="rec-tail-titles">
            <h2 id="rec-tail-title">{session.name}</h2>
            <p className="rec-tail-cwd">{session.cwd}</p>
          </div>
          <button ref={fecharRef} type="button" className="rec-tail-x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        {/* `tabIndex={0}`: a box that scrolls has to be reachable by keyboard, otherwise whoever
            navigates without a mouse cannot get there. */}
        <div className="rec-tail-body" tabIndex={0} role="region" aria-label="Saved output">
          {erro ? <p className="rec-tail-msg">{erro}</p> : null}
          {!erro && cru === null ? <p className="rec-tail-msg">Reading…</p> : null}
          {!erro && cru !== null ? (
            cru.length > 0 ? <TailReplay cru={cru} cols={cols} rows={rows} />
              : <p className="rec-tail-msg">This conversation had no saved output.</p>
          ) : null}
        </div>

        <footer className="rec-tail-foot">
          <span className="rec-tail-note">Repainted as it was in the terminal ({cols}×{rows}).</span>
          <button type="button" className="rec-btn" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * A read-only xterm, with the raw output written inside it.
 *
 * The geometry is the ORIGINAL one, and not the one that would fit the box: a TUI positions in
 * absolute terms (`ESC[29;3H`) and clears by line, so replaying it narrower breaks the rules in half
 * and replaying it shorter sends the status bar off screen. Measured on the same tail: 180×32 shows
 * the screen's 10 lines; 180×24 shows 6. If it does not fit the box, it is the box that scrolls —
 * the geometry does not give.
 *
 * Colors: only the background and the text come from the app's tokens (`--bg-terminal`,
 * `--text-normal`), so the reader belongs to the active theme. The 16 ANSI colors stay xterm's own;
 * `minimumContrastRatio` is the same as the real terminal's and it is what stops a hardcoded white
 * from disappearing over a light background.
 */
function TailReplay({ cru, cols, rows }: { cru: string; cols: number; rows: number }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const raiz = getComputedStyle(document.documentElement);
    const token = (nome: string) => raiz.getPropertyValue(nome).trim() || undefined;

    const term = new Terminal({
      cols,
      rows,
      fontFamily: token('--font-mono') ?? 'ui-monospace, monospace',
      // 11px and not the real terminal's 13: here the entire screen of a session (30-32 lines) has
      // to fit in a box, and each line costs almost twice the font size in height.
      fontSize: 11,
      lineHeight: 1.4,
      scrollback: SCROLLBACK,
      // Dead conversation: nothing is written into it, and a blinking cursor in a terminal that no
      // longer receives anything is a false promise.
      disableStdin: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      minimumContrastRatio: 4.5,
      theme: { background: token('--bg-terminal'), foreground: token('--text-normal') },
    });

    term.open(host);
    term.write(cru);

    return () => term.dispose();
  }, [cru, cols, rows]);

  // `width: max-content` (in the CSS) so the box's flex does not shrink the terminal below the
  // width the geometry requires — shrinking here would be the same as replaying at another width.
  return <div className="rec-tail-term" ref={hostRef} />;
}
