// Reiniciar o backend DUAS vezes seguidas não pode apagar o que ninguém chegou a ver.
//
// É o caminho mais provável de todos e o mais fácil de partir sem dar por isso: o `start.sh` corre
// num terminal, muitas vezes sem browser aberto. Com um só ficheiro, o segundo arranque lia o que o
// primeiro já tinha reescrito com `sessions: []` e o registo das conversas mortas desaparecia — a
// funcionalidade continuava a "funcionar" e a única coisa que ela existe para salvar tinha-se ido.
//
// Cada `arrancaInstancia()` é um ARRANQUE do backend: `resetModules` + import novo faz o módulo
// correr a promoção outra vez, que é exactamente o que acontece num processo novo.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-snapshot-reboot-'));
process.env.JOCA_DATA_DIR = DATA_DIR;

const FICHEIRO_VIVAS = path.join(DATA_DIR, 'sessions-snapshot.json');
const FICHEIRO_PREV = path.join(DATA_DIR, 'sessions-snapshot.prev.json');

/** O retrato que uma instância deixa em disco quando morre com uma conversa lá dentro. */
function escreveRetratoComConversa(bootId: string) {
  fs.writeFileSync(FICHEIRO_VIVAS, JSON.stringify({
    bootId,
    savedAt: Date.now(),
    sessions: [{
      id: 'sessao-1', name: 'Session 1', cwd: '/tmp/projecto',
      cli: 'claude', origin: 'user', status: 'idle',
      tail: 'output que o utilizador ainda não leu',
    }],
  }));
}

async function arrancaInstancia() {
  vi.resetModules();
  return await import('../sessions-snapshot');
}

beforeEach(() => {
  fs.rmSync(FICHEIRO_VIVAS, { force: true });
  fs.rmSync(FICHEIRO_PREV, { force: true });
});

afterAll(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  delete process.env.JOCA_DATA_DIR;
});

describe('sobreviver a arranques seguidos', () => {
  it('promove o retrato de quem morreu com conversas vivas', async () => {
    escreveRetratoComConversa('instancia-A');
    const m = await arrancaInstancia();

    const rec = m.recoveredSessions();
    expect(rec.previousBootId).toBe('instancia-A');
    expect(rec.sessions.map((s) => s.id)).toEqual(['sessao-1']);
    expect(fs.existsSync(FICHEIRO_PREV)).toBe(true);
  });

  it('DOIS arranques seguidos sem ninguém ver o aviso — o retrato continua lá', async () => {
    escreveRetratoComConversa('instancia-A');

    // Arranque 1: promove e escreve o seu próprio retrato vazio (não há sessões vivas).
    const primeira = await arrancaInstancia();
    primeira.flushSessionsSnapshot();
    expect(JSON.parse(fs.readFileSync(FICHEIRO_VIVAS, 'utf8')).sessions).toEqual([]);

    // Arranque 2: o ficheiro das vivas está vazio. É aqui que a versão de um só ficheiro perdia tudo.
    const segunda = await arrancaInstancia();
    const rec = segunda.recoveredSessions();

    expect(rec.previousBootId).toBe('instancia-A');
    expect(rec.sessions.map((s) => s.id)).toEqual(['sessao-1']);
    expect(segunda.recoveredTail('sessao-1')).toBe('output que o utilizador ainda não leu');
  });

  it('dispensar é o ÚNICO gesto que apaga — e apaga mesmo, incluindo do disco', async () => {
    escreveRetratoComConversa('instancia-A');
    const primeira = await arrancaInstancia();

    primeira.clearRecovered();
    expect(primeira.recoveredSessions().sessions).toEqual([]);
    expect(fs.existsSync(FICHEIRO_PREV)).toBe(false);

    // E não volta no arranque seguinte.
    const segunda = await arrancaInstancia();
    expect(segunda.recoveredSessions().sessions).toEqual([]);
  });

  it('um arranque limpo não inventa aviso nenhum', async () => {
    const m = await arrancaInstancia();
    const rec = m.recoveredSessions();
    expect(rec.sessions).toEqual([]);
    expect(rec.previousBootId).toBeUndefined();
  });
});
