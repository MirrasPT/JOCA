#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CACHE_DIR = path.join(os.tmpdir(), 'joca-ui');
const CACHE_FILE = path.join(CACHE_DIR, 'rate-limits.json');
const OAUTH_CACHE = path.join(CACHE_DIR, 'oauth-usage.json');
const OAUTH_TTL_MS = 120_000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchOAuthUsage() {
  try {
    const stat = fs.existsSync(OAUTH_CACHE) && fs.statSync(OAUTH_CACHE);
    if (stat && Date.now() - stat.mtimeMs < OAUTH_TTL_MS) {
      return JSON.parse(fs.readFileSync(OAUTH_CACHE, 'utf8'));
    }
  } catch {}

  try {
    const creds = JSON.parse(
      execSync('security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null', {
        encoding: 'utf8', timeout: 3000,
      })
    );
    const token = creds?.claudeAiOauth?.accessToken;
    if (!token) return null;

    const raw = execSync(
      `curl -s --max-time 3 -H "Authorization: Bearer ${token}" "https://api.anthropic.com/api/oauth/usage"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const data = JSON.parse(raw);
    ensureDir(CACHE_DIR);
    fs.writeFileSync(OAUTH_CACHE, JSON.stringify(data));
    return data;
  } catch {
    try { return JSON.parse(fs.readFileSync(OAUTH_CACHE, 'utf8')); } catch {}
    return null;
  }
}

const bar = (pct) => {
  if (pct == null) return '';
  const filled = Math.min(10, Math.round(pct / 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
};

const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

const timeLeft = (val) => {
  if (!val) return '?';
  const epoch = typeof val === 'string' ? Math.floor(new Date(val).getTime() / 1000) : val;
  const diff = epoch - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'now';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
};

const color = (pct) => {
  if (pct == null) return '37';
  if (pct >= 80) return '31';
  if (pct >= 60) return '33';
  return '32';
};

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

    ensureDir(CACHE_DIR);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(limits));

    const oauth = fetchOAuthUsage();

    let out = `\x1b[0;36m${limits.model}\x1b[0m`;
    out += `  \x1b[0;37min:${fmtK(limits.context.input_tokens)} out:${fmtK(limits.context.output_tokens)}\x1b[0m`;

    if (limits.context.used_pct != null) {
      const c = color(limits.context.used_pct);
      out += `  \x1b[0;${c}mctx ${bar(limits.context.used_pct)} ${Math.round(limits.context.used_pct)}%\x1b[0m`;
    }

    if (oauth) {
      const fh = oauth.five_hour;
      if (fh?.utilization != null) {
        const c = color(fh.utilization);
        out += `  \x1b[0;${c}m5h ${bar(fh.utilization)} ${Math.round(fh.utilization)}% ↺${timeLeft(fh.resets_at)}\x1b[0m`;
      }

      const sd = oauth.seven_day;
      if (sd?.utilization != null) {
        const c = color(sd.utilization);
        out += `  \x1b[0;${c}m7d ${bar(sd.utilization)} ${Math.round(sd.utilization)}%\x1b[0m`;
      }

      const sonnet = oauth.seven_day_sonnet;
      if (sonnet?.utilization != null) {
        const c = color(sonnet.utilization);
        out += `  \x1b[0;${c}mSonnet ${bar(sonnet.utilization)} ${Math.round(sonnet.utilization)}%\x1b[0m`;
      }
    } else {
      if (limits.five_hour.used_pct != null) {
        const c = color(limits.five_hour.used_pct);
        out += `  \x1b[0;${c}m5h ${bar(limits.five_hour.used_pct)} ${Math.round(limits.five_hour.used_pct)}% ↺${timeLeft(limits.five_hour.resets_at)}\x1b[0m`;
      }
      if (limits.seven_day.used_pct != null) {
        const c = color(limits.seven_day.used_pct);
        out += `  \x1b[0;${c}m7d ${bar(limits.seven_day.used_pct)} ${Math.round(limits.seven_day.used_pct)}%\x1b[0m`;
      }
    }

    process.stdout.write(out);
  } catch {
    process.stdout.write('statusline: parse error');
  }
});
