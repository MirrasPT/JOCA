import type { JocaLogicInfo, Project, SessionInfo, ProjectMemory } from '../types';
import ProjectDetailView from './dashboard/ProjectDetailView';
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

// Thin router: the project dashboard and the global dashboard are two independent views (never
// mounted together), each owning its own state — see ./dashboard/ProjectDetailView + ProjectsOverview.
export default function DashboardView(props: Props) {
  if (props.mainView === 'project') {
    const project = props.projects.find((p) => p.id === props.activeProjectId) ?? null;
    return (
      <ProjectDetailView
        project={project}
        sessions={props.sessions}
        onEditProject={props.onEditProject}
        onOpenProject={props.onOpenProject}
        onSwitchSession={props.onSwitchSession}
        onPreviewFile={props.onPreviewFile}
        onRenameProject={props.onRenameProject}
        onUpdateProject={props.onUpdateProject}
        onRenameSession={props.onRenameSession}
        onCreateProjectSkill={props.onCreateProjectSkill}
      />
    );
  }
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
