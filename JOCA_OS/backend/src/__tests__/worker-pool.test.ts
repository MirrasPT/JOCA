// O gestor de projecto é um terminal NORMAL (worker area 'gestor'): abre sozinho, mas fecha como
// qualquer outro. Este teste cobre a garantia nova — fechar funciona para todas as sessões.
import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../session-manager';

describe('sessionManager.kill — terminais fecham todos', () => {
  const spawned: string[] = [];

  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
  });

  it('fecha o terminal do gestor como outro qualquer', () => {
    const session = sessionManager.spawn({ sessionName: 'Worker gestor (teste)', area: 'gestor' });
    spawned.push(session.id);

    expect(sessionManager.kill(session.id)).toBe(true);
    expect(sessionManager.get(session.id)).toBeUndefined();
    spawned.pop();
  });

  it('fecha uma sessão normal', () => {
    const session = sessionManager.spawn({ sessionName: 'Worker teste' });
    spawned.push(session.id);

    expect(sessionManager.kill(session.id)).toBe(true);
    expect(sessionManager.get(session.id)).toBeUndefined();
    spawned.pop();
  });
});
