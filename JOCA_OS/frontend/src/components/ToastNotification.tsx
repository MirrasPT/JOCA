// Toasts — o aviso efémero no canto do ecrã.
//
// Duas diferenças em relação à versão que só anunciava sessões terminadas:
//   • o toast LEVA A ALGUM LADO. Carrega o mesmo `meta` que a notificação persistente e a do SO,
//     e o clique resolve-o pelo mesmo contrato (sessão → terminal · projecto → workspace);
//   • um toast de `priority: 'action'` NÃO se auto-fecha. É um bloqueio à espera de resposta;
//     evaporar-se ao fim de 5 segundos é perder o pedido, que é precisamente o oposto do que se
//     pede a uma coisa marcada como "precisa de ti".
import { useEffect, useRef, useState } from 'react';
import type { NotificationPriority } from '../types';
import { hasNotificationTarget, type NotificationTarget } from '../lib/notify';
import { waitedFor } from './WaitingQueue';
import './ToastNotification.css';

export interface ToastItem {
  id: string;
  sessionName: string;
  sessionId: string;
  timestamp: number;
  /** Cabeçalho do toast. Por omissão "Sessão terminada" — a origem histórica destes avisos. */
  title?: string;
  /** 'action' = alguém está bloqueado à tua espera; nunca desaparece sozinho. */
  priority?: NotificationPriority;
  /** Destino do clique. Sem isto o toast cai no comportamento antigo: abrir `sessionId`. */
  target?: NotificationTarget;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onSelect: (sessionId: string) => void;
  /** Navegação partilhada com a inbox e com a notificação do SO. Sem ela, só `onSelect`. */
  onOpenTarget?: (target: NotificationTarget) => void;
}

