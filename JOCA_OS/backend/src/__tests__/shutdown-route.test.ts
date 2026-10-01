// POST /shutdown — o botão «Sair». O spawn é mockado: correr o stop a sério matava o JOCA de quem
// corre os testes. O que se verifica é QUAL script, COMO é lançado (desacoplado) e o 202.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const spawnMock = vi.fn();
vi.mock('child_process', async (orig) => ({
  ...(await orig<typeof import('child_process')>()),
  spawn: (...a: unknown[]) => spawnMock(...a),
}));

const { shutdownRouter, stopCommand, isLoopbackAddress } = await import('../http/shutdown-routes');

function fakeChild() {
  return { on: vi.fn(), unref: vi.fn() };
}

beforeEach(() => {
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => fakeChild());
});

describe('stopCommand', () => {
  it('Windows → stop.bat via `cmd /c start` (sai da árvore do backend)', () => {
    const s = stopCommand('win32', 'C:\\x\\JOCA_OS');
    expect(s.cmd).toBe('cmd.exe');
    // `/c` e não `/K`: o stop.bat corre num cmd que fecha sozinho (sem janela pendurada).
    expect(s.args.join(' ')).toContain('start "" /min cmd /d /c "C:\\x\\JOCA_OS\\stop.bat"');
    expect(s.args.join(' ')).not.toMatch(/\/k\b/i);
    expect(s.args.join(' ')).not.toContain('stop.sh');
    expect(s.windowsVerbatimArguments).toBe(true);
  });

  it.each(['darwin', 'linux'] as const)('%s → bash stop.sh', (p) => {
    const s = stopCommand(p, '/x/JOCA_OS');
    expect(s.cmd).toBe('bash');
    expect(s.args).toEqual(['/x/JOCA_OS/stop.sh']);
  });
});

describe('isLoopbackAddress', () => {
  it('aceita só loopback', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.5')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });
});

describe('POST /shutdown', () => {
  it('responde 202 e lança o script da plataforma desacoplado (detached + unref + stdio ignore)', async () => {
    const child = fakeChild();
    spawnMock.mockImplementation(() => child);
    const app = express();
    app.use(shutdownRouter());
    const res = await request(app).post('/shutdown');
    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [cmd, args, opts] = spawnMock.mock.calls[0];
    const want = stopCommand();
    expect(cmd).toBe(want.cmd);
    expect(args).toEqual(want.args);
    expect(String(args.join(' '))).toMatch(process.platform === 'win32' ? /stop\.bat/ : /stop\.sh$/);
    expect(opts.detached).toBe(true);
    expect(opts.stdio).toBe('ignore');
    expect(opts.env.JOCA_BACKEND_PORT).toBe(String(Number(process.env.PORT || 7491)));
    expect(opts.env.JOCA_FRONTEND_PORT).toBe(String(Number(process.env.JOCA_FRONTEND_PORT || 7492)));
    expect(child.unref).toHaveBeenCalled();
  });

  it.each([
    ['win32', 'cmd.exe', /stop\.bat/],
    ['linux', 'bash', /stop\.sh$/],
    ['darwin', 'bash', /stop\.sh$/],
  ] as const)('plataforma %s → %s com o script certo', async (platform, cmd, script) => {
    const real = process.platform;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    try {
      const app = express();
      app.use(shutdownRouter());
      expect((await request(app).post('/shutdown')).status).toBe(202);
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
      const [c, args, opts] = spawnMock.mock.calls[0];
      expect(c).toBe(cmd);
      expect(args.join(' ')).toMatch(script);
      expect(opts.detached).toBe(true);
    } finally {
      Object.defineProperty(process, 'platform', { value: real, configurable: true });
    }
  });

  it('um 2.º pedido não lança o stop outra vez', async () => {
    const app = express();
    app.use(shutdownRouter());
    await request(app).post('/shutdown');
    const res = await request(app).post('/shutdown');
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 20));
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('403 a pedido não-local, sem lançar nada', async () => {
    const app = express();
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', { value: '10.0.0.7', configurable: true });
      next();
    });
    app.use(shutdownRouter());
    const res = await request(app).post('/shutdown');
    expect(res.status).toBe(403);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
