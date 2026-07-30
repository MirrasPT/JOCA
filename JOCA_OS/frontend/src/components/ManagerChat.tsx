// ManagerChat — a conversa com o gestor do projecto.
//
// O gestor não escreve código: ouve, decide e manda workers (terminais reais) fazer o trabalho.
// Por isso o chat NÃO é síncrono: o POST devolve 202 com a nossa própria mensagem e a resposta dele
// chega depois por WebSocket — às vezes segundos, às vezes minutos depois, quando um worker acaba.
// Aqui isso traduz-se em: enviar é optimista, e todo o resto vem de um refetch disparado pelo
// `refreshKey` (que o App incrementa a cada `manager_message`/`manager_busy`).
//
// Reaproveita as bolhas do thread de notas das tarefas (.tk-note*) — é a mesma ideia visual
// (conversa entre humano e agentes) e não vale a pena um segundo sistema de estilos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ManagerMessage, ManagerRole, PooledWorker } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { fullDate, relTime } from './TaskDetail';

interface Props {
  projectId: string;
  projectName: string;
  /** Incrementa a cada evento WS do gestor (mensagem nova ou mudança de "a pensar"). */
  refreshKey: number;
  /** O GET do chat traz também a pool de workers — quem os mostra é o ProjectWorkspace. */
  onWorkersChange?: (workers: PooledWorker[]) => void;
}

interface ChatResponse {
  messages: ManagerMessage[];
  busy: boolean;
  totalCostUsd: number;
  workers: PooledWorker[];
}

const ROLE_META: Record<ManagerRole, { icon: string; label: string }> = {
  user: { icon: '👤', label: 'Eu' },
  manager: { icon: '🧭', label: 'Gestor' },
  system: { icon: '⚙', label: 'Sistema' },
};

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12 20 4l-8 16-2-6-6-2z" />
    </svg>
  );
}

