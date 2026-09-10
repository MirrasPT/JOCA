#!/usr/bin/env node
// Stop hook — reads the queue of changes and RECOMMENDS testers. It never blocks the turn.
//
// History: in earlier versions it fired on EVERY Stop, with the same recommendation, without looking
// at what had changed or at work in progress. Measured in real feedback: 6 to 9 refusals per session,
// always the same one, and one case of a loop (the model answered with a reasoned refusal 3x and the
// hook repeated 3x). Four brakes, in this order:
//   1. WORK IN PROGRESS — contract `.joca/loop.json` with steps still open → it goes quiet and does
//      NOT clear the queue (auditing files another agent is mid-way through writing gives false findings);
//   2. WHAT CHANGED — the queue is cross-checked with `git status --porcelain`: a file deleted in the
//      meantime, or already clean (committed/reverted), drops out of the count. Fail-open: no git, count everything;
//   3. REFUSAL MEMORY — the same set of testers already recommended in this session (or in the last
//      15 min) → silence, and the queue is cleared all the same. The same thing is not asked twice;
//   4. EXPLICIT EXITS in the message — including "the session forbids dispatching agents", which
//      exists as a system directive and was not in the hook's vocabulary.
// Fail-open: any error → silent exit 0. A hook that blows up cannot stall the session.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEMO_TTL_MIN = 15;

