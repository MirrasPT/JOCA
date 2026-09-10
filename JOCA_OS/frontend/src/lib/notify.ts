// Notification helpers: a short sound cue + a real OS (Windows/macOS) desktop notification, so the
// user is alerted even when the JOCA window isn't focused. The in-app toast is separate (visual, only
// when the tab is visible); these fire alongside it.
//
// A notification that warns and leads nowhere forces the user to find the place it was talking about
// on his own. That is why every route (toast, inbox, OS notification) shares the same destination
// contract — the notification's own `meta` — resolved by a single handler registered by the App,
// which is what knows how to navigate.
import type { AppNotification } from '../types';

export type NotificationTarget = NonNullable<AppNotification['meta']>;

let audioCtx: AudioContext | null = null;

// Registered once by the App (which has the router and the view state). A module and not a React
// context because what fires this — the WebSocket message router — is not a component.
let openTargetHandler: ((target: NotificationTarget) => void) | null = null;

export function setNotificationTargetHandler(fn: ((target: NotificationTarget) => void) | null): void {
  openTargetHandler = fn;
}

/** Navigates to the origin of a notification. A silent no-op if nobody has registered the handler yet. */
export function openNotificationTarget(target: NotificationTarget | undefined | null): void {
  if (!target || !openTargetHandler) return;
  try { openTargetHandler(target); } catch { /* navigation failed — not worth blowing up the warning */ }
}

/** Is there anywhere to go? It lets the toast decide whether to show "Open" or not. */
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
 * Icon of the active brand theme, so the OS notification does not come out with the browser's generic icon.
 *
 * Read from the page's own `<link rel="icon">` instead of importing `brand.ts`: it is `index.html`
 * that swaps it (before the bundle, so the tab does not flash the wrong theme), so the DOM is the
 * source that is always right — without duplicating the logic of which theme is active.
 */
function iconeDaMarca(): string | undefined {
  try {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    return link?.href || undefined;
  } catch { return undefined; }
}

/**
 * Subject of the notification, so the OS REPLACES the previous one on the same subject instead of stacking.
 *
 * This was the origin of the repeated notifications: without `tag`, each warning is a new notification, and a
 * a source that speaks five times leaves five cards in the tray saying nearly the same thing. `groupKey` is
 * the same notion the backend already uses to merge entries in the inbox (`notifications/store.ts`) —
 * it is reused here, so the two halves have a single idea of "this is the same subject".
 */
function assunto(title: string, target?: NotificationTarget): string {
  if (target?.groupKey) return target.groupKey;
  if (target?.sessionId) return `sessao:${target.sessionId}`;
  if (target?.projectId) return `projecto:${target.projectId}`;
  return `titulo:${title}`;
}

// Fire an OS notification if the user granted permission (no-op otherwise).
//
// With `target`, the click brings the window to the front AND navigates. The order matters: `window.focus()`
// before navigating, otherwise the view change happens in a window that stays behind everything and the
// user only finds it later, by then with no context.
export function osNotify(title: string, body: string, target?: NotificationTarget): void {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // `renotify` is left at its default (false): replacing the previous card does not sound again nor
    // jump to the front. The sound was already given by `notify()`, when that is the case.
    const n = new Notification(title, { body, icon: iconeDaMarca(), tag: assunto(title, target) });
    if (!hasNotificationTarget(target)) return;
    n.onclick = () => {
      try { window.focus(); } catch { /* the browser may refuse the focus */ }
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
