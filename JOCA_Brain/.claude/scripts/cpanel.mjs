#!/usr/bin/env node
// cpanel.mjs — generic cPanel UAPI client driven by a local token file.
//
// Creds live OUTSIDE git in ~/.cpanel/<account>.json:
//   { "host": "...", "port": 2083, "user": "...", "primaryDomain": "...", "token": "..." }
// The token is read from disk and never printed.
//
// Usage:
//   node cpanel.mjs uapi <Module> <function> [key=value ...] [--post] [--account=<name>]
//   node cpanel.mjs accounts                      # list configured ~/.cpanel/*.json
//   node cpanel.mjs domains                       # DomainInfo/list_domains (shortcut)
//   node cpanel.mjs email                         # Email/list_pops (shortcut)
//   node cpanel.mjs dns <zone>                    # DNS/parse_zone (shortcut, base64 decoded: "TYPE name → value")
//   node cpanel.mjs ls <dir>                      # Fileman/list_files (shortcut, dir relative to home)
//   node cpanel.mjs read <path>                   # Fileman/get_file_content (path relative to home)
//
// Examples:
//   node cpanel.mjs uapi Email add_pop email=ola@x.com password='S3cr3t!' quota=512 domain=x.com --post
//   node cpanel.mjs uapi DNS mass_edit_zone ...   # mutating calls: prefer --post
//
// Exit code != 0 when cPanel returns status:0 (error) or transport fails.
//
// Windows/Git Bash: export MSYS_NO_PATHCONV=1 before passing absolute remote paths (/home/...),
// otherwise MSYS rewrites them and the server error looks like a server problem (see warnIfMsysPath).

import fs from 'fs';
import os from 'os';
import path from 'path';

const CPANEL_DIR = path.join(os.homedir(), '.cpanel');

