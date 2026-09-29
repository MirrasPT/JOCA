import { describe, it, expect } from 'vitest';
// Helper do FRONTEND (lógica pura, sem React): o frontend não tem runner de testes e não se
// acrescentam dependências, por isso o teste vive aqui, no vitest do backend.
import { shownState, stateText, attentionRank, STATE_LABEL } from '../../../frontend/src/lib/agent-state';

describe('frontend: estado mostrado de uma sessão (#6)', () => {
  it('o agentState manda sobre o status: calada à espera de ti não é «parado»', () => {
    expect(shownState({ status: 'idle', agentState: 'waiting' })).toBe('waiting');
    expect(shownState({ status: 'idle', agentState: 'working' })).toBe('working');
    expect(shownState({ status: 'working', agentState: 'done' })).toBe('done');
  });

  it('sem agentState (outros CLIs) fica o comportamento antigo', () => {
    expect(shownState({ status: 'working' })).toBe('working');
    expect(shownState({ status: 'idle' })).toBe('idle');
    expect(STATE_LABEL[shownState({ status: 'idle' })]).toBe('Parado');
  });

  it('em espera, o texto leva o pedido; sem pedido, só o rótulo', () => {
    expect(stateText({ status: 'idle', agentState: 'waiting', waitingReason: 'Permissão para Bash' }))
      .toBe('À espera de ti: Permissão para Bash');
    expect(stateText({ status: 'idle', agentState: 'waiting' })).toBe('À espera de ti');
    // O motivo só conta em espera (um resto de waitingReason não aparece noutro estado).
    expect(stateText({ status: 'working', agentState: 'working', waitingReason: 'velho' })).toBe('A trabalhar');
  });

  it('ordem de atenção: à espera > a trabalhar > resto', () => {
    const lista = [
      { status: 'idle' as const },
      { status: 'working' as const },
      { status: 'idle' as const, agentState: 'waiting' as const },
      { status: 'idle' as const, agentState: 'done' as const },
    ];
    const ordenada = [...lista].sort((a, b) => attentionRank(b) - attentionRank(a)).map(shownState);
    expect(ordenada.slice(0, 2)).toEqual(['waiting', 'working']);
  });
});
