// Tema: claro, escuro, ou dinâmico (troca sozinho à hora que o utilizador definir).
//
// O modo e os horários vivem em localStorage (fonte de verdade do cliente) e são espelhados no
// servidor via PATCH /ui-settings, para a escolha sobreviver a outro browser/máquina. O
// localStorage é que manda no arranque porque o `index.html` tem de decidir a cor ANTES do
// primeiro paint — esperar por um fetch daria um flash do tema errado.

export type ThemeMode = 'dark' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'light';

export const DEFAULT_DAY_START = '08:00';
export const DEFAULT_NIGHT_START = '20:00';

export const LS_MODE = 'joca-theme-mode';
export const LS_DAY = 'joca-theme-day';
export const LS_NIGHT = 'joca-theme-night';
/** Legado + atalho de arranque: guarda o tema JÁ resolvido. */
export const LS_RESOLVED = 'joca-theme';

/** "HH:MM" → minutos desde a meia-noite. `null` se não for uma hora válida. */
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
 * Qual o tema agora. Em `auto`, o dia é a janela [dayStart, nightStart).
 * A janela pode atravessar a meia-noite (ex.: dia 22:00 → noite 06:00) — daí os dois ramos.
 * Horas iguais = janela vazia = escuro sempre (não há como adivinhar a intenção).
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

/** Escreve o tema no `<html>`. Escuro é o default do CSS, por isso remove-se o atributo. */
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
    // Sem modo guardado, herda a escolha antiga (só light/dark) para não reverter o tema de quem
    // já usava o JOCA antes do modo dinâmico existir.
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

/** Lê o que está guardado e aplica. Devolve o tema aplicado. */
export function applyStoredTheme(): ResolvedTheme {
  const s = readThemeSettings();
  const resolved = resolveTheme(s.mode, s.dayStart, s.nightStart);
  applyTheme(resolved);
  return resolved;
}
