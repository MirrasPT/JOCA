// Conversas perdidas num reinício do backend.
//
// Quando o servidor reinicia, os PTYs morrem com ele e o `sessions_list` que chega a seguir é um
// retrato AUTORITATIVO vazio: a UI poda tudo e as conversas desaparecem da lista sem uma palavra.
// A poda está certa — o que faltava era dizer ao utilizador o que aconteceu. É isso que este hook
// alimenta: lê o retrato que o backend guardou antes de morrer, e dá as duas saídas possíveis
// (reabrir, ou ler o que a conversa tinha escrito).
//
// A poda NÃO é tocada aqui. Este hook só lê `/sessions/recovered`.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecoveredSnapshot } from '../types';

const ENDPOINT = '/sessions/recovered';

export interface RecoveredSessionsApi {
  /** `null` = nada a recuperar (encerramento limpo, retrato já dispensado, ou backend sem a rota). */
  snapshot: RecoveredSnapshot | null;
  /** Dispensa o aviso: apaga o retrato no servidor para não voltar no próximo arranque. */
  dismiss: () => void;
  /** Output cru (com ANSI) que a conversa tinha quando morreu. */
  loadTail: (sessionId: string) => Promise<string>;
  /** O `bootId` que veio no `sessions_list`. Mudou → o backend reiniciou → há retrato novo. */
  noteBootId: (bootId?: string) => void;
}

export function useRecoveredSessions(): RecoveredSessionsApi {
  const [snapshot, setSnapshot] = useState<RecoveredSnapshot | null>(null);
  // Último arranque do servidor de que temos conhecimento. Serve só para detectar a MUDANÇA.
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
      // Falha de rede não é motivo para deitar fora um retrato que já está no ecrã.
      .catch(() => {})
      .finally(() => { emCurso.current = false; });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const noteBootId = useCallback((bootId?: string) => {
    if (!bootId) return;
    const anterior = bootIdRef.current;
    bootIdRef.current = bootId;
    // Primeira vez (ainda não sabíamos qual era) não conta como reinício: o arranque já foi lido
    // pelo efeito de montagem. Só uma MUDANÇA significa "o servidor que estava ali morreu".
    if (anterior === null || anterior === bootId) return;
    refresh();
  }, [refresh]);

  const dismiss = useCallback(() => {
    setSnapshot(null);
    // Se o DELETE falhar, o retrato continua no servidor e volta a aparecer numa próxima carga —
    // que é o comportamento seguro: mais vale um aviso a repetir-se do que perder as conversas.
    fetch(ENDPOINT, { method: 'DELETE' }).catch(() => {});
  }, []);

  const loadTail = useCallback(async (sessionId: string): Promise<string> => {
    const r = await fetch(`${ENDPOINT}/${encodeURIComponent(sessionId)}/tail`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }, []);

  return { snapshot, dismiss, loadTail, noteBootId };
}
