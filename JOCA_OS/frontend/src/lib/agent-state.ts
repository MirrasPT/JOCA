import type { AgentState, SessionInfo } from '../types';

// Estado que a UI MOSTRA de uma sessão. O `agentState` (hooks do Claude Code) manda quando existe:
// é o único que sabe distinguir «à espera de ti» de «parado» — pelos bytes, uma sessão a pedir
// permissão está calada, logo `status: 'idle'`. Sem ele (CLIs sem hooks, sessão acabada de abrir)
// fica o de sempre: bytes/silêncio.
export type ShownState = AgentState | 'idle';

type StateSource = Pick<SessionInfo, 'status' | 'agentState' | 'waitingReason'>;

export const STATE_LABEL: Record<ShownState, string> = {
  working: 'A trabalhar',
  waiting: 'À espera de ti',
  done: 'Acabou',
  idle: 'Parado',
};

export function shownState(s: StateSource): ShownState {
  return s.agentState ?? (s.status === 'working' ? 'working' : 'idle');
}

/** Texto do estado para tooltip/nome acessível — em espera, leva o que o agente está a pedir. */
export function stateText(s: StateSource): string {
  const st = shownState(s);
  return st === 'waiting' && s.waitingReason ? `${STATE_LABEL.waiting}: ${s.waitingReason}` : STATE_LABEL[st];
}

/** Ordem de atenção para listas: primeiro o que pede acção, depois o que está a mexer. */
export function attentionRank(s: StateSource): number {
  const st = shownState(s);
  return st === 'waiting' ? 2 : st === 'working' ? 1 : 0;
}
