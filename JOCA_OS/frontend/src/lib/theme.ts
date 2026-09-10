// Theme: light, dark, or dynamic (switches by itself at the time the user sets).
//
// The mode and the schedules live in localStorage (the client's source of truth) and are mirrored on
// the server via PATCH /ui-settings, so the choice survives another browser/machine. localStorage is
// what rules at startup because `index.html` has to decide the color BEFORE the first paint —
// waiting for a fetch would give a flash of the wrong theme.

export type ThemeMode = 'dark' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'light';

export const DEFAULT_DAY_START = '08:00';
export const DEFAULT_NIGHT_START = '20:00';

export const LS_MODE = 'joca-theme-mode';
export const LS_DAY = 'joca-theme-day';
export const LS_NIGHT = 'joca-theme-night';
/** Legacy + startup shortcut: stores the ALREADY resolved theme. */
export const LS_RESOLVED = 'joca-theme';

/** "HH:MM" → minutes since midnight. `null` if it is not a valid time. */
export function parseHM(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Which theme now. In `auto`, the day is the window [dayStart, nightStart).
 * The window can cross midnight (e.g. day 22:00 → night 06:00) — hence the two branches.
 * Equal times = empty window = always dark (there is no way to guess the intent).
 */
export function resolveTheme(
  mode: ThemeMode,
  dayStart: string,
  nightStart: string,
  now: Date = new Date(),
): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  const day = parseHM(dayStart);
  const night = parseHM(nightStart);
  if (day === null || night === null || day === night) return 'dark';
  const t = now.getHours() * 60 + now.getMinutes();
  const isDay = day < night ? t >= day && t < night : t >= day || t < night;
  return isDay ? 'light' : 'dark';
}

/** Writes the theme on `<html>`. Dark is the CSS default, which is why the attribute is removed. */
export function applyTheme(theme: ResolvedTheme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(LS_RESOLVED, theme); } catch { /* ignore */ }
}

export interface ThemeSettings {
  mode: ThemeMode;
  dayStart: string;
  nightStart: string;
}

export function readThemeSettings(): ThemeSettings {
  let mode: ThemeMode = 'dark';
  let dayStart = DEFAULT_DAY_START;
  let nightStart = DEFAULT_NIGHT_START;
  try {
    const m = localStorage.getItem(LS_MODE);
    if (m === 'dark' || m === 'light' || m === 'auto') mode = m;
    // With no saved mode, inherit the old choice (light/dark only) so as not to revert the theme of
    // anyone who was already using JOCA before the dynamic mode existed.
    else if (localStorage.getItem(LS_RESOLVED) === 'light') mode = 'light';
    if (parseHM(localStorage.getItem(LS_DAY)) !== null) dayStart = localStorage.getItem(LS_DAY) as string;
    if (parseHM(localStorage.getItem(LS_NIGHT)) !== null) nightStart = localStorage.getItem(LS_NIGHT) as string;
  } catch { /* ignore */ }
  return { mode, dayStart, nightStart };
}

export function writeThemeSettings(s: ThemeSettings) {
  try {
    localStorage.setItem(LS_MODE, s.mode);
    localStorage.setItem(LS_DAY, s.dayStart);
    localStorage.setItem(LS_NIGHT, s.nightStart);
  } catch { /* ignore */ }
}

/** Reads what is stored and applies it. Returns the applied theme. */
export function applyStoredTheme(): ResolvedTheme {
  const s = readThemeSettings();
  const resolved = resolveTheme(s.mode, s.dayStart, s.nightStart);
  applyTheme(resolved);
  return resolved;
}
