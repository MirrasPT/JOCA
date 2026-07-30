import type { JocaLogicInfo, Project, SessionInfo, ProjectMemory } from '../types';
import ProjectsOverview from './dashboard/ProjectsOverview';
import type { RateLimits } from './dashboard/RateBar';
import './DashboardView.css';

// Re-export so existing consumers keep importing { RateLimits } from './DashboardView'.
export type { RateLimits };

interface Props {
  mainView: 'dashboard' | 'project';
  projects: Project[];
  sessions: SessionInfo[];
  activeProjectId: string | null;
  projectMemory: Record<string, ProjectMemory>;
  jocaLogicInfo: JocaLogicInfo | null;
  onUpdateProjectMemory: (projectId: string, patch: Partial<ProjectMemory>) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onShowProject: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  setRightPanel: (panel: 'files' | 'toolkit' | 'settings' | null) => void;
  onPreviewFile: (path: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, patch: Partial<Project>) => Promise<void>;
  onRenameSession?: (id: string, name: string) => void;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
  rateLimits: RateLimits | null;
}

// O panorama global de projectos. A vista de UM projecto deixou de passar por aqui: vive no
// ProjectWorkspace (chat do gestor em destaque), montado directamente pelo App em mainView
// === 'project'. As props que só serviam esse ramo ficam na interface por o App as passar na mesma.
export default function DashboardView(props: Props) {
  return (
    <ProjectsOverview
      projects={props.projects}
      sessions={props.sessions}
      jocaLogicInfo={props.jocaLogicInfo}
      rateLimits={props.rateLimits}
      onCreateProject={props.onCreateProject}
      onEditProject={props.onEditProject}
      onShowProject={props.onShowProject}
      onOpenProject={props.onOpenProject}
      onSwitchSession={props.onSwitchSession}
      onNewSession={props.onNewSession}
      onRenameProject={props.onRenameProject}
      onRenameSession={props.onRenameSession}
    />
  );
}
