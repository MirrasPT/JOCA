// Rate-limit aggregation across Claude (OAuth usage API + statusline cache), Codex
// (~/.codex/logs_2.sqlite via node:sqlite), and AGY (statusline cache). Self-contained —
// derives paths from os. `getRateLimits()` returns the combined object (or null) that the
// /rate-limits route serves verbatim.
//
// NOTE: RL_CACHE_DIR is deliberately 'joca-ui' (NOT 'joca-os') — the cache is SHARED with the
// statusline; renaming it would empty the dashboard.
import path from 'path';
import os from 'os';
import fs from 'fs';
import https from 'https';
import { execFileSync } from 'child_process';

const MAX_RATE_LIMITS_FILE_SIZE = 100_000;
function readBoundedJson(file: string): unknown {
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > MAX_RATE_LIMITS_FILE_SIZE) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const RL_CACHE_DIR = path.join(os.tmpdir(), 'joca-ui');
const OAUTH_CACHE_FILE = path.join(RL_CACHE_DIR, 'oauth-usage.json');
const OAUTH_TTL_MS = 60_000;

// Normalise any reset timestamp (ISO string | epoch seconds | epoch ms) to epoch SECONDS.
function toEpochSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : Math.floor(t / 1000);
  }
  return null;
}

// Read the Claude OAuth access token. Windows/Linux: ~/.claude/.credentials.json.
// macOS: Keychain. (The statusline script only handled macOS — this is the cross-platform fix.)
function readClaudeToken(): string | null {
  try {
    const f = path.join(os.homedir(), '.claude', '.credentials.json');
    if (fs.existsSync(f)) {
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      const t = c?.claudeAiOauth?.accessToken;
      if (typeof t === 'string' && t) return t;
    }
  } catch {}
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { encoding: 'utf8', timeout: 3000 });
      return JSON.parse(out)?.claudeAiOauth?.accessToken || null;
    } catch {}
  }
  return null;
}

