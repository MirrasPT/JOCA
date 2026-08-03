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
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import type { ManagerMessage, ManagerRole, PooledWorker } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { basename } from '../lib/paths';
import { captureDrop, dragRealPaths, dropHadFilesWithoutPath, resolveDrop, uploadPastedImages, uploadPickedFiles } from '../lib/fileDrop';
import { fullDate, relTime } from './TaskDetail';

function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
    </svg>
  );
}

interface Props {
  /** Omitido = modo global (Joca): fala com todos os projectos, não um só. */
  projectId?: string;
  projectName?: string;
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
  const isGlobal = !projectId;
  const chatBase = isGlobal ? '/manager/global/chat' : `/projects/${projectId}/chat`;
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Anexos do próximo envio — imagens/vídeo/ficheiros. O gestor não os "vê" automaticamente: o
  // texto enviado leva os paths (o backend acrescenta uma nota clara), e ele decide chamar
  // `ver_imagem`/`ver_ficheiro`, ou delegar a um agente (ex.: agy para vídeo) via `trabalhar`.
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);
  // Callback lida por ref: assim o `load` não muda de identidade a cada render do pai.
  const workersCbRef = useRef(onWorkersChange);
  useEffect(() => { workersCbRef.current = onWorkersChange; }, [onWorkersChange]);

  const load = useCallback(() => {
    fetch(`${chatBase}?limit=200`)
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
  }, [chatBase]);

  useEffect(() => {
    setLoading(true);
    setConfirmClear(false);
  }, [chatBase]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Auto-scroll ao fim quando chega mensagem nova (ou quando ele começa/deixa de pensar).
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, busy]);

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  const onFilesPicked = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite re-escolher o mesmo ficheiro
    if (!files.length) return;
    setUploading(true);
    try {
      const paths = await uploadPickedFiles(files);
      if (paths.length) setAttachments((a) => [...a, ...paths]);
    } finally { setUploading(false); }
  }, []);

  // Ctrl+V de uma imagem (screenshot) directo no compose — sobe para JOCA_Drops e fica como anexo.
  const onComposePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imgs.length === 0) return; // deixa o paste de texto passar
    e.preventDefault();
    setUploading(true);
    try {
      const paths = await uploadPastedImages(imgs, Date.now());
      if (paths.length) setAttachments((a) => [...a, ...paths]);
    } finally { setUploading(false); }
  }, []);

  const onComposeDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const cap = captureDrop(e.nativeEvent);
    const real = dragRealPaths(cap);
    if (real.length) { setAttachments((a) => [...a, ...real]); return; }
    if (!dropHadFilesWithoutPath(cap)) return;
    setUploading(true);
    try {
      const { paths } = await resolveDrop(cap);
      if (paths.length) setAttachments((a) => [...a, ...paths]);
    } finally { setUploading(false); }
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || sending) return;
    setSending(true);
    setActionError('');
    try {
      const res = await fetch(chatBase, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, attachments: attachments.length ? attachments : undefined }),
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
      setAttachments([]);
      setBusy(true); // ele está a pensar; o `manager_busy` confirma logo a seguir
    } catch {
      setActionError('Erro de rede ao falar com o gestor.');
    } finally {
      setSending(false);
    }
  }, [draft, attachments, sending, chatBase]);

  const clearChat = useCallback(async () => {
    setConfirmClear(false);
    setActionError('');
    try {
      const res = await fetch(chatBase, { method: 'DELETE' });
      if (!res.ok) { setActionError('Não foi possível limpar a conversa.'); return; }
      setMessages([]);
      setTotalCost(0);
      load();
    } catch {
      setActionError('Erro de rede ao limpar a conversa.');
    }
  }, [chatBase, load]);

  return (
    <section className="mgr-chat" aria-label={isGlobal ? 'Joca — gestor global' : `Gestor do projecto ${projectName}`}>
      <header className="mgr-chat-head">
        <div className="mgr-chat-head-main">
          <h2>{isGlobal ? 'Joca' : 'Gestor do projecto'}</h2>
          <p>
            {isGlobal
              ? 'Fala com ele sobre qualquer projecto — pontos de situação, tarefas cross-project, coordenação. Para mexer em ficheiros de um projecto específico, entra nesse projecto.'
              : 'Fala só com ele. Ele trata dos workers, das tarefas e volta a falar quando houver novidades.'}
          </p>
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
            {isGlobal ? (
              <>
                <p>
                  O Joca não escreve código nem mexe em ficheiros: vê os teus projectos todos, abre workers
                  em qualquer um deles, e gere tarefas cross-project. Depois volta aqui a dizer o que ficou feito.
                </p>
                <p className="mgr-empty-hints">
                  Experimenta: <em>“como estão os projectos todos?”</em> ·{' '}
                  <em>“cria uma tarefa no Bigorna para rever preços”</em> · <em>“que tarefas estão paradas?”</em>
                </p>
              </>
            ) : (
              <>
                <p>
                  O gestor conhece o {projectName}, não escreve código e não mexe nos ficheiros: ouve o que queres,
                  abre workers (terminais reais) e cria tarefas para eles. Depois volta aqui a dizer o que ficou feito.
                </p>
                <p className="mgr-empty-hints">
                  Experimenta: <em>“arruma a página inicial e diz-me o que mudaste”</em> ·{' '}
                  <em>“o que falta para lançar isto?”</em> · <em>“cria uma tarefa para eu rever os textos”</em>
                </p>
              </>
            )}
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
                {m.attachments?.length ? (
                  <div className="tk-attach-chips">
                    {m.attachments.map((p) => (
                      <span key={p} className="tk-attach-chip" title={p}>
                        <PaperclipIcon /><span className="tk-attach-name">{basename(p)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
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

      {attachments.length > 0 && (
        <div className="tk-attach-chips mgr-compose-attachments">
          {attachments.map((p) => (
            <button type="button" key={p} className="tk-attach-chip" title={p} aria-label={`Remover anexo ${basename(p)}`} onClick={() => setAttachments((a) => a.filter((x) => x !== p))}>
              <PaperclipIcon /><span className="tk-attach-name">{basename(p)}</span> ✕
            </button>
          ))}
        </div>
      )}

      <div
        className={`tk-note-compose mgr-compose${dragOver ? ' mgr-compose--dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onComposeDrop}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          onPaste={onComposePaste}
          rows={3}
          placeholder="Diz o que queres feito… (Enter envia, Shift+Enter nova linha, Ctrl+V cola imagens)"
          aria-label={isGlobal ? 'Falar com o Joca' : 'Falar com o gestor do projecto'}
        />
        <div className="mgr-compose-actions">
          <button type="button" className="mgr-attach-btn" onClick={openPicker} disabled={uploading} title="Anexar ficheiro, imagem ou vídeo">
            <PaperclipIcon /> {uploading ? 'A carregar…' : 'Anexar'}
          </button>
          <button type="button" className="tk-btn-primary" onClick={send} disabled={sending || (!draft.trim() && attachments.length === 0)}>
            <SendIcon /> {sending ? 'A enviar…' : 'Enviar'}
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
    </section>
  );
}
