// Notification helpers: a short sound cue + a real OS (Windows/macOS) desktop notification, so the
// user is alerted even when the JOCA window isn't focused. The in-app toast is separate (visual, only
// when the tab is visible); these fire alongside it.

let audioCtx: AudioContext | null = null;

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

// Fire an OS notification if the user granted permission (no-op otherwise).
export function osNotify(title: string, body: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch { /* unsupported */ }
}

// Convenience: sound + OS notification together (the two "external" cues), used for done events.
export function notify(title: string, body: string): void {
  playNotifySound();
  osNotify(title, body);
}