try {
  const repoRoot = path.resolve(__dirname, '../..');
  const jocaDir = path.join(repoRoot, '.joca');
  const queueFile = path.join(jocaDir, 'test-queue.jsonl');
  const memoFile = path.join(jocaDir, 'test-dispatch-memo.json');

  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { /* no stdin */ }
  const sessionId = payload.session_id || 'sem-sessao';
  const cwd = payload.cwd || process.cwd();

  if (!fs.existsSync(queueFile)) process.exit(0);
  const content = fs.readFileSync(queueFile, 'utf8').trim();
  if (!content) process.exit(0);

  // --- Brake 1: work still open (live agents/steps) ---------------------------
  // The contract `.joca/loop.json` is the on-disk marker of multi-step work in progress
  // (written by the main loop, read by stop-continue.js). While there are steps still to
  // verify, the files are mid-write — recommending testers now is noise.
  // The queue is NOT cleared: the recommendation survives for when the contract closes.
  for (const dir of [path.join(cwd, '.joca'), jocaDir]) {
    const loopFile = path.join(dir, 'loop.json');
    if (!fs.existsSync(loopFile)) continue;
    try {
      const loop = JSON.parse(fs.readFileSync(loopFile, 'utf8'));
      const passos = Array.isArray(loop.passos) ? loop.passos : [];
      if (passos.some((p) => p.estado !== 'verificado')) process.exit(0);
    } catch (_) { /* unreadable contract — does not suppress */ }
  }

  // --- Brake 2: read what CHANGED, not what was touched ------------------------
  // `git status --porcelain` in the cwd, with prefix-match (untracked/ignored dirs come collapsed).
  // A file inside the repo and absent from the list = clean → does not count. Outside the repo, or
  // with no git, it counts (fail-open — better to over-recommend than to silence a true signal).
  let toplevel = null;
  let mudados = null;
  try {
    toplevel = execSync('git rev-parse --show-toplevel', {
      cwd, encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const out = execSync('git status --porcelain --ignored', {
      cwd, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    mudados = out.split('\n').filter(Boolean)
      .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop().trim())
      .filter(Boolean);
  } catch (_) { toplevel = null; mudados = null; }

  function conta(file) {
    if (!file) return false;
    const abs = path.resolve(cwd, file);
    if (!fs.existsSync(abs)) return false;           // created and deleted in the same turn
    if (!toplevel || !mudados) return true;          // no git → fail-open
    const rel = path.relative(toplevel, abs).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) return true; // outside this repo
    return mudados.some((m) => rel === m || rel.startsWith(m.endsWith('/') ? m : m + '/'));
  }

  const lines = content.split('\n').filter(Boolean);
  let backend = 0, frontend = 0, style = 0, db = 0, trivial = 0;
  // Dedup by the file+DOMAIN pair, not by the file alone: the same file can enter the
  // queue as `frontend` and as `backend` (a blade with JS, a .vue with an API),
  // and deduplicating before accumulating the domain threw the second one away — the
  // auditor saw "0 backend, 1 frontend" where it should have been both. The purpose of the
  // dedup is still "the same file edited N times = 1", and that holds within each domain.
  const vistos = new Set();
  const ficheirosLimpos = new Set();                  // counted once per file
  const ficheirosContados = new Set();

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch (_) { continue; }
    const file = entry.file || entry.path || entry.file_path;
    if (file) {
      const chave = `${file}|${entry.domain || ''}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      if (!conta(file)) { ficheirosLimpos.add(file); continue; }
      ficheirosContados.add(file);   // the message talks about FILES: 1 file in 2 domains = 1
    }
    if (entry.domain === 'backend') backend++;
    else if (entry.domain === 'frontend') frontend++;
    else if (entry.domain === 'style') style++;
    else if (entry.domain === 'database') db++;
    else if (entry.domain === 'trivial') trivial++;
  }

  // Only recommend tester-api if the project HAS an API. A WordPress without a single
  // endpoint was getting "run tester-api" on every constant bump.
  function hasApiSurface() {
    if (fs.existsSync(path.join(cwd, 'routes'))) return true;          // Laravel
    if (fs.existsSync(path.join(cwd, 'pages', 'api'))) return true;    // Next (pages)
    if (fs.existsSync(path.join(cwd, 'app', 'api'))) return true;      // Next (app)
    try {
      // WordPress / plain PHP: look for REST route registration at the top of the tree
      const out = execSync(
        "grep -rl --include='*.php' -e 'register_rest_route' -e 'rest_api_init' . 2>/dev/null | head -1",
        { cwd, encoding: 'utf8', timeout: 4000 }
      );
      return out.trim().length > 0;
    } catch (_) { return false; }
  }

  const tests = [];
  if (backend > 0) {
    tests.push('tester-code');
    if (hasApiSurface()) tests.push('tester-api');
  }
  if (frontend > 0) tests.push('tester-ui-ux');
  if (db > 0) tests.push('query-debugger');
  if (backend + frontend > 3) tests.push('tester-security');

  // --- Brake 3: refusal memory (do not ask twice for the same thing) ------------
  // The hook does not see the model's answer; what it does see is having ALREADY recommended this
  // set in this session. A repeated recommendation = a repeated refusal. Once per session (and never
  // before MEMO_TTL_MIN) is enough — the queue is cleared anyway, so the signal does not pile up.
  const assinatura = tests.join(' ');
  let repetido = false;
  if (assinatura) {
    let memo = {};
    try { memo = JSON.parse(fs.readFileSync(memoFile, 'utf8')); } catch (_) { memo = {}; }
    const idade = Date.now() - (Date.parse(memo.ts || '') || 0);
    repetido = memo.assinatura === assinatura
      && (memo.session === sessionId || idade < MEMO_TTL_MIN * 60 * 1000);
    if (!repetido) {
      try {
        fs.mkdirSync(jocaDir, { recursive: true });
        fs.writeFileSync(memoFile, JSON.stringify(
          { session: sessionId, assinatura, ts: new Date().toISOString() }, null, 2
        ));
      } catch (_) { /* best-effort */ }
    }
  }

  if (assinatura && !repetido) {
    const counted = ficheirosContados.size;
    const limpos = ficheirosLimpos.size;
    console.log(
      `AUTO-TEST: ${counted} relevant files (${backend} backend, ${frontend} frontend, ${db} db` +
      `${trivial ? `; ${trivial} trivial ones ignored` : ''}` +
      `${limpos ? `; ${limpos} with no changes in the working tree` : ''}). Recommended: ${tests.join(' ')}\n` +
      `This is a RECOMMENDATION, not a block. Finish in one line (dispatching nothing) if: you have ` +
      `already run these testers in this session · the changes do not justify them · or the session ` +
      `forbids dispatching agents. The queue has already been cleared and the same set will not be asked for again.`
    );
  }

  // The queue is ALWAYS cleared once the hook gets here, even with no recommendation. Without this the
  // same set of changes fires again at the end of every following turn.
  fs.writeFileSync(queueFile, '');
  process.exit(0);
} catch (_) {
  process.exit(0); // fail-open
}
