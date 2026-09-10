#!/usr/bin/env node
// Stop hook — light auto-checkpoint (session memory without a manual /save).
// Must run BEFORE auto-test-dispatch.js in the Stop array: this one reads the
// .joca/test-queue.jsonl that the other one consumes/clears.
// Anti-noise safeguards: (a) only fires with ≥1 code file in the queue;
// (b) 10 min throttle between auto-checkpoints; (c) its own pruning: keeps only the
// 4 most recent auto- ones (does not push the manual checkpoints out of KEEP=12).
// Fail-open: any error → silent exit 0. It complements /save (prose/feedback
// remain exclusive to /save) — this is only the machine-readable snapshot for /resume.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const THROTTLE_MIN = 10;
const KEEP_AUTO = 4;
const CKPT_SCRIPT = path.join(__dirname, '..', 'scripts', 'joca-checkpoint.mjs');
const MEM_CKPT = path.join(__dirname, '..', '..', 'memory', 'checkpoints');

try {
  const cwd = process.cwd();
  const queueFile = path.join(cwd, '.joca', 'test-queue.jsonl');
  if (!fs.existsSync(queueFile)) process.exit(0);

  const lines = fs.readFileSync(queueFile, 'utf8').split('\n').filter(Boolean);
  const files = [];
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      const f = e.file || e.path || e.file_path;
      if (f && !files.includes(f)) files.push(f);
    } catch (_) { /* broken line — ignore */ }
  }
  const code = files.filter((f) => /\.(php|ts|tsx|js|jsx|mjs|cjs|py|cs|vue|go|rb|css|html|blade\.php)$/i.test(f));
  if (!code.length) process.exit(0);

  // slug identical to joca-checkpoint's (git toplevel → basename; fallback cwd)
  let slug;
  try {
    slug = path.basename(execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
  } catch (_) { slug = path.basename(cwd); }
  slug = slug.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown';

  // throttle + pruning of the old auto- ones
  const dir = path.join(MEM_CKPT, slug);
  if (fs.existsSync(dir)) {
    const autos = fs.readdirSync(dir).filter((f) => f.endsWith('-auto.md')).sort().reverse();
    if (autos.length) {
      const newest = fs.statSync(path.join(dir, autos[0])).mtimeMs;
      if (Date.now() - newest < THROTTLE_MIN * 60 * 1000) process.exit(0);
    }
    for (const old of autos.slice(KEEP_AUTO - 1)) {
      try { fs.unlinkSync(path.join(dir, old)); } catch (_) { /* best-effort */ }
    }
  }

  const body =
    `## Files touched (auto)\n` +
    files.slice(0, 30).map((f) => `- ${f}`).join('\n') +
    (files.length > 30 ? `\n- (+${files.length - 30})` : '') +
    `\n## Note\n- Automatic checkpoint on Stop — for the full state run /save\n`;

  execFileSync('node', [CKPT_SCRIPT, 'save', '--title', 'auto', '--status', 'wip'], {
    input: body,
    cwd,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  process.exit(0);
} catch (_) {
  process.exit(0); // fail-open
}
