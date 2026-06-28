// Rate-limit usage bar + the RateLimits type. Fonte única de verdade: App.tsx faz o poll de
// /rate-limits e passa por prop; DashboardView re-exporta RateLimits para os consumidores.

interface RateWindow {
  used_pct: number | null;
  resets_at?: number | null; // epoch SECONDS
}

export interface RateLimits {
  claude?: {
    model?: string;
    five_hour?: RateWindow;
    seven_day?: RateWindow;
    sonnet_seven_day?: RateWindow;
  };
  codex?: {
    plan?: string | null;
    updated_at?: number | null;
    five_hour?: RateWindow;
    seven_day?: RateWindow;
  };
  agy?: {
    model: string;
    plan: string | null;
    context: { used_pct: number | null; input_tokens: number; output_tokens: number };
  };
}

// Compact countdown to a reset timestamp (epoch seconds): "2h05m", "3d4h", "now".
function formatReset(epochSec?: number | null): string | null {
  if (epochSec == null) return null;
  const diff = epochSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'now';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

export function RateBar({ label, win, fillClass }: { label: string; win?: RateWindow; fillClass: string }) {
  if (!win || win.used_pct == null) return null;
  const reset = formatReset(win.resets_at);
  return (
    <div className="db-rate-bar">
      <span className="db-rate-bar-label">{label}</span>
      <div className="db-rate-bar-track">
        <div className={`db-rate-bar-fill ${fillClass}`} style={{ width: `${Math.min(100, win.used_pct)}%` }} />
      </div>
      <span className="db-rate-bar-pct">{win.used_pct < 1 ? '<1' : Math.round(win.used_pct)}%</span>
      {reset && <span className="db-rate-bar-reset" title="Próximo reset">↺ {reset}</span>}
    </div>
  );
}
