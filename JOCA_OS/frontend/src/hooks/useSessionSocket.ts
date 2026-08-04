import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ToastItem } from '../components/ToastNotification';
import type { WorkflowState } from '../components/WorkflowPanel';
import type { AppNotification, MainView, ManagerMessage, SessionInfo, TerminalRef } from '../types';
import { notify } from '../lib/notify';

type ActivityEvent = { id: string; title: string; detail: string; timestamp: number };

// Returns a new Set without `id`, or the SAME Set when `id` isn't there (no re-render).
function withoutId(set: Set<string>, id: string): Set<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

// Keeps only the ids still alive server-side; returns the same Set when nothing was removed.
function pruneIds(set: Set<string>, alive: Set<string>): Set<string> {
  const stale = [...set].filter((id) => !alive.has(id));
  if (stale.length === 0) return set;
  const next = new Set(set);
  stale.forEach((id) => next.delete(id));
  return next;
}

// Deletes dead session entries from a ref-held Map in place; true when something was removed.
function pruneMap<T>(map: Map<string, T>, alive: Set<string>): boolean {
  let removed = false;
  for (const id of [...map.keys()]) {
    if (!alive.has(id)) { map.delete(id); removed = true; }
  }
  return removed;
}

export type ServerMessage =
  | { type: 'sessions_list'; sessions: SessionInfo[] }
  | { type: 'session_created'; session: SessionInfo }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'session_renamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'buffer'; sessionId: string; data: string }
  | { type: 'session_status'; sessionId: string; status: 'working' | 'idle'; isDone?: boolean }
  | { type: 'projects_changed' }
  | { type: 'automation_message'; id: string; text: string; ts: number }
  | { type: 'automations_changed' }
  | { type: 'task_question'; taskId: string; sessionId: string; title: string; summary?: string }
  | { type: 'tasks_changed' }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'manager_message'; projectId: string; message: ManagerMessage }
  | { type: 'manager_busy'; projectId: string; busy: boolean }
  | { type: 'error'; error: string };

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

// Reconnect backoff: doubles on every failed attempt up to RECONNECT_MAX_DELAY, with jitter so N
// tabs don't all retry on the same tick. Reset to RECONNECT_BASE_DELAY once a socket opens.
const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30_000;

// Everything the message router needs from the parent. Stable refs are passed directly; React state
// is mutated via the setters. Mirrored in a ref inside the hook so the socket is created ONCE on
// mount and never rebuilt when a dependency identity changes.
export interface SessionSocketDeps {
  setSessions: Dispatch<SetStateAction<SessionInfo[]>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setActivityEvents: Dispatch<SetStateAction<ActivityEvent[]>>;
  setMainView: Dispatch<SetStateAction<MainView>>;
  setWorkflowStates: Dispatch<SetStateAction<Map<string, WorkflowState>>>;
  setUnreadIds: Dispatch<SetStateAction<Set<string>>>;
  setActivatedIds: Dispatch<SetStateAction<Set<string>>>;
  setAutomationsRefresh: Dispatch<SetStateAction<number>>;
  setTasksRefresh: Dispatch<SetStateAction<number>>;
  setNotificationsRefresh: Dispatch<SetStateAction<number>>;
  setManagerRefresh: Dispatch<SetStateAction<number>>;
  /** Gestores a meio de um turno (`__global__` = o Joca) — alimenta o indicador do rodapé. */
  setBusyManagerIds: Dispatch<SetStateAction<string[]>>;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  outputBuffers: React.MutableRefObject<Map<string, string>>;
  workflowRef: React.MutableRefObject<Map<string, WorkflowState>>;
  sessionsRef: React.MutableRefObject<SessionInfo[]>;
  activeIdRef: React.MutableRefObject<string | null>;
  pinOutputRef: React.MutableRefObject<boolean>;
  /** `false` = a próxima sessão criada NÃO rouba o ecrã (o "+" da lista de agentes cria o agente e
   *  fica onde se está). Volta a `true` sozinho depois de consumido — é uma excepção pontual, não
   *  um modo: numa lista lateral, ser atirado para ecrã cheio a cada agente novo é agressivo. */
  focusNewSessionRef: React.MutableRefObject<boolean>;
  activateSession: (id: string) => void;
  addToast: (session: SessionInfo) => void;
  /** Toast persistente para uma notificação `priority:'action'` (bloqueio à espera de resposta). */
  addNotificationToast: (notification: AppNotification) => void;
  processOutput: (sessionId: string, data: string) => void;
  reloadProjects: () => void;
  reloadProjectMemory: () => void;
}

