#!/usr/bin/env node
// PreToolUse(Bash|PowerShell) hook — recusa `git add -A` / `--all` / `.` / `:/` com agentes vivos.
// Porquê: com workers a escrever, o stage em massa apanha ficheiros a meio de escrita de outro
// agente (regra dura em rules/orchestration-patterns.md; casos em reference/orquestracao-casos.md).
// "Agentes vivos" = (a) o próprio comando vem de um subagente (`agent_id` no input do hook), ou
// (b) na sessão principal, algum transcript `<sessão>/subagents/agent-*.jsonl` foi escrito há
// < JANELA_MS. O layout (b) não é documentado: medido no Claude Code 2.1.272 (verificado 2026-09-15).
// Fail-OPEN: qualquer erro ou input inesperado → deixa passar. `git add <caminho>` passa sempre.
//
// T164 — também recusa `git commit` SEM `--only` e sem caminhos quando o índice tem entradas staged
// que esta sessão não adicionou (ex.: deleção deixada staged por outra sessão, que o commit levava).
// "Adicionou" = (1) caminhos de `git add|rm|mv|update-index` no próprio comando ou em comandos
// anteriores desta sessão, e (2) o que um comando desses pôs no índice e o texto não diz (ex.:
// `git update-index --chmod=+x "$f"` num ciclo de um script de sincronização): antes do comando guarda-se o
// índice; no comando seguinte, o que entrou entretanto conta como desta sessão. Estado em
// <tmp>/joca-guard-git-add/<session_id>.txt (+ .pendente.json); `JOCA_GUARD_GIT_DIR` muda a pasta.
// Sintaxe Bash e PowerShell (`;`, `&&`, `cd`/`Set-Location`/`Push-Location`, `git -C`, aspas).
// `git commit <caminhos>` / `--only` passam sempre; merge/rebase/cherry-pick/revert em curso também.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const JANELA_MS = 120 * 1000;

let aRegistar = null; // regista os caminhos staged por esta sessão só se o comando passar
function allow() { if (aRegistar) aRegistar(); process.exit(0); }

// Um segmento de comando (separado por ; && || |) que é `git [-C x] add ...` com stage em massa.
function stageEmMassa(cmd) {
  // Texto entre aspas não é comando (ex.: um teste que cita `git add --all` numa string) — tirar antes de partir.
  const semAspas = cmd.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const seg of semAspas.split(/;|&&|\|\||\|/)) {
    const m = seg.match(/\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*add\b(.*)$/);
    if (!m) continue;
    const args = m[1].trim().split(/\s+/).filter(Boolean);
    for (const a of args) {
      if (a === '--') break;
      if (a === '--all' || a === '.' || a === './' || a === ':/' || /^-[a-zA-Z]*A[a-zA-Z]*$/.test(a)) return a;
    }
  }
  return null;
}

