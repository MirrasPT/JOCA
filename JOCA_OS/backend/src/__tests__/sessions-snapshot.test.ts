// O retrato das sessões em disco — a rede que apanha o backend a morrer.
//
// Duas coisas que valem teste porque falham em SILÊNCIO:
//   1. o corte da cauda (o ficheiro escreve-se na mesma, com lixo lá dentro);
//   2. a ORDEM das rotas — `DELETE /sessions/recovered` tem de vir antes de `DELETE /sessions/:id`,
//      senão "recovered" é tratado como o id de um terminal e a resposta muda de forma sem erro.
import fs from 'fs';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, afterAll } from 'vitest';
import { sessionsRouter } from '../http/sessions-routes';
import { sessionManager } from '../session-manager';
import {
  snapshotTail,
  flushSessionsSnapshot,
  SNAPSHOT_FILE,
  BOOT_ID,
  type SessionsSnapshot,
} from '../sessions-snapshot';

function app() {
  const a = express();
  a.use(sessionsRouter());
  return a;
}

afterAll(() => {
  if (fs.existsSync(SNAPSHOT_FILE)) fs.rmSync(SNAPSHOT_FILE);
});

describe('snapshotTail', () => {
  it('devolve o buffer inteiro quando cabe', () => {
    expect(snapshotTail('olá mundo', 1024)).toBe('olá mundo');
  });

  it('corta pelo fim e cabe no limite de BYTES', () => {
    const buffer = 'x'.repeat(5000);
    const tail = snapshotTail(buffer, 1000);
    // O prefixo de reposição de cor é acrescentado DEPOIS do corte.
    expect(Buffer.byteLength(tail.replace(/^\x1b\[0m/, ''), 'utf8')).toBeLessThanOrEqual(1000);
    expect(buffer.endsWith(tail.replace(/^\x1b\[0m/, ''))).toBe(true);
  });

  it('repõe o estado de cor à cabeça', () => {
    expect(snapshotTail('y'.repeat(5000), 1000).startsWith('\x1b[0m')).toBe(true);
  });

  it('nunca parte um caracter multi-byte ao meio', () => {
    // 3 bytes por 'ç' → o corte cai a meio de um code point se não recuar.
    const tail = snapshotTail('ç'.repeat(4000), 1001);
    expect(tail).not.toContain('�');
  });

  it('alinha o corte ao início de uma sequência de escape', () => {
    // Sem alinhamento, o corte deixaria `31mVERMELHO` (parâmetros soltos que o xterm imprime
    // como texto). Com alinhamento, a cauda começa no `\x1b` seguinte.
    const buffer = 'a'.repeat(2000) + '\x1b[31mVERMELHO' + 'b'.repeat(300);
    const tail = snapshotTail(buffer, 400).replace(/^\x1b\[0m/, '');
    expect(tail.startsWith('\x1b[31m')).toBe(true);
  });
});

describe('flushSessionsSnapshot', () => {
  it('escreve um ficheiro com o contrato acordado', () => {
    const session = sessionManager.spawn({ sessionName: 'Snapshot (teste)' });
    try {
      flushSessionsSnapshot();
      const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
      expect(snap.bootId).toBe(BOOT_ID);
      expect(typeof snap.savedAt).toBe('number');
      const entry = snap.sessions.find((s) => s.id === session.id);
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({
        name: 'Snapshot (teste)',
        cwd: session.cwd,
        cli: session.cli,
        origin: 'user',
      });
      expect(typeof entry!.tail).toBe('string');
      expect(['idle', 'working']).toContain(entry!.status);
    } finally {
      sessionManager.kill(session.id);
    }
  });

  // A geometria é o que permite REPINTAR a cauda: o CLI por omissão é um TUI, desenha por posição,
  // e reproduzido noutro tamanho o desenho parte-se. O que tem de ficar guardado é a geometria VIVA
  // (o browser redimensiona a sessão ao abrir o painel), não a de arranque — daí o resize no meio.
  it('guarda a geometria viva do PTY, não a de arranque', () => {
    const session = sessionManager.spawn({ sessionName: 'Geometria (teste)' });
    try {
      sessionManager.resize(session.id, 180, 32);
      flushSessionsSnapshot();
      const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
      const entry = snap.sessions.find((s) => s.id === session.id);
      expect(entry).toMatchObject({ cols: 180, rows: 32 });
    } finally {
      sessionManager.kill(session.id);
    }
  });

  it('sem sessões vivas escreve uma lista vazia — encerramento limpo não gera aviso', () => {
    for (const s of sessionManager.list()) sessionManager.kill(s.id);
    flushSessionsSnapshot();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
    expect(snap.sessions).toEqual([]);
  });
});

describe('rotas /sessions/recovered', () => {
  it('GET devolve sempre o bootId desta instância e uma lista', async () => {
    const res = await request(app()).get('/sessions/recovered');
    expect(res.status).toBe(200);
    expect(res.body.bootId).toBe(BOOT_ID);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    // O `tail` nunca vai na listagem — só o seu tamanho. A geometria vai, porque é com ela que o
    // cliente repinta a cauda: sem cols/rows não sabe em que terminal a escrever.
    for (const s of res.body.sessions) {
      expect(s.tail).toBeUndefined();
      expect(typeof s.tailBytes).toBe('number');
      expect(typeof s.cols).toBe('number');
      expect(typeof s.rows).toBe('number');
    }
  });

  it('GET do tail de uma sessão inexistente é 404', async () => {
    const res = await request(app()).get('/sessions/recovered/nao-existe/tail');
    expect(res.status).toBe(404);
  });

  it('DELETE dispensa o aviso e devolve 204 (não cai no DELETE /sessions/:id)', async () => {
    const del = await request(app()).delete('/sessions/recovered');
    expect(del.status).toBe(204);

    const res = await request(app()).get('/sessions/recovered');
    expect(res.body.sessions).toEqual([]);
    expect(res.body.previousBootId).toBeUndefined();
  });
});
