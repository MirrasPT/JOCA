#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(raw);
    const limits = {
      model: d.model?.display_name || 'Unknown',
      context: {
        used_pct: d.context_window?.used_percentage ?? null,
        remaining_pct: d.context_window?.remaining_percentage ?? null,
        input_tokens: d.context_window?.total_input_tokens ?? 0,
        output_tokens: d.context_window?.total_output_tokens ?? 0,
      },
      five_hour: {
        used_pct: d.rate_limits?.five_hour?.used_percentage ?? null,
        resets_at: d.rate_limits?.five_hour?.resets_at ?? null,
      },
      seven_day: {
        used_pct: d.rate_limits?.seven_day?.used_percentage ?? null,
        resets_at: d.rate_limits?.seven_day?.resets_at ?? null,
      },
      updated_at: Date.now(),
    };

    const outDir = path.join(os.tmpdir(), 'joca-ui');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'rate-limits.json'), JSON.stringify(limits));

    const bar = (pct) => {
      if (pct == null) return '';
      const filled = Math.min(10, Math.round(pct / 10));
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

    const timeLeft = (epoch) => {
      if (!epoch) return '?';
      const diff = epoch - Math.floor(Date.now() / 1000);
      if (diff <= 0) return 'now';
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
    };

    let out = `\x1b[0;36m${limits.model}\x1b[0m`;
    out += `  \x1b[0;37min:${fmtK(limits.context.input_tokens)} out:${fmtK(limits.context.output_tokens)}\x1b[0m`;

    if (limits.context.used_pct != null) {
      out += `  \x1b[0;33mctx ${bar(limits.context.used_pct)} ${Math.round(limits.context.used_pct)}%\x1b[0m`;
    }
    if (limits.five_hour.used_pct != null) {
      out += `  \x1b[0;35m5h ${bar(limits.five_hour.used_pct)} ${Math.round(limits.five_hour.used_pct)}% ↺${timeLeft(limits.five_hour.resets_at)}\x1b[0m`;
    }
    if (limits.seven_day.used_pct != null) {
      out += `  \x1b[0;34m7d ${bar(limits.seven_day.used_pct)} ${Math.round(limits.seven_day.used_pct)}% ⏱ ${timeLeft(limits.seven_day.resets_at)}\x1b[0m`;
    }

    process.stdout.write(out);
  } catch {
    process.stdout.write('statusline: parse error');
  }
});
