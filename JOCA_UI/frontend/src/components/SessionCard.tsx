import { useState, useEffect, useRef } from 'react';
import StatusDot from './StatusDot';
import type { SessionInfo } from '../App';

interface Props {
  session: SessionInfo;
  isActive: boolean;
  projectName?: string;
  outputPreview: string;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
}

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

export default function SessionCard({
  session, isActive, projectName, outputPreview,
  onSelect, onClose, onRename,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track done flash
  const prevStatus = useRef(session.status);
  const [doneFlash, setDoneFlash] = useState(false);

  useEffect(() => {
    if (prevStatus.current === 'working' && session.status === 'idle') {
      setDoneFlash(true);
      const t = setTimeout(() => setDoneFlash(false), 700);
      return () => clearTimeout(t);
    }
    prevStatus.current = session.status;
  }, [session.status]);

  useEffect(() => {
    if (editing) {
      setDraft(session.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, session.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== session.name) onRename(t);
    setEditing(false);
  };

  const dotStatus = doneFlash ? 'done' : session.status;

  const cardClass = [
    'session-card',
    isActive ? 'session-card--active' : '',
    `session-card--${session.status}`,
  ].filter(Boolean).join(' ');

  return (
    <article
      className={cardClass}
      onClick={() => !editing && onSelect()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-selected={isActive}
    >
      <div className="card-header">
        <StatusDot status={dotStatus} size="sm" />
        {editing ? (
          <input
            ref={inputRef}
            className="card-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); setDraft(session.name); setEditing(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="card-name"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`${session.name} — double-click to rename`}
          >
            {session.name}
          </span>
        )}
        {hovered && !editing && (
          <button
            className="card-close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close session"
          >
            ×
          </button>
        )}
      </div>

      <div className="card-preview" aria-hidden>
        <pre className="card-preview-text">{outputPreview || '…'}</pre>
      </div>

      <div className="card-footer">
        {projectName && <span className="card-project-chip">{projectName}</span>}
        <span className="card-cwd">{shortPath(session.cwd)}</span>
      </div>
    </article>
  );
}
