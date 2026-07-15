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
    const data = {
      model: d.model?.display_name || 'Unknown',
      plan: d.plan_tier || null,
      context: {
        used_pct: d.context_window?.used_percentage ?? null,
        window_size: d.context_window?.context_window_size ?? null,
        input_tokens: d.context_window?.total_input_tokens ?? 0,
        output_tokens: d.context_window?.total_output_tokens ?? 0,
      },
      updated_at: Date.now(),
    };

    const outDir = path.join(os.tmpdir(), 'joca-ui');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'agy-rate-limits.json'), JSON.stringify(data));

    const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    const bar = (pct) => {
      if (pct == null) return '';
      const filled = Math.min(10, Math.round(pct / 10));
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    let out = `\x1b[0;36m${data.model}\x1b[0m`;
    out += `  \x1b[0;37min:${fmtK(data.context.input_tokens)} out:${fmtK(data.context.output_tokens)}\x1b[0m`;
    if (data.context.used_pct != null) {
      out += `  \x1b[0;33mctx ${bar(data.context.used_pct)} ${Math.round(data.context.used_pct)}%\x1b[0m`;
    }

    process.stdout.write(out);
  } catch {
    process.stdout.write('agy statusline: parse error');
  }
});
