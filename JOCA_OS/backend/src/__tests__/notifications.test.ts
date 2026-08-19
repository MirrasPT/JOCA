// Notification grouping and priority.
//
// The risk being tested is asymmetric: grouping too little is noise, but grouping too much HIDES
// something the user needed to see. Every test here is about that boundary.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../project-store';
import {
  pushNotification, loadNotifications, markAllNotificationsRead, pendingActions, unreadCount,
} from '../notifications/store';

const file = path.join(DATA_DIR, 'notifications.json');
const wipe = () => { try { fs.rmSync(file, { force: true }); } catch { /* ok */ } };

describe('notification grouping', () => {
  beforeEach(wipe);
  afterEach(wipe);

  it('folds repeats of the same groupKey into one entry with a count', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'primeiro', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'B', text: 'segundo', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'C', text: 'terceiro', groupKey: 'p1' });

    const list = loadNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(3);
    expect(list[0].title).toBe('C');            // o mais recente manda
    expect(list[0].text).toContain('terceiro');
    expect(list[0].text).toContain('+2');       // e diz quantos ficaram por baixo
  });

  it('keeps different groupKeys apart', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'B', text: 'y', groupKey: 'p2' });
    expect(loadNotifications()).toHaveLength(2);
  });

  it('never groups when no key is given — two blockers stay two decisions', () => {
    pushNotification({ kind: 'automation', title: 'Q1', text: 'que cor?', priority: 'action' });
    pushNotification({ kind: 'automation', title: 'Q2', text: 'apago isto?', priority: 'action' });
    const list = loadNotifications();
    expect(list).toHaveLength(2);
    expect(list.every((n) => n.priority === 'action')).toBe(true);
  });

  it('does not fold into an entry the user already read', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', groupKey: 'p1' });
    markAllNotificationsRead();
    pushNotification({ kind: 'system', title: 'B', text: 'y', groupKey: 'p1' });
    // Agrupar numa lida ressuscitava-a silenciosamente; melhor entrada nova.
    expect(loadNotifications()).toHaveLength(2);
  });

  it('groups automation failures by reason, so a different failure still surfaces', () => {
    const key = (reason: string) => `auto-fail:proj:${reason}`;
    pushNotification({ kind: 'system', title: 'T1', text: 'CLI em baixo', priority: 'action', groupKey: key('CLI em baixo') });
    pushNotification({ kind: 'system', title: 'T2', text: 'CLI em baixo', priority: 'action', groupKey: key('CLI em baixo') });
    pushNotification({ kind: 'system', title: 'T3', text: 'ficheiro em falta', priority: 'action', groupKey: key('ficheiro em falta') });

    const list = loadNotifications();
    expect(list).toHaveLength(2);
    expect(list.find((n) => n.text.includes('CLI em baixo'))?.count).toBe(2);
    expect(list.find((n) => n.text.includes('ficheiro em falta'))?.count).toBeUndefined();
  });
});

describe('notification priority', () => {
  beforeEach(wipe);
  afterEach(wipe);

  it('defaults to info', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x' });
    expect(loadNotifications()[0].priority).toBe('info');
  });

  it('pendingActions returns only unread action items', () => {
    pushNotification({ kind: 'system', title: 'info', text: 'x' });
    pushNotification({ kind: 'automation', title: 'bloqueio', text: 'y', priority: 'action' });
    expect(pendingActions().map((n) => n.title)).toEqual(['bloqueio']);

    markAllNotificationsRead();
    expect(pendingActions()).toHaveLength(0);   // respondido deixa de contar
  });

  it('a grouped entry counts as one unread, not N', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'B', text: 'y', groupKey: 'p1' });
    expect(unreadCount()).toBe(1);
  });

  it('carries the project so the UI can jump to the source', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', meta: { projectId: 'proj-1' } });
    expect(loadNotifications()[0].meta?.projectId).toBe('proj-1');
  });
});