const AUTO_DISMISS_MS = 5000;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Ponto de exclamação em traço fino — o par visual do visto, para o toast que pede resposta.
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Toast({ item, onDismiss, onSelect, onOpenTarget }: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  onSelect: (sessionId: string) => void;
  onOpenTarget?: (target: NotificationTarget) => void;
}) {
  const acao = item.priority === 'action';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Um bloqueio fica até alguém lhe tocar.
    if (acao) return;
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss, acao]);

  // Só o toast que fica precisa de relógio: a idade dele diz há quanto tempo alguém espera.
  useEffect(() => {
    if (!acao) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [acao]);

  // Destino explícito quando existe; senão, o comportamento de sempre (abrir a sessão do toast).
  const podeAbrir = Boolean(
    (item.target && hasNotificationTarget(item.target) && onOpenTarget) || item.sessionId,
  );
  const abrir = () => {
    if (item.target && hasNotificationTarget(item.target) && onOpenTarget) onOpenTarget(item.target);
    else if (item.sessionId) onSelect(item.sessionId);
    onDismiss(item.id);
  };

  return (
    // O tipo lê-se por duas vias além da cor: a forma do ícone (visto / exclamação) e o título
    // («… precisa de ti» / «Sessão terminada»). O anúncio ao leitor de ecrã é da região (polite).
    <div className={`toast ${acao ? 'toast--action' : 'toast--done'}`}>
      <div className="toast-icon" aria-hidden>
        {acao ? <AlertIcon /> : <CheckIcon />}
      </div>

      {/* O corpo inteiro é o alvo do clique — não obriga a acertar num botão pequeno. É um
          <button> irmão do fechar (nunca aninhado: botão dentro de botão é HTML inválido). */}
      <button
        type="button"
        className="toast-open"
        onClick={abrir}
        disabled={!podeAbrir}
      >
        <span className="toast-title">{item.title ?? 'Sessão terminada'}</span>
        <span className="toast-session">{item.sessionName}</span>
        <span className="toast-meta">
          <time dateTime={new Date(item.timestamp).toISOString()}>{waitedFor(item.timestamp, now)}</time>
        </span>
      </button>

      <button
        type="button"
        className="toast-dismiss"
        onClick={() => onDismiss(item.id)}
        aria-label="Dispensar aviso"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** Quantos avisos ficam à vista antes do «+N»: 3 no ecrã largo, 1 no estreito (ver o CSS). */
const VISIVEIS_LARGO = 3;
const VISIVEIS_ESTREITO = 1;

export default function ToastNotification({ toasts, onDismiss, onSelect, onOpenTarget }: Props) {
  // Recolhido por omissão: só os mais recentes à vista, o resto atrás do «+N avisos». É estado da
  // vista, não do aviso — nenhum aviso sai da lista por estar recolhido, e o mais novo (o que o
  // leitor de ecrã anuncia) está sempre à vista.
  const [aberto, setAberto] = useState(false);
  const escondidosLargo = Math.max(0, toasts.length - VISIVEIS_LARGO);
  const escondidosEstreito = Math.max(0, toasts.length - VISIVEIS_ESTREITO);

  // A pilha esvaziou: a próxima volta a começar recolhida. Ajuste durante o render (o padrão do
  // React para estado que depende de props) — sem efeito nem render a mais.
  const [contagem, setContagem] = useState(toasts.length);
  if (contagem !== toasts.length) {
    setContagem(toasts.length);
    if (toasts.length <= VISIVEIS_ESTREITO) setAberto(false);
  }

  // Reserva de espaço: a pilha recolhida é fixa por cima da página, e no telemóvel tapava a última
  // linha de cada lista mesmo com o scroll no fim. Publica-se a altura que ela ocupa (do topo dela ao
  // fundo do ecrã) em --toast-reserve; as áreas de scroll juntam-na ao padding de baixo (só < 600px,
  // no CSS). Aberta, a reserva não cresce — abrir foi escolha tua e fecha-se por fora ou Escape.
  const ref = useRef<HTMLDivElement>(null);
  const temAvisos = toasts.length > 0;
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || !temAvisos) { root.style.removeProperty('--toast-reserve'); return; }
    if (aberto) return;
    const medir = () => {
      const top = el.getBoundingClientRect().top;
      root.style.setProperty('--toast-reserve', `${Math.max(0, Math.ceil(window.innerHeight - top))}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [temAvisos, aberto]);
  useEffect(() => () => { document.documentElement.style.removeProperty('--toast-reserve'); }, []);

  // Aberta, fecha com um toque fora dela ou com Escape — mas só o Escape que não tem outro dono:
  // com o foco na pilha ou em lado nenhum (<body>). Num terminal, o Escape é do agente.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.target === document.body || ref.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const classes = [
    'toast-container',
    aberto ? 'is-open' : '',
    escondidosLargo > 0 ? 'has-more-wide' : '',
    escondidosEstreito > 0 ? 'has-more-narrow' : '',
  ].filter(Boolean).join(' ');

  // O «+N» fica FORA da região viva: a contagem muda a cada aviso e seria anunciada de novo.
  // A região (só os avisos) existe sempre, vazia ou não: um aria-live só anuncia o que entra DEPOIS
  // de ele estar no DOM — montá-lo junto com o 1.º aviso calava o leitor de ecrã nesse.
  return (
    <div ref={ref} className={classes}>
      {escondidosEstreito > 0 && (
        <button
          type="button"
          className="toast-more"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? 'Recolher avisos' : (
            <>
              <span className="toast-more-wide">+{escondidosLargo} {escondidosLargo === 1 ? 'aviso' : 'avisos'}</span>
              <span className="toast-more-narrow">+{escondidosEstreito} {escondidosEstreito === 1 ? 'aviso' : 'avisos'}</span>
            </>
          )}
        </button>
      )}
      {/* A pilha rola dentro de si quando aberta; o «+N» fica fora dela, sempre à vista. */}
      <div className="toast-stack" role="region" aria-label="Avisos" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={onDismiss} onSelect={onSelect} onOpenTarget={onOpenTarget} />
        ))}
      </div>
    </div>
  );
}
