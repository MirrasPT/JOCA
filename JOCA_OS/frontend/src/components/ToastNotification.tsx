// Toasts — o aviso efémero no canto do ecrã.
//
// Duas diferenças em relação à versão que só anunciava sessões terminadas:
//   • o toast LEVA A ALGUM LADO. Carrega o mesmo `meta` que a notificação persistente e a do SO,
//     e o clique resolve-o pelo mesmo contrato (sessão → terminal · projecto → chat do gestor ·
//     tarefa → detalhe · automação → Automações);
//   • um toast de `priority: 'action'` NÃO se auto-fecha. É um bloqueio à espera de resposta;
//     evaporar-se ao fim de 5 segundos é perder o pedido, que é precisamente o oposto do que se
//     pede a uma coisa marcada como "precisa de ti".
import { useEffect } from 'react';
import type { NotificationPriority } from '../types';
import { hasNotificationTarget, type NotificationTarget } from '../lib/notify';
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

  useEffect(() => {
    // Um bloqueio fica até alguém lhe tocar.
    if (acao) return;
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss, acao]);

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
    // `role="alert"` só para o informativo: um pedido de resposta é `alertdialog`-like, mas o
    // conteúdo continua a viver num botão focável — chega-se lá por Tab, sem roubar o foco.
    <div className={`toast ${acao ? 'toast--action' : 'toast--done'}`} role={acao ? 'status' : 'alert'}>
      <div className="toast-icon" aria-hidden>
        {acao ? <AlertIcon /> : <CheckIcon />}
      </div>

      {/* O corpo inteiro é o alvo do clique — não obriga a acertar num botão de 60px. É um
          <button> irmão dos outros dois (nunca aninhado: botão dentro de botão é HTML inválido). */}
      <button
        type="button"
        className="toast-open"
        onClick={abrir}
        disabled={!podeAbrir}
      >
        <span className="toast-title">{item.title ?? 'Sessão terminada'}</span>
        <span className="toast-session">{item.sessionName}</span>
      </button>

      {acao && <span className="toast-flag">precisa de ti</span>}

      <button
        className="toast-dismiss"
        onClick={() => onDismiss(item.id)}
        aria-label="Dispensar aviso"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss, onSelect, onOpenTarget }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Avisos">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} onSelect={onSelect} onOpenTarget={onOpenTarget} />
      ))}
    </div>
  );
}
