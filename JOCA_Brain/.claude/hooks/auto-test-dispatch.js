#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const queueFile = path.join(repoRoot, '.joca', 'test-queue.jsonl');

if (!fs.existsSync(queueFile)) process.exit(0);
const content = fs.readFileSync(queueFile, 'utf8').trim();
if (!content) process.exit(0);

const lines = content.split('\n').filter(Boolean);
let backend = 0, frontend = 0, style = 0, db = 0, trivial = 0;

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.domain === 'backend') backend++;
    else if (entry.domain === 'frontend') frontend++;
    else if (entry.domain === 'style') style++;
    else if (entry.domain === 'database') db++;
    else if (entry.domain === 'trivial') trivial++;
  } catch {}
}

// Só recomendar tester-api se o projecto TIVER API. Um WordPress sem um único
// endpoint estava a receber "corre tester-api" a cada bump de constante.
function hasApiSurface() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'routes'))) return true;          // Laravel
  if (fs.existsSync(path.join(cwd, 'pages', 'api'))) return true;    // Next (pages)
  if (fs.existsSync(path.join(cwd, 'app', 'api'))) return true;      // Next (app)
  try {
    // WordPress / PHP puro: procurar registo de rotas REST no topo da árvore
    const out = require('child_process').execSync(
      "grep -rl --include='*.php' -e 'register_rest_route' -e 'rest_api_init' . 2>/dev/null | head -1",
      { cwd, encoding: 'utf8', timeout: 4000 }
    );
    return out.trim().length > 0;
  } catch { return false; }
}

const tests = [];
if (backend > 0) {
  tests.push('tester-code');
  if (hasApiSurface()) tests.push('tester-api');
}
if (frontend > 0) tests.push('tester-ui-ux');
if (db > 0) tests.push('query-debugger');
if (backend + frontend > 3) tests.push('tester-security');

if (tests.length > 0) {
  const counted = backend + frontend + style + db;
  console.log(
    `AUTO-TEST: ${counted} ficheiros relevantes (${backend} backend, ${frontend} frontend, ${db} db` +
    `${trivial ? `; ${trivial} triviais ignorados` : ''}). Recomendado: ${tests.join(' ')}\n` +
    `Isto é uma RECOMENDAÇÃO, não um bloqueio: se já correste estes testers nesta sessão, ou se as ` +
    `alterações não os justificam, diz numa linha porquê e termina — a fila já foi limpa.`
  );
}

// A fila limpa-se SEMPRE, mesmo quando nada foi recomendado. Sem isto o mesmo
// conjunto de alterações volta a disparar no fim de cada turno seguinte.
fs.writeFileSync(queueFile, '');