/** Markdown do gestor, convertido uma única vez por texto (a lista re-renderiza a cada evento WS). */
function ManagerText({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div className="tk-note-text mgr-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ManagerChat({ projectId, projectName, refreshKey, onWorkersChange }: Props) {
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  // Callback lida por ref: assim o `load` não muda de identidade a cada render do pai.
  const workersCbRef = useRef(onWorkersChange);
  useEffect(() => { workersCbRef.current = onWorkersChange; }, [onWorkersChange]);

  const load = useCallback(() => {
    fetch(`/projects/${projectId}/chat?limit=200`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ChatResponse) => {
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setBusy(Boolean(d.busy));
        setTotalCost(Number(d.totalCostUsd) || 0);
        workersCbRef.current?.(Array.isArray(d.workers) ? d.workers : []);
        setLoadError('');
      })
      .catch(() => setLoadError('Não foi possível carregar a conversa com o gestor.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setConfirmClear(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Auto-scroll ao fim quando chega mensagem nova (ou quando ele começa/deixa de pensar).
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, busy]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setActionError('');
    try {
      const res = await fetch(`/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError((d as { error?: string }).error || `Não foi possível enviar (HTTP ${res.status}).`);
        return;
      }
      // 202: o corpo traz só a NOSSA mensagem, já persistida. A resposta dele vem por WebSocket.
      const d = (await res.json().catch(() => null)) as { message?: ManagerMessage } | null;
      if (d?.message?.id) {
        setMessages((prev) => (prev.some((m) => m.id === d.message!.id) ? prev : [...prev, d.message!]));
      }
      setDraft('');
      setBusy(true); // ele está a pensar; o `manager_busy` confirma logo a seguir
    } catch {
      setActionError('Erro de rede ao falar com o gestor.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, projectId]);

  const clearChat = useCallback(async () => {
    setConfirmClear(false);
    setActionError('');
    try {
      const res = await fetch(`/projects/${projectId}/chat`, { method: 'DELETE' });
      if (!res.ok) { setActionError('Não foi possível limpar a conversa.'); return; }
      setMessages([]);
      setTotalCost(0);
      load();
    } catch {
      setActionError('Erro de rede ao limpar a conversa.');
    }
  }, [projectId, load]);

  return (
    <section className="mgr-chat" aria-label={`Gestor do projecto ${projectName}`}>
      <header className="mgr-chat-head">
        <div className="mgr-chat-head-main">
          <h2>Gestor do projecto</h2>
          <p>Fala só com ele. Ele trata dos workers, das tarefas e volta a falar quando houver novidades.</p>
        </div>
        <div className="mgr-chat-head-side">
          {totalCost > 0 && (
            <span className="mgr-cost" title="Custo acumulado das conversas deste gestor">
              ${totalCost.toFixed(2)}
            </span>
          )}
          {confirmClear ? (
            <span className="mgr-confirm" role="alert">
              Apagar a conversa e a memória dele?
              <button type="button" className="mgr-confirm-yes" onClick={clearChat}>Limpar</button>
              <button type="button" onClick={() => setConfirmClear(false)}>Cancelar</button>
            </span>
          ) : (
            <button
              type="button"
              className="mgr-clear"
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0}
              title="Limpar a conversa e recomeçar a memória do gestor"
            >
              Limpar conversa
            </button>
          )}
        </div>
      </header>

      {loadError && <div className="tk-drawer-error" role="alert">{loadError}</div>}

      <div className="mgr-chat-thread">
        {loading && messages.length === 0 && <p className="tk-drawer-empty">A carregar a conversa…</p>}

        {!loading && messages.length === 0 && !loadError && (
          <div className="mgr-empty">
            <strong>Ainda não falaram.</strong>
            <p>
              O gestor conhece o {projectName}, não escreve código e não mexe nos ficheiros: ouve o que queres,
              abre workers (terminais reais) e cria tarefas para eles. Depois volta aqui a dizer o que ficou feito.
            </p>
            <p className="mgr-empty-hints">
              Experimenta: <em>“arruma a página inicial e diz-me o que mudaste”</em> ·{' '}
              <em>“o que falta para lançar isto?”</em> · <em>“cria uma tarefa para eu rever os textos”</em>
            </p>
          </div>
        )}

        <ol className="tk-thread-list">
          {messages.map((m) => {
            const meta = ROLE_META[m.role] ?? ROLE_META.system;
            return (
              <li key={m.id} className={`tk-note tk-note--${m.role}`}>
                <div className="tk-note-head">
                  <span className="tk-note-icon" aria-hidden>{meta.icon}</span>
                  <span className="tk-note-author">{m.author || meta.label}</span>
                  {m.author && <span className="tk-note-role">{meta.label}</span>}
                  <time className="tk-note-time" dateTime={new Date(m.ts).toISOString()} title={fullDate(m.ts)}>
                    {relTime(m.ts)}
                  </time>
                  {typeof m.costUsd === 'number' && m.costUsd > 0 && (
                    <span className="mgr-note-cost" title="Custo deste turno">${m.costUsd.toFixed(3)}</span>
                  )}
                </div>
                {m.role === 'manager'
                  ? <ManagerText text={m.text} />
                  : <p className="tk-note-text">{m.text}</p>}
                {m.actions?.length ? (
                  <div className="mgr-note-actions">
                    {m.actions.map((a, i) => <span key={`${m.id}-${i}`}>· {a}</span>)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {busy && (
          <div className="mgr-thinking" role="status">
            <span className="mgr-thinking-dots" aria-hidden><i /><i /><i /></span>
            a pensar…
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {actionError && <div className="tk-drawer-error" role="alert">{actionError}</div>}

      <div className="tk-note-compose mgr-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={3}
          placeholder="Diz o que queres feito… (Enter envia, Shift+Enter nova linha)"
          aria-label="Falar com o gestor do projecto"
        />
        <button type="button" className="tk-btn-primary" onClick={send} disabled={sending || !draft.trim()}>
          <SendIcon /> {sending ? 'A enviar…' : 'Enviar'}
        </button>
      </div>
    </section>
  );
}
