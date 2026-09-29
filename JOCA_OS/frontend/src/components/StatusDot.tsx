// 'waiting' = o agente parou à espera de ti (hook do Claude Code). É o único estado que pede uma
// acção, por isso é o único com a cor de destaque da app.
import { STATE_LABEL, type ShownState } from '../lib/agent-state';

type DotStatus = ShownState;

interface Props {
  status: DotStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusDot({ status, size = 'md' }: Props) {
  return (
    <span
      className={`status-dot status-dot--${status} status-dot--${size}`}
      aria-label={STATE_LABEL[status]}
      role="img"
    />
  );
}
