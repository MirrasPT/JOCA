// Every terminal closes — there are no (and never will be) special terminals that resist the kill.
import { describe, it, expect, afterEach } from 'vitest';
import { sessionManager } from '../session-manager';

describe('sessionManager.kill — every terminal closes', () => {
  const spawned: string[] = [];

  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
  });

  it('closes a terminal', () => {
    const session = sessionManager.spawn({ sessionName: 'Terminal (test)' });
    spawned.push(session.id);

    expect(sessionManager.kill(session.id)).toBe(true);
    expect(sessionManager.get(session.id)).toBeUndefined();
    spawned.pop();
  });

  it('closes a normal session', () => {
    const session = sessionManager.spawn({ sessionName: 'Worker test' });
    spawned.push(session.id);

    expect(sessionManager.kill(session.id)).toBe(true);
    expect(sessionManager.get(session.id)).toBeUndefined();
    spawned.pop();
  });
});