// Caminho estilo Git Bash (/c/Users/…) → Windows (c:/Users/…).
const conv = (p) => (process.platform === 'win32' ? String(p).replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:') : String(p));
// Partição sensível a aspas: segmentos (; && || | e mudança de linha fora de aspas) → tokens sem aspas.
// Texto entre aspas é UM token (`echo "git commit -m x"` não é um git). Escapes: Bash → `\` (fora de
// aspas, e dentro de "…" só antes de $ ` " \); PowerShell → backtick; `\` é literal (C:\Users).
function segmentos(cmd, ps) {
  const segs = []; let toks = []; let tok = null; let q = '';
  const fecha = () => { if (tok !== null) toks.push(tok); tok = null; };
  const corta = () => { fecha(); if (toks.length) segs.push(toks); toks = []; };
  const esc = ps ? '`' : '\\';
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) q = '';
      else if (q === '"' && c === esc && i + 1 < cmd.length && (ps || '$`"\\\n'.includes(cmd[i + 1]))) tok += cmd[++i];
      else tok += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; if (tok === null) tok = ''; continue; }
    if (c === esc && i + 1 < cmd.length) { tok = (tok || '') + cmd[++i]; continue; }
    if (c === ';' || c === '\n' || c === '\r' || c === '|' || (c === '&' && cmd[i + 1] === '&')) { if ((c === '|' || c === '&') && cmd[i + 1] === c) i++; corta(); continue; }
    if (/\s/.test(c)) { fecha(); continue; }
    tok = (tok || '') + c;
  }
  corta();
  return segs;
}
const CD = /^(?:cd|chdir|pushd|set-location|sl|push-location)$/i;
// Segmentos `git [-C dir] <sub> args` → [{ sub, dir (absoluto), args }], seguindo os `cd <dir>`
// anteriores do mesmo comando (relativos, absolutos, Git Bash, com aspas, PowerShell).
function gitSegs(cmd, cwd, ps) {
  const out = []; let cur = cwd;
  for (const t of segmentos(cmd, ps)) {
    while (t.length && (/^[A-Za-z_]\w*=/.test(t[0]) || t[0] === '&')) t.shift(); // VAR=x git … · & git …
    if (t.length && CD.test(t[0])) {
      const a = t.slice(1).filter((x) => !/^-(?:path|literalpath)$/i.test(x))[0];
      cur = a && a !== '-' ? path.resolve(cur, conv(a === '~' ? os.homedir() : a.replace(/^~(?=[\\/])/, os.homedir()))) : (a ? cur : os.homedir());
      continue;
    }
    if (!t.length || !/^git(?:\.exe)?$/i.test(t[0])) continue;
    let j = 1; let dir = cur;
    while (j < t.length && (t[j] === '-C' || t[j] === '-c')) { if (t[j] === '-C' && t[j + 1]) dir = path.resolve(dir, conv(t[j + 1])); j += 2; }
    if (j < t.length) out.push({ sub: t[j], dir, args: t.slice(j + 1) });
  }
  return out;
}
const MUDA_INDICE = new Set(['add', 'rm', 'mv', 'update-index']);
// Caminhos que um `git add|rm|mv|update-index` põe no índice (absolutos). Stage em massa → raiz/cwd.
function caminhosAdicionados(g, raiz) {
  const base = g.dir;
  const res = []; let fim = false;
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (!fim && a === '--') { fim = true; continue; }
    if (!fim && g.sub === 'update-index' && a === '--cacheinfo') {
      const v = g.args[i + 1] || '';
      if (v.split(',').length >= 3) { res.push(path.resolve(base, conv(v.split(',').slice(2).join(',')))); i += 1; } else { if (g.args[i + 3]) res.push(path.resolve(base, conv(g.args[i + 3]))); i += 3; }
      continue;
    }
    if (!fim && /^-/.test(a)) {
      if (g.sub === 'add' && (a === '--all' || a === '-u' || a === '--update' || /^-[a-zA-Z]*[Au][a-zA-Z]*$/.test(a))) res.push(raiz || base);
      continue;
    }
    if (a === ':/') { res.push(raiz || base); continue; }
    if (!a) continue;
    res.push(path.resolve(base, conv(a)));
  }
  return res;
}
// Caminhos postos no índice por ref — `git checkout <ref> -- <p>`, `git reset <ref> -- <p>` e `git restore --source=<ref> --staged <p>`
// também põem <p> no índice. Só caminhos explícitos: sem `--` (checkout/reset), sem ref ou sem
// --staged não regista nada — o alcance não se sabe pelo texto.
function caminhosDeRef(g) {
  const res = [];
  if (g.sub === 'restore') {
    let fonte = false; let staged = false; let fim = false;
    for (let i = 0; i < g.args.length; i++) {
      const a = g.args[i];
      if (!fim && a === '--') { fim = true; continue; }
      if (!fim && (a === '--source' || a === '-s')) { fonte = Boolean(g.args[++i]); continue; }
      if (!fim && /^(?:--source=|-s)./.test(a)) { fonte = true; continue; }
      if (!fim && a === '--staged') { staged = true; continue; }
      if (!fim && /^-[a-zA-Z]+$/.test(a)) { if (a.includes('S')) staged = true; continue; }
      if (!fim && a.startsWith('-')) continue;
      if (a) res.push(path.resolve(g.dir, conv(a)));
    }
    return fonte && staged ? res : [];
  }
  const sep = g.args.indexOf('--');
  if (sep < 1 || !g.args.slice(0, sep).some((a) => a && !a.startsWith('-'))) return [];
  return g.args.slice(sep + 1).filter(Boolean).map((a) => path.resolve(g.dir, conv(a)));
}
// `git commit` que leva o índice inteiro (sem --only e sem caminhos)? Devolve true.
function commitDoIndice(g) {
  const comValor = new Set(['-m', '-F', '-C', '-c', '-t', '--author', '--date', '--template', '--cleanup', '--fixup', '--squash', '--trailer', '--message', '--file', '--reuse-message', '--reedit-message']);
  let fim = false;
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (!fim && a === '--') { fim = true; continue; }
    if (!fim && (a === '--only' || a === '-o' || /^-[a-zA-Z]*o[a-zA-Z]*$/.test(a) && !/^--/.test(a))) return false;
    if (!fim && a.startsWith('--')) { if (comValor.has(a)) i++; continue; }
    if (!fim && a.startsWith('-') && a.length > 1) { if (/[mFCct]$/.test(a)) i++; continue; }
    if (!a) continue;
    return false; // caminho → git commit <caminhos> é --only implícito
  }
  return true;
}
const normP = (p) => { const r = path.resolve(p).replace(/\\/g, '/'); return process.platform === 'win32' ? r.toLowerCase() : r; };
const dentro = (p, d) => p === d || p.startsWith(d.endsWith('/') ? d : d + '/');
function estadoFile(sid, ext = '.txt') {
  const dir = process.env.JOCA_GUARD_GIT_DIR || path.join(os.tmpdir(), 'joca-guard-git-add');
  return path.join(dir, `${/^[A-Za-z0-9_-]{1,128}$/.test(sid || '') ? sid : 'sem-sessao'}${ext}`);
}
function lerAdicionados(sid) { try { return fs.readFileSync(estadoFile(sid), 'utf8').split('\n').filter(Boolean); } catch (_) { return []; } }
function registar(sid, caminhos) {
  if (!caminhos.length) return;
  try { const f = estadoFile(sid); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, caminhos.map(normP).join('\n') + '\n'); } catch (_) {}
}
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
// Índice actual de um repo como caminhos absolutos normalizados (+ raiz e git-dir).
function indice(dir) {
  const [raiz, gitDir] = git(dir, ['rev-parse', '--show-toplevel', '--absolute-git-dir']).trim().split(/\r?\n/);
  const staged = git(dir, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean).map((n) => normP(path.join(raiz, n)));
  return { raiz, gitDir, staged };
}
// Fotografias do índice pendentes (tiradas antes de um comando que mexeu no índice): o que entrou
// desde então foi esse comando → conta como desta sessão. Resolve-se no comando seguinte.
function resolverPendentes(sid) {
  const f = estadoFile(sid, '.pendente.json');
  let pend; try { pend = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return; }
  try { fs.unlinkSync(f); } catch (_) {}
  for (const p of Array.isArray(pend) ? pend : []) {
    try { const antes = new Set(p.antes); registar(sid, indice(p.dir).staged.filter((s) => !antes.has(s))); } catch (_) {}
  }
}
function guardarPendentes(sid, fotos) {
  if (!fotos.length) return;
  try { const f = estadoFile(sid, '.pendente.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(fotos)); } catch (_) {}
}
// Entradas staged que ninguém desta sessão adicionou → lista de caminhos relativos (vazia = passa).
function stagedAlheios(g, adicionados) {
  const { raiz, gitDir, staged } = indice(g.dir);
  for (const e of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
    if (fs.existsSync(path.join(gitDir, e))) return [];
  }
  const cobertos = adicionados.map(normP);
  const r = normP(raiz);
  return staged.filter((s) => !cobertos.some((c) => dentro(s, c))).map((s) => s.slice(r.length + 1));
}

function subagenteRecente(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return false;
  const dir = path.join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents');
  let nomes;
  try { nomes = fs.readdirSync(dir); } catch (_) { return false; }
  const agora = Date.now();
  return nomes.some((n) => {
    if (!/^agent-.*\.jsonl$/.test(n)) return false;
    try { return agora - fs.statSync(path.join(dir, n)).mtimeMs < JANELA_MS; } catch (_) { return false; }
  });
}

try {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { allow(); }
  if (!raw) allow();
  const input = JSON.parse(raw);
  const cmd = input && input.tool_input && input.tool_input.command;
  if (!cmd || typeof cmd !== 'string') allow();

  // T164: regista o que a sessão põe no índice e trava o commit que levaria o resto.
  try {
    const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
    const sid = input.session_id;
    const ps = /powershell/i.test(input.tool_name || '');
    resolverPendentes(sid);
    const segs = gitSegs(cmd, cwd, ps);
    const novos = [];
    const fotos = [];
    for (const g of segs) {
      if (MUDA_INDICE.has(g.sub)) {
        let raiz = '';
        try {
          const ind = indice(g.dir); raiz = ind.raiz;
          if (!fotos.some((f) => f.dir === g.dir)) fotos.push({ dir: g.dir, antes: ind.staged });
        } catch (_) {}
        novos.push(...caminhosAdicionados(g, raiz));
      }
      if (g.sub === 'checkout' || g.sub === 'restore' || g.sub === 'reset') novos.push(...caminhosDeRef(g));
      if (g.sub === 'commit' && commitDoIndice(g)) {
        const alheios = stagedAlheios(g, [...lerAdicionados(sid), ...novos]);
        if (alheios.length) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason:
                `[guard-git-add] \`git commit\` sem \`--only\` recusado: o índice tem ${alheios.length} entrada(s) staged que `
                + `esta sessão não adicionou (${alheios.slice(0, 8).join(', ')}${alheios.length > 8 ? ', …' : ''}) — o commit levava-as.\n`
                + 'Usa `git commit --only <caminhos> -m …` só com os teus ficheiros (rules/task-intake.md §Segurança).',
            },
          }));
          process.exit(0);
        }
      }
    }
    aRegistar = () => { registar(sid, novos); guardarPendentes(sid, fotos); };
  } catch (_) { /* fail-open */ }

  const flag = stageEmMassa(cmd);
  if (!flag) allow();

  const deSubagente = Boolean(input.agent_id);
  if (!deSubagente && !subagenteRecente(input.transcript_path)) allow();

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[guard-git-add] \`git add ${flag}\` recusado: ` +
        (deSubagente ? 'o comando vem de um subagente' : 'há subagentes activos nesta sessão (transcript escrito há < 2 min)') +
        '. O stage em massa apanha ficheiros a meio de escrita de outro agente.\n' +
        'Faz `git add <caminho> <caminho>` só com os ficheiros que tu escreveste (`git status --porcelain` para os ver).',
    },
  }));
  process.exit(0);
} catch (_) {
  allow();
}
