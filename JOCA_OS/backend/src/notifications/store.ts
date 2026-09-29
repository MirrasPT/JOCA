// Notifications inbox — persistent, delivery-guaranteed layer over the ephemeral WS broadcast.
// Every user-facing notification (sessao terminada, sistema) e
// appended here BEFORE being broadcast, so a closed browser tab never loses it: the UI loads the
// inbox on connect and shows unread state. Source of truth = DATA_DIR/notifications.json (atomic
// writes via project-store.writeJsonFile). Capped to the most recent MAX_NOTIFICATIONS.
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';

export type NotificationKind = 'session_done' | 'system';

// What the notification wants from you. The inbox used to treat "a worker is blocked waiting for
// your answer" exactly like "a job finished" — com várias tarefas a correr em projectos diferentes
// at once, that flattening is what turns an inbox into noise you stop reading.
//   action → nothing moves until you decide
//   info   → happened, no decision needed
export type NotificationPriority = 'action' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  ts: number;
  read: boolean;
  priority?: NotificationPriority;      // default 'info'
  // How many events this entry stands for. >1 means later events were folded in (see groupKey).
  count?: number;
  // «Adiar» na fila «à espera de ti»: até este instante (epoch ms) a entrada sai da fila; depois
  // volta sozinha. Só esconde — continua por ler e continua a ser resolvida como as outras.
  snoozedUntil?: number;
  // optional deep-link context so the UI can jump to the source
  meta?: {
    sessionId?: string;
    projectId?: string; area?: string; groupKey?: string;
  };
}

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const MAX_NOTIFICATIONS = 500;

// Window in which repeated events from the SAME source collapse into one entry. Three workers of
// the same project finishing within a minute is one thing that happened, not three; before the
// isto era raro; com a fila de tarefas a andar sozinha, passou a ser o caso normal.
const GROUP_WINDOW_MS = 90_000;

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
  priority?: NotificationPriority;
  meta?: AppNotification['meta'];
  // Same key + inside GROUP_WINDOW_MS + still unread → folds into the existing entry instead of
  // adding a new one. Callers that omit it always get a separate notification.
  //
  // The key must identify the same THING repeating, not merely the same source: dez avisos
  // falhados porque o CLI esta em baixo sao um problema (group on project+reason), but two workers
  // blocked on different questions are two decisions, and folding those hides one. When in doubt,
  // omit it.
  groupKey?: string;
}): AppNotification {
  const list = loadNotifications();
  const now = Date.now();
  const priority = spec.priority ?? 'info';

  if (spec.groupKey) {
    const prev = [...list].reverse().find((n) =>
      n.meta?.groupKey === spec.groupKey && !n.read && now - n.ts < GROUP_WINDOW_MS);
    if (prev) {
      prev.count = (prev.count ?? 1) + 1;
      prev.ts = now;                                     // reordena para o topo
      prev.title = spec.title.slice(0, 200);
      prev.text = `${spec.text}\n\n(+${prev.count - 1} antes disto, do mesmo sítio)`.slice(0, 8000);
      saveNotifications(list);
      try { notificationsBroadcaster?.(prev); } catch { /* inbox already persisted */ }
      return prev;
    }
  }

  const n: AppNotification = {
    id: randomUUID(),
    kind: spec.kind,
    title: spec.title.slice(0, 200),
    text: spec.text.slice(0, 8000),
    ts: now,
    read: false,
    priority,
    ...(spec.groupKey ? { meta: { ...spec.meta, groupKey: spec.groupKey } } : { meta: spec.meta }),
  };
  list.push(n);
  saveNotifications(list);
  try { notificationsBroadcaster?.(n); } catch { /* inbox already persisted */ }
  return n;
}

// Anything still waiting on a decision. The UI surfaces these above the rest — an unanswered
// blocker is worth more than ten "finished" lines.
export function pendingActions(): AppNotification[] {
  return loadNotifications().filter((n) => !n.read && n.priority === 'action');
}

export function markNotificationRead(id: string, read: boolean): AppNotification | null {
  const list = loadNotifications();
  const n = list.find((x) => x.id === id);
  if (!n) return null;
  n.read = read;
  saveNotifications(list);
  return n;
}

// Resolve (marca como lidas) as entradas por ler de um grupo — quando a coisa que as causou deixou
// de ser verdade (ex.: a sessão saiu de «à espera de ti», ou fechou). Cada entrada resolvida volta a
// ser difundida já com `read: true`: é isso que deixa a UI fechar o toast de acção, que não se
// fecha sozinho. Devolve quantas mudaram.
export function resolveNotificationGroup(groupKey: string): number {
  const list = loadNotifications();
  const resolved = list.filter((n) => n.meta?.groupKey === groupKey && !n.read);
  if (resolved.length === 0) return 0;
  for (const n of resolved) n.read = true;
  saveNotifications(list);
  for (const n of resolved) { try { notificationsBroadcaster?.(n); } catch { /* inbox already persisted */ } }
  return resolved.length;
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

// ── Fila «à espera de ti» ─────────────────────────────────────────────────────
// A mesma inbox, vista pelo lado do que te bloqueia: só entradas de acção por ler, a mais antiga
// primeiro (quem espera há mais tempo passa à frente), sem as adiadas. Não há estado próprio — o
// «adiar» é um campo da notificação, por isso persiste (e sobrevive a um reinício) como o resto.
//
// Voltar a entrar em espera DEPOIS de ter saído traz a sessão de volta mesmo com um adiamento
// pendente: sair resolve a entrada (read) e a entrada seguinte nasce nova, sem `snoozedUntil`.

// Durações oferecidas pelo botão «Adiar». Lista fechada: a rota recusa o resto.
export const SNOOZE_MINUTES = [15, 60, 240] as const;

export interface WaitingQueue {
  queue: AppNotification[];   // por ordem de espera, a mais antiga primeiro
  snoozed: number;            // quantas estão adiadas agora
  nextWakeAt?: number;        // quando acaba o adiamento mais próximo (a UI refaz o pedido aí)
}

const isWaiting = (n: AppNotification) => !n.read && n.priority === 'action';

export function waitingQueue(now: number = Date.now()): WaitingQueue {
  const waiting = loadNotifications().filter(isWaiting);
  const snoozed = waiting.filter((n) => (n.snoozedUntil ?? 0) > now);
  const queue = waiting.filter((n) => (n.snoozedUntil ?? 0) <= now).sort((a, b) => a.ts - b.ts);
  const nextWakeAt = snoozed.length ? Math.min(...snoozed.map((n) => n.snoozedUntil as number)) : undefined;
  return { queue, snoozed: snoozed.length, ...(nextWakeAt ? { nextWakeAt } : {}) };
}

// Adia uma entrada da fila. Só o que está mesmo à espera (acção, por ler): adiar uma coisa já
// resolvida não faria nada visível e escondia o erro de quem chamou.
export function snoozeNotification(
  id: string, minutes: number, now: number = Date.now(),
): AppNotification | 'not_found' | 'not_waiting' {
  const list = loadNotifications();
  const n = list.find((x) => x.id === id);
  if (!n) return 'not_found';
  if (!isWaiting(n)) return 'not_waiting';
  n.snoozedUntil = now + minutes * 60_000;
  saveNotifications(list);
  return n;
}