function listAccounts() {
  try {
    return fs.readdirSync(CPANEL_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch { return []; }
}

function loadCreds(account) {
  const accounts = listAccounts();
  if (accounts.length === 0) {
    console.error(`No accounts in ${CPANEL_DIR}. Create <name>.json with { host, port, user, token }.`);
    process.exit(2);
  }
  const name = account || (accounts.length === 1 ? accounts[0] : null);
  if (!name) {
    console.error(`Multiple accounts found — pass --account=<name>. Available: ${accounts.join(', ')}`);
    process.exit(2);
  }
  const file = path.join(CPANEL_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Account not found: ${file}. Available: ${accounts.join(', ')}`);
    process.exit(2);
  }
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!c.host || !c.user || !c.token) {
    console.error(`Account ${name} missing host/user/token.`);
    process.exit(2);
  }
  c.port = c.port || 2083;
  return c;
}

// Git Bash (MSYS) rewrites POSIX-looking arguments into Windows paths, so a remote path like
// /home/user/site becomes /home/user/D:/repo/site and the SERVER reports "does not exist".
// Detect the smuggled drive letter and say who is at fault — the error is local, not remote.
const MSYS_DRIVE_RE = /\/[A-Za-z]:[\/\\]/;
function warnIfMsysPath(value) {
  if (typeof value !== 'string' || !MSYS_DRIVE_RE.test(value)) return;
  console.error(
    `WARNING: path "${value}" contains a Windows drive letter mid-path.\n` +
    `  Most likely cause: Git Bash/MSYS rewriting the POSIX path locally — i.e. a LOCAL problem,\n` +
    `  not the server rejecting the path. (Heuristic: it matches the shape, not the origin.)\n` +
    `  Fix: export MSYS_NO_PATHCONV=1   (or prefix the command with MSYS_NO_PATHCONV=1)`
  );
}

// UAPI DNS/parse_zone returns dname_b64 / data_b64 in base64; undecoded they read as undefined.
function b64(v) {
  if (v == null) return '';
  // data_b64 can be an ARRAY (e.g. MX = [priority, host]) — decode each part, then join.
  if (Array.isArray(v)) return v.map(b64).join(' ');
  const s = String(v);
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return s; }
}

function printZone(json) {
  // `data` ausente/null NÃO é o mesmo que zona vazia: é resposta incompleta. Distinguir.
  const semData = !json || json.data == null;
  const rows = semData ? [] : json.data;
  let printed = 0;
  let ignoradas = 0;
  for (const r of rows) {
    const type = r.record_type || r.type || '';
    if (!type || type === 'control' || type === 'comment') { ignoradas++; continue; }
    const name = r.dname_b64 !== undefined ? b64(r.dname_b64) : (r.dname || r.name || '');
    const data = r.data_b64 !== undefined ? b64(r.data_b64) : (r.data || '');
    // Um registo com `type` reconhecido mas SEM nome e SEM dados imprimiria `tipo\t → ` — uma linha
    // vazia que conta como sucesso. É o mesmo falso-negativo por outra porta: não imprimir nem contar.
    if (!name && !data) { ignoradas++; continue; }
    console.log(`${type}\t${name} → ${data}`);
    printed++;
  }
  // Saída vazia com exit 0 lê-se como "zona vazia" — o falso-negativo que este atalho existe para
  // matar. Dizer QUAL dos três casos é, e sair != 0 sempre que não se mediu nada.
  if (printed === 0) {
    if (semData) {
      console.error('RESPOSTA SEM CAMPO `data`: a UAPI não devolveu registos — erro de pedido ou de permissões, não zona vazia.');
    } else if (rows.length === 0) {
      console.error('ZONA SEM REGISTOS: a UAPI devolveu 0 linhas — confirma o nome da zona e a conta (--account).');
    } else {
      console.error(`ZONA SEM REGISTOS IMPRIMÍVEIS: ${rows.length} linha(s) devolvidas, ${ignoradas} ignorada(s) (control/comment, sem record_type, ou sem nome e sem dados).`);
    }
    process.exitCode = 2;
  }
}

async function uapi(creds, module, func, params, usePost, onJson) {
  const base = `https://${creds.host}:${creds.port}/execute/${module}/${func}`;
  const headers = { Authorization: `cpanel ${creds.user}:${creds.token}` };
  let url = base;
  let body;
  if (usePost) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(params).toString();
  } else {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  let res;
  try {
    res = await fetch(url, { method: usePost ? 'POST' : 'GET', headers, body });
  } catch (e) {
    console.error(`Transport error: ${e.message}`);
    process.exit(1);
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { console.error(`HTTP ${res.status} (non-JSON):\n${text.slice(0, 1000)}`); process.exit(1); }
  if (onJson && json && json.status !== 0) onJson(json);
  else console.log(JSON.stringify(json, null, 2));
  // UAPI envelope: status 1 = ok, 0 = error.
  if (json && json.status === 0) process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const params = {};
  let account;
  let usePost = false;
  for (const a of argv) {
    if (a === '--post') usePost = true;
    else if (a.startsWith('--account=')) account = a.slice('--account='.length);
    else if (a.includes('=') && !a.startsWith('--')) {
      const i = a.indexOf('=');
      params[a.slice(0, i)] = a.slice(i + 1);
    } else positional.push(a);
  }
  return { positional, params, account, usePost };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'accounts') {
    const accs = listAccounts();
    console.log(accs.length ? accs.join('\n') : `(none in ${CPANEL_DIR})`);
    return;
  }
  const { positional, params, account, usePost } = parseArgs(rest);
  for (const v of positional) warnIfMsysPath(v);
  for (const v of Object.values(params)) warnIfMsysPath(v);
  const creds = loadCreds(account);

  switch (cmd) {
    case 'uapi': {
      const [module, func] = positional;
      if (!module || !func) { console.error('Usage: uapi <Module> <function> [key=value ...]'); process.exit(2); }
      return uapi(creds, module, func, params, usePost);
    }
    case 'domains': return uapi(creds, 'DomainInfo', 'list_domains', {}, false);
    case 'email':   return uapi(creds, 'Email', 'list_pops', {}, false);
    case 'dns': {
      const zone = positional[0] || creds.primaryDomain;
      if (!zone) { console.error('Usage: dns <zone>'); process.exit(2); }
      // parse_zone returns base64 fields — decode and print "TYPE name → value".
      return uapi(creds, 'DNS', 'parse_zone', { zone }, false, printZone);
    }
    case 'ls':   return uapi(creds, 'Fileman', 'list_files', { dir: positional[0] || '', ...params }, false);
    case 'read': {
      const p = positional[0];
      if (!p) { console.error('Usage: read <path>'); process.exit(2); }
      // Fileman/get_file_content takes dir + file (NOT a single path).
      const file = p.split('/').pop();
      const dir = p.slice(0, Math.max(0, p.length - file.length - 1)) || '';
      return uapi(creds, 'Fileman', 'get_file_content', { dir, file }, false);
    }
    default:
      console.error(`Unknown command: ${cmd}. Try: accounts | domains | email | dns | ls | read | uapi`);
      process.exit(2);
  }
}

main();
