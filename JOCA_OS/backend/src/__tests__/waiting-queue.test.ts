// Fila «à espera de ti» (issue #11): ordem por idade, «adiar» que persiste, expira e cede a uma
// entrada nova em espera, e a validação das rotas.
//
// DATA_DIR próprio: os notifications.json de outros ficheiros de teste (que correm em paralelo)
// apagavam-se uns aos outros a meio.
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-waiting-queue-${process.pid}`;
});

import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { DATA_DIR } from '../project-store';
import {
  pushNotification, loadNotifications, waitingQueue, snoozeNotification, resolveNotificationGroup,
  markNotificationRead, setNotificationsBroadcaster, type AppNotification,
} from '../notifications/store';
import { systemRouter } from '../http/system-routes';

const file = path.join(DATA_DIR, 'notifications.json');
const wipe = () => { try { fs.rmSync(file, { force: true }); } catch { /* ok */ } };

// Uma sessão a entrar em espera, como o session-manager a publica.
const waitingFor = (sessionId: string, text = 'Permitir Bash?') => pushNotification({
  kind: 'system', priority: 'action', title: `«${sessionId}» precisa de ti`, text,
  meta: { sessionId }, groupKey: `agent-waiting:${sessionId}`,
});

beforeEach(wipe);
afterAll(() => { fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

describe('waitingQueue', () => {
  it('só entradas de acção por ler — info e resolvidas ficam de fora', () => {
    pushNotification({ kind: 'system', title: 'acabou', text: 'x' });
    const resolvida = waitingFor('s1');
    markNotificationRead(resolvida.id, true);
    waitingFor('s2');
    expect(waitingQueue().queue.map((n) => n.meta?.sessionId)).toEqual(['s2']);
  });

  it('a mais antiga primeiro, qualquer que seja a ordem no ficheiro', () => {
    const a = waitingFor('a'); const b = waitingFor('b'); const c = waitingFor('c');
    // Reescreve as idades fora de ordem: b esperou mais, depois c, depois a.
    const list = loadNotifications();
    list.find((n) => n.id === a.id)!.ts = 3_000;
    list.find((n) => n.id === b.id)!.ts = 1_000;
    list.find((n) => n.id === c.id)!.ts = 2_000;
    fs.writeFileSync(file, JSON.stringify(list));
    expect(waitingQueue().queue.map((n) => n.meta?.sessionId)).toEqual(['b', 'c', 'a']);
  });
});

describe('adiar', () => {
  it('sai da fila, fica persistido no ficheiro e conta como adiada', () => {
    const now = 1_000_000;
    const n = waitingFor('s1');
    waitingFor('s2');
    const out = snoozeNotification(n.id, 15, now);
    expect(out).not.toBe('not_found');
    // Persistido: relido do disco, como depois de um reinício do backend.
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string; snoozedUntil?: number }>;
    expect(onDisk.find((x) => x.id === n.id)?.snoozedUntil).toBe(now + 15 * 60_000);

    const q = waitingQueue(now + 60_000);
    expect(q.queue.map((x) => x.meta?.sessionId)).toEqual(['s2']);
    expect(q.snoozed).toBe(1);
    expect(q.nextWakeAt).toBe(now + 15 * 60_000);
  });

  it('volta à fila quando o adiamento expira', () => {
    const now = 1_000_000;
    const n = waitingFor('s1');
    snoozeNotification(n.id, 15, now);
    expect(waitingQueue(now + 15 * 60_000 - 1).queue).toHaveLength(0);
    const q = waitingQueue(now + 15 * 60_000);
    expect(q.queue.map((x) => x.id)).toEqual([n.id]);
    expect(q.snoozed).toBe(0);
    expect(q.nextWakeAt).toBeUndefined();
  });

  it('sair da espera e voltar a entrar traz a sessão de volta, mesmo com o adiamento a correr', () => {
    const now = Date.now();
    const primeira = waitingFor('s1');
    snoozeNotification(primeira.id, 240, now);
    expect(waitingQueue(now).queue).toHaveLength(0);

    resolveNotificationGroup('agent-waiting:s1');     // respondeste: saiu da espera
    const segunda = waitingFor('s1', 'Permitir Write?');  // e pediu outra coisa

    const q = waitingQueue(now);
    expect(q.queue.map((x) => x.id)).toEqual([segunda.id]);
    expect(q.queue[0].snoozedUntil).toBeUndefined();
    expect(q.snoozed).toBe(0);                        // a adiada foi resolvida, já não conta
  });

  it('difunde o adiamento por WS — os outros separadores tiram-na da fila já, não no poll', () => {
    const enviados: AppNotification[] = [];
    setNotificationsBroadcaster((x) => enviados.push(x));
    try {
      const n = waitingFor('s1');
      enviados.length = 0;
      snoozeNotification(n.id, 15, 1_000_000);
      expect(enviados).toHaveLength(1);
      expect(enviados[0]).toMatchObject({ id: n.id, read: false, snoozedUntil: 1_000_000 + 15 * 60_000 });
      // Recusado (já resolvida) não difunde nada.
      resolveNotificationGroup('agent-waiting:s1');
      enviados.length = 0;
      expect(snoozeNotification(n.id, 15)).toBe('not_waiting');
      expect(enviados).toHaveLength(0);
    } finally {
      setNotificationsBroadcaster(() => {});
    }
  });

  it('devolve as adiadas em si, para a UI contar só as que ainda têm sessão', () => {
    const now = 1_000_000;
    const a = waitingFor('s1');
    waitingFor('s2');
    snoozeNotification(a.id, 60, now);
    const q = waitingQueue(now);
    expect(q.snoozedItems.map((x) => x.id)).toEqual([a.id]);
    expect(q.snoozedItems[0].meta?.sessionId).toBe('s1');
  });

  it('recusa adiar o que já não está à espera', () => {
    const info = pushNotification({ kind: 'system', title: 'acabou', text: 'x' });
    expect(snoozeNotification(info.id, 15)).toBe('not_waiting');
    const n = waitingFor('s1');
    resolveNotificationGroup('agent-waiting:s1');
    expect(snoozeNotification(n.id, 15)).toBe('not_waiting');
    expect(snoozeNotification('nao-existe', 15)).toBe('not_found');
  });
});

describe('rotas da fila', () => {
  const app = () => express().use(systemRouter());

  it('GET /notifications/queue devolve a fila ordenada', async () => {
    waitingFor('s1');
    const res = await request(app()).get('/notifications/queue');
    expect(res.status).toBe(200);
    expect(res.body.queue).toHaveLength(1);
    expect(res.body.snoozed).toBe(0);
  });

  it('POST /notifications/:id/snooze aceita só as durações fixas', async () => {
    const n = waitingFor('s1');
    for (const minutes of [0, 7, -15, '15', null, 1e9]) {
      const res = await request(app()).post(`/notifications/${n.id}/snooze`).send({ minutes });
      expect(res.status, `minutes=${String(minutes)}`).toBe(400);
    }
    const bad = await request(app()).post(`/notifications/${n.id}/snooze`).send({});
    expect(bad.status).toBe(400);
    expect(loadNotifications()[0].snoozedUntil).toBeUndefined();

    const ok = await request(app()).post(`/notifications/${n.id}/snooze`).send({ minutes: 60 });
    expect(ok.status).toBe(200);
    expect(ok.body.snoozedUntil).toBeGreaterThan(Date.now() + 59 * 60_000);
    expect((await request(app()).get('/notifications/queue')).body.snoozed).toBe(1);
  });

  it('404 para id desconhecido, 409 para o que já foi resolvido', async () => {
    expect((await request(app()).post('/notifications/nao-existe/snooze').send({ minutes: 15 })).status).toBe(404);
    const n = waitingFor('s1');
    resolveNotificationGroup('agent-waiting:s1');
    expect((await request(app()).post(`/notifications/${n.id}/snooze`).send({ minutes: 15 })).status).toBe(409);
  });
});
