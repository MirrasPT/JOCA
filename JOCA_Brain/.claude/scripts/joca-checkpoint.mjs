#!/usr/bin/env node
/**
 * joca-checkpoint — snapshots de sessão restauráveis (adaptado de gstack context-save/restore).
 * Append-only por projecto, frontmatter (ts/branch/slug/status), poda aos últimos N.
 * Restauro cross-branch (não filtra por branch — permite handoff entre branches/sessões).
 *
 * Store: <JOCA_Brain>/memory/checkpoints/<slug>/<ts>-<title>.md
 *
 * Uso:
 *   echo "<markdown body>" | joca-checkpoint save [--title "x"] [--status wip|done]
 *   joca-checkpoint latest [--slug X]      # imprime o checkpoint mais recente
 *   joca-checkpoint list   [--slug X]      # lista checkpoints (mais recente primeiro)
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
function slug() {
  const ex = arg('slug');
  if (ex) return sanitize(ex);
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
  return readdirSync(d).filter((f) => f.endsWith('.md')).sort().reverse(); // ts prefix → reverse = recente 1º
}

const cmd = process.argv[2];
const s = slug();

if (cmd === 'save') {
  let body = '';
  try { body = readFileSync(0, 'utf8'); } catch (_) { /* sem stdin */ }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const title = sanitize(arg('title', 'checkpoint'));
  const status = arg('status', 'wip');
  const d = dirFor(s);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const fm = `---\nts: ${new Date().toISOString()}\nbranch: ${branch()}\nslug: ${s}\nstatus: ${status}\n---\n\n`;
  const file = join(d, `${ts}-${title}.md`);
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, fm + (body.trim() || '(sem corpo)') + '\n', 'utf8');
  renameSync(tmp, file); // atómico
  // poda
  const all = ckptList(s);
  for (const old of all.slice(KEEP)) { try { unlinkSync(join(d, old)); } catch (_) { /* best-effort */ } }
  console.log(`[checkpoint] ${s} → ${basename(file)} (${status})`);
} else if (cmd === 'latest') {
  const all = ckptList(s);
  if (!all.length) { console.log(`(sem checkpoints para ${s})`); process.exit(0); }
  console.log(readFileSync(join(dirFor(s), all[0]), 'utf8'));
} else if (cmd === 'list') {
  const all = ckptList(s);
  if (!all.length) { console.log(`(sem checkpoints para ${s})`); process.exit(0); }
  console.log(`# Checkpoints — ${s}`);
  for (const f of all) console.log(`- ${f}`);
} else {
  console.log('joca-checkpoint — uso: save (stdin) | latest | list');
  process.exit(cmd ? 1 : 0);
}
