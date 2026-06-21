#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execFileSync } = require('child_process');

const CACHE_DIR = path.join(os.tmpdir(), 'joca-ui');
const CACHE_FILE = path.join(CACHE_DIR, 'rate-limits.json');
const OAUTH_CACHE = path.join(CACHE_DIR, 'oauth-usage.json');
const OAUTH_TTL_MS = 120_000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readKeychainToken() {
  // Windows/Linux: credentials file written by Claude Code.
  try {
    const f = path.join(os.homedir(), '.claude', '.credentials.json');
    if (fs.existsSync(f)) {
      const creds = JSON.parse(fs.readFileSync(f, 'utf8'));
      const t = creds?.claudeAiOauth?.accessToken;
      if (t) return t;
    }
  } catch {}
  // macOS: Keychain.
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync(
        'security',
        ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const creds = JSON.parse(out);
      return creds?.claudeAiOauth?.accessToken || null;
    } catch {}
  }
  return null;
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 3000 }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function fetchOAuthUsage() {
  try {
    const stat = fs.existsSync(OAUTH_CACHE) && fs.statSync(OAUTH_CACHE);
    if (stat && Date.now() - stat.mtimeMs < OAUTH_TTL_MS) {
      return JSON.parse(fs.readFileSync(OAUTH_CACHE, 'utf8'));
    }
  } catch {}

  const token = readKeychainToken();
  if (!token || !/^[A-Za-z0-9._\-]+$/.test(token)) return null;

  try {
    const { status, body } = await httpGet(
      'https://api.anthropic.com/api/oauth/usage',
      { 'Authorization': `Bearer ${token}` }
    );
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const data = JSON.parse(body);
    ensureDir(CACHE_DIR);
    fs.writeFileSync(OAUTH_CACHE, JSON.stringify(data), { mode: 0o600 });
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
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
};

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
  if (raw.length > 1_000_000) { process.stdout.write('statusline: input too large'); process.exit(1); }
});
process.stdin.on('end', async () => {
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
    fs.writeFileSync(CACHE_FILE, JSON.stringify(limits), { mode: 0o600 });

    const oauth = await fetchOAuthUsage();

    let out = `\x1b[0;36m${limits.model}\x1b[0m`;
    out += `  \x1b[0;37min:${fmtK(limits.context.input_tokens)} out:${fmtK(limits.context.output_tokens)}\x1b[0m`;

    if (limits.context.used_pct != null) {
      out += `  \x1b[0;33mctx ${bar(limits.context.used_pct)} ${Math.round(limits.context.used_pct)}%\x1b[0m`;
    }

    if (oauth) {
      const fh = oauth.five_hour;
      if (fh?.utilization != null) {
        out += `  \x1b[0;35m5h ${bar(fh.utilization)} ${Math.round(fh.utilization)}%  ↺ ${timeLeft(fh.resets_at)}\x1b[0m`;
      }

      const sd = oauth.seven_day;
      if (sd?.utilization != null) {
        out += `  \x1b[0;34m7d ${bar(sd.utilization)} ${Math.round(sd.utilization)}%  ⏱ ${timeLeft(sd.resets_at)}\x1b[0m`;
      }

      const sonnet = oauth.seven_day_sonnet;
      if (sonnet?.utilization != null) {
        out += `  \x1b[0;31mSonnet ${bar(sonnet.utilization)} ${Math.round(sonnet.utilization)}%  ⏱ ${timeLeft(sonnet.resets_at)}\x1b[0m`;
      }
    } else {
      if (limits.five_hour.used_pct != null) {
        out += `  \x1b[0;35m5h ${bar(limits.five_hour.used_pct)} ${Math.round(limits.five_hour.used_pct)}%  ↺ ${timeLeft(limits.five_hour.resets_at)}\x1b[0m`;
      }
      if (limits.seven_day.used_pct != null) {
        out += `  \x1b[0;34m7d ${bar(limits.seven_day.used_pct)} ${Math.round(limits.seven_day.used_pct)}%  ⏱ ${timeLeft(limits.seven_day.resets_at)}\x1b[0m`;
      }
    }

    process.stdout.write(out);
  } catch {
    process.stdout.write('statusline: parse error');
  }
});
