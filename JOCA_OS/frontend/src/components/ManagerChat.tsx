// ManagerChat — a conversa com o gestor do projecto.
//
// O gestor não escreve código: ouve, decide e manda workers (terminais reais) fazer o trabalho.
// Por isso o chat NÃO é síncrono: o POST devolve 202 com a nossa própria mensagem e a resposta dele
// chega depois por WebSocket — às vezes segundos, às vezes minutos depois, quando um worker acaba.
// Aqui isso traduz-se em: enviar é optimista, e todo o resto vem de um refetch disparado pelo
// `refreshKey` (que o App incrementa a cada `manager_message`/`manager_busy`).
//
// Visualmente é uma conversa, não um log: bolhas alinhadas por autor (as minhas à direita, as dele
// à esquerda), avatar redondo, mensagens seguidas do mesmo autor agrupadas e separadores de dia.
// Deixou de reaproveitar as .tk-note* das tarefas — lá é um registo cronológico de notas, aqui é
// um diálogo a dois, e a mesma folha de estilos não servia os dois sem um deles ficar pior.
//
// A camada de escrita (barra de formatação, colar com formatação, autocomplete de `/`) vive no
// mesmo composer: clip à esquerda, caixa ao meio, enviar à direita, com a barra por cima.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import type { ManagerMessage, ManagerRole, PooledWorker } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { basename } from '../lib/paths';
import { captureDrop, dragRealPaths, dropHadFilesWithoutPath, resolveDrop, uploadPastedImages, uploadPickedFiles } from '../lib/fileDrop';
import { fullDate } from './TaskDetail';
import { useBrand } from '../hooks/useBrand';
import './manager-chat.css';

function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
    </svg>
  );
}

/* ── Colar com formatação ─────────────────────────────────────────────────────
   O que o gestor lê é markdown em texto simples, por isso colar de um site/documento
   não pode ser "colar HTML": tem de ser traduzido. Sem isto, o `text/plain` do clipboard
   chega achatado (negritos, listas, links e títulos desaparecem). Conversão mínima e
   deliberadamente conservadora — o que não sabe traduzir cai para texto. */

const INLINE_WRAP: Record<string, string> = { STRONG: '**', B: '**', EM: '*', I: '*', CODE: '`', DEL: '~~', S: '~~' };
const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'SVG']);

/** Espaço colapsado como o browser faz — o HTML colado vem cheio de indentação do source. */
function inlineText(node: Node): string {
  return (node.textContent || '').replace(/\s+/g, ' ');
}

