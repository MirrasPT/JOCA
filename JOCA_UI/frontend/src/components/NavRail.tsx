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
          ◫
        </button>
      </div>
    </nav>
  );
}
