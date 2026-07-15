interface Props {
  showFiles: boolean;
  onToggleFiles: () => void;
}

export default function NavRail({ showFiles, onToggleFiles }: Props) {
  return (
    <nav className="nav-rail" aria-label="Main navigation">
      <div className="nav-brand" aria-hidden>
        <span className="nav-brand-letter">J</span>
      </div>

      <div className="nav-items">
        <button
          className={`nav-item ${showFiles ? 'active' : ''}`}
          onClick={onToggleFiles}
          data-tooltip="Files"
          aria-label="Toggle files"
          aria-pressed={showFiles}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H11l2 2h4.5A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