function nodeToMd(node: Node, indent: string): string {
  if (node.nodeType === Node.TEXT_NODE) return inlineText(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (IGNORED_TAGS.has(tag)) return '';

  const kids = () => Array.from(el.childNodes).map((c) => nodeToMd(c, indent)).join('');

  if (tag === 'BR') return '\n';
  if (tag === 'HR') return '\n\n---\n\n';
  if (tag === 'IMG') {
    const src = el.getAttribute('src') || '';
    return src ? `![${el.getAttribute('alt') || ''}](${src})` : '';
  }
  if (tag === 'A') {
    const href = el.getAttribute('href') || '';
    const label = kids().trim();
    if (!label) return '';
    return href && !href.startsWith('javascript:') ? `[${label}](${href})` : label;
  }
  if (INLINE_WRAP[tag]) {
    const inner = kids().trim();
    return inner ? `${INLINE_WRAP[tag]}${inner}${INLINE_WRAP[tag]}` : '';
  }
  if (/^H[1-6]$/.test(tag)) {
    const inner = kids().trim();
    return inner ? `\n\n${'#'.repeat(Number(tag[1]))} ${inner}\n\n` : '';
  }
  if (tag === 'PRE') {
    const inner = (el.textContent || '').replace(/\n+$/, '');
    return inner ? `\n\n\`\`\`\n${inner}\n\`\`\`\n\n` : '';
  }
  if (tag === 'BLOCKQUOTE') {
    const inner = kids().trim();
    return inner ? `\n\n${inner.split('\n').map((l) => `> ${l}`).join('\n')}\n\n` : '';
  }
  if (tag === 'UL' || tag === 'OL') {
    const ordered = tag === 'OL';
    let n = 0;
    const items = Array.from(el.children)
      .filter((c) => c.tagName.toUpperCase() === 'LI')
      .map((li) => {
        n += 1;
        // Linhas em branco dentro de um item partem a lista em markdown — colapsa-as.
        const inner = nodeToMd(li, `${indent}  `).trim().replace(/\n{2,}/g, '\n');
        if (!inner) return '';
        const marker = ordered ? `${n}. ` : '- ';
        // Continuações de uma linha de lista (sub-listas) alinham sob o marcador.
        const [head, ...rest] = inner.split('\n');
        return [`${indent}${marker}${head}`, ...rest.map((l) => `${indent}  ${l}`)].join('\n');
      })
      .filter(Boolean);
    return items.length ? `\n\n${items.join('\n')}\n\n` : '';
  }
  if (tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'TR') {
    const inner = kids().trim();
    return inner ? `\n\n${inner}\n\n` : '';
  }
  return kids();
}

/** HTML do clipboard → markdown em texto simples. Vazio = não vale a pena, usa o texto puro. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return nodeToMd(doc.body, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── Ícones da barra de formatação (traço fino, como o resto da app) ──────────── */
function FmtIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const BoldIcon = () => <FmtIcon><path d="M6 4h7a4 4 0 0 1 0 8H6z" /><path d="M6 12h8a4 4 0 0 1 0 8H6z" /></FmtIcon>;
const ItalicIcon = () => <FmtIcon><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></FmtIcon>;
const CodeIcon = () => <FmtIcon><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></FmtIcon>;
const ListIcon = () => <FmtIcon><path d="M9 6h12" /><path d="M9 12h12" /><path d="M9 18h12" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></FmtIcon>;
const LinkIcon = () => <FmtIcon><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></FmtIcon>;

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

/** Um slash command tal como o backend o descobre em `.claude/commands/`. */
interface SlashCommand {
  nome: string;
  descricao: string;
  peso: 'leve' | 'pesado';
  origem: 'joca' | 'claude';
}

/** 202 do POST de chat: com `/comando` o backend responde sem turno do gestor (`modo: 'local'`). */
interface SendResponse {
  message?: ManagerMessage;
  comando?: string;
  modo?: 'local' | 'gestor' | 'delegar';
}

// Sem emojis como ícones (regra do projecto): quem fala identifica-se pelo monograma do avatar.
const ROLE_META: Record<ManagerRole, { label: string }> = {
  user: { label: 'Eu' },
  manager: { label: 'Gestor' },
  system: { label: 'Sistema' },
};

/** Monograma do avatar — a inicial de quem fala. */
function monogram(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

const MIN = 60_000;
/** Duas mensagens seguidas do mesmo autor dentro desta janela são o mesmo "bloco de fala". */
const GROUP_WINDOW = 5 * MIN;

function sameDay(a: number, b: number): boolean {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function dayLabel(ts: number): string {
  const now = Date.now();
  if (sameDay(ts, now)) return 'Hoje';
  if (sameDay(ts, now - 24 * 60 * MIN)) return 'Ontem';
  return new Date(ts).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

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
  // Sem `white-space:pre-wrap` (ao contrário do texto cru): o markdown já traz a estrutura em
  // blocos, e o pre-wrap transformava as mudanças de linha do HTML em espaço vertical a mais.
  return <div className="mgr-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ManagerChat({ projectId, projectName, refreshKey, onWorkersChange }: Props) {
  const brand = useBrand();
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Selecção a repor DEPOIS do re-render: mexer no textarea antes de o React escrever o novo
  // `value` perde o cursor (o browser mete-o no fim). Guardada aqui, aplicada no efeito.
  const pendingSelRef = useRef<[number, number] | null>(null);

  // Slash commands: catálogo vindo do backend + estado do autocomplete.
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);

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

  // Caminho vindo de fora (botão "colar caminho" do painel de ficheiros): entra como anexo, sem
  // upload — o ficheiro já está no disco, e o gestor recebe o caminho real.
  useEffect(() => {
    const onAttachPath = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path !== 'string' || !path) return;
      setAttachments((a) => (a.includes(path) ? a : [...a, path]));
    };
    window.addEventListener('joca:attach-path', onAttachPath);
    return () => window.removeEventListener('joca:attach-path', onAttachPath);
  }, []);

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

  // ── Escrita: formatação, colar com formatação, atalhos ──────────────────────

  useEffect(() => {
    const sel = pendingSelRef.current;
    if (!sel) return;
    pendingSelRef.current = null;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(sel[0], sel[1]);
  }, [draft]);

  /** Substitui o intervalo dado e deixa a selecção final marcada para o efeito acima. */
  const replaceRange = useCallback((start: number, end: number, text: string, sel: [number, number]) => {
    setDraft((d) => d.slice(0, start) + text + d.slice(end));
    pendingSelRef.current = sel;
  }, []);

  /** Envolve a selecção com um marcador markdown — ou desfaz, se já estiver envolvida. */
  const wrapSelection = useCallback((mark: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    const selected = draft.slice(start, end);
    const outerStart = start - mark.length;
    const alreadyOutside = outerStart >= 0 && draft.slice(outerStart, start) === mark && draft.slice(end, end + mark.length) === mark;
    if (alreadyOutside) {
      replaceRange(outerStart, end + mark.length, selected, [outerStart, outerStart + selected.length]);
      return;
    }
    if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length > mark.length * 2) {
      const inner = selected.slice(mark.length, -mark.length);
      replaceRange(start, end, inner, [start, start + inner.length]);
      return;
    }
    const body = selected || placeholder;
    replaceRange(start, end, `${mark}${body}${mark}`, [start + mark.length, start + mark.length + body.length]);
  }, [draft, replaceRange]);

  /** Liga/desliga `- ` em todas as linhas tocadas pela selecção. */
  const toggleList = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lineStart = draft.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const nextBreak = draft.indexOf('\n', ta.selectionEnd);
    const lineEnd = nextBreak === -1 ? draft.length : nextBreak;
    const lines = draft.slice(lineStart, lineEnd).split('\n');
    const allListed = lines.every((l) => /^\s*- /.test(l));
    const out = lines.map((l) => (allListed ? l.replace(/^(\s*)- /, '$1') : `- ${l}`)).join('\n');
    replaceRange(lineStart, lineEnd, out, [lineStart, lineStart + out.length]);
  }, [draft, replaceRange]);

  /** `[texto](url)` com o cursor já em cima do `url` — o passo seguinte é sempre colar o link. */
  const insertLink = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    const label = draft.slice(start, end) || 'texto';
    const urlStart = start + label.length + 3;
    replaceRange(start, end, `[${label}](url)`, [urlStart, urlStart + 3]);
  }, [draft, replaceRange]);

  // Ctrl+V: imagem (screenshot) → anexo; HTML de um site/documento → markdown; resto → texto puro.
  const onComposePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imgs.length > 0) {
      e.preventDefault();
      setUploading(true);
      try {
        const paths = await uploadPastedImages(imgs, Date.now());
        if (paths.length) setAttachments((a) => [...a, ...paths]);
      } finally { setUploading(false); }
      return;
    }

    const html = e.clipboardData?.getData('text/html') ?? '';
    if (!html) return; // paste de texto simples: deixa o browser tratar
    const md = htmlToMarkdown(html);
    const plain = e.clipboardData?.getData('text/plain') ?? '';
    // Se a conversão não acrescenta nada ao texto puro, não vale a pena roubar o paste nativo.
    if (!md || md === plain.trim()) return;
    e.preventDefault();
    const ta = e.currentTarget;
    replaceRange(ta.selectionStart, ta.selectionEnd, md, [ta.selectionStart + md.length, ta.selectionStart + md.length]);
  }, [replaceRange]);

  // ── Autocomplete de slash commands ──────────────────────────────────────────

  useEffect(() => {
    fetch('/manager/slash-commands')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { commands?: SlashCommand[] }) => setCommands(Array.isArray(d.commands) ? d.commands : []))
      .catch(() => setCommands([])); // sem catálogo o chat continua a funcionar, só sem sugestões
  }, []);

  // Só enquanto a mensagem É o comando: assim que há espaço (`/save num agente`) o utilizador
  // está a escrever argumentos e a lista deixa de ajudar.
  const slashTerm = useMemo(() => {
    const m = /^\/(\S*)$/.exec(draft);
    return m ? m[1].toLowerCase() : null;
  }, [draft]);

  const slashMatches = useMemo(() => {
    if (slashTerm === null) return [];
    const hits = commands.filter((c) => c.nome.toLowerCase().includes(slashTerm));
    // Prefixo primeiro: quem escreve `/sa` procura `/save`, não `/sync-brain`.
    return hits.sort((a, b) => {
      const pa = a.nome.toLowerCase().startsWith(slashTerm) ? 0 : 1;
      const pb = b.nome.toLowerCase().startsWith(slashTerm) ? 0 : 1;
      return pa - pb || a.nome.localeCompare(b.nome);
    });
  }, [commands, slashTerm]);

  const slashOpen = slashTerm !== null && !slashDismissed && slashMatches.length > 0;

  useEffect(() => { setSlashDismissed(false); }, [slashTerm]);
  useEffect(() => { setSlashIndex(0); }, [slashTerm, slashMatches.length]);

  const pickCommand = useCallback((cmd: SlashCommand) => {
    const text = `/${cmd.nome} `;
    setDraft(text);
    pendingSelRef.current = [text.length, text.length];
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
      const d = (await res.json().catch(() => null)) as SendResponse | null;
      if (d?.message?.id) {
        setMessages((prev) => (prev.some((m) => m.id === d.message!.id) ? prev : [...prev, d.message!]));
      }
      setDraft('');
      setAttachments([]);
      // `modo: 'local'` = comando tratado no backend, sem turno do gestor: nada a esperar,
      // só reler o estado (a conversa pode ter sido limpa ou ter ganho uma resposta directa).
      if (d?.modo === 'local') load();
      else setBusy(true); // ele está a pensar; o `manager_busy` confirma logo a seguir
    } catch {
      setActionError('Erro de rede ao falar com o gestor.');
    } finally {
      setSending(false);
    }
  }, [draft, attachments, sending, chatBase, load]);

  const onComposeKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickCommand(slashMatches[slashIndex] ?? slashMatches[0]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setSlashDismissed(true); return; }
    }

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); wrapSelection('**', 'negrito'); return; }
      if (k === 'i') { e.preventDefault(); wrapSelection('*', 'itálico'); return; }
      if (k === 'k') { e.preventDefault(); insertLink(); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }, [slashOpen, slashMatches, slashIndex, pickCommand, wrapSelection, insertLink, send]);

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
    <section className="mgr-chat" aria-label={isGlobal ? `${brand.managerName} — gestor global` : `Gestor do projecto ${projectName}`}>
      {/* Cabeçalho de conversa, não de página: quem é, em que estado está, custo, limpar. */}
      <header className="mgr-chat-head">
        <div className="mgr-chat-head-main">
          <span className={`mgr-avatar mgr-avatar--manager mgr-head-avatar${busy ? ' is-busy' : ''}`} aria-hidden>
            {isGlobal ? brand.managerName.charAt(0).toUpperCase() : 'G'}
          </span>
          <div className="mgr-chat-head-id">
            <h2>{isGlobal ? brand.managerName : 'Gestor do projecto'}</h2>
            <p className="mgr-chat-head-status">
              {busy ? 'a pensar…' : isGlobal ? 'vê todos os projectos' : projectName}
            </p>
          </div>
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
                  O {brand.managerName} não escreve código nem mexe em ficheiros: vê os teus projectos todos, abre workers
                  em qualquer um deles, e gere tarefas cross-project. Depois volta aqui a dizer o que ficou feito.
                </p>
                <p className="mgr-empty-hints">
                  Experimenta: <em>“como estão os projectos todos?”</em> ·{' '}
                  <em>“cria uma tarefa no my-project para rever preços”</em> · <em>“que tarefas estão paradas?”</em>
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

        <ol className="mgr-thread">
          {messages.map((m, i) => {
            const meta = ROLE_META[m.role] ?? ROLE_META.system;
            const name = m.author || meta.label;
            const prev = i > 0 ? messages[i - 1] : null;
            const startsDay = !prev || !sameDay(prev.ts, m.ts);
            // "Bloco de fala": mesmo autor, seguido, no mesmo dia e dentro da janela — sem repetir
            // avatar nem nome, como em qualquer messenger.
            const grouped = !startsDay && !!prev
              && prev.role === m.role && (prev.author || '') === (m.author || '')
              && m.ts - prev.ts < GROUP_WINDOW;
            const day = startsDay ? <li key={`d-${m.id}`} className="mgr-day"><span>{dayLabel(m.ts)}</span></li> : null;

            // O sistema não é um interlocutor — é uma nota ao centro, fora do diálogo.
            if (m.role === 'system') {
              return (
                <Fragment key={m.id}>
                  {day}
                  <li className="mgr-row mgr-row--system">
                    <p className="mgr-sysline" title={fullDate(m.ts)}>{m.text}</p>
                  </li>
                </Fragment>
              );
            }

            const mine = m.role === 'user';
            return (
              <Fragment key={m.id}>
                {day}
                <li className={`mgr-row mgr-row--${mine ? 'out' : 'in'}${grouped ? ' is-grouped' : ''}`}>
                  <div className="mgr-avatar-slot">
                    {!grouped && (
                      <span className={`mgr-avatar mgr-avatar--${m.role}`} aria-hidden>{monogram(name)}</span>
                    )}
                  </div>
                  <div className="mgr-bubble-wrap">
                    {!grouped && !mine && <span className="mgr-bubble-author">{name}</span>}
                    <div className="mgr-bubble">
                      {m.role === 'manager'
                        ? <ManagerText text={m.text} />
                        : <p className="mgr-bubble-text">{m.text}</p>}
                      {m.attachments?.length ? (
                        <div className="tk-attach-chips mgr-bubble-attach">
                          {m.attachments.map((p) => (
                            <span key={p} className="tk-attach-chip" title={p}>
                              <PaperclipIcon /><span className="tk-attach-name">{basename(p)}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {m.actions?.length ? (
                        <div className="mgr-note-actions">
                          {m.actions.map((a, k) => <span key={`${m.id}-${k}`}>· {a}</span>)}
                        </div>
                      ) : null}
                      <div className="mgr-bubble-meta">
                        <time dateTime={new Date(m.ts).toISOString()} title={fullDate(m.ts)}>{clockTime(m.ts)}</time>
                        {typeof m.costUsd === 'number' && m.costUsd > 0 && (
                          <span className="mgr-note-cost" title="Custo deste turno">${m.costUsd.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              </Fragment>
            );
          })}

          {busy && (
            <li className="mgr-row mgr-row--in mgr-row--typing" role="status">
              <div className="mgr-avatar-slot">
                <span className="mgr-avatar mgr-avatar--manager" aria-hidden>{isGlobal ? 'J' : 'G'}</span>
              </div>
              <div className="mgr-bubble-wrap">
                <div className="mgr-bubble mgr-bubble--typing">
                  <span className="mgr-thinking-dots" aria-hidden><i /><i /><i /></span>
                  <span className="mgr-typing-label">a pensar…</span>
                </div>
              </div>
            </li>
          )}
        </ol>

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
        {slashOpen && (
          <div className="mgr-slash">
            <ul id="mgr-slash-list" role="listbox" aria-label="Comandos disponíveis">
              {slashMatches.map((c, i) => (
                <li
                  key={c.nome}
                  id={`mgr-slash-opt-${c.nome}`}
                  role="option"
                  aria-selected={i === slashIndex}
                  className="mgr-slash-opt"
                  onMouseEnter={() => setSlashIndex(i)}
                  // `onMouseDown` e não `onClick`: o click tirava o foco ao textarea antes de escolher.
                  onMouseDown={(e) => { e.preventDefault(); pickCommand(c); }}
                >
                  <span className="mgr-slash-name">/{c.nome}</span>
                  <span className="mgr-slash-desc">{c.descricao}</span>
                  <span className={`mgr-slash-peso${c.peso === 'pesado' ? ' mgr-slash-peso--pesado' : ''}`}>
                    {c.peso === 'pesado' ? 'vai para um agente' : 'o gestor faz'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mgr-slash-help">↑↓ escolher · Enter usar · Esc fechar</p>
          </div>
        )}

        {/* `group` e não `toolbar`: o padrão toolbar obriga a navegação por setas entre os botões,
            e aqui as setas pertencem ao autocomplete — cada botão fica no Tab, como o resto do chat. */}
        <div className="mgr-fmt-bar" role="group" aria-label="Formatação do texto">
          <button type="button" className="mgr-fmt-btn" onClick={() => wrapSelection('**', 'negrito')} title="Negrito (Ctrl+B)" aria-label="Negrito">
            <BoldIcon />
          </button>
          <button type="button" className="mgr-fmt-btn" onClick={() => wrapSelection('*', 'itálico')} title="Itálico (Ctrl+I)" aria-label="Itálico">
            <ItalicIcon />
          </button>
          <button type="button" className="mgr-fmt-btn" onClick={() => wrapSelection('`', 'código')} title="Código" aria-label="Código">
            <CodeIcon />
          </button>
          <span className="mgr-fmt-sep" aria-hidden />
          <button type="button" className="mgr-fmt-btn" onClick={toggleList} title="Lista" aria-label="Lista">
            <ListIcon />
          </button>
          <button type="button" className="mgr-fmt-btn" onClick={insertLink} title="Link (Ctrl+K)" aria-label="Link">
            <LinkIcon />
          </button>
          <span className="mgr-fmt-hint">Markdown · escreve <code>/</code> para comandos</span>
        </div>

        {/* Clip à esquerda, caixa ao meio, enviar à direita: o anexo fica do lado de onde se
            escreve e a acção onde a leitura acaba. Ambos reduzidos a ícone — é o que uma barra de
            conversa precisa; a barra de formatação por cima é que carrega as palavras. */}
        <div className="mgr-compose-row">
          <button
            type="button"
            className="mgr-attach-btn"
            onClick={openPicker}
            disabled={uploading}
            title="Anexar ficheiro, imagem ou vídeo (ou largar aqui um ficheiro)"
            aria-label={uploading ? 'A carregar anexo' : 'Anexar ficheiro'}
          >
            {uploading ? <span className="mgr-attach-spin" aria-hidden /> : <PaperclipIcon />}
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposeKeyDown}
            onPaste={onComposePaste}
            rows={2}
            placeholder="Diz o que queres feito…"
            title="Enter envia · Shift+Enter nova linha · / para comandos · Ctrl+V cola imagens"
            aria-label={isGlobal ? `Falar com o ${brand.managerName}` : 'Falar com o gestor do projecto'}
            role="combobox"
            aria-expanded={slashOpen}
            aria-controls="mgr-slash-list"
            aria-autocomplete="list"
            aria-activedescendant={slashOpen ? `mgr-slash-opt-${slashMatches[slashIndex]?.nome ?? ''}` : undefined}
          />
          <button
            type="button"
            className="mgr-send-btn"
            onClick={send}
            disabled={sending || (!draft.trim() && attachments.length === 0)}
            title="Enviar (Enter)"
            aria-label={sending ? 'A enviar' : 'Enviar'}
          >
            <SendIcon />
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
    </section>
  );
}
