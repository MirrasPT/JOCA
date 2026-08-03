// Joca — o gestor global (mainView === 'joca'). Mesmo ManagerChat que cada projecto usa, sem
// `projectId`: fala de todos os projectos, não de um só. Sem painel de workers/pasta ao lado (essa
// composição só faz sentido dentro de UM projecto) — o Joca global fica só o chat, espaço nobre.
import ManagerChat from './ManagerChat';

interface Props {
  managerRefresh: number;
}

export default function GlobalManagerView({ managerRefresh }: Props) {
  return (
    <div className="dashboard-view">
      <div className="vp-header">
        <div>
          <h1 className="vp-title">Joca_</h1>
          <p className="vp-desc">O gestor global — todos os projectos, pontos de situação, tarefas cross-project.</p>
        </div>
      </div>
      <ManagerChat refreshKey={managerRefresh} />
    </div>
  );
}
