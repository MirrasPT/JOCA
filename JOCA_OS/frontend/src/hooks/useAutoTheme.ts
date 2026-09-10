import { useEffect } from 'react';
import { applyStoredTheme, parseHM, readThemeSettings, writeThemeSettings } from '../lib/theme';
import type { ThemeMode } from '../lib/theme';

/**
 * Keeps the right theme while the app is open.
 *
 * The dynamic mode is only worth something if the switch happens on its own with the app already
 * open — hence the tick. `setInterval` is not enough: a laptop that sleeps crosses the hour
 * boundary with the timers frozen, so it is re-evaluated on coming back to the tab too.
 *
 * It lives in the App (always mounted) and reads localStorage on every tick instead of receiving
 * props: whoever changes the settings (SettingsPanel) writes there, and no state travels half the app.
 */
export function useAutoTheme() {
  useEffect(() => {
    applyStoredTheme();

    // The server is the copy that travels between browsers/machines: in a new browser localStorage
    // is empty and only this brings the choice back.
    fetch('/ui-settings')
      .then((r) => r.json())
      .then((s: { themeMode?: string; theme?: string; themeDayStart?: string; themeNightStart?: string }) => {
        const current = readThemeSettings();
        let mode: ThemeMode | null = null;
        if (s.themeMode === 'dark' || s.themeMode === 'light' || s.themeMode === 'auto') mode = s.themeMode;
        else if (s.theme === 'light' || s.theme === 'dark') mode = s.theme; // settings from before the dynamic mode
        if (!mode) return;
        writeThemeSettings({
          mode,
          dayStart: parseHM(s.themeDayStart) !== null ? (s.themeDayStart as string) : current.dayStart,
          nightStart: parseHM(s.themeNightStart) !== null ? (s.themeNightStart as string) : current.nightStart,
        });
        applyStoredTheme();
      })
      .catch(() => {});

    // 30s: the switch happens on the right minute at no cost at all (it is an integer comparison).
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

/** Applies and saves a new choice (local + server). Used by the settings panel. */
export function saveThemeSettings(mode: ThemeMode, dayStart: string, nightStart: string) {
  writeThemeSettings({ mode, dayStart, nightStart });
  const resolved = applyStoredTheme();
  fetch('/ui-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    // `theme` still goes with the resolved value: it is what `index.html`'s startup reads as a
    // shortcut and what old clients understand.
    body: JSON.stringify({ themeMode: mode, themeDayStart: dayStart, themeNightStart: nightStart, theme: resolved }),
  }).catch(() => {});
}
