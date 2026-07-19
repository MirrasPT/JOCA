import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ToastItem } from '../components/ToastNotification';
import type { WorkflowState } from '../components/WorkflowPanel';
import type { MainView, SessionInfo, TerminalRef } from '../types';
import { notify } from '../lib/notify';

type ActivityEvent = { id: string; title: string; detail: string; timestamp: number };

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
  | { type: 'tasks_changed' };

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

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
  setAutomationsRefresh: Dispatch<SetStateAction<number>>;
  setTasksRefresh: Dispatch<SetStateAction<number>>;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  outputBuffers: React.MutableRefObject<Map<string, string>>;
  workflowRef: React.MutableRefObject<Map<string, WorkflowState>>;
  sessionsRef: React.MutableRefObject<SessionInfo[]>;
  activeIdRef: React.MutableRefObject<string | null>;
  pinOutputRef: React.MutableRefObject<boolean>;
  activateSession: (id: string) => void;
  addToast: (session: SessionInfo) => void;
  processOutput: (sessionId: string, data: string) => void;
  reloadProjects: () => void;
  reloadProjectMemory: () => void;
}

// Owns the WebSocket lifecycle (connect / reconnect / message routing) and exposes a stable `send`.
// All parent dependencies are read through a ref, so the socket is created once on mount.
export function useSessionSocket(deps: SessionSocketDeps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        case 'sessions_list':
          d.setSessions(msg.sessions);
          msg.sessions.forEach((s) => d.activateSession(s.id));
          if (msg.sessions.length > 0) {
            d.setActiveId((prev) => prev ?? msg.sessions[0].id);
          }
          break;

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
          if (msg.session.origin !== 'auto') {
            d.setActiveId(msg.session.id);
            d.setMainView('session');
          }
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
                notify('JOCA — Terminado', session.name);
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
          notify('JOCA — Automação', msg.text.replace(/\s+/g, ' ').trim().slice(0, 120));
          break;
        // A task worker is blocked waiting for the user (question/confirmation in the terminal).
        case 'task_question':
          notify('JOCA — Tarefa precisa de ti', `${msg.title}: ${(msg.summary ?? 'responde no terminal').slice(0, 100)}`);
          break;
        case 'automations_changed':
          d.setAutomationsRefresh((n) => n + 1);
          break;
        case 'tasks_changed':
          d.setTasksRefresh((n) => n + 1);
          break;

        default:
          if (import.meta.env.DEV) console.warn('Unknown WS message type', (msg as { type?: string }).type);
          break;
      }
    };

    ws.onclose = () => {
      if (!unmountedRef.current) {
        reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; connect(); }, 2000);
      }
    };

    ws.onerror = () => ws.close();
    // Handlers are read via depsRef; the socket is intentionally created once.
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { send };
}
