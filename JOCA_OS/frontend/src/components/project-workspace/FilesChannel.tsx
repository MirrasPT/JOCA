import FileBrowser from '../FileBrowser';

interface Props {
  path: string;
  onPreviewFile: (path: string) => void;
}

export default function FilesChannel({ path, onPreviewFile }: Props) {
  return (
    <div className="project-folder-browser">
      <FileBrowser
        embedded
        initialPath={path}
        onPreview={onPreviewFile}
        onPastePath={() => {}}
        selectedPath={null}
      />
    </div>
  );
}
