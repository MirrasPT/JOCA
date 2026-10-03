// `joca sessions` mostra só o que o GET /sessions envia (SessionInfo): sem o `busy` do antigo
// sistema de tarefas, com o `currentJob` que o agente escreve por `joca status`.
import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AddressInfo } from 'net';

const CLI = path.resolve(__dirname, '../../../cli/joca.mjs');

const sessions = [
  { id: 'aaaaaaaa-1111', name: 'Revisor', cwd: '/tmp', origin: 'user', cli: 'claude', status: 'working', currentJob: 'a rever o PR 12', area: 'frontend', busy: true },
  { id: 'bbbbbbbb-2222', name: 'Parado', cwd: '/tmp', origin: 'user', cli: 'codex', status: 'idle' },
];

const server = http.createServer((req, res) => {
  if (req.url === '/sessions') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(sessions));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

describe('joca sessions', () => {
  it('lista estado e trabalho actual, sem a legenda do campo busy', async () => {
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as AddressInfo;
    const { stdout } = await promisify(execFile)(process.execPath, [CLI, 'sessions'], {
      env: { ...process.env, JOCA_API_URL: `http://127.0.0.1:${port}`, JOCA_SESSION_ID: '', JOCA_API_TOKEN: '' },
    });
    expect(stdout).toContain('[claude] working');
    expect(stdout).toContain('· a rever o PR 12');
    expect(stdout).toContain('[codex] idle');
    expect(stdout).not.toContain('*');
  }, 20_000); // arranque frio do node num processo filho
});
