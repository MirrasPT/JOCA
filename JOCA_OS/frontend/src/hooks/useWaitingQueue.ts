// Fila «à espera de ti» (issue #11): a inbox persistente vista pelo lado do que te bloqueia.
//
// A fonte é o backend (`GET /notifications/queue` — ordem por idade, adiadas fora), mas a UI tem
// uma verdade mais fresca sobre as sessões: o `agentState` chega pelo WebSocket antes de qualquer
// novo pedido. Por isso uma entrada `agent-waiting:<id>` cuja sessão já não está em espera (ou já
// não existe — um reinício do backend deixa-as por resolver) não se mostra.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppNotification, SessionInfo, WaitingQueueResponse } from '../types';

// Rede de segurança: o adiamento feito noutro separador chega por WS (inboxTick); isto é para o resto.
const POLL_MS = 60_000;

export interface WaitingItem {
  notification: AppNotification;
  /** A sessão viva a que a entrada se refere, se houver. */
  session?: SessionInfo;
  /** O que o agente está a pedir — o da sessão viva manda (pode mudar sem notificação nova). */
  reason: string;
  since: number;
}

export function useWaitingQueue(sessions: SessionInfo[], refreshKey: number) {
  const [data, setData] = useState<WaitingQueueResponse>({ queue: [], snoozed: 0, snoozedItems: [] });

  const reload = useCallback(() => {
    fetch('/notifications/queue')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WaitingQueueResponse | null) => { if (d && Array.isArray(d.queue) && Array.isArray(d.snoozedItems)) setData(d); })
      .catch(() => { /* backend em baixo: fica a última fila conhecida */ });
  }, []);

  // Quem está em espera agora — mudar isto (entrar/sair) é razão para voltar a pedir.
  const waitingKey = sessions.filter((s) => s.agentState === 'waiting').map((s) => s.id).sort().join(',');

  useEffect(() => { reload(); }, [reload, refreshKey, waitingKey]);

  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // Um adiamento que acaba volta a pôr a entrada na fila — pede-se nesse instante, não no próximo poll.
  useEffect(() => {
    if (!data.nextWakeAt) return;
    const t = setTimeout(reload, Math.max(0, data.nextWakeAt - Date.now()) + 250);
    return () => clearTimeout(t);
  }, [data.nextWakeAt, reload]);

  const sessaoDe = useCallback((n: AppNotification) =>
    (n.meta?.sessionId ? sessions.find((s) => s.id === n.meta?.sessionId) : undefined), [sessions]);
  // Órfã: espera de uma sessão que já não existe ou já não está em espera. Vale para a fila e para
  // o contador de adiadas — com filtros diferentes dizia «1 adiada» e «Nada à tua espera» juntos.
  const orfa = useCallback((n: AppNotification) =>
    !!n.meta?.groupKey?.startsWith('agent-waiting:') && sessaoDe(n)?.agentState !== 'waiting', [sessaoDe]);

  const items = useMemo<WaitingItem[]>(() => data.queue.flatMap((n) => {
    if (orfa(n)) return [];
    const session = sessaoDe(n);
    return [{ notification: n, session, reason: session?.waitingReason ?? n.text, since: n.ts }];
  }), [data.queue, orfa, sessaoDe]);

  const snoozed = useMemo(() => data.snoozedItems.filter((n) => !orfa(n)).length, [data.snoozedItems, orfa]);

  const snooze = useCallback(async (id: string, minutes: number) => {
    // Sai já da vista; se o backend recusar (ex.: entretanto resolvida), o reload repõe a verdade.
    setData((d) => ({ ...d, queue: d.queue.filter((n) => n.id !== id) }));
    try {
      await fetch(`/notifications/${encodeURIComponent(id)}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
    } finally {
      reload();
    }
  }, [reload]);

  return { items, snoozed, snooze };
}
