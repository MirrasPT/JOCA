// Notification helpers: a short sound cue + a real OS (Windows/macOS) desktop notification, so the
// user is alerted even when the JOCA window isn't focused. The in-app toast is separate (visual, only
// when the tab is visible); these fire alongside it.
//
// Uma notificação que avisa e não leva a lado nenhum obriga o utilizador a procurar sozinho o sítio
// de que ela falava. Por isso todas as vias (toast, inbox, notificação do SO) partilham o mesmo
// contrato de destino — o `meta` da própria notificação — resolvido por um único handler registado
// pelo App, que é quem sabe navegar.
import type { AppNotification } from '../types';

export type NotificationTarget = NonNullable<AppNotification['meta']>;

let audioCtx: AudioContext | null = null;

// Registado uma vez pelo App (quem tem o router e o estado de vistas). Módulo e não contexto React
// porque quem dispara isto — o router de mensagens do WebSocket — não é um componente.
let openTargetHandler: ((target: NotificationTarget) => void) | null = null;

export function setNotificationTargetHandler(fn: ((target: NotificationTarget) => void) | null): void {
  openTargetHandler = fn;
}

/** Navega para a origem de uma notificação. No-op silencioso se ainda ninguém registou o handler. */
export function openNotificationTarget(target: NotificationTarget | undefined | null): void {
  if (!target || !openTargetHandler) return;
  try { openTargetHandler(target); } catch { /* navegação falhou — não vale rebentar o aviso */ }
}

/** Há para onde ir? Serve para o toast decidir se mostra "Abrir" ou não. */
export function hasNotificationTarget(target: NotificationTarget | undefined | null): boolean {
  if (!target) return false;
  return Boolean(target.sessionId || target.projectId);
}

// Ask once for OS-notification permission. Call on first mount; browsers only grant from a page that
// has been interacted with, which is the case by the time anything worth notifying happens.
export function ensureNotificationPermission(): void {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch { /* unsupported */ }
}

// Two-tone blip via WebAudio (no asset file, no autoplay-blocked <audio>). The AudioContext is created
// lazily and resumed if the browser suspended it until a user gesture.
export function playNotifySound(): void {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const blip = (freq: number, start: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(0.16, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.22);
      o.start(now + start);
      o.stop(now + start + 0.24);
    };
    blip(784, 0);      // G5
    blip(1047, 0.12);  // C6
  } catch { /* audio unavailable */ }
}

/**
 * Ícone do tema de marca activo, para a notificação do SO não sair com o ícone genérico do browser.
 *
 * Lido do `<link rel="icon">` da própria página em vez de importar o `brand.ts`: é o `index.html`
 * que o troca (antes do bundle, para o separador não piscar o tema errado), portanto o DOM é a
 * fonte que está sempre certa — sem duplicar a lógica de qual tema está activo.
 */
function iconeDaMarca(): string | undefined {
  try {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    return link?.href || undefined;
  } catch { return undefined; }
}

/**
 * Assunto da notificação, para o SO SUBSTITUIR a anterior do mesmo assunto em vez de empilhar.
 *
 * Era esta a origem das notificações repetidas: sem `tag`, cada aviso é uma notificação nova, e um
 * uma fonte que fala cinco vezes deixa cinco cartões na bandeja a dizer quase o mesmo. O `groupKey` é
 * a mesma noção que o backend já usa para fundir entradas na inbox (`notifications/store.ts`) —
 * aqui reaproveita-se, para as duas metades terem uma só ideia de "isto é o mesmo assunto".
 */
function assunto(title: string, target?: NotificationTarget): string {
  if (target?.groupKey) return target.groupKey;
  if (target?.sessionId) return `sessao:${target.sessionId}`;
  if (target?.projectId) return `projecto:${target.projectId}`;
  return `titulo:${title}`;
}

// Fire an OS notification if the user granted permission (no-op otherwise).
//
// Com `target`, o clique traz a janela para a frente E navega. A ordem importa: `window.focus()`
// antes de navegar, senão a mudança de vista acontece numa janela que continua atrás de tudo e o
// utilizador só a encontra mais tarde, já sem contexto.
export function osNotify(title: string, body: string, target?: NotificationTarget): void {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // `renotify` fica por omissão (false): substituir o cartão anterior não volta a tocar nem a
    // saltar para a frente. O som já foi dado pelo `notify()`, quando é caso disso.
    const n = new Notification(title, { body, icon: iconeDaMarca(), tag: assunto(title, target) });
    if (!hasNotificationTarget(target)) return;
    n.onclick = () => {
      try { window.focus(); } catch { /* o browser pode recusar o foco */ }
      openNotificationTarget(target);
      n.close();
    };
  } catch { /* unsupported */ }
}

// Convenience: sound + OS notification together (the two "external" cues), used for done events.
export function notify(title: string, body: string, target?: NotificationTarget): void {
  playNotifySound();
  osNotify(title, body, target);
}
