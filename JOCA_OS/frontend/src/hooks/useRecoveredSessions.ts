// Conversations lost in a backend restart.
//
// When the server restarts, the PTYs die with it and the `sessions_list` that arrives next is an
// empty AUTHORITATIVE snapshot: the UI prunes everything and the conversations vanish from the list
// without a word. The pruning is right — what was missing was telling the user what happened. That
// is what this hook feeds: it reads the snapshot the backend saved before dying, and gives the two
// possible ways out (reopen, or read what the conversation had written).
//
// The pruning is NOT touched here. This hook only reads `/sessions/recovered`.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecoveredSnapshot } from '../types';

const ENDPOINT = '/sessions/recovered';

export interface RecoveredSessionsApi {
  /** `null` = nothing to recover (clean shutdown, snapshot already dismissed, or backend without the route). */
  snapshot: RecoveredSnapshot | null;
  /** Dismisses the warning: deletes the snapshot on the server so it does not come back on the next startup. */
  dismiss: () => void;
  /** Raw output (with ANSI) the conversation had when it died. */
  loadTail: (sessionId: string) => Promise<string>;
  /** The `bootId` that came in the `sessions_list`. Changed → the backend restarted → there is a new snapshot. */
  noteBootId: (bootId?: string) => void;
}

export function useRecoveredSessions(): RecoveredSessionsApi {
  const [snapshot, setSnapshot] = useState<RecoveredSnapshot | null>(null);
  // The last server startup we know about. It only serves to detect the CHANGE.
  const bootIdRef = useRef<string | null>(null);
  const emCurso = useRef(false);

  const refresh = useCallback(() => {
    if (emCurso.current) return;
    emCurso.current = true;
    fetch(ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: RecoveredSnapshot | null) => {
        if (!dados || !Array.isArray(dados.sessions) || dados.sessions.length === 0) {
          setSnapshot(null);
          return;
        }
        if (typeof dados.bootId === 'string') bootIdRef.current = dados.bootId;
        setSnapshot(dados);
      })
      // A network failure is no reason to throw away a snapshot that is already on screen.
      .catch(() => {})
      .finally(() => { emCurso.current = false; });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const noteBootId = useCallback((bootId?: string) => {
    if (!bootId) return;
    const anterior = bootIdRef.current;
    bootIdRef.current = bootId;
    // The first time (we did not yet know which one it was) does not count as a restart: the startup
    // was already read by the mount effect. Only a CHANGE means "the server that was there died".
    if (anterior === null || anterior === bootId) return;
    refresh();
  }, [refresh]);

  const dismiss = useCallback(() => {
    setSnapshot(null);
    // If the DELETE fails, the snapshot stays on the server and shows up again on a later load —
    // which is the safe behavior: better a warning that repeats than losing the conversations.
    fetch(ENDPOINT, { method: 'DELETE' }).catch(() => {});
  }, []);

  const loadTail = useCallback(async (sessionId: string): Promise<string> => {
    const r = await fetch(`${ENDPOINT}/${encodeURIComponent(sessionId)}/tail`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }, []);

  return { snapshot, dismiss, loadTail, noteBootId };
}
