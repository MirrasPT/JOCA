#!/usr/bin/env node
// joca — bridge CLI between a terminal and the JOCA_OS that opened it.
//
// Every terminal opened by JOCA is born with JOCA_API_URL / JOCA_CLI / JOCA_SESSION_ID in the
// environment (and JOCA_API_TOKEN when auth is on), so any agent — Claude Code, Codex, agy,
// OpenCode — can use this with no configuration and WITHOUT restarting JOCA:
//
//   node "$JOCA_CLI" sessions                   terminals of your project (area + current work)
//   node "$JOCA_CLI" send <id> "text"           talks to another agent in the same project
//   node "$JOCA_CLI" read <id> --tail 2000      reads what another agent wrote
//   node "$JOCA_CLI" cat <path>                  reads 1 file by path (no navigation/listing)
//
// The terminal commands are LIMITED TO THE PROJECT of whoever runs them: two agents of the same
// project talk to and check each other, but do not see those of another project. Whoever runs the
// CLI by hand (without JOCA_SESSION_ID) still sees everything.
//
// No dependencies. Output designed to be read by an agent: short and deterministic.
import process from 'node:process';
import path from 'node:path';
import os from 'node:os';

const API = (process.env.JOCA_API_URL || 'http://127.0.0.1:7491').replace(/\/$/, '');
const TOKEN = process.env.JOCA_API_TOKEN || '';
const SESSION_ID = process.env.JOCA_SESSION_ID || '';

function die(msg, code = 1) {
  console.error(`joca: ${msg}`);
  process.exit(code);
}

