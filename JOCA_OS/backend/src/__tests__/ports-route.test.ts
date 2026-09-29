// Rota GET /projects/:id/ports (issue #13): o isolamento entre projectos e o 503 quando o sistema
// não se deixa ler. Com o project-store, o session-manager e o listOpenPorts falsos — criar um
// projecto a sério escreveria no DATA_DIR partilhado com o routes-contract (ver ports.test.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { listOpenPorts, sessions } = vi.hoisted(() => ({
  listOpenPorts: vi.fn(),
  sessions: [] as Array<{ id: string; name: string; projectId?: string; pty: { pid?: number } }>,
}));

vi.mock('../project-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../project-store')>()),
  loadProjects: () => [{ id: 'A', name: 'A', path: '/a' }, { id: 'B', name: 'B', path: '/b' }],
}));
vi.mock('../session-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../session-manager')>()),
  sessionManager: { list: () => sessions },
}));
vi.mock('../ports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ports')>()),
  listOpenPorts,
}));

import { projectsRouter } from '../http/projects-routes';
import { PortsUnavailableError } from '../ports';

const app = () => express().use(projectsRouter());

beforeEach(() => {
  listOpenPorts.mockReset();
  sessions.length = 0;
  sessions.push(
    { id: 'a1', name: 'dev A', projectId: 'A', pty: { pid: 100 } },
    { id: 'b1', name: 'dev B', projectId: 'B', pty: { pid: 200 } },
    { id: 'a2', name: 'testes A', projectId: 'A', pty: { pid: 300 } },
    { id: 'solto', name: 'sem projecto', pty: { pid: 400 } },
  );
});

describe('GET /projects/:id/ports', () => {
  it('só as sessões do projecto pedido chegam ao listOpenPorts', async () => {
    listOpenPorts.mockResolvedValue([]);
    const res = await request(app()).get('/projects/A/ports');
    expect(res.status).toBe(200);
    expect(listOpenPorts).toHaveBeenCalledTimes(1);
    expect(listOpenPorts).toHaveBeenCalledWith([
      { id: 'a1', name: 'dev A', pid: 100 },
      { id: 'a2', name: 'testes A', pid: 300 },
    ]);
  });

  it('o projecto B não recebe as sessões do A', async () => {
    listOpenPorts.mockResolvedValue([]);
    await request(app()).get('/projects/B/ports');
    expect(listOpenPorts).toHaveBeenCalledWith([{ id: 'b1', name: 'dev B', pid: 200 }]);
  });

  it('503 «indisponível» quando o sistema não se deixa ler — distinto de lista vazia', async () => {
    listOpenPorts.mockRejectedValue(new PortsUnavailableError('netstat: ENOENT'));
    const res = await request(app()).get('/projects/A/ports');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'indisponível' });
  });
});
