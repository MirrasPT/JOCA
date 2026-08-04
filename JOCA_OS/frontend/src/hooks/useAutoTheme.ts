import { useEffect } from 'react';
import { applyStoredTheme, parseHM, readThemeSettings, writeThemeSettings } from '../lib/theme';
import type { ThemeMode } from '../lib/theme';

/**
 * Mantém o tema certo enquanto a app está aberta.
 *
 * O modo dinâmico só serve para alguma coisa se a troca acontecer sozinha com a app já aberta —
 * daí o tick. Não basta o `setInterval`: um portátil que adormece atravessa a fronteira das horas
 * com os timers congelados, por isso reavalia-se também ao voltar ao separador.
 *
 * Vive no App (sempre montado) e lê o localStorage a cada tick, em vez de receber props: quem
 * muda as definições (SettingsPanel) escreve lá, e não é preciso passar estado por meia app.
 */
export function useAutoTheme() {
  useEffect(() => {
    applyStoredTheme();

    // O servidor é a cópia que viaja entre browsers/máquinas: num browser novo o localStorage está
    // vazio e só isto traz a escolha de volta.
    fetch('/ui-settings')
      .then((r) => r.json())
      .then((s: { themeMode?: string; theme?: string; themeDayStart?: string; themeNightStart?: string }) => {
        const current = readThemeSettings();
        let mode: ThemeMode | null = null;
        if (s.themeMode === 'dark' || s.themeMode === 'light' || s.themeMode === 'auto') mode = s.themeMode;
        else if (s.theme === 'light' || s.theme === 'dark') mode = s.theme; // definições anteriores ao modo dinâmico
        if (!mode) return;
        writeThemeSettings({
          mode,
          dayStart: parseHM(s.themeDayStart) !== null ? (s.themeDayStart as string) : current.dayStart,
          nightStart: parseHM(s.themeNightStart) !== null ? (s.themeNightStart as string) : current.nightStart,
        });
        applyStoredTheme();
      })
      .catch(() => {});

    // 30s: a troca acontece no minuto certo sem custo nenhum (é uma comparação de inteiros).
    const timer = window.setInterval(applyStoredTheme, 30_000);
    const onWake = () => { if (!document.hidden) applyStoredTheme(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);
}

/** Aplica e guarda uma escolha nova (local + servidor). Usado pelo painel de definições. */
export function saveThemeSettings(mode: ThemeMode, dayStart: string, nightStart: string) {
  writeThemeSettings({ mode, dayStart, nightStart });
  const resolved = applyStoredTheme();
  fetch('/ui-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    // `theme` continua a ir com o valor resolvido: é o que o arranque do `index.html` lê como
    // atalho e o que clientes antigos entendem.
    body: JSON.stringify({ themeMode: mode, themeDayStart: dayStart, themeNightStart: nightStart, theme: resolved }),
  }).catch(() => {});
}
