import type { JocaLogicInfo, Project, SessionInfo } from '../types';
import ProjectsOverview from './dashboard/ProjectsOverview';
import type { RateLimits } from './dashboard/RateBar';
import './DashboardView.css';

// Re-export so existing consumers keep importing { RateLimits } from './DashboardView'.
export type { RateLimits };

// The view of ONE project no longer goes through here (it lives in ProjectWorkspace); this layer
// was a passthrough with eight dead props from that era — mainView, projectMemory, setRightPanel,
// onPreviewFile, etc. — that forced the App to pass things nobody read. Interface = actual use.
interface Props {
  projects: Project[];
  sessions: SessionInfo[];
  jocaLogicInfo: JocaLogicInfo | null;
  rateLimits: RateLimits | null;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onShowProject: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  /** Sends `/save` (with Enter) to the given conversations — the header's "Save all". */
  onSaveAll: (sessionIds: string[]) => void;
  onRenameProject?: (id: string, name: string) => void;
  onRenameSession?: (id: string, name: string) => void;
}

export default function DashboardView(props: Props) {
  return <ProjectsOverview {...props} />;
}