function httpGetJson(url: string, headers: Record<string, string>): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers, timeout: 5000 }, (r) => {
      let buf = '';
      r.on('data', (c) => { buf += c; if (buf.length > 200_000) req.destroy(); });
      r.on('end', () => {
        if (r.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(buf)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Fetch Anthropic OAuth usage directly (five_hour, seven_day, seven_day_sonnet + resets).
// File-cached (shared with the statusline) with a short TTL so polling stays cheap.
async function getClaudeOAuthUsage(): Promise<Record<string, any> | null> {
  try {
    if (fs.existsSync(OAUTH_CACHE_FILE) && Date.now() - fs.statSync(OAUTH_CACHE_FILE).mtimeMs < OAUTH_TTL_MS) {
      return JSON.parse(fs.readFileSync(OAUTH_CACHE_FILE, 'utf8'));
    }
  } catch {}
  const token = readClaudeToken();
  if (!token || !/^[A-Za-z0-9._\-]+$/.test(token)) {
    try { return JSON.parse(fs.readFileSync(OAUTH_CACHE_FILE, 'utf8')); } catch { return null; }
  }
  const data = await httpGetJson('https://api.anthropic.com/api/oauth/usage', { Authorization: `Bearer ${token}` });
  if (data) {
    try { fs.mkdirSync(RL_CACHE_DIR, { recursive: true }); fs.writeFileSync(OAUTH_CACHE_FILE, JSON.stringify(data), { mode: 0o600 }); } catch {}
    return data;
  }
  try { return JSON.parse(fs.readFileSync(OAUTH_CACHE_FILE, 'utf8')); } catch { return null; }
}

// Read the latest codex.rate_limits event from ~/.codex/logs_2.sqlite.
// Uses Node's built-in node:sqlite (Node 22.5+) — no sqlite3 binary needed (it isn't on Windows).
let codexCache: { at: number; data: Record<string, any> | null } | null = null;
function getCodexLimits(): Record<string, any> | null {
  if (codexCache && Date.now() - codexCache.at < OAUTH_TTL_MS) return codexCache.data;
  let data: Record<string, any> | null = null;
  try {
    const dbPath = path.join(os.homedir(), '.codex', 'logs_2.sqlite');
    if (fs.existsSync(dbPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string, o?: object) => any };
      const db = new DatabaseSync(dbPath, { readonly: true });
      try {
        const row = db.prepare(
          "SELECT ts, feedback_log_body AS body FROM logs WHERE feedback_log_body LIKE '%codex.rate_limits%' ORDER BY ts DESC LIMIT 1"
        ).get() as { ts: number; body: string } | undefined;
        if (row?.body) {
          const i = row.body.indexOf('"type":"codex.rate_limits"');
          const start = i !== -1 ? row.body.lastIndexOf('{', i) : -1;
          if (start >= 0) {
            let depth = 0;
            for (let k = start; k < row.body.length; k++) {
              if (row.body[k] === '{') depth++;
              else if (row.body[k] === '}') { depth--; if (depth === 0) {
                const d = JSON.parse(row.body.slice(start, k + 1));
                const rl = d.rate_limits || {};
                data = {
                  plan: d.plan_type || null,
                  updated_at: row.ts ? row.ts * 1000 : null,
                  ...(rl.primary ? { five_hour: { used_pct: rl.primary.used_percent ?? null, resets_at: toEpochSeconds(rl.primary.reset_at) } } : {}),
                  ...(rl.secondary ? { seven_day: { used_pct: rl.secondary.used_percent ?? null, resets_at: toEpochSeconds(rl.secondary.reset_at) } } : {}),
                };
                break;
              } }
            }
          }
        }
      } finally { db.close(); }
    }
  } catch { data = null; }
  codexCache = { at: Date.now(), data };
  return data;
}

// Combined rate-limit snapshot served by GET /rate-limits. Returns null when nothing is available.
export async function getRateLimits(): Promise<Record<string, unknown> | null> {
  const result: Record<string, unknown> = {};

  // ── Claude ── OAuth usage (5h, 7d, Sonnet 7d) fetched directly; statusline cache as fallback.
  try {
    const base = readBoundedJson(path.join(RL_CACHE_DIR, 'rate-limits.json')) as Record<string, any> | null;
    const oauth = await getClaudeOAuthUsage();
    const claude: Record<string, any> = {};
    if (base?.model) claude.model = base.model;
    if (oauth) {
      if (oauth.five_hour?.utilization != null) claude.five_hour = { used_pct: oauth.five_hour.utilization, resets_at: toEpochSeconds(oauth.five_hour.resets_at) };
      if (oauth.seven_day?.utilization != null) claude.seven_day = { used_pct: oauth.seven_day.utilization, resets_at: toEpochSeconds(oauth.seven_day.resets_at) };
      if (oauth.seven_day_sonnet?.utilization != null) claude.sonnet_seven_day = { used_pct: oauth.seven_day_sonnet.utilization, resets_at: toEpochSeconds(oauth.seven_day_sonnet.resets_at) };
    }
    // Fallback to the statusline snapshot for any window OAuth didn't provide.
    if (base) {
      if (!claude.five_hour && base.five_hour?.used_pct != null) claude.five_hour = { used_pct: base.five_hour.used_pct, resets_at: toEpochSeconds(base.five_hour.resets_at) };
      if (!claude.seven_day && base.seven_day?.used_pct != null) claude.seven_day = { used_pct: base.seven_day.used_pct, resets_at: toEpochSeconds(base.seven_day.resets_at) };
    }
    if (claude.five_hour || claude.seven_day || claude.sonnet_seven_day) result.claude = claude;
  } catch {}

  // ── Codex ── primary=5h, secondary=week, from ~/.codex/logs_2.sqlite via node:sqlite.
  try {
    const codex = getCodexLimits();
    if (codex && (codex.five_hour || codex.seven_day)) result.codex = codex;
  } catch {}

  // ── Gemini/AGY ── Antigravity (consumer) exposes no time-windowed limits; only the
  // statusline context-window snapshot is available. Best-effort read of that cache.
  try {
    const agy = readBoundedJson(path.join(RL_CACHE_DIR, 'agy-rate-limits.json'));
    if (agy) result.agy = agy;
  } catch {}

  return Object.keys(result).length > 0 ? result : null;
}
