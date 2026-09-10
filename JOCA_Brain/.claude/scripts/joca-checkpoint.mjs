#!/usr/bin/env node
/**
 * joca-checkpoint — restorable session snapshots (adapted from gstack context-save/restore).
 * Append-only per project, frontmatter (ts/branch/slug/status), pruned to the last N.
 * Cross-branch restore (does not filter by branch — allows handoff between branches/sessions).
 *
 * Store: <JOCA_Brain>/memory/checkpoints/<slug>/<ts>-<title>.md
 *
 * Usage:
 *   echo "<markdown body>" | joca-checkpoint save [--slug X] [--title "x"] [--status wip|done]
 *   joca-checkpoint latest [--slug X]      # prints the most recent checkpoint
 *   joca-checkpoint list   [--slug X]      # lists checkpoints (most recent first)
 *
 * ⚠ Without --slug the slug is inferred from the git repo of the PROCESS CWD — under JOCA_OS/`/save`
 * the cwd is almost always `JOCA_Brain`, and another project's checkpoint lands in `checkpoints/JOCA...`
 * (it happened with Novanor, Kromway, Livro de Elogios, ComfyUI). Always pass
 * `--slug <project resolved in STEP 1 of /save>`. `--project` is an alias of `--slug`.
 */
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, renameSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEM = join(__dirname, '..', '..', 'memory');
const KEEP = 12;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown'; }
let slugInferido = false;
function slug() {
  const ex = arg('slug') || arg('project'); // --project = alias of --slug
  if (ex) return sanitize(ex);
  slugInferido = true;
  try { return sanitize(basename(execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())); }
  catch (_) { return sanitize(basename(process.cwd())); }
}
function branch() {
  try { return execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown'; }
  catch (_) { return 'unknown'; }
}
function dirFor(s) { return join(MEM, 'checkpoints', s); }
function ckptList(s) {
  const d = dirFor(s);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith('.md')).sort().reverse(); // ts prefix → reverse = most recent first
}

const cmd = process.argv[2];
const s = slug();

if (cmd === 'save') {
  let body = '';
  try { body = readFileSync(0, 'utf8'); } catch (_) { /* no stdin */ }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const title = sanitize(arg('title', 'checkpoint'));
  const status = arg('status', 'wip');
  const d = dirFor(s);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const fm = `---\nts: ${new Date().toISOString()}\nbranch: ${branch()}\nslug: ${s}\nstatus: ${status}\n---\n\n`;
  const file = join(d, `${ts}-${title}.md`);
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, fm + (body.trim() || '(no body)') + '\n', 'utf8');
  renameSync(tmp, file); // atomic
  // prune
  const all = ckptList(s);
  for (const old of all.slice(KEEP)) { try { unlinkSync(join(d, old)); } catch (_) { /* best-effort */ } }
  console.log(`[checkpoint] ${s} → ${basename(file)} (${status})`);
  if (slugInferido) console.error(`[checkpoint] ⚠ slug inferred from the cwd (${s}) — if the work was in another project, re-run with --slug <project> and delete this file`);
} else if (cmd === 'latest') {
  const all = ckptList(s);
  if (!all.length) { console.log(`(no checkpoints for ${s})`); process.exit(0); }
  console.log(readFileSync(join(dirFor(s), all[0]), 'utf8'));
} else if (cmd === 'list') {
  const all = ckptList(s);
  if (!all.length) { console.log(`(no checkpoints for ${s})`); process.exit(0); }
  console.log(`# Checkpoints — ${s}`);
  for (const f of all) console.log(`- ${f}`);
} else {
  console.log([
    'joca-checkpoint — usage:',
    '  echo "<md>" | joca-checkpoint save [--slug X] [--title "x"] [--status wip|done]',
    '  joca-checkpoint latest [--slug X]',
    '  joca-checkpoint list   [--slug X]',
    '  (--project = alias of --slug; without it the slug comes from the git repo of the process cwd)',
  ].join('\n'));
  process.exit(cmd && cmd !== '--help' && cmd !== '-h' && cmd !== 'help' ? 1 : 0);
}
