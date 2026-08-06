// Todos os terminais fecham — não há (nem há-de haver) terminais especiais que resistam ao kill.
import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../session-manager';

describe('sessionManager.kill — terminais fecham todos', () => {
  const spawned: string[] = [];

  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
  });

  it('fecha um terminal', () => {
    const session = sessionManager.spawn({ sessionName: 'Terminal (teste)' });
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
