#!/usr/bin/env node
// Stop hook — lê a fila de alterações e RECOMENDA testers. Nunca bloqueia o turno.
//
// Histórico: em versões anteriores disparava a CADA Stop, com a mesma recomendação, sem olhar ao
// que mudou nem a trabalho em curso. Medido em feedback real: 6 a 9 recusas por sessão, sempre a
// mesma, e um caso de loop (o modelo respondeu a recusa fundamentada 3x e o hook repetiu 3x).
// Quatro travões, por esta ordem:
//   1. TRABALHO EM CURSO — contrato `.joca/loop.json` com passos por fechar → cala-se e NÃO limpa a
//      fila (auditar ficheiros a meio de escrita por outro agente dá achados falsos);
//   2. O QUE MUDOU — a fila é cruzada com `git status --porcelain`: ficheiro apagado entretanto,
//      ou já limpo (commitado/revertido), sai da contagem. Fail-open: sem git, conta tudo;
//   3. MEMÓRIA DE RECUSA — mesmo conjunto de testers já recomendado nesta sessão (ou nos últimos
//      15 min) → silêncio, fila limpa à mesma. Não se pede duas vezes o mesmo;
//   4. SAÍDAS EXPLÍCITAS na mensagem — incluindo "a sessão proíbe despachar agentes", que existe
//      como directiva de sistema e não estava no vocabulário do hook.
// Fail-open: qualquer erro → exit 0 silencioso. Um hook que rebenta não pode travar a sessão.
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
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { /* sem stdin */ }
  const sessionId = payload.session_id || 'sem-sessao';
  const cwd = payload.cwd || process.cwd();

  if (!fs.existsSync(queueFile)) process.exit(0);
  const content = fs.readFileSync(queueFile, 'utf8').trim();
  if (!content) process.exit(0);

  // --- Travão 1: trabalho por fechar (agentes/passos vivos) --------------------
  // O contrato `.joca/loop.json` é o marcador em disco de trabalho multi-passo em curso
  // (escrito pelo main loop, lido pelo stop-continuar.js). Enquanto houver passos por
  // verificar, os ficheiros estão a meio de escrita — recomendar testers agora é ruído.
  // A fila NÃO se limpa: a recomendação sobrevive para quando o contrato fechar.
  for (const dir of [path.join(cwd, '.joca'), jocaDir]) {
    const loopFile = path.join(dir, 'loop.json');
    if (!fs.existsSync(loopFile)) continue;
    try {
      const loop = JSON.parse(fs.readFileSync(loopFile, 'utf8'));
      const passos = Array.isArray(loop.passos) ? loop.passos : [];
      if (passos.some((p) => p.estado !== 'verificado')) process.exit(0);
    } catch (_) { /* contrato ilegível — não suprime */ }
  }

  // --- Travão 2: ler o que MUDOU, não o que foi tocado -------------------------
  // `git status --porcelain` no cwd, com prefix-match (dirs untracked/ignored vêm colapsados).
  // Ficheiro dentro do repo e ausente da lista = limpo → não conta. Fora do repo, ou sem git,
  // conta (fail-open — melhor recomendar a mais do que calar um sinal verdadeiro).
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
    if (!fs.existsSync(abs)) return false;           // criado e apagado no mesmo turno
    if (!toplevel || !mudados) return true;          // sem git → fail-open
    const rel = path.relative(toplevel, abs).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) return true; // fora deste repo
    return mudados.some((m) => rel === m || rel.startsWith(m.endsWith('/') ? m : m + '/'));
  }

  const lines = content.split('\n').filter(Boolean);
  let backend = 0, frontend = 0, style = 0, db = 0, trivial = 0;
  // Dedup pelo par ficheiro+DOMÍNIO, não pelo ficheiro sozinho: o mesmo ficheiro pode
  // entrar na fila como `frontend` e como `backend` (um blade com JS, um .vue com API),
  // e deduplicar antes de acumular o domínio deitava o segundo fora — o auditor viu
  // "0 backend, 1 frontend" onde deviam ser os dois. O objectivo do dedup continua a
  // ser "mesmo ficheiro editado N vezes = 1", e isso mantém-se dentro de cada domínio.
  const vistos = new Set();
  const ficheirosLimpos = new Set();                  // contados uma vez por ficheiro
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
      ficheirosContados.add(file);   // a mensagem fala de FICHEIROS: 1 ficheiro em 2 domínios = 1
    }
    if (entry.domain === 'backend') backend++;
    else if (entry.domain === 'frontend') frontend++;
    else if (entry.domain === 'style') style++;
    else if (entry.domain === 'database') db++;
    else if (entry.domain === 'trivial') trivial++;
  }

  // Só recomendar tester-api se o projecto TIVER API. Um WordPress sem um único
  // endpoint estava a receber "corre tester-api" a cada bump de constante.
  function hasApiSurface() {
    if (fs.existsSync(path.join(cwd, 'routes'))) return true;          // Laravel
    if (fs.existsSync(path.join(cwd, 'pages', 'api'))) return true;    // Next (pages)
    if (fs.existsSync(path.join(cwd, 'app', 'api'))) return true;      // Next (app)
    try {
      // WordPress / PHP puro: procurar registo de rotas REST no topo da árvore
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

  // --- Travão 3: memória de recusa (não pedir duas vezes o mesmo) ---------------
  // O hook não vê a resposta do modelo; o que vê é ter JÁ recomendado este conjunto nesta
  // sessão. Recomendação repetida = recusa repetida. Uma vez por sessão (e nunca antes de
  // MEMO_TTL_MIN) chega — a fila limpa-se à mesma, portanto o sinal não se acumula.
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
      `AUTO-TEST: ${counted} ficheiros relevantes (${backend} backend, ${frontend} frontend, ${db} db` +
      `${trivial ? `; ${trivial} triviais ignorados` : ''}` +
      `${limpos ? `; ${limpos} sem alterações no working tree` : ''}). Recomendado: ${tests.join(' ')}\n` +
      `Isto é uma RECOMENDAÇÃO, não um bloqueio. Termina numa linha (sem despachar nada) se: já ` +
      `correste estes testers nesta sessão · as alterações não os justificam · ou a sessão proíbe ` +
      `despachar agentes. A fila já foi limpa e o mesmo conjunto não volta a ser pedido.`
    );
  }

  // A fila limpa-se SEMPRE que o hook chega aqui, mesmo sem recomendação. Sem isto o mesmo
  // conjunto de alterações volta a disparar no fim de cada turno seguinte.
  fs.writeFileSync(queueFile, '');
  process.exit(0);
} catch (_) {
  process.exit(0); // fail-open
}