// A single HTTP entry point: `raw` returns the body as-is (/file-content serves the file, not
// JSON) and `forbiddenHint` explains a 403 — the only response whose backend text ("Forbidden")
// does not tell the agent what to do next.
async function request(method, route, { body, raw = false, forbiddenHint = '' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: API };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  // Tells JOCA_OS WHO is calling: this is how the backend limits an agent to its project's
  // terminals. Running this by hand (without JOCA_SESSION_ID) identifies nobody, and sees everything.
  if (SESSION_ID) headers['X-Joca-Session'] = SESSION_ID;
  let res;
  try {
    res = await fetch(`${API}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    die(`could not talk to JOCA_OS at ${API} (${e.message}).
  JOCA_OS may not be running, or may be on another port. Check that the app is open and
  that JOCA_API_URL points to it (now: ${process.env.JOCA_API_URL ? `JOCA_API_URL=${process.env.JOCA_API_URL}` : 'JOCA_API_URL not set — I used the default'}).`);
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    // 401 is always the same problem seen from two sides: missing token or already-dead token.
    if (res.status === 401) {
      die(TOKEN
        ? `JOCA_OS refused this terminal's JOCA_API_TOKEN (expired or revoked by a password change).
  Open a new terminal from JOCA_OS — every PTY is born with a fresh token.`
        : `JOCA_OS has auth on and JOCA_API_TOKEN is missing from this environment.
  Terminals opened by JOCA_OS receive it automatically; if you are running this by hand,
  export JOCA_API_TOKEN=<token> (the same one the UI uses) before retrying.`);
    }
    const hint = res.status === 403 && forbiddenHint ? `\n  ${forbiddenHint}` : '';
    die(`${res.status} — ${(data && data.error) || text || 'error'}${hint}`);
  }
  return raw ? text : data;
}

const api = (method, route, body) => request(method, route, { body });

// ── args ──────────────────────────────────────────────────────────────────────
// Supports `--flag value` and `--flag=value`; the rest are positional.
function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { flags, positional };
}

const rel = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
const short = (id) => (id || '').slice(0, 8);
const oneLine = (s, n = 90) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Accepts a full id or a prefix (agents copy short ids from the listing).
function resolveId(items, ref, label, notFoundHint = '') {
  if (!ref) die(`missing the ${label} id`);
  const exact = items.find((t) => t.id === ref);
  if (exact) return exact;
  const matches = items.filter((t) => t.id.startsWith(ref));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) die(`prefix "${ref}" is ambiguous (${matches.length} ${label}s)`);
  die(`${label} "${ref}" not found${notFoundHint ? `\n  ${notFoundHint}` : ''}`);
}

// A project is referred to by id, id prefix or name — an agent that read "Ana's Site" in a
// message does not have the uuid at hand. Ambiguity never guesses: it lists the candidates and exits.
async function resolveProject(ref) {
  const all = (await api('GET', '/projects')).filter((p) => !p.archived);
  if (!all.length) die('there are no projects in JOCA_OS. Create one in the UI (sidebar → Projects).');
  if (!ref) die('missing the project. See the list with: joca projects');
  const lower = String(ref).toLowerCase();
  const exact = all.find((p) => p.id === ref) || all.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;
  let matches = all.filter((p) => p.id.startsWith(ref));
  if (!matches.length) matches = all.filter((p) => p.name.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`joca: "${ref}" matches ${matches.length} projects — pick one:`);
    for (const p of matches) console.error(`  ${short(p.id)}  ${p.name}`);
    process.exit(1);
  }
  die(`project "${ref}" not found. See the list with: joca projects`);
}

// Paths are resolved ON THE AGENT SIDE (~ and relative ones count from this terminal's cwd);
// the backend always receives an absolute one, otherwise it would resolve against the server's cwd.
function absPath(p) {
  const raw = String(p).trim();
  if (raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(1));
  return path.resolve(raw);
}

const FILES_HINT = 'JOCA_OS only serves files inside your home (and never sensitive folders like .ssh/.aws).';
const SCOPE_HINT = 'An agent only talks to terminals of the SAME project — see which with: joca sessions';

// ── commands ──────────────────────────────────────────────────────────────────
const commands = {
  // Inside an agent this list already comes limited to its project (the backend filters by
  // X-Joca-Session). Shows the AREA and the current work: that is what decides who is worth talking to.
  async sessions() {
    const list = await api('GET', '/sessions');
    if (!list.length) return console.log('(no terminals open)');
    const self = list.find((s) => s.id === SESSION_ID);
    if (self?.projectName) console.log(`# terminals of "${self.projectName}" (you only see those of your project)\n`);
    for (const s of list) {
      const me = s.id === SESSION_ID ? '  ← this terminal' : '';
      const area = s.area ? `${s.area}${s.busy ? '*' : ''}` : '—';
      const job = s.currentJob ? `  · ${oneLine(s.currentJob, 60)}` : '';
      console.log(`${short(s.id)}  [${s.cli}] ${s.status.padEnd(7)} ${oneLine(s.name, 28).padEnd(30)} ${area.padEnd(16)}${job}${me}`);
    }
    console.log('\n(area with * = busy working · read what it is doing with: joca read <id>)');
  },

  async 'new-session'(flags, [...nameParts]) {
    const s = await api('POST', '/sessions', {
      name: nameParts.join(' ') || flags.name,
      cli: flags.cli,
      model: flags.model,
      project: flags.project,
      cwd: flags.cwd,
      prompt: flags.prompt,
    });
    console.log(`terminal opened: ${short(s.id)}  [${s.cli}] ${s.name}`);
  },

  async send(flags, [ref, ...rest]) {
    const text = rest.join(' ') || flags.text;
    if (!text) die('missing the text: joca send <session-id> "message"');
    const list = await api('GET', '/sessions');
    const s = resolveId(list, ref, 'session', SCOPE_HINT);
    if (s.id === SESSION_ID) die('you cannot send a message to yourself');
    await request('POST', `/sessions/${s.id}/input`, { body: { text }, forbiddenHint: SCOPE_HINT });
    console.log(`sent to "${s.name}" (${short(s.id)})`);
  },

  async read(flags, [ref]) {
    const list = await api('GET', '/sessions');
    const s = resolveId(list, ref, 'session', SCOPE_HINT);
    const out = await request('GET', `/sessions/${s.id}/buffer?tail=${Number(flags.tail) || 4000}`, { forbiddenHint: SCOPE_HINT });
    console.log(out.text);
  },

  async projects() {
    const list = await api('GET', '/projects');
    for (const p of list.filter((x) => !x.archived)) console.log(`${short(p.id)}  ${p.name}  ${p.path}`);
  },


  async cat(flags, [target]) {
    if (!target) die('missing the path: joca cat <path> [--tail N]');
    const file = absPath(target);
    // The backend serves the whole file; the line cut is done here (there is no tail route).
    const body = await request('GET', `/file-content?path=${encodeURIComponent(file)}`, { raw: true, forbiddenHint: FILES_HINT });
    const tail = Number(flags.tail);
    if (tail > 0) {
      const lines = body.split('\n');
      // The trailing \n is not a line — without this, `--tail 2` returned the last line and an empty one.
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      console.log(lines.slice(Math.max(0, lines.length - tail)).join('\n'));
    } else process.stdout.write(body);   // no extra \n: the file comes out byte for byte as it is
  },

  async notify(flags, [...parts]) {
    const text = parts.join(' ') || flags.text;
    if (!text) die('missing the text: joca notify "message"');
    await api('POST', '/notifications', { title: flags.title || 'Terminal', text, kind: 'system' });
    console.log('notification sent');
  },


  help() {
    console.log(`joca — bridge between this terminal and JOCA_OS (${API})

TERMINALS (agents talk to each other — only within the SAME project)
  sessions                                     terminals of your project, with area and current work
  new-session "<name>" [--cli claude|codex|agy|opencode] [--project <id>] [--prompt "..."]
  send <id> "<text>"                           talks to another agent (checks its work, asks for something)
  read <id> [--tail 4000]                      reads another agent's output
  (inside an agent you see ONLY the terminals of its project; talking to one from another project is
   refused by JOCA_OS.)


FILES (one-off reading — no navigation/listing, see skill)
  cat <path> [--tail N]                        reads a file (--tail N = last N lines)

OTHER
  projects · notify "<text>"

Context of this terminal: session ${SESSION_ID ? short(SESSION_ID) : '(unknown)'}`);
  },
};

const [, , cmd = 'help', ...rest] = process.argv;
const { flags, positional } = parseArgs(rest);
// Object.hasOwn: `joca toString` must not fall through to Object.prototype.
const isCommand = (name) => Object.hasOwn(commands, name);
const handler = isCommand(cmd) ? commands[cmd] : (cmd === '--help' || cmd === '-h' ? commands.help : null);
if (!handler) die(`unknown command "${cmd}". Run: joca help`);
// Promise.resolve: `help` is synchronous and returns undefined — calling .catch() on it blew up.
Promise.resolve(handler(flags, positional)).catch((e) => die(e.message));
