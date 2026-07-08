#!/usr/bin/env node
// Stop hook — auto-checkpoint light (memória de sessão sem /save manual).
// Tem de correr ANTES do auto-test-dispatch.js no array Stop: este lê a
// .joca/test-queue.jsonl que aquele consome/limpa.
// Salvaguardas anti-ruído: (a) só dispara com ≥1 ficheiro de código na queue;
// (b) throttle 10 min entre auto-checkpoints; (c) poda própria: mantém só os
// 4 auto- mais recentes (não empurra os checkpoints manuais para fora do KEEP=12).
// Fail-open: qualquer erro → exit 0 silencioso. Complementa o /save (prosa/feedback
// continuam exclusivos do /save) — isto é só o snapshot machine-readable p/ /resume.
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
    } catch (_) { /* linha partida — ignora */ }
  }
  const code = files.filter((f) => /\.(php|ts|tsx|js|jsx|mjs|cjs|py|cs|vue|go|rb|css|html|blade\.php)$/i.test(f));
  if (!code.length) process.exit(0);

  // slug igual ao do joca-checkpoint (git toplevel → basename; fallback cwd)
  let slug;
  try {
    slug = path.basename(execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
  } catch (_) { slug = path.basename(cwd); }
  slug = slug.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown';

  // throttle + poda dos auto- antigos
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
    `## Ficheiros tocados (auto)\n` +
    files.slice(0, 30).map((f) => `- ${f}`).join('\n') +
    (files.length > 30 ? `\n- (+${files.length - 30})` : '') +
    `\n## Nota\n- Checkpoint automático no Stop — para estado completo correr /save\n`;

  execFileSync('node', [CKPT_SCRIPT, 'save', '--title', 'auto', '--status', 'wip'], {
    input: body,
    cwd,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  process.exit(0);
} catch (_) {
  process.exit(0); // fail-open
}
