import { useRef } from 'react';
import { ChatIcon, TasksIcon } from '../dashboard/icons';

export type ProjectChannel = 'chat' | 'tasks';

// Git e Overview deixaram de ser canais — o gestor de estado (git/toolkit/arquivar-remover) vive
// agora no modal de Settings (CreateProjectModal em modo edição), aberto pelo botão de engrenagem
// do cabeçalho do workspace. Só 2 canais: o chat de trabalho e as tarefas do projecto.
const CHANNELS: { id: ProjectChannel; label: string; Icon: () => JSX.Element }[] = [
  { id: 'chat', label: 'Workspace', Icon: ChatIcon },
  { id: 'tasks', label: 'Tarefas', Icon: TasksIcon },
];

export const CHANNEL_IDS: ProjectChannel[] = CHANNELS.map((c) => c.id);

interface Props {
  active: ProjectChannel;
  onChange: (channel: ProjectChannel) => void;
  workerCount?: number;
}

// Barra de canais do workspace de um projecto — troca de vista sem sair do projecto. Workers e
// Ficheiros não são canais próprios: vivem dentro do Chat (é lá que se fala com o gestor e se vê o
// que ele está a fazer, não faz sentido separar). Mesmo mecanismo de troca que RightWorkspace (um
// filho montado de cada vez, remontado por `key`), mas horizontal com sublinhado no activo.
export default function ChannelTabs({ active, onChange, workerCount }: Props) {
  const btnRefs = useRef<Map<ProjectChannel, HTMLButtonElement>>(new Map());

  // ARIA APG Tabs pattern: setas movem o foco (roving tabindex — só o activo é alcançável por
  // Tab), Home/End vão aos extremos. Sem isto, um leitor de ecrã que entra no tablist só tem o
  // Tab sequencial para passar pelos canais todos antes de chegar ao conteúdo.
  const focusAt = (index: number) => {
    const id = CHANNELS[index]?.id;
    if (!id) return;
    btnRefs.current.get(id)?.focus();
    onChange(id);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); focusAt((index + 1) % CHANNELS.length); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt((index - 1 + CHANNELS.length) % CHANNELS.length); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(CHANNELS.length - 1); }
  };

  return (
    <div className="pw-channel-tabs" role="tablist" aria-label="Canais do projecto">
      {CHANNELS.map(({ id, label, Icon }, index) => (
        <button
          key={id}
          ref={(el) => { if (el) btnRefs.current.set(id, el); else btnRefs.current.delete(id); }}
          id={`pw-tab-${id}`}
          role="tab"
          type="button"
          tabIndex={active === id ? 0 : -1}
          className={`pw-channel-tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
          onKeyDown={(e) => onKeyDown(e, index)}
          aria-selected={active === id}
          aria-controls={`pw-channel-${id}`}
        >
          <Icon />
          <span>{label}</span>
          {id === 'chat' && !!workerCount && <span className="pw-channel-tab-badge">{workerCount}</span>}
        </button>
      ))}
    </div>
  );
}
