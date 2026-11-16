// Em que pasta nasce um terminal (session-manager.pastaDoTerminal + spawn): projecto na pasta do
// projecto, pasta em falta → pessoal com aviso, solta → pessoal (nunca o Brain), reinício na mesma
// pasta, e JOCA_BRAIN no ambiente do terminal quando há Brain. PTY falso; Brain falso de exemplo.
import { vi, describe, it, expect, afterEach, afterAll } from 'vitest';

const cap = vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-session-cwd-${process.pid}`;
  return { ptys: [] as Array<{ cwd: string; env: Record<string, string> }> };
});

vi.mock('node-pty', () => ({
  spawn: (_file: string, _args: string[], opts: { cwd: string; env: Record<string, string> }) => {
    cap.ptys.push({ cwd: opts.cwd, env: opts.env });
    return {
      pid: 1, cols: 120, rows: 30,
      onData: () => ({ dispose() {} }),
      onExit: () => ({ dispose() {} }),
      write() {}, kill() {}, resize() {},
    };
  },
}));

// Brain de exemplo: o teste não depende de haver (ou não) um Brain nesta máquina.
vi.mock('../toolkit-registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../toolkit-registry')>()),
  BRAIN: { root: '/exemplo/JOCA_Brain', via: 'env-joca-brain' },
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { DATA_DIR, saveProjects } from '../project-store';
import { sessionManager, pastaDoTerminal, ambienteComBrain } from '../session-manager';
import { loadNotifications } from '../notifications/store';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-session-cwd-'));
const pastaProjecto = path.join(tmp, 'projeto-exemplo');
fs.mkdirSync(pastaProjecto, { recursive: true });
const pastaSumida = path.join(tmp, 'projeto-que-ja-nao-existe');
saveProjects([
  { id: 'p-existe', name: 'Exemplo', path: pastaProjecto },
  { id: 'p-sumido', name: 'Sumido', path: pastaSumida },
]);

const spawned: string[] = [];
afterEach(() => { for (const id of spawned.splice(0)) sessionManager.kill(id); });
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ }
});
const abrir = (opts: Parameters<typeof sessionManager.spawn>[0]) => {
  const s = sessionManager.spawn({ cli: 'opencode', ...opts });
  spawned.push(s.id);
  return s;
};
const ultimoPty = () => cap.ptys[cap.ptys.length - 1];

describe('pastaDoTerminal (pura)', () => {
  const home = '/home/exemplo';
  const existe = (p: string) => p === '/projetos/existe';
  it('cwd explícito ganha a tudo', () => {
    expect(pastaDoTerminal({ cwd: '/outra', projectPath: '/projetos/existe', home, existe })).toEqual({ cwd: '/outra' });
  });
  it('projecto existente → pasta do projecto', () => {
    expect(pastaDoTerminal({ projectPath: '/projetos/existe', home, existe })).toEqual({ cwd: '/projetos/existe' });
  });
  it('projecto com pasta inexistente → pasta pessoal, com aviso', () => {
    const r = pastaDoTerminal({ projectPath: '/projetos/sumiu', home, existe });
    expect(r.cwd).toBe(home);
    expect(r.aviso).toContain('/projetos/sumiu');
  });
  it('solta → pasta pessoal', () => {
    expect(pastaDoTerminal({ home, existe })).toEqual({ cwd: home });
  });
});

describe('ambienteComBrain (pura)', () => {
  it('com Brain: põe JOCA_BRAIN e tira o JOCA_LOGIC_PATH herdado', () => {
    expect(ambienteComBrain({ PATH: '/bin', JOCA_LOGIC_PATH: '/exemplo/legado' }, '/exemplo/JOCA_Brain'))
      .toEqual({ PATH: '/bin', JOCA_BRAIN: '/exemplo/JOCA_Brain' });
  });
  it('sem Brain: o ambiente fica como está', () => {
    const env = { PATH: '/bin', JOCA_LOGIC_PATH: '/exemplo/legado' };
    expect(ambienteComBrain(env, null)).toEqual(env);
  });
});

describe('spawn: pasta e ambiente do terminal', () => {
  it('sessão de projecto abre na pasta do projecto', () => {
    const s = abrir({ projectId: 'p-existe' });
    expect(s.cwd).toBe(pastaProjecto);
    expect(ultimoPty().cwd).toBe(pastaProjecto);
  });

  it('projecto com pasta inexistente abre na pasta pessoal e deixa aviso', () => {
    const s = abrir({ projectId: 'p-sumido', sessionName: 'Sumido' });
    expect(s.cwd).toBe(os.homedir());
    const aviso = loadNotifications().find((n) => n.meta?.sessionId === s.id);
    expect(aviso?.text).toContain(pastaSumida);
  });

  it('sessão solta abre na pasta pessoal, nunca no Brain', () => {
    const s = abrir({});
    expect(s.cwd).toBe(os.homedir());
    expect(s.cwd).not.toBe('/exemplo/JOCA_Brain');
  });

  it('o terminal recebe JOCA_BRAIN com o Brain encontrado', () => {
    abrir({});
    expect(ultimoPty().env.JOCA_BRAIN).toBe('/exemplo/JOCA_Brain');
  });

  it('reinício (fecha + abre como o create_session com restartOf) mantém a pasta', () => {
    const a = abrir({ projectId: 'p-existe', sessionName: 'Exemplo' });
    sessionManager.kill(a.id);
    const b = abrir({ projectId: 'p-existe', sessionName: a.name, nameSource: a.nameSource });
    expect(b.cwd).toBe(a.cwd);

    // Solta com pasta própria: o frontend reenvia o `cwd` que ela tinha.
    const c = abrir({ cwd: pastaProjecto });
    sessionManager.kill(c.id);
    const d = abrir({ cwd: c.cwd, sessionName: c.name, nameSource: c.nameSource });
    expect(d.cwd).toBe(pastaProjecto);
  });
});