// Owns the WebSocket lifecycle (connect / reconnect / message routing) and exposes a stable `send`.
// All parent dependencies are read through a ref, so the socket is created once on mount.
export function useSessionSocket(deps: SessionSocketDeps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_DELAY);
  const unmountedRef = useRef(false);
  const depsRef = useRef(deps);
  useEffect(() => { depsRef.current = deps; });

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const d = depsRef.current;
      let msg: ServerMessage;
      try { msg = JSON.parse(event.data) as ServerMessage; }
      catch { return; }

      switch (msg.type) {
        case 'sessions_list': {
          d.setSessions(msg.sessions);
          const alive = new Set(msg.sessions.map((s) => s.id));
          msg.sessions.forEach((s) => d.activateSession(s.id));
          if (msg.sessions.length > 0) {
            d.setActiveId((prev) => prev ?? msg.sessions[0].id);
          }
          // This message also arrives after a RECONNECT. Any terminal already mounted has been
          // deaf while the socket was down (mobile suspends it on every background switch), so
          // re-pull the server-side buffer to recover the output emitted meanwhile.
          d.termRefs.current.forEach((_ref, sessionId) => {
            if (alive.has(sessionId)) send({ type: 'get_buffer', sessionId });
          });
          // `sessions_list` is the server's authoritative snapshot: drop every ref/id belonging to
          // a session it no longer knows about (e.g. closed while we were disconnected).
          pruneMap(d.termRefs.current, alive);
          pruneMap(d.outputBuffers.current, alive);
          if (pruneMap(d.workflowRef.current, alive)) d.setWorkflowStates(new Map(d.workflowRef.current));
          d.setUnreadIds((prev) => pruneIds(prev, alive));
          d.setActivatedIds((prev) => pruneIds(prev, alive));
          break;
        }

        case 'session_created':
          d.setSessions((prev) => {
            if (prev.some((s) => s.id === msg.session.id)) return prev;
            return [...prev, msg.session];
          });
          d.setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Session created', detail: msg.session.name, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          d.activateSession(msg.session.id);
          // Workers spawned by automations/tasks (origin 'auto') stay in the BACKGROUND — they must
          // not yank focus to the terminal. Only user-created sessions switch the view.
          if (msg.session.origin !== 'auto' && d.focusNewSessionRef.current) {
            d.setActiveId(msg.session.id);
            d.setMainView('session');
          }
          d.focusNewSessionRef.current = true;
          break;

        case 'session_closed':
          d.setSessions((prev) => {
            const next = prev.filter((s) => s.id !== msg.sessionId);
            d.setActiveId((cur) => {
              if (cur !== msg.sessionId) return cur;
              return next.length > 0 ? next[next.length - 1].id : null;
            });
            return next;
          });
          d.termRefs.current.delete(msg.sessionId);
          d.outputBuffers.current.delete(msg.sessionId);
          d.workflowRef.current.delete(msg.sessionId);
          d.setWorkflowStates(new Map(d.workflowRef.current));
          // These Sets used to keep every id ever seen — a slow leak across a long-running app.
          d.setUnreadIds((prev) => withoutId(prev, msg.sessionId));
          d.setActivatedIds((prev) => withoutId(prev, msg.sessionId));
          d.setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Session closed', detail: msg.sessionId, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          // A pool de workers do gestor não vive no estado global — vem do GET do chat. Sem este
          // refetch, um agente fechado à mão continuava na lista de Agentes até o gestor falar, e
          // clicar nele abria um terminal que já não existe. O backend já o tirou da pool
          // (worker-pool.forgetSession no evento 'closed'); faltava o cliente ir buscar.
          d.setManagerRefresh((n) => n + 1);
          break;

        case 'session_renamed':
          d.setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          break;

        case 'output':
          d.termRefs.current.get(msg.sessionId)?.write(msg.data);
          d.processOutput(msg.sessionId, msg.data);
          if (d.pinOutputRef.current && msg.sessionId === d.activeIdRef.current) {
            d.termRefs.current.get(msg.sessionId)?.scrollToBottom?.();
          }
          break;

        case 'buffer': {
          const ref = d.termRefs.current.get(msg.sessionId);
          ref?.reset();
          ref?.write(msg.data);
          requestAnimationFrame(() => ref?.fit?.());
          d.outputBuffers.current.set(msg.sessionId, '');
          d.workflowRef.current.delete(msg.sessionId);
          d.processOutput(msg.sessionId, msg.data);
          break;
        }

        case 'session_status':
          d.setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, status: msg.status } : s
          ));
          if (msg.isDone) {
            const session = d.sessionsRef.current.find((s) => s.id === msg.sessionId);
            if (session && session.id !== d.activeIdRef.current) {
              // NO popup toast for your own terminal work — keep only the subtle unread dot in the
              // sidebar. Automation/task workers (origin 'auto') DO fire an OS notification: they run
              // in the background, so the user must be alerted that the result is ready to inspect.
              d.setUnreadIds((prev) => new Set([...prev, msg.sessionId]));
              if (session.origin === 'auto') {
                notify('JOCA — Terminado', session.name, { sessionId: session.id });
              }
            }
          }
          break;

        case 'projects_changed':
          // A project was created/updated server-side — refresh the sidebar list + memory.
          d.reloadProjects();
          d.reloadProjectMemory();
          break;

        // An automation delivered a message-node result → OS notification (the worker terminal and
        // the automation's lastResult hold the full output).
        case 'automation_message':
          notify('JOCA — Automação', msg.text.replace(/\s+/g, ' ').trim().slice(0, 120), { automationId: msg.id });
          break;
        // A task worker is blocked waiting for the user (question/confirmation in the terminal).
        case 'task_question':
          notify(
            'JOCA — Tarefa precisa de ti',
            `${msg.title}: ${(msg.summary ?? 'responde no terminal').slice(0, 100)}`,
            { taskId: msg.taskId, sessionId: msg.sessionId },
          );
          break;
        case 'automations_changed':
          d.setAutomationsRefresh((n) => n + 1);
          break;
        case 'tasks_changed':
          d.setTasksRefresh((n) => n + 1);
          break;

        // O gestor de um projecto falou. Não trazemos a mensagem para dentro do estado global: um
        // contador chega para o ManagerChat aberto refazer o GET (fonte única, sem risco de a lista
        // divergir). O gestor volta a falar sozinho minutos depois — se a janela não estiver à
        // frente, isso tem de chegar ao utilizador como notificação do sistema.
        case 'manager_message':
          d.setManagerRefresh((n) => n + 1);
          if (msg.message.role === 'manager' && !document.hasFocus()) {
            notify(
              'JOCA — Gestor do projecto',
              msg.message.text.replace(/\s+/g, ' ').trim().slice(0, 120),
              { projectId: msg.projectId },
            );
          }
          break;
        case 'manager_busy':
          d.setManagerRefresh((n) => n + 1);
          // Conjunto (via array) de quem está a pensar — o rodapé mostra a contagem. Guardado por
          // chave de gestor, que pode ser um projectId ou `__global__` (o Joca).
          d.setBusyManagerIds((prev) => {
            const tem = prev.includes(msg.projectId);
            if (msg.busy === tem) return prev; // sem mudança → sem re-render
            return msg.busy ? [...prev, msg.projectId] : prev.filter((id) => id !== msg.projectId);
          });
          break;

        // Nova entrada no inbox persistente → refetch do NotificationsInbox. OS notification só
        // para heartbeat/system: automation_message e task_question já notificam nos cases acima.
        case 'notification':
          d.setNotificationsRefresh((n) => n + 1);
          if (msg.notification.kind === 'heartbeat' || msg.notification.kind === 'system') {
            notify(
              msg.notification.title,
              msg.notification.text.replace(/\s+/g, ' ').trim().slice(0, 120),
              msg.notification.meta,
            );
          }
          // Um bloqueio à espera de resposta tem de aparecer mesmo com a inbox fechada — e o toast
          // de `action` não se auto-fecha, ao contrário do aviso de sessão terminada.
          if (msg.notification.priority === 'action') d.addNotificationToast(msg.notification);
          break;

        // Server-side refusal (session cap reached, invalid cwd, …). Without this the request just
        // silently did nothing and the user had no idea why.
        case 'error':
          d.setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Erro do servidor', detail: msg.error, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          notify('JOCA — Erro', msg.error.replace(/\s+/g, ' ').trim().slice(0, 120));
          break;

        default:
          if (import.meta.env.DEV) console.warn('Unknown WS message type', (msg as { type?: string }).type);
          break;
      }
    };

    ws.onopen = () => { reconnectDelay.current = RECONNECT_BASE_DELAY; };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      // Exponential backoff + jitter: a dead/restarting backend no longer gets hammered every 2s.
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_DELAY);
      const jittered = delay + Math.random() * (delay * 0.25);
      reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; connect(); }, jittered);
    };

    ws.onerror = () => ws.close();
    // Handlers are read via depsRef; the socket is intentionally created once.
  }, [send]);

  useEffect(() => {
    unmountedRef.current = false;
    reconnectDelay.current = RECONNECT_BASE_DELAY;
    connect();

    // Coming back from the background (mobile suspends the socket every time) must not wait out
    // the backoff — retry at once if the socket is already gone.
    const onVisibilityChange = () => {
      if (document.hidden || unmountedRef.current) return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      reconnectDelay.current = RECONNECT_BASE_DELAY;
      connect();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unmountedRef.current = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { send };
}
