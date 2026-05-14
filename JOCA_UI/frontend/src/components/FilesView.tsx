import FileBrowser from './FileBrowser';

interface Props {
  onPastePath: (path: string) => void;
  onPreview: (path: string) => void;
  initialPath?: string;
  onClose: () => void;
}

export default function FilesView({ onPastePath, onPreview, initialPath, onClose }: Props) {
  return (
    <div className="files-view">
      <div className="files-view-header">
        <span className="files-view-title">Files</span>
        <button className="files-view-close" onClick={onClose} aria-label="Close files">×</button>
      </div>
      <FileBrowser onPastePath={onPastePath} onPreview={onPreview} initialPath={initialPath} />
    </div>
  );
}
