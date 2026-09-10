// Tabs for a project's terminals — navigation between agents, in the place everyone already
// expects to find it (on top of what it controls), instead of a fixed column beside it.
//
// It replaces the old `WorkersChannel` side list: with one agent, the column spent 285px to show
// a single row; with five, it was a list you had to search. One tab per terminal solves both
// cases and gives the width back to the terminal.
import { useEffect, useRef, useState } from 'react';
import type { CliProfileInfo, SessionInfo } from '../../types';
import InlineName from '../InlineName';

export interface TerminalTab {
  id: string;
  label: string;
  working: boolean;
}

interface Props {
  tabs: TerminalTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** Rename the session (double click on the tab name). Absent = name not editable. */
  onRename?: (id: string, name: string) => void;
  onNew: (cli?: string) => void;
}

/**
 * One tab per project terminal. Single source: the WebSocket sessions. There used to be a second
 * source here — the project manager's pool of areas —, removed along with it.
 */
export function buildTabs(projectSessions: SessionInfo[]): TerminalTab[] {
  return projectSessions.map((s) => ({
    id: s.id,
    label: s.name || 'Terminal',
    working: s.status === 'working',
  }));
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export default function TerminalTabs({
  tabs, activeId, onSelect, onClose, onRename, onNew,
}: Props) {
  // Closing kills work mid-flight — it is confirmed on the tab itself, as in the rest of the app,
  // instead of a modal on top of the terminal.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cliMenuOpen, setCliMenuOpen] = useState(false);
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[] | null>(null);
  const newWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cliMenuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (newWrapRef.current && !newWrapRef.current.contains(ev.target as Node)) setCliMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [cliMenuOpen]);

  const openCliMenu = () => {
    setCliMenuOpen((o) => !o);
    if (cliProfiles === null) {
      fetch('/cli-profiles').then((r) => r.json())
        .then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : []))
        .catch(() => setCliProfiles([]));
    }
  };

  return (
    <div className="pw-tabbar">
      <div className="pw-tabs" role="tablist" aria-label="Project terminals">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div key={t.id} className={`pw-tab ${active ? 'pw-tab--active' : ''}`}>
              {/* `div[role=tab]` and not `<button>`: the name is editable and an <input> cannot live
                  inside a button. The keyboard behavior is restored by hand. */}
              <div
                role="tab"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                className="pw-tab-main"
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id); }
                }}
                // The state goes in the accessible name (the green dot is decorative) — this app has
                // no screen-reader-only text utility class, and a <span> hidden "by hand" here
                // actually showed up on screen.
                aria-label={`${t.label}${t.working ? ' — working' : ''}`}
              >
                <span className={`pw-tab-dot ${t.working ? 'pw-tab-dot--working' : ''}`} aria-hidden />
                <InlineName
                  value={t.label}
                  onRename={onRename ? (name) => onRename(t.id, name) : undefined}
                  onActivate={() => onSelect(t.id)}
                  className="pw-tab-label"
                  inputClassName="pw-tab-name-input"
                  title={`${t.label} — double-click renames`}
                />
              </div>
              {confirmId === t.id ? (
                <span className="pw-tab-confirm">
                  <button type="button" className="pw-tab-confirm-yes" onClick={() => { setConfirmId(null); onClose(t.id); }}>close</button>
                  <button type="button" className="pw-tab-confirm-no" onClick={() => setConfirmId(null)}>no</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="pw-tab-close"
                  onClick={() => setConfirmId(t.id)}
                  aria-label={`Close terminal ${t.label}`}
                  title="Close this terminal"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}

        {/* The "+" follows the last tab: with few terminals, the fixed button on the right sat far
            from where you are looking. This one is just "open one more" — the CLI choice lives in
            the button on the right, which is not clipped by this row's horizontal scroll. */}
        <button
          type="button"
          className="pw-tab-add"
          onClick={() => onNew()}
          title="Open a new terminal"
          aria-label="Open a new terminal"
        >+</button>
      </div>

      {/* Outside the tab row deliberately — see the note on `.pw-tabs` in the CSS. */}
      <div className="pw-tab-new-wrap" ref={newWrapRef}>
        <button type="button" className="pw-tab-new" onClick={() => onNew()} title="Open a new terminal (choose the CLI in the arrow beside it)" aria-label="Open a new terminal">+</button>
        <button type="button" className="pw-tab-new-caret" onClick={openCliMenu} aria-haspopup="menu" aria-expanded={cliMenuOpen} aria-label="Choose the new terminal's CLI">▾</button>
        {cliMenuOpen && (
          <div className="pw-cli-menu" role="menu" aria-label="Available CLIs">
            {(cliProfiles ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="pw-cli-item"
                disabled={!p.available}
                onClick={() => { setCliMenuOpen(false); onNew(p.id); }}
              >
                {p.label}{p.available ? '' : ' (not installed)'}
              </button>
            ))}
            {cliProfiles === null && <div className="pw-cli-item pw-cli-item--loading">Loading…</div>}
            {cliProfiles?.length === 0 && <div className="pw-cli-item pw-cli-item--loading">No CLI profiles.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
