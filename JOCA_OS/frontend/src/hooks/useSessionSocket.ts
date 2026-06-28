import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ToastItem } from '../components/ToastNotification';
import type { WorkflowState } from '../components/WorkflowPanel';
import type { MainView, MasterEntry, SessionInfo, TerminalRef } from '../types';

// Human-readable labels for the Master's orchestration tool calls — shown live in the bottom
// activity indicator so the user sees what it's doing (dispatching workers, reading, etc.).
const MASTER_STEP_LABELS: Record<string, string> = {
  spawn_worker: 'A abrir um worker…',
  send_to_worker: 'A enviar a tarefa ao worker…',
  read_worker: 'A acompanhar o worker…',
  list_workers: 'A ver os workers abertos…',
  create_project: 'A criar o projecto…',
  search_memory: 'A consultar a memória…',
  read_diary: 'A ler o histórico…',
};

type ActivityEvent = { id: string; title: string; detail: string; timestamp: number };

export type ServerMessage =
  | { type: 'sessions_list'; sessions: SessionInfo[] }
  | { type: 'session_created'; session: SessionInfo }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'session_renamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'buffer'; sessionId: string; data: string }
  | { type: 'session_status'; sessionId: string; status: 'working' | 'idle'; isDone?: boolean }
  | { type: 'master_message'; text: string }
  | { type: 'orchestration_step'; tool: string; input: unknown }
  | { type: 'worker_summary'; summary: string; isError: boolean; costUsd: number }
  | { type: 'master_error'; error: string }
  | { type: 'projects_changed' }
  | { type: 'master_chat_cleared' }
  | { type: 'automation_message'; id: string; text: string; ts: number }
  | { type: 'automation_activity'; text: string }
  | { type: 'automations_changed' };

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
  setMasterLog: Dispatch<SetStateAction<MasterEntry[]>>;
  setMasterPending: Dispatch<SetStateAction<number>>;
  setMasterActivity: Dispatch<SetStateAction<string | null>>;
  setUnreadIds: Dispatch<SetStateAction<Set<string>>>;
  setAutomationsRefresh: Dispatch<SetStateAction<number>>;
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
          // Keep workers in the BACKGROUND when the user is in the Master view — spawning a worker
          // must not yank focus to the terminal. Only switch + select when not orchestrating.
          d.setMainView((prev) => {
            if (prev === 'master') return prev;
            d.setActiveId(msg.session.id);
            return 'session';
          });
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
              d.addToast(session);
              d.setUnreadIds((prev) => new Set([...prev, msg.sessionId]));
            }
          }
          break;

        // The Master's "thinking" — interim narration and tool calls. The final chat shows only the
        // answer (worker_summary), but we surface these live as a bottom activity indicator so the
        // user knows it's working / dispatching workers instead of waiting in silence.
        case 'master_message':
          d.setMasterActivity(msg.text.replace(/\s+/g, ' ').trim().slice(0, 200));
          break;
        case 'orchestration_step':
          d.setMasterActivity(MASTER_STEP_LABELS[msg.tool] ?? `A usar ${msg.tool}…`);
          break;

        case 'worker_summary':
          // Every run ends with exactly one worker_summary carrying the final answer. This is the
          // only thing the chat shows for an assistant turn.
          d.setMasterLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'summary' as const, text: msg.summary, isError: msg.isError, costUsd: msg.costUsd }]);
          d.setMasterPending((n) => Math.max(0, n - 1));
          break;

        case 'master_error':
          d.setMasterLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'error', text: msg.error }]);
          d.setMasterPending((n) => Math.max(0, n - 1));
          break;

        case 'projects_changed':
          // The Master created/registered a project — refresh the sidebar list + memory.
          d.reloadProjects();
          d.reloadProjectMemory();
          break;

        case 'master_chat_cleared':
          d.setMasterLog([]);
          break;

        // An automation delivered a result → show it in the Master chat (it persists server-side too).
        case 'automation_message':
          d.setMasterLog((prev) => [...prev, { id: msg.id, role: 'summary' as const, text: msg.text, isError: false, costUsd: 0 }]);
          break;
        case 'automation_activity':
          d.setMasterActivity(msg.text.replace(/\s+/g, ' ').trim().slice(0, 200));
          break;
        case 'automations_changed':
          d.setAutomationsRefresh((n) => n + 1);
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
