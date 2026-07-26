// Notifications inbox — persistent, delivery-guaranteed layer over the ephemeral WS broadcast.
// Every user-facing notification (automation message, task question, heartbeat alert, system) is
// appended here BEFORE being broadcast, so a closed browser tab never loses it: the UI loads the
// inbox on connect and shows unread state. Source of truth = DATA_DIR/notifications.json (atomic
// writes via project-store.writeJsonFile). Capped to the most recent MAX_NOTIFICATIONS.
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';

export type NotificationKind = 'automation' | 'task_question' | 'session_done' | 'heartbeat' | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  ts: number;
  read: boolean;
  // optional deep-link context (sessionId/taskId/automationId) so the UI can jump to the source
  meta?: { sessionId?: string; taskId?: string; automationId?: string };
}

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const MAX_NOTIFICATIONS = 500;

// Decoupled broadcaster: server.ts injects a fn that pushes the new notification over WS.
let notificationsBroadcaster: ((n: AppNotification) => void) | null = null;
export function setNotificationsBroadcaster(fn: (n: AppNotification) => void): void {
  notificationsBroadcaster = fn;
}

export function loadNotifications(): AppNotification[] {
  return readJsonFile<AppNotification[]>(NOTIFICATIONS_FILE, []);
}

function saveNotifications(list: AppNotification[]): void {
  writeJsonFile(NOTIFICATIONS_FILE, list.slice(-MAX_NOTIFICATIONS));
}

// Persist-then-broadcast: the inbox write happens first so a WS failure can't lose the record.
export function pushNotification(spec: {
  kind: NotificationKind;
  title: string;
  text: string;
  meta?: AppNotification['meta'];
}): AppNotification {
  const n: AppNotification = {
    id: randomUUID(),
    kind: spec.kind,
    title: spec.title.slice(0, 200),
    text: spec.text.slice(0, 8000),
    ts: Date.now(),
    read: false,
    meta: spec.meta,
  };
  const list = loadNotifications();
  list.push(n);
  saveNotifications(list);
  try { notificationsBroadcaster?.(n); } catch { /* inbox already persisted */ }
  return n;
}

export function markNotificationRead(id: string, read: boolean): AppNotification | null {
  const list = loadNotifications();
  const n = list.find((x) => x.id === id);
  if (!n) return null;
  n.read = read;
  saveNotifications(list);
  return n;
}

export function markAllNotificationsRead(): number {
  const list = loadNotifications();
  let count = 0;
  for (const n of list) if (!n.read) { n.read = true; count++; }
  if (count > 0) saveNotifications(list);
  return count;
}

export function deleteNotification(id: string): boolean {
  const list = loadNotifications();
  const next = list.filter((n) => n.id !== id);
  if (next.length === list.length) return false;
  saveNotifications(next);
  return true;
}

export function unreadCount(): number {
  return loadNotifications().filter((n) => !n.read).length;
}
