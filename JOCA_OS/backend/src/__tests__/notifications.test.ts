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
    pushNotification({ kind: 'system', title: 'A', text: 'first', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'B', text: 'second', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'C', text: 'third', groupKey: 'p1' });

    const list = loadNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(3);
    expect(list[0].title).toBe('C');            // the most recent one wins
    expect(list[0].text).toContain('third');
    expect(list[0].text).toContain('+2');       // and it says how many are stacked underneath
  });

  it('keeps different groupKeys apart', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', groupKey: 'p1' });
    pushNotification({ kind: 'system', title: 'B', text: 'y', groupKey: 'p2' });
    expect(loadNotifications()).toHaveLength(2);
  });

  it('never groups when no key is given — two blockers stay two decisions', () => {
    pushNotification({ kind: 'system', title: 'Q1', text: 'which color?', priority: 'action' });
    pushNotification({ kind: 'system', title: 'Q2', text: 'delete this?', priority: 'action' });
    const list = loadNotifications();
    expect(list).toHaveLength(2);
    expect(list.every((n) => n.priority === 'action')).toBe(true);
  });

  it('does not fold into an entry the user already read', () => {
    pushNotification({ kind: 'system', title: 'A', text: 'x', groupKey: 'p1' });
    markAllNotificationsRead();
    pushNotification({ kind: 'system', title: 'B', text: 'y', groupKey: 'p1' });
    // Folding into an already-read entry resurrected it silently; a new entry is better.
    expect(loadNotifications()).toHaveLength(2);
  });

  it('groups repeated failures by reason, so that a different reason still shows up', () => {
    const key = (reason: string) => `auto-fail:proj:${reason}`;
    pushNotification({ kind: 'system', title: 'T1', text: 'CLI down', priority: 'action', groupKey: key('CLI down') });
    pushNotification({ kind: 'system', title: 'T2', text: 'CLI down', priority: 'action', groupKey: key('CLI down') });
    pushNotification({ kind: 'system', title: 'T3', text: 'missing file', priority: 'action', groupKey: key('missing file') });

    const list = loadNotifications();
    expect(list).toHaveLength(2);
    expect(list.find((n) => n.text.includes('CLI down'))?.count).toBe(2);
    expect(list.find((n) => n.text.includes('missing file'))?.count).toBeUndefined();
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
    pushNotification({ kind: 'system', title: 'blocker', text: 'y', priority: 'action' });
    expect(pendingActions().map((n) => n.title)).toEqual(['blocker']);

    markAllNotificationsRead();
    expect(pendingActions()).toHaveLength(0);   // answered stops counting
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
