import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowState } from '../components/WorkflowPanel';
import type { AppNotification, MainView, SessionInfo, TerminalRef } from '../types';
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
  /** `bootId` identifies THIS backend startup. Changed between two `sessions_list` → the server
   *  that was there died and came back, and the conversations from before no longer exist. */
  | { type: 'sessions_list'; sessions: SessionInfo[]; bootId?: string }
  | { type: 'session_created'; session: SessionInfo; requestedBy?: string }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'session_renamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'buffer'; sessionId: string; data: string }
  | { type: 'session_status'; sessionId: string; status: 'working' | 'idle'; isDone?: boolean }
  | { type: 'projects_changed' }
  | { type: 'notification'; notification: AppNotification }
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
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  outputBuffers: React.MutableRefObject<Map<string, string>>;
  workflowRef: React.MutableRefObject<Map<string, WorkflowState>>;
  sessionsRef: React.MutableRefObject<SessionInfo[]>;
  activeIdRef: React.MutableRefObject<string | null>;
  pinOutputRef: React.MutableRefObject<boolean>;
  /** `false` = the next session created does NOT steal the screen (the "+" in the agents list creates
   *  the agent and stays where you are). It goes back to `true` by itself once consumed — it is a one-off
   *  exception, not a mode: in a side list, being thrown into full screen on every new agent is aggressive. */
  focusNewSessionRef: React.MutableRefObject<boolean>;
  activateSession: (id: string) => void;
  addToast: (session: SessionInfo) => void;
  /** Persistent toast for a `priority:'action'` notification (a block waiting on an answer). */
  addNotificationToast: (notification: AppNotification) => void;
  processOutput: (sessionId: string, data: string) => void;
  reloadProjects: () => void;
  reloadProjectMemory: () => void;
  /** Which backend startup is on the other side. It only notifies; the pruning below does not change for this. */
  onServerBoot?: (bootId?: string) => void;
}

// Owns the WebSocket lifecycle (connect / reconnect / message routing) and exposes a stable `send`.
// All parent dependencies are read through a ref, so the socket is created once on mount.
/**
 * Identity of this tab. It only lives in memory: reloading gives a new id, and that is what is wanted —
 * a reloaded tab is a new client, without inheriting view jumps from before.
 */
const CLIENT_ID = crypto.randomUUID();

