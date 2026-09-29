// Portas abertas por projecto (issue #13). Os parsers testam-se sobre output dos comandos do
// sistema: o do netstat é uma amostra real deste Windows (2026-09-28, PIDs mantidos); o do lsof
// segue o formato `-F pcn` documentado em lsof(8) §OUTPUT FOR OTHER PROGRAMS — é o que cobre o
// Mac nesta máquina, onde não há lsof para correr.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { projectsRouter } from '../http/projects-routes';
import {
  parseNetstat, parseLsof, parseProcTable, descendants, attributePorts, ownPorts,
} from '../ports';

const NETSTAT_WINDOWS = [
  '',
  'Active Connections',
  '',
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1984',
  '  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4',
  '  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       9100',
  '  TCP    127.0.0.1:51791        127.0.0.1:51792        ESTABLISHED     44568',
  '  TCP    [::]:135               [::]:0                 LISTENING       1984',
  '  TCP    [::1]:5173             [::]:0                 LISTENING       9100',
  '  TCP    [::1]:3000             [::]:0                 ABHÖREN         9200',
  '  UDP    0.0.0.0:123            *:*                                    3100',
].join('\r\n');

const LSOF_MAC = [
  'p512',
  'crapportd',
  'f7',
  'n*:49152',
  'p9100',
  'cnode',
  'f23',
  'n127.0.0.1:5173',
  'f24',
  'n[::1]:5173',
  'p9200',
  'cruby',
  'f9',
  'n*:3000',
].join('\n');

describe('parseNetstat', () => {
  it('lê só TCP em escuta, IPv4 e IPv6, e junta a mesma porta+PID', () => {
    expect(parseNetstat(NETSTAT_WINDOWS)).toEqual([
      { port: 135, pid: 1984 },
      { port: 445, pid: 4 },
      { port: 5173, pid: 9100 },
      { port: 3000, pid: 9200 },   // estado noutra língua: conta pelo endereço remoto
    ]);
  });
});

describe('parseLsof', () => {
  it('lê o formato -F pcn com nome do processo', () => {
    expect(parseLsof(LSOF_MAC)).toEqual([
      { port: 49152, pid: 512, processName: 'rapportd' },
      { port: 5173, pid: 9100, processName: 'node' },
      { port: 3000, pid: 9200, processName: 'ruby' },
    ]);
  });
});

describe('parseProcTable', () => {
  it('lê ps (pid ppid) e o PowerShell (pid ppid nome)', () => {
    expect(parseProcTable('  100     1\n  200   100\n')).toEqual([
      { pid: 100, ppid: 1, name: undefined },
      { pid: 200, ppid: 100, name: undefined },
    ]);
    expect(parseProcTable('0 0 System Idle Process\r\n9100 8000 node.exe\r\n')).toEqual([
      { pid: 0, ppid: 0, name: 'System Idle Process' },
      { pid: 9100, ppid: 8000, name: 'node.exe' },
    ]);
  });
});

// Árvore: shell 8000 → npm 8500 → node 9100 (escuta 5173). 9200 é de outro sítio qualquer.
const PROCS = [
  { pid: 1, ppid: 0, name: 'init' },
  { pid: 8000, ppid: 1, name: 'powershell.exe' },
  { pid: 8500, ppid: 8000, name: 'npm.exe' },
  { pid: 9100, ppid: 8500, name: 'node.exe' },
  { pid: 9200, ppid: 1, name: 'ruby' },
];

describe('descendants', () => {
  it('apanha netos e sobrevive a ciclos de PIDs reciclados', () => {
    expect([...descendants(8000, PROCS)].sort()).toEqual([8000, 8500, 9100]);
    const ciclo = [{ pid: 10, ppid: 11 }, { pid: 11, ppid: 10 }];
    expect([...descendants(10, ciclo)].sort()).toEqual([10, 11]);
  });
});

describe('attributePorts', () => {
  const listeners = parseNetstat(NETSTAT_WINDOWS);
  const sess = [{ id: 's1', name: 'Session 1', pid: 8000 }];

  it('atribui ao terminal só as portas da sua árvore, com nome e url', () => {
    expect(attributePorts(listeners, PROCS, sess, new Set())).toEqual([{
      port: 5173, pid: 9100, processName: 'node.exe',
      sessionId: 's1', sessionName: 'Session 1', url: 'http://localhost:5173',
    }]);
  });

  it('exclui as portas do próprio JOCA OS', () => {
    expect(attributePorts(listeners, PROCS, sess, new Set([5173]))).toEqual([]);
  });

  it('ownPorts devolve as portas do backend e do frontend (env ou omissão)', () => {
    const saved = { PORT: process.env.PORT, FE: process.env.JOCA_FRONTEND_PORT };
    try {
      process.env.PORT = '7691';
      process.env.JOCA_FRONTEND_PORT = '7692';
      expect([...ownPorts()].sort()).toEqual([7691, 7692]);
      delete process.env.PORT;
      delete process.env.JOCA_FRONTEND_PORT;
      expect([...ownPorts()].sort()).toEqual([7491, 7492]);
    } finally {
      if (saved.PORT === undefined) delete process.env.PORT; else process.env.PORT = saved.PORT;
      if (saved.FE === undefined) delete process.env.JOCA_FRONTEND_PORT; else process.env.JOCA_FRONTEND_PORT = saved.FE;
    }
  });
});

// Só o 404: criar um projecto aqui escreveria no DATA_DIR partilhado com o routes-contract, que o
// apaga em beforeEach — com ficheiros em paralelo isso seria um teste intermitente.
describe('GET /projects/:id/ports', () => {
  it('404 para projecto desconhecido', async () => {
    const res = await request(express().use(projectsRouter())).get('/projects/nao-existe/ports');
    expect(res.status).toBe(404);
  });
});
