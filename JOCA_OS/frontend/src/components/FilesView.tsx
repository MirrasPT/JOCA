import FileBrowser from './FileBrowser';

interface Props {
  onPastePath: (path: string) => void;
  onPreview: (path: string) => void;
  initialPath?: string;
  onClose: () => void;
  selectedPath?: string | null;
}

function ChevronsRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  );
}

export default function FilesView({ onPastePath, onPreview, initialPath, onClose, selectedPath }: Props) {
  return (
    <div className="files-view">
      <div className="files-view-header">
        <div>
          <span className="files-view-title">Workspace Files</span>
          <span className="files-view-subtitle">Real filesystem</span>
        </div>
        <button className="files-view-close" onClick={onClose} aria-label="Collapse files" data-tooltip="Fechar painel" data-tooltip-position="bottom">
          <ChevronsRight />
        </button>
      </div>
      <FileBrowser onPastePath={onPastePath} onPreview={onPreview} initialPath={initialPath} selectedPath={selectedPath} />
    </div>
  );
}