export function useSessionSocket(deps: SessionSocketDeps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_DELAY);
  const unmountedRef = useRef(false);
  const depsRef = useRef(deps);
  // What has already been painted in each session's xterm, so as NOT to clear the screen again for nothing.
  // It stores the length of the last replicated buffer + the tail at that point (a cheap
  // fingerprint): if the new buffer continues the same one, only the delta is written instead of `reset()`.
  // `ref` stores the terminal INSTANCE it was painted on: a remounted `TerminalPane` brings a
  // new, empty xterm, and there the replay has to be complete, not incremental.
  const replayed = useRef<Map<string, { ref: TerminalRef; len: number; tail: string }>>(new Map());
  useEffect(() => { depsRef.current = deps; });

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Stamps WHO is asking for the session. The stamp is injected here, and not in each of the ten
      // places that create sessions, so that none of them forgets — forgetting means dragging every
      // open tab into the new terminal again.
      const m = msg as { type?: string; clientId?: string };
      const corpo = m.type === 'create_session' && !m.clientId ? { ...msg, clientId: CLIENT_ID } : msg;
      wsRef.current.send(JSON.stringify(corpo));
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
          // First of all: say WHO is on the other side. If the backend restarted, the pruning that
          // happens further down will delete the old sessions — and whoever listens to this is the one
          // that can then explain to the user where they went.
          d.onServerBoot?.(msg.bootId);
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
          pruneMap(replayed.current, alive);
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
          // Only WHOEVER ASKED FOR IT jumps to the new terminal. Three conditions: it is not a background
          // worker ('auto'), it was me who asked (`requestedBy`), and this request was not one of the ones
          // that open in the background (`focusNewSessionRef`). Without the middle one, a second tab — or
          // another agent opening a terminal — threw you out of what you were doing.
          const pediEu = msg.requestedBy === undefined || msg.requestedBy === CLIENT_ID;
          if (msg.session.origin !== 'auto' && pediEu && d.focusNewSessionRef.current) {
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
          break;

        case 'session_renamed':
          d.setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          break;

        case 'output': {
          d.termRefs.current.get(msg.sessionId)?.write(msg.data);
          d.processOutput(msg.sessionId, msg.data);
          // The server buffer is the concatenation of what comes out of the PTY: tracking here what has
          // already been painted live is what stops the next replay from rewriting these same lines
          // (that was the duplication). If the server trims the buffer meanwhile, the length stops
          // matching and the replay falls into the `reset()` path, which is the right one in that case.
          const marca = replayed.current.get(msg.sessionId);
          if (marca) {
            const tail = (marca.tail + msg.data).slice(-256);
            replayed.current.set(msg.sessionId, { ref: marca.ref, len: marca.len + msg.data.length, tail });
          }
          if (d.pinOutputRef.current && msg.sessionId === d.activeIdRef.current) {
            d.termRefs.current.get(msg.sessionId)?.scrollToBottom?.();
          }
          break;
        }

        case 'buffer': {
          const ref = d.termRefs.current.get(msg.sessionId);
          // A `reset()` clears the screen in front of whoever is reading. Before it happened on EVERY
          // response to `get_buffer` — including the ones a reconnection fires for each mounted
          // terminal — and it read as "a clear came out of nowhere and wiped my chat". It only clears when
          // the server buffer has stopped continuing what is already painted (a terminal just
          // mounted, or a buffer trimmed on the server for having passed the ceiling).
          const prev = replayed.current.get(msg.sessionId);
          const continua = !!prev
            && !!ref
            && prev.ref === ref
            && msg.data.length >= prev.len
            && msg.data.slice(Math.max(0, prev.len - prev.tail.length), prev.len) === prev.tail;
          if (continua && prev) {
            const delta = msg.data.slice(prev.len);
            if (delta) { ref?.write(delta); d.processOutput(msg.sessionId, delta); }
          } else {
            ref?.reset();
            ref?.write(msg.data);
            requestAnimationFrame(() => ref?.fit?.());
            d.outputBuffers.current.set(msg.sessionId, '');
            d.workflowRef.current.delete(msg.sessionId);
            d.processOutput(msg.sessionId, msg.data);
          }
          if (ref) replayed.current.set(msg.sessionId, { ref, len: msg.data.length, tail: msg.data.slice(-256) });
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
              // sidebar. Workers created programmatically (origin 'auto') DO fire an OS
              // notification: they run in the background, so the user has to be told that
              // the result is ready for inspection.
              d.setUnreadIds((prev) => new Set([...prev, msg.sessionId]));
              if (session.origin === 'auto') {
                notify('JOCA — Finished', session.name, { sessionId: session.id });
              }
            }
          }
          break;

        case 'projects_changed':
          // A project was created/updated server-side — refresh the sidebar list + memory.
          d.reloadProjects();
          d.reloadProjectMemory();
          break;


        // The notifications panel was removed; what is left are the ephemeral channels. An OS
        // notification only for 'system'.
        case 'notification':
          if (msg.notification.kind === 'system') {
            notify(
              msg.notification.title,
              msg.notification.text.replace(/\s+/g, ' ').trim().slice(0, 120),
              msg.notification.meta,
            );
          }
          // A block waiting on an answer has to show up even with the inbox closed — and the `action`
          // toast does not auto-close, unlike the finished-session warning.
          if (msg.notification.priority === 'action') d.addNotificationToast(msg.notification);
          break;

        // Server-side refusal (session cap reached, invalid cwd, …). Without this the request just
        // silently did nothing and the user had no idea why.
        case 'error':
          d.setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Server error', detail: msg.error, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          notify('JOCA — Error', msg.error.replace(/\s+/g, ' ').trim().slice(0, 120));
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
