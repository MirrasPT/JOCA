import type { JocaLogicInfo, Project, SessionInfo } from '../types';
import ProjectsOverview from './dashboard/ProjectsOverview';
import type { RateLimits } from './dashboard/RateBar';
import './DashboardView.css';

// Re-export so existing consumers keep importing { RateLimits } from './DashboardView'.
export type { RateLimits };

// A vista de UM projecto deixou de passar por aqui (vive no ProjectWorkspace); esta camada era um
// passthrough com oito props mortas desse tempo — mainView, projectMemory, setRightPanel,
// onPreviewFile, etc. — que obrigavam o App a passar coisas que ninguém lia. Interface = uso real.
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
  onRenameProject?: (id: string, name: string) => void;
  onRenameSession?: (id: string, name: string) => void;
}

export default function DashboardView(props: Props) {
  return <ProjectsOverview {...props} />;
}
