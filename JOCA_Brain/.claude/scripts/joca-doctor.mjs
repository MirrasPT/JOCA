#!/usr/bin/env node
// joca-doctor.mjs — diagnóstico do JOCA. Node ESM, zero dependências npm.
//
// Uso:
//   node .claude/scripts/joca-doctor.mjs             # só diagnóstico
//   node .claude/scripts/joca-doctor.mjs --fix       # aplica correcções seguras
//   node .claude/scripts/joca-doctor.mjs --promises  # + auditoria heurística description-vs-corpo
//
// Exit code: 0 = sem erros (warnings ok) · 1 = pelo menos um erro (✗).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Memória de projectos em pastas (`<slug>/index.md`), lida pelo lib — fonte única, também dos limites
// (§7). Sem o lib (instalação parcial) o doctor não cai: avisa e salta o que dependia dele.
const memoria = (() => {
  try { return createRequire(import.meta.url)('./lib/memoria-projecto.cjs'); } catch { return null; }
})();
const listarFichas = (dir) => (memoria ? memoria.listarProjectos(dir) : []);
const ficheirosFicha = (nome, dir) => (memoria ? memoria.ficheirosDoProjecto(nome, {}, dir) : []);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(SCRIPT_DIR, '..', '..');          // JOCA_Brain/
const ROOT = path.dirname(BRAIN);                             // raiz do repo JOCA/
const OS_DIR = path.join(ROOT, 'JOCA_OS');
const FIX = process.argv.includes('--fix');
const PROMISES = process.argv.includes('--promises');
const IS_WIN = process.platform === 'win32';

let nOk = 0, nWarn = 0, nErr = 0;
const ok = (msg) => { nOk++; console.log(`  ✓ ${msg}`); };
const warn = (msg) => { nWarn++; console.log(`  ⚠ ${msg}`); };
const err = (msg) => { nErr++; console.log(`  ✗ ${msg}`); };
const section = (title) => console.log(`\n${title}`);

function run(cmd, args, opts = {}) {
  try {
    return spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000, ...opts });
  } catch {
    return { status: -1, stdout: '', stderr: '' };
  }
}

function whichCli(name) {
  const r = run(IS_WIN ? 'where' : 'which', [name]);
  return r.status === 0 && r.stdout && r.stdout.trim() ? r.stdout.trim().split(/\r?\n/)[0] : null;
}

function listMd(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }
}

function walkMd(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function readUtf8(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

// Compara CONTEÚDO fonte↔espelho, para desarmar o falso positivo do mtime (ver secção 5).
// Devolve a lista de basenames que divergem. Só compara o que é comparável: espelhos `.md`
// (mesmo corpo, sem a 1ª linha, que o compilador reescreve). Se o espelho for de outro formato
// — os `.toml` do Codex são gerados, não copiados — devolve `null` = "não comparável", e quem
// chama mantém o aviso do mtime em vez de fingir que verificou.
function conteudoDivergente(srcDir, dstDir) {
  let fontes;
  try { fontes = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md')); } catch { return null; }
  const corpo = (p) => { const t = readUtf8(p); return t == null ? null : t.replace(/\r\n/g, '\n').split('\n').slice(1).join('\n').trim(); };
  const difs = [];
  for (const f of fontes) {
    const espelho = path.join(dstDir, f);
    if (!fs.existsSync(espelho)) {
      if (!fs.existsSync(path.join(dstDir, f.replace(/\.md$/, '.toml')))) { difs.push(f); continue; }
      return null;                                   // espelho noutro formato → não comparável
    }
    const a = corpo(path.join(srcDir, f)); const b = corpo(espelho);
    if (a == null || b == null || a !== b) difs.push(f);
  }
  return difs;
}

function newestMtime(dir, exts) {
  let newest = 0;
  let stack;
  try { stack = [dir]; fs.readdirSync(dir); } catch { return null; }
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (!exts || exts.some((x) => e.name.endsWith(x))) {
        try { newest = Math.max(newest, fs.statSync(p).mtimeMs); } catch { /* ignore */ }
      }
    }
  }
  return newest || null;
}

// ── 1. Runtimes ───────────────────────────────────────────────────────────────
section('1. Runtimes');

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor >= 18) ok(`Node ${process.version} (>= 18)`);
else err(`Node ${process.version} — JOCA precisa de Node >= 18. Actualiza em https://nodejs.org`);

let pythonCmd = null;
for (const cand of IS_WIN ? ['python', 'python3'] : ['python3', 'python']) {
  const r = run(cand, ['--version']);
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status === 0 && /Python 3/.test(out)) { pythonCmd = cand; ok(`${cand} disponível (${out})`); break; }
}
if (!pythonCmd) {
  warn('Python 3 não encontrado — build-skill-index.py indisponível. Instala Python 3.10+.');
}
if (IS_WIN) {
  warn('Windows: usa sempre `python`, não `python3` — o `python3` é o stub vazio da Microsoft Store (sem os teus pacotes).');
}

// ── 2. CLIs (informativo) ─────────────────────────────────────────────────────
section('2. CLIs no PATH');

for (const [cli, note] of [
  ['claude', 'obrigatório para usar o JOCA'],
  ['codex', 'opcional — bridge Codex (.codex/agents/)'],
  ['agy', 'opcional — bridge Antigravity/Gemini (GEMINI.md)'],
]) {
  const p = whichCli(cli);
  if (p) ok(`${cli} → ${p}`);
  else warn(`${cli} não está no PATH (${note}).`);
}

// ── 3. settings.json + hooks ──────────────────────────────────────────────────
section('3. .claude/settings.json + hooks');

const settingsPath = path.join(BRAIN, '.claude', 'settings.json');
let settings = null;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  ok('settings.json é JSON válido');
} catch (e) {
  err(`settings.json inválido ou em falta (${e.message}). Repara o JSON ou corre o /install.`);
}

if (settings) {
  const commands = [];
  for (const group of Object.values(settings.hooks || {})) {
    for (const entry of Array.isArray(group) ? group : []) {
      for (const h of entry.hooks || []) if (h.command) commands.push(h.command);
    }
  }
  const withPlaceholder = commands.filter((c) => c.includes('<JOCA_ROOT>'));
  if (withPlaceholder.length) {
    err(`${withPlaceholder.length} hook(s) ainda com placeholder <JOCA_ROOT> não substituído — os hooks NÃO vão correr. Corre o /install (ou substitui <JOCA_ROOT> pelo caminho real: ${ROOT}).`);
  } else if (commands.length) {
    ok('Sem placeholders <JOCA_ROOT> por substituir');
  }

  // Existência dos ficheiros referenciados (resolvendo o placeholder para validar o disco)
  let missing = [];
  let checked = 0;
  for (const c of commands) {
    for (const m of c.matchAll(/"([^"]+)"/g)) {
      const raw = m[1];
      if (raw.startsWith('$')) continue; // variáveis tipo $TOOL_INPUT_FILE_PATH
      if (!/\.(js|mjs|cjs|sh|py)$/.test(raw)) continue;
      const resolved = raw.replaceAll('<JOCA_ROOT>', ROOT);
      checked++;
      if (!fs.existsSync(resolved)) missing.push(raw);
    }
  }
  missing = [...new Set(missing)];
  if (missing.length) err(`Hooks referenciam ficheiros inexistentes: ${missing.join(', ')}`);
  else if (checked) ok(`${checked} referência(s) de hooks existem no disco`);
}

// ── 3b. Output style: ficheiro instalado E ligado nas settings da máquina ─────
// 2026-09-17: uma instalação respondeu em inglês durante dois dias. A única regra de língua vivia no
// output style do JOCA — que nessa máquina nunca esteve ligado (sem `outputStyle` nas settings) — e uma
// auditoria feita noutra máquina deu-o como activo. Uma instrução que só vive num output style não vale
// nada se o `outputStyle` não estiver nas settings DESTA máquina: as duas metades verificam-se aqui.
// ⚠ O `~/.claude/settings.json` pode conter chaves. Lê-se com JSON.parse e reporta-se apenas
// {campo, presente} — nunca o conteúdo do ficheiro, nem o valor de campo nenhum (o `outputStyle`
// compara-se em memória com o nome do estilo canónico e sai daqui como sim/não).
section('3b. Output style (ficheiro instalado + ligado nas settings da máquina)');

{
  const HOME_CLAUDE = path.join(os.homedir(), '.claude');
  const estilosCanon = listMd(path.join(BRAIN, '.claude', 'output-styles')) || [];
  const estilosHome = listMd(path.join(HOME_CLAUDE, 'output-styles'));

  // Instalação sem output style próprio (.claude/output-styles/ vazio ou ausente): nada a exigir —
  // a regra de língua vive no ~/CLAUDE.md (/install, secção 7c).
  if (!estilosCanon.length) {
    ok('sem output style do JOCA nesta instalação (.claude/output-styles/ vazio) — secção não se aplica');
  } else {
  // Metade 1: o ficheiro do estilo existe em ~/.claude/output-styles/.
  if (estilosHome == null) {
    warn(`~/.claude/output-styles/ não existe — nenhum output style instalado nesta máquina. Copia .claude/output-styles/*.md para lá (o /install faz isso).`);
  } else {
    const emFalta = estilosCanon.filter((f) => !estilosHome.includes(f));
    if (emFalta.length) {
      warn(`output style(s) do JOCA por instalar em ~/.claude/output-styles/: ${emFalta.join(', ')} — copia de .claude/output-styles/ (o /install faz isso).`);
    } else if (estilosCanon.length) {
      ok(`${estilosCanon.length} output style(s) do JOCA instalado(s) em ~/.claude/output-styles/`);
    }
  }

  // Metade 2: o `outputStyle` está ligado nas settings do utilizador, e é o do JOCA.
  // Nomes aceites: o basename do ficheiro canónico (`joca`) e o `name:` do frontmatter (`JOCA`).
  const nomesCanon = new Set();
  for (const f of estilosCanon) {
    nomesCanon.add(f.slice(0, -3).toLowerCase());
    const t = readUtf8(path.join(BRAIN, '.claude', 'output-styles', f));
    const m = t && t.match(/^name:[ \t]*(.+)$/m);
    if (m) nomesCanon.add(m[1].trim().replace(/^["']|["']$/g, '').toLowerCase());
  }
  const userSettingsPath = path.join(HOME_CLAUDE, 'settings.json');
  let userSettings = null;
  try {
    userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
  } catch (e) {
    warn(`~/.claude/settings.json ilegível ou inválido (${e.message}) — não dá para confirmar se o output style está ligado.`);
  }
  if (userSettings) {
    const presente = Object.prototype.hasOwnProperty.call(userSettings, 'outputStyle')
      && typeof userSettings.outputStyle === 'string' && userSettings.outputStyle.trim() !== '';
    if (!presente) {
      err('~/.claude/settings.json: {campo: outputStyle, presente: não} — nenhum output style ligado nesta máquina. Tudo o que só vive no output style (regra de língua incluída) NÃO se aplica. Liga-o: /output-style, ou corre o /install.');
    } else {
      const valor = userSettings.outputStyle.trim().replace(/\.md$/i, '').toLowerCase();
      if (nomesCanon.size && !nomesCanon.has(valor)) {
        warn(`~/.claude/settings.json: {campo: outputStyle, presente: sim}, mas o estilo ligado NÃO é o do JOCA (${[...nomesCanon].join('/')}) — a regra de língua do estilo do JOCA não se aplica. (O valor não se imprime: o ficheiro de settings pode ter chaves.)`);
      } else {
        ok('~/.claude/settings.json: {campo: outputStyle, presente: sim} e o estilo ligado é o do JOCA');
      }
    }
  }
  }
}

// ── 3c. Playwright MCP proibido (T134) ────────────────────────────────────────
// Removido «de vez» a 2026-08-05, reapareceu no Windows em DOIS scopes (user + local na home) e
// nada o detectou — o browser da casa é o Claude in Chrome. Procura-se em todos os scopes: user
// (`mcpServers` no topo do ~/.claude.json), local (`projects[<path>].mcpServers`) e projecto
// (`.mcp.json`). ⚠ O ~/.claude.json pode ter chaves: só se lêem NOMES de servidores, nunca valores.
section('3c. Playwright MCP (proibido em qualquer scope)');

{
  const PW = /playwright/i;
  const achados = [];
  const nomes = (obj) => (obj && typeof obj === 'object' ? Object.keys(obj).filter((k) => PW.test(k)) : []);
  const claudeJson = path.join(os.homedir(), '.claude.json');
  let lido = false;
  try {
    const cj = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
    lido = true;
    for (const k of nomes(cj.mcpServers)) achados.push(`user: ${k}`);
    for (const [proj, cfg] of Object.entries(cj.projects || {})) {
      for (const k of nomes(cfg && cfg.mcpServers)) achados.push(`local (${proj}): ${k}`);
    }
  } catch { /* sem ~/.claude.json legível — reportado abaixo */ }
  for (const d of [ROOT, BRAIN, os.homedir()]) {
    try {
      const mj = JSON.parse(fs.readFileSync(path.join(d, '.mcp.json'), 'utf8'));
      for (const k of nomes(mj.mcpServers)) achados.push(`projecto (${path.join(d, '.mcp.json')}): ${k}`);
    } catch { /* sem .mcp.json */ }
  }
  if (achados.length) err(`Playwright MCP instalado (${achados.length} scope(s)) — o browser da casa é o Claude in Chrome; remove com \`claude mcp remove <nome> -s <user|local|project>\`:\n${achados.map((a) => `      ${a}`).join('\n')}`);
  else if (!lido) warn('~/.claude.json ilegível ou em falta — scopes user/local do Playwright MCP não verificados.');
  else ok('sem Playwright MCP em nenhum scope (user · local · .mcp.json)');
}

// ── 4. Inventário vs índices ──────────────────────────────────────────────────
section('4. Inventário vs índices');

const skillsDir = path.join(BRAIN, '.claude', 'skills');
const agentsDir = path.join(BRAIN, '.claude', 'agents');
const commandsDir = path.join(BRAIN, '.claude', 'commands');
const skillFiles = listMd(skillsDir) || [];
const agentFiles = listMd(agentsDir) || [];
const commandFiles = listMd(commandsDir) || [];
console.log(`  disco: ${skillFiles.length} skills · ${agentFiles.length} agents · ${commandFiles.length} commands`);

const indexPath = path.join(BRAIN, 'memory', 'SKILL_INDEX.json');
let indexStale = false;
try {
  const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const counts = {};
  for (const e of idx) counts[e.type] = (counts[e.type] || 0) + 1;
  const idxSkills = counts.skill || 0;
  const idxAgents = counts.agent || 0;
  if (idxSkills === skillFiles.length && idxAgents === agentFiles.length) {
    ok(`SKILL_INDEX.json em sincronia (${idxSkills} skills, ${idxAgents} agents; commands não são indexados)`);
  } else {
    indexStale = true;
    warn(`SKILL_INDEX.json dessincronizado — índice: ${idxSkills} skills/${idxAgents} agents vs disco: ${skillFiles.length}/${agentFiles.length}. Corre: ${pythonCmd || 'python'} .claude/scripts/build-skill-index.py`);
  }
} catch (e) {
  err(`SKILL_INDEX.json ilegível (${e.message}). Regenera: ${pythonCmd || 'python'} .claude/scripts/build-skill-index.py`);
  indexStale = true;
}

if (FIX && indexStale && pythonCmd) {
  const r = run(pythonCmd, [path.join(BRAIN, '.claude', 'scripts', 'build-skill-index.py')], { cwd: BRAIN });
  if (r.status === 0) ok(`--fix: SKILL_INDEX.json regenerado (${(r.stdout || '').trim()})`);
  else err(`--fix: build-skill-index.py falhou: ${(r.stderr || '').trim()}`);
} else if (FIX && indexStale && !pythonCmd) {
  warn('--fix: não foi possível regenerar SKILL_INDEX.json — Python indisponível.');
}

// READMEs — contagens declaradas.
// São DOIS e ambos as declaram: o da raiz e o do JOCA_Brain. Verificar só um deixa o outro a
// envelhecer em silêncio (o do Brain esteve em 143/106 contra 150/109 reais).
for (const [readmePath, label] of [
  [path.join(ROOT, 'README.md'), 'README.md (raiz)'],
  [path.join(BRAIN, 'README.md'), 'JOCA_Brain/README.md'],
]) {
  const readme = readUtf8(readmePath);
  if (readme == null) { warn(`${label} não encontrado — contagens não verificadas.`); continue; }

  const problems = [];
  const compRe = /\*\*(\d+) componentes:\*\*\s*(\d+) skills \+ (\d+) agents \+ (\d+) commands/;
  const comp = readme.match(compRe);
  const realTotal = skillFiles.length + agentFiles.length + commandFiles.length;
  if (!comp) {
    warn(`${label}: linha "**N componentes:** X skills + Y agents + Z commands" não encontrada.`);
  } else if (+comp[1] !== realTotal || +comp[2] !== skillFiles.length || +comp[3] !== agentFiles.length || +comp[4] !== commandFiles.length) {
    problems.push(`linha componentes diz ${comp[1]} (${comp[2]}+${comp[3]}+${comp[4]}), real é ${realTotal} (${skillFiles.length}+${agentFiles.length}+${commandFiles.length})`);
  }
  const headers = [
    ['Skills', skillFiles.length],
    ['Agents', agentFiles.length],
    ['Commands', commandFiles.length],
  ];
  for (const [header, real] of headers) {
    const m = readme.match(new RegExp(`^## ${header} \\((\\d+)\\)`, 'm'));
    if (m && +m[1] !== real) problems.push(`header "## ${header} (${m[1]})" — real: ${real}`);
  }
  if (!problems.length) {
    ok(`${label}: contagens (componentes + headers) batem certo com o disco`);
  } else if (FIX) {
    let updated = readme;
    updated = updated.replace(compRe, `**${realTotal} componentes:** ${skillFiles.length} skills + ${agentFiles.length} agents + ${commandFiles.length} commands`);
    for (const [header, real] of headers) {
      updated = updated.replace(new RegExp(`^## ${header} \\(\\d+\\)`, 'm'), `## ${header} (${real})`);
    }
    fs.writeFileSync(readmePath, updated);
    ok(`--fix: ${label} actualizado (${problems.length} contagem(ns) corrigida(s))`);
  } else {
    warn(`${label} dessincronizado: ${problems.join('; ')}. Corre com --fix para corrigir.`);
  }
}

// ── 5. Bridges cross-CLI ──────────────────────────────────────────────────────
section('5. Bridges cross-CLI (.agents/ + .codex/)');

const TOL = 2000; // ms — tolerância para cópias no mesmo segundo
for (const [srcDir, dstDir, label] of [
  [skillsDir, path.join(BRAIN, '.agents', 'skills'), '.agents/skills/'],
  [agentsDir, path.join(BRAIN, '.codex', 'agents'), '.codex/agents/'],
]) {
  const srcM = newestMtime(srcDir, ['.md']);
  const dstM = newestMtime(dstDir, null);
  if (dstM == null) warn(`${label} não existe — bridge nunca compilada. Corre: bash .claude/scripts/compile-bridges.sh`);
  else if (srcM != null && srcM - dstM > TOL) {
    // O mtime é só uma SUSPEITA. O `compile-bridges.sh` não reescreve ficheiros cujo output não
    // muda, portanto qualquer edição da fonte que não altere o compilado (corrigir um typo no
    // corpo, mexer numa linha que o gerador não usa) deixa a fonte mais recente com o espelho
    // correcto — e o aviso saía por um não-defeito. Medido a 2026-08-20: 159/159 ficheiros
    // idênticos em conteúdo com o mtime a acusar stale. Confirmar antes de acusar.
    const difs = conteudoDivergente(srcDir, dstDir);
    if (difs === null) {
      warn(`${label} stale — fonte .claude/ é mais recente (${new Date(srcM).toISOString()} vs ${new Date(dstM).toISOString()}) e o espelho não é comparável por conteúdo (formato gerado). Corre: bash .claude/scripts/compile-bridges.sh`);
    } else if (difs.length) {
      warn(`${label} stale — ${difs.length} ficheiro(s) diferem do compilado (${difs.slice(0, 3).join(', ')}${difs.length > 3 ? '…' : ''}). Corre: bash .claude/scripts/compile-bridges.sh`);
    } else {
      ok(`${label} actualizada face à fonte (mtime mais recente, conteúdo idêntico — sem recompilação a fazer)`);
    }
  } else ok(`${label} actualizada face à fonte`);
}

// TOMLs com description malformada (sintoma do parser frágil: description contém "name:")
const codexAgentsDir = path.join(BRAIN, '.codex', 'agents');
try {
  const bad = [];
  for (const f of fs.readdirSync(codexAgentsDir).filter((x) => x.endsWith('.toml'))) {
    const text = fs.readFileSync(path.join(codexAgentsDir, f), 'utf8');
    const m = text.match(/^description = """([\s\S]*?)"""/);
    if (m && (/(^|\s)name:\s/.test(m[1]) || m[1].trim() === '|' || m[1].trim() === '')) bad.push(f);
  }
  if (bad.length) {
    warn(`${bad.length} .toml em .codex/agents/ com description malformada (sintoma do parser de frontmatter): ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ` … (+${bad.length - 6})` : ''}. Recompila: bash .claude/scripts/compile-bridges.sh --target codex`);
  } else {
    ok('.codex/agents/*.toml sem descriptions malformadas');
  }
} catch { /* dir inexistente — já reportado acima */ }

// ── 6. GEMINI.md / AGENTS.md ──────────────────────────────────────────────────
section('6. GEMINI.md / AGENTS.md');

const geminiExists = fs.existsSync(path.join(BRAIN, 'GEMINI.md'));
const agentsMdExists = fs.existsSync(path.join(BRAIN, 'AGENTS.md'));
if (geminiExists && agentsMdExists) ok('GEMINI.md e AGENTS.md existem');
else warn(`${!geminiExists ? 'GEMINI.md ' : ''}${!agentsMdExists ? 'AGENTS.md ' : ''}em falta — corre: bash .claude/scripts/compile-bridges.sh`);

// Desde 2026-08-20 os dois ficheiros são COMPILADOS do canónico (CLAUDE.md + soul.md +
// rules/*) com contagens derivadas do disco. Verificar isso mesmo, em vez de avisar de
// um heredoc estático que já não existe.
for (const [file, exists] of [['GEMINI.md', geminiExists], ['AGENTS.md', agentsMdExists]]) {
  if (!exists) continue;
  const txt = fs.readFileSync(path.join(BRAIN, file), 'utf8');
  if (!/FICHEIRO GERADO/.test(txt)) {
    warn(`${file} sem cabeçalho "FICHEIRO GERADO" — foi editado à mão ou é de uma versão antiga. Corre: bash .claude/scripts/compile-bridges.sh`);
    continue;
  }
  const declared = {
    Skills: txt.match(/^\| Skills \| (\d+) \|/m),
    Agentes: txt.match(/^\| Agentes \| (\d+) \|/m),
    Comandos: txt.match(/^\| Comandos \| (\d+) \|/m),
  };
  const real = { Skills: skillFiles.length, Agentes: agentFiles.length, Comandos: commandFiles.length };
  const bad = Object.entries(declared)
    .filter(([k, m]) => !m || +m[1] !== real[k])
    .map(([k, m]) => `${k}: ${m ? m[1] : 'ausente'} (real ${real[k]})`);
  if (bad.length) warn(`${file} dessincronizado — ${bad.join('; ')}. Corre: bash .claude/scripts/compile-bridges.sh`);
  else ok(`${file} compilado do canónico e em sincronia com o disco`);
}

// ── 7. memory/ ────────────────────────────────────────────────────────────────
section('7. memory/');

const soulPath = path.join(BRAIN, 'memory', 'soul.md');
try {
  const soul = fs.readFileSync(soulPath, 'utf8');
  const placeholders = soul.match(/<YOUR_[A-Z_]+>/g);
  if (placeholders) warn(`soul.md ainda com template por preencher (${[...new Set(placeholders)].join(', ')}) — corre o /install ou preenche a secção "User Alignment".`);
  else ok('soul.md personalizado (sem placeholders de template)');
} catch {
  err('memory/soul.md em falta — o JOCA perde a personalidade base. Restaura do repo.');
}

for (const d of ['projects', 'feedback']) {
  const p = path.join(BRAIN, 'memory', d);
  if (fs.existsSync(p)) ok(`memory/${d}/ existe`);
  else if (FIX) { fs.mkdirSync(p, { recursive: true }); ok(`--fix: memory/${d}/ criado`); }
  else warn(`memory/${d}/ não existe — /save e /feedback-joca vão falhar. Corre com --fix para criar.`);
}

// B08: o `/save` marca `directorio_estado: quebrado` quando o `test -d` de um `directorio*` falha.
// Sem quem o leia, o valor morria na ficha e a sessão seguinte casava pelo caminho morto.
{
  const projDir = path.join(BRAIN, 'memory', 'projects');
  const quebrados = [];
  let comEstado = 0;
  for (const { slug, ficheiro } of listarFichas(projDir)) {
    const t = readUtf8(ficheiro);
    const fm = t && t.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
    const m = fm && fm[1].match(/^directorio_estado:[ \t]*(.*)$/m);
    if (!m) continue;
    comEstado++;
    if (/^["']?quebrad/i.test(m[1].trim())) quebrados.push(slug);
  }
  if (quebrados.length) warn(`${quebrados.length} projecto(s) com \`directorio_estado: quebrado\` — o caminho na ficha não existe nesta máquina; o /resume não pode casar por ele. Corrige o \`directorio*\` na ficha: ${quebrados.join(', ')}`);
  else ok(`memory/projects/: ${comEstado} ficha(s) com directorio_estado, nenhuma quebrada`);
}

// Limites da memória por pastas (desenho §1.4, issue #82). Regras no lib (`lintMemoria`), não aqui:
// o `validate-skill.py --all` mostra a mesma lista. ✗ = estrutura partida ou index fora do limite
// (o /resume lê o index em cada sessão); ⚠ = área grande ou áreas a mais (arquivar é decisão do utilizador).
{
  const projDir = path.join(BRAIN, 'memory', 'projects');
  if (!memoria) warn('lib .claude/scripts/lib/memoria-projecto.cjs em falta — memória de projectos não verificada.');
  else if (fs.existsSync(projDir)) {
    const r = memoria.lintMemoria(projDir);
    const lista = (xs) => xs.map((x) => `      ${x.slug}: ${x.msg}`).join('\n');
    if (r.erros.length) err(`${r.erros.length} problema(s) na memória por pastas — corrige o index/pasta (planas: node .claude/scripts/migrar-memoria-pastas.mjs):\n${lista(r.erros)}`);
    else ok(`memory/projects/: ${r.pastas} pasta(s) dentro dos limites (index ≤40 linhas/4 KB, ≤3 linhas por área, ficheiros listados, sem fichas planas)`);
    if (r.avisos.length) warn(`${r.avisos.length} aviso(s) de tamanho na memória por pastas — sugerir ao utilizador; não arquivar sem ele dizer que acabou:\n${lista(r.avisos)}`);
  }
}

// ── 8. JOCA_OS (só leitura) ───────────────────────────────────────────────────
section('8. JOCA_OS (só leitura)');

if (!fs.existsSync(OS_DIR)) {
  warn('JOCA_OS/ não existe ao lado do JOCA_Brain — interface visual indisponível (ok se só usas o Brain).');
} else {
  const dataDir = path.join(OS_DIR, 'data');
  if (fs.existsSync(dataDir)) {
    const jsons = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
    const broken = [];
    for (const f of jsons) {
      try { JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { broken.push(f); }
    }
    if (broken.length) err(`JOCA_OS/data com JSON inválido: ${broken.join(', ')} — repara manualmente (o doctor NÃO toca no JOCA_OS).`);
    else ok(`JOCA_OS/data: ${jsons.length} ficheiro(s) JSON válidos`);
  } else {
    ok('JOCA_OS/data ainda não existe (é criado no primeiro arranque)');
  }
  for (const side of ['backend', 'frontend']) {
    const nm = path.join(OS_DIR, side, 'node_modules');
    if (fs.existsSync(nm)) ok(`JOCA_OS/${side}/node_modules instalado`);
    else warn(`JOCA_OS/${side}/node_modules em falta — corre: cd JOCA_OS && npm run setup (informativo).`);
  }
}

// ── 9. Integridade de conteúdo ───────────────────────────────
// As secções 1-8 contam ficheiros e validam JSON. Nada disso apanha a classe de defeito
// mais cara do toolkit: o ficheiro existe, o índice bate certo, e o conteúdo aponta para
// o vazio ou é inalcançável. Quatro checks, quatro falhas reais já pagas.
section('9. Integridade de conteúdo (paths citados · agentes gémeos · lançadores)');

// 9a. Guard legacy já existente — ligado aqui (era escrito e nunca corrido).
const checkPathsSh = path.join(BRAIN, '.claude', 'scripts', 'check-skill-paths.sh');
if (!fs.existsSync(checkPathsSh)) {
  warn('check-skill-paths.sh em falta — guard contra paths de skill legacy (skills/SKILL.md, nested) não corre.');
} else if (!whichCli('bash')) {
  warn('bash não está no PATH — check-skill-paths.sh não pôde correr (no Windows vem com o Git Bash).');
} else {
  const r = run('bash', [checkPathsSh, '--all'], { cwd: BRAIN });
  if (r.status === 0) ok('check-skill-paths.sh: sem paths de skill legacy (skills/SKILL.md · nested)');
  else if (r.status === 2) err(`check-skill-paths.sh encontrou paths de skill partidos:\n${(r.stdout || '').trimEnd()}`);
  else warn(`check-skill-paths.sh terminou com status ${r.status} — ${(r.stderr || '').trim().slice(0, 200)}`);
}

// 9b. Todo o path JOCA-interno citado tem de resolver no disco.
// `anima.md` apontava para 8 ficheiros numa pasta `./gsap/` que nunca existiu no repo, e
// `hyperframes.md` para mais 5. Um agente lê a skill, tenta o Read(), falha, e improvisa
// sem avisar. Só se verificam paths que o Brain POSSUI (.claude/<componente>/… ou memory/…) e paths
// explicitamente relativos (./x/y.md) — `block.json`, `theme.json`, `.claude/product-marketing-context.md`
// e afins pertencem ao projecto-alvo, não a esta árvore, e não são verificáveis daqui.
{
  const OWNED = /^\.claude\/(skills|agents|commands|rules|reference|scripts|hooks|workflows)\/|^memory\//;
  const SUB = /^(rules|reference|skills|agents|commands|scripts|hooks|workflows)\//;
  // `memory/{projects,feedback,knowledge,…}` é estado GERADO em runtime — citá-lo não é
  // prometer um ficheiro versionado, e acusá-lo seria falso positivo em toda a máquina nova.
  const RUNTIME = /^memory\/(feedback|projects|knowledge|decisions|learnings|checkpoints)\//;
  // Um ponteiro CONDICIONAL nao e um ponteiro morto: a skill ja trata a ausencia ("se existir",
  // "if it exists"). Sem isto o check acusava 2 ficheiros que 15 skills citam de proposito como
  // opcionais — e um aviso que grita por um nao-defeito treina quem le a ignorar a seccao.
  // Bilingue de proposito: as skills importadas de terceiros estao em ingles.
  // A forma real nas skills e `If \`<path>\` exists (or …)` — o verbo vem DEPOIS do path, por isso
  // nao se procura uma frase contigua: basta a linha falar de existencia ou de verificar.
  const OPCIONAL = /\b(exists?|existir|exista|existe|houver|opcional|optional|if present|if available|check for|verifica se)\b/i;
  // Uma linha que AFIRMA que o path nao existe esta a documentar um caso, nao a prometer um
  // ficheiro. Caso real: o `/upgrade-joca` explica a regra "alvo inexistente = achado" citando
  // `skills/webapp-testing.md`, que nao existe DE PROPOSITO — e o check acusava-o como defeito.
  // Sem isto, escrever sobre um ponteiro morto passa a criar um ponteiro morto.
  const ABSENTE = /(n[aã]o exist|inexistente|em falta|does not exist|doesn't exist|did ?n[o']t exist|no longer exists|missing|nunca existiu)/i;
  const sources = [
    ...walkMd(path.join(BRAIN, '.claude', 'skills')),
    ...walkMd(path.join(BRAIN, '.claude', 'reference')),
    ...walkMd(path.join(BRAIN, '.claude', 'agents')),
    ...walkMd(path.join(BRAIN, '.claude', 'commands')),
    ...walkMd(path.join(BRAIN, '.claude', 'rules')),
  ];
  const dead = [];
  let checked = 0;
  // Os templates do `/start` sao copiados para o projecto-alvo: os paths que citam
  // (`.claude/agents/revisor.md`) resolvem LA, nao aqui. O ficheiro fonte vive em
  // `reference/start/templates/claude/agents/revisor.md` — existe, so nao neste caminho.
  // Medir um template contra a arvore do toolkit e medir a coisa errada.
  const TEMPLATE_DE_PROJECTO = /[\\/]reference[\\/]start[\\/]templates[\\/]/;
  for (const f of sources) {
    if (TEMPLATE_DE_PROJECTO.test(f)) continue;
    const raw0 = readUtf8(f);
    if (raw0 == null) continue;
    // Secção de créditos cita ficheiros de repos de TERCEIROS (`skills/ads/…` do repo de origem,
    // com licença) — não são ponteiros desta árvore. Corta-se do heading até ao heading seguinte,
    // mantendo o comprimento (os índices das ocorrências continuam a bater com as linhas).
    const text = raw0.replace(/^(#{1,6}[ \t]+(?:Cr[ée]ditos|Credits|Atribui[çc][ãa]o|Attribution)\b[^\n]*\n)([\s\S]*?)(?=^#{1,6}[ \t]|(?![\s\S]))/gim,
      (_m, h, corpo) => h + corpo.replace(/[^\n]/g, ' '));
    const cands = new Map();   // path citado → índice da 1ª ocorrência (para ler a linha)
    const add = (v, i) => { if (!cands.has(v)) cands.set(v, i); };
    for (const m of text.matchAll(/Read\(\s*["']([^"']+)["']\s*\)/g)) add(m[1], m.index);
    for (const m of text.matchAll(/`([^`\n]+)`/g)) add(m[1], m.index);
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) add(m[1], m.index);
    for (const [raw, idx] of cands) {
      const c = raw.trim();
      if (/[<>*${}|"'[\]\s]/.test(c)) continue;         // placeholders, globs, variáveis
      if (c.endsWith('/')) continue;
      if (!/\.[a-z0-9]{1,5}$/i.test(c)) continue;       // tem de ter extensão
      if (RUNTIME.test(c)) continue;                    // estado de runtime, não ponteiro
      // A linha onde o path aparece decide: citado como opcional → não é defeito.
      const linha = text.slice(text.lastIndexOf('\n', idx) + 1, (text.indexOf('\n', idx) + 1 || text.length));
      if (OPCIONAL.test(linha)) continue;
      if (ABSENTE.test(linha)) continue;
      // Um path sem prefixo (`reference/x.md`) pode ser irmao do ficheiro que o cita, viver na
      // pasta-companheira do componente (`deep-research.md` + `deep-research/`), ou ser relativo
      // ao `.claude/`. Resolve-se se QUALQUER hipotese existir: sem as tres, os 5 `reference/*.md`
      // do agente deep-research saiam como mortos e a seccao passava a gritar por nao-defeitos.
      const dir = path.dirname(f);
      const companheira = path.join(dir, path.basename(f, '.md'));
      const alvos = [];
      if (c.startsWith('./')) alvos.push(path.join(dir, c.slice(2)));
      else if (OWNED.test(c)) alvos.push(path.join(BRAIN, c));
      else if (SUB.test(c)) alvos.push(path.join(dir, c), path.join(companheira, c), path.join(BRAIN, '.claude', c));
      else continue;
      checked++;
      if (!alvos.some((a) => fs.existsSync(a))) dead.push(`${path.relative(BRAIN, f)} → ${c}`);
    }
  }
  if (dead.length) {
    err(`${dead.length} ponteiro(s) morto(s) em skills/reference/agents/commands/rules — um agente lê a skill, faz Read(), falha e improvisa:\n${dead.slice(0, 10).map((d) => `      ${d}`).join('\n')}${dead.length > 10 ? `\n      … (+${dead.length - 10})` : ''}`);
  } else {
    ok(`${checked} referência(s) interna(s) citadas em skills/reference/agents/commands/rules resolvem no disco`);
  }
}

// 9c. Skill de execução sem agente gémeo.
// Despachar um `<skill>-agent` falhou 3x porque a skill existia e o agente não. Custou um
// turno inteiro. A lista curada vive no topo do skill-agents.mjs — lê-se de lá, não se copia.
try {
  const src = fs.readFileSync(path.join(BRAIN, '.claude', 'scripts', 'skill-agents.mjs'), 'utf8');
  const bloco = src.match(/const EXECUTION_SKILLS = \{([\s\S]*?)\n\};/);
  if (!bloco) {
    warn('skill-agents.mjs sem bloco EXECUTION_SKILLS reconhecível — agentes gémeos não verificados.');
  } else {
    const exec = [];
    for (const arr of bloco[1].matchAll(/\[([^\]]*)\]/g)) {
      for (const q of arr[1].matchAll(/['"]([a-z0-9][a-z0-9-]*)['"]/g)) exec.push(q[1]);
    }
    const semSkill = exec.filter((s) => !fs.existsSync(path.join(skillsDir, `${s}.md`)));
    const semAgente = exec.filter((s) => !fs.existsSync(path.join(agentsDir, `${s}-agent.md`)));
    if (semSkill.length) warn(`skill-agents.mjs lista skill(s) que não existem: ${semSkill.join(', ')} — tira-as da lista curada.`);
    if (semAgente.length) {
      warn(`${semAgente.length} skill(s) de execução sem agente gémeo: ${semAgente.slice(0, 8).join(', ')}${semAgente.length > 8 ? ` … (+${semAgente.length - 8})` : ''}. Regenera: node .claude/scripts/skill-agents.mjs`);
    } else if (!semSkill.length) {
      ok(`${exec.length} skill(s) de execução têm agente gémeo`);
    }
  }
} catch (e) {
  warn(`skill-agents.mjs ilegível (${e.message}) — agentes gémeos não verificados.`);
}

// 9d. Line endings dos lançadores Windows.
// O cmd.exe lê batch por offset de byte: um .bat gravado com LF sai truncado linha a linha
// ('edelayedexpansion' is not recognized). Só aparece quando alguém tenta arrancar — e não
// há gate nenhum entre a edição no Mac e o arranque no Windows.
const bats = [];
for (const d of [OS_DIR, ROOT]) {
  try {
    for (const f of fs.readdirSync(d)) if (/\.(bat|cmd)$/i.test(f)) bats.push(path.join(d, f));
  } catch { /* dir inexistente */ }
}
if (!bats.length) {
  ok('sem lançadores .bat/.cmd para verificar');
} else {
  const comLf = bats.filter((p) => {
    const t = fs.readFileSync(p, 'utf8');
    return /\n/.test(t) && /(^|[^\r])\n/.test(t);
  });
  if (!comLf.length) {
    ok(`${bats.length} lançador(es) .bat/.cmd em CRLF`);
  } else if (FIX) {
    for (const p of comLf) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    ok(`--fix: ${comLf.length} lançador(es) convertidos para CRLF: ${comLf.map((p) => path.basename(p)).join(', ')}`);
  } else {
    // Só é FALHA na máquina que os corre. Fora do Windows é aviso: o `core.autocrlf` do
    // git pode converter no checkout — o que não se pode é contar com isso, daí o
    // `.gitattributes` (`*.bat eol=crlf`) ser a correcção durável.
    const msg = `${comLf.length} lançador(es) .bat/.cmd com LF: ${comLf.map((p) => path.basename(p)).join(', ')} — no Windows o cmd.exe lê batch por offset de byte e trunca cada linha. Corre com --fix e fixa em .gitattributes: *.bat eol=crlf`;
    if (IS_WIN) err(`${msg} (NÃO vão arrancar nesta máquina).`);
    else warn(`${msg} (aviso: nesta máquina não corres .bat).`);
  }
}

// ── 10. Cobertura do trigger map ──────────────────────────────────────────────
section('10. Cobertura do trigger map (.claude/reference/trigger-map.md + CLAUDE.md)');

{
  // 2026-09-15: a tabela saiu do CLAUDE.md para .claude/reference/trigger-map.md (gerada,
  // on-demand). Uma skill conta como alcançável se for citada num dos dois — o CLAUDE.md continua a
  // nomear algumas à mão (Activation Rule).
  const refMd = readUtf8(path.join(BRAIN, '.claude', 'reference', 'trigger-map.md'));
  const brainClaude = readUtf8(path.join(BRAIN, 'CLAUDE.md'));
  const claudeMd = refMd == null ? null : `${refMd}\n${brainClaude || ''}`;
  if (claudeMd == null) {
    err('.claude/reference/trigger-map.md em falta — sem trigger map as pontes do Codex/Gemini não roteiam skills. Corre `node .claude/scripts/trigger-map-gen.mjs --apply`.');
  } else {
    let allow = [];
    const allowPath = path.join(BRAIN, '.claude', 'scripts', 'trigger-map-allowlist.json');
    // ⚠ O ficheiro usa a chave `skills` (ver o `_doc` lá dentro). Ler só `.allow` dava uma
    // allowlist SEMPRE vazia — a secção acusava as sub-skills já declaradas e ninguém via porquê.
    try {
      const j = JSON.parse(fs.readFileSync(allowPath, 'utf8'));
      allow = Array.isArray(j) ? j : (j.skills || j.allow || []);
    } catch { /* opcional */ }

    const bodies = new Map();
    for (const f of skillFiles) bodies.set(f.slice(0, -3), readUtf8(path.join(skillsDir, f)) || '');

    const orphans = [];
    let routed = 0;
    for (const name of bodies.keys()) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`[\`/(]${esc}\\b`).test(claudeMd)) continue;      // citada no trigger map / CLAUDE.md
      if (allow.includes(name)) continue;                              // sub-skill declarada
      const ref = new RegExp(`\`${esc}\`|skills/${esc}\\.md`);
      let by = null;
      for (const [other, text] of bodies) { if (other !== name && ref.test(text)) { by = other; break; } }
      if (by) routed++; else orphans.push(name);
    }
    if (!orphans.length) {
      ok(`todas as ${bodies.size} skills são alcançáveis (trigger map, router ou allowlist; ${routed} por router)`);
    } else {
      warn(`${orphans.length} skill(s) sem trigger no trigger map e sem router que as cite — inalcançáveis por relevância: ${orphans.slice(0, 8).join(', ')}${orphans.length > 8 ? ` … (+${orphans.length - 8})` : ''}. Acrescenta a linha ao Trigger Map ou declara-as em .claude/scripts/trigger-map-allowlist.json.`);
    }
  }

  // O Trigger Map é GERADO (trigger-map-gen.mjs). Um gerador que ninguém corre volta a ser
  // uma lista escrita à mão em duas semanas — por isso o drift acusa-se aqui.
  try {
    const gen = path.join(BRAIN, '.claude', 'scripts', 'trigger-map-gen.mjs');
    if (fs.existsSync(gen)) {
      const r = spawnSync(process.execPath, [gen, '--check'], { encoding: 'utf8' });
      if (r.status === 0) ok('Trigger Map em dia com as skills em disco (trigger-map-gen --check)');
      else warn('Trigger Map DESACTUALIZADO face às skills em disco — corre `node .claude/scripts/trigger-map-gen.mjs --apply`.');
    }
  } catch (_) { /* best-effort: o doctor nunca rebenta por causa de um sub-processo */ }
}

// ── 10b. Nomes citados como skills resolvem no disco ──────────────────────────
section('10b. Nomes citados como skills (~/CLAUDE.md + Trigger Map)');

// A secção 10 faz a direcção inversa (skill no disco sem quem a dispare). Esta faz a directa: cada
// nome anunciado como skill tem de existir em .claude/skills/. Um nome fantasma custa mais do que uma
// skill órfã — o modelo lê a lista, acredita nela, tenta Read() e improvisa quando falha.
// ⚠ O ~/CLAUDE.md é ficheiro do UTILIZADOR: o doctor lê-o e reporta, nunca o corrige (nem com --fix).
{
  const skillNames = new Set(skillFiles.map((f) => f.slice(0, -3)));
  const agentNames = new Set(agentFiles.map((f) => f.slice(0, -3)));
  const commandNames = new Set(commandFiles.map((f) => f.slice(0, -3)));
  const ruleNames = new Set((listMd(path.join(BRAIN, '.claude', 'rules')) || []).map((f) => f.slice(0, -3)));

  const missing = [];       // não existe em lado nenhum
  const misclassified = []; // existe, mas como agente/rule/command — está listado como skill

  // `a/b` = sub-skill de terceiros (gsap/gsap-core): resolve pelo caminho ou pelo nome final.
  const resolve = (name) => {
    const base = name.includes('/') ? name.split('/').pop() : name;
    if (skillNames.has(name) || skillNames.has(base) || fs.existsSync(path.join(skillsDir, `${name}.md`))) return 'skill';
    if (agentNames.has(name) || agentNames.has(base)) return 'agente';
    if (ruleNames.has(name) || ruleNames.has(base)) return 'rule';
    if (commandNames.has(name) || commandNames.has(base)) return 'command';
    return null;
  };
  const record = (name, kind, source) => {
    if (kind === 'skill') return;
    if (kind === null) missing.push(`${name} (${source})`);
    else misclassified.push(`${name} → é ${kind} (${source})`);
  };

  // ── Fonte A: bloco "Skills activas:" do ~/CLAUDE.md ──
  const homeClaude = path.join(os.homedir(), 'CLAUDE.md');
  const homeText = readUtf8(homeClaude);
  if (homeText == null) {
    warn(`~/CLAUDE.md não existe (${homeClaude}) — lista de skills activas do utilizador não verificada. Normal noutra máquina.`);
  } else {
    const lines = homeText.split(/\r?\n/);
    const start = lines.findIndex((l) => /^Skills activas:/.test(l));
    if (start < 0) {
      warn('~/CLAUDE.md sem bloco "Skills activas:" — nada para validar (ok se não declaras skills lá).');
    } else {
      let n = 0;
      for (let i = start + 1; i < lines.length && /^- /.test(lines[i]); i++) {
        // "- Categoria: a, b, c (nota com vírgulas)" → tirar categoria e parentesis ANTES de partir
        // por vírgulas, senão a nota entra na lista aos bocados.
        const items = lines[i]
          .replace(/^- [^:]*:\s*/, '')
          .replace(/\([^()]*\)/g, '')
          .replace(/\*\*|`/g, '')
          .split(',');
        for (const raw of items) {
          const name = raw.trim();
          if (!/^[a-z0-9][a-z0-9/-]*$/.test(name)) continue;   // prosa, globs (wp-*), restos
          n++;
          record(name, resolve(name), '~/CLAUDE.md');
        }
      }
      ok(`~/CLAUDE.md: ${n} nome(s) declarado(s) em "Skills activas:" verificados`);
    }
  }

  // ── Fonte B: coluna "Activates" do Trigger Map (.claude/reference/trigger-map.md desde 2026-09-15) ──
  const brainMd = readUtf8(path.join(BRAIN, '.claude', 'reference', 'trigger-map.md')) || '';
  const mapStart = brainMd.indexOf('## Trigger Map');
  if (mapStart >= 0) {
    const mapEnd = brainMd.indexOf('\n## ', mapStart + 1);
    const map = brainMd.slice(mapStart, mapEnd < 0 ? brainMd.length : mapEnd);
    let n = 0;
    for (const line of map.split(/\r?\n/)) {
      if (!/^\|/.test(line)) continue;
      const cells = line.split('|').map((s) => s.trim());
      // O nome roteado vem SEMPRE antes do parêntesis de anotação — o que está lá dentro é prosa
      // ("(agent — ⚠ o `agy` NÃO gera vídeo…)") e não se valida como skill.
      const cell = (cells[cells.length - 2] || '').split('(')[0];
      for (const m of cell.matchAll(/`([^`\n]+)`/g)) {
        const name = m[1].trim();
        if (name.startsWith('/') || name.includes('/') || /\.[a-z0-9]{1,5}$/i.test(name)) continue; // commands, rules, ficheiros
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) continue;
        n++;
        const kind = resolve(name);
        // Linha que já se declara ("(agent)", "(rule)", "(command)") está correcta — não é ruído a
        // acrescentar. Só interessa o nome que se APRESENTA como skill e não o é.
        const ANNOTATION = { agente: /\(agent/i, rule: /\(rule/i, command: /\(command|\/\w/i };
        if (kind && kind !== 'skill' && ANNOTATION[kind].test(cells[cells.length - 2] || '')) continue;
        record(name, kind, 'Trigger Map');
      }
    }
    ok(`Trigger Map: ${n} nome(s) roteado(s) verificados`);
  } else {
    warn('.claude/reference/trigger-map.md sem "## Trigger Map" — nomes roteados não verificados. Corre `node .claude/scripts/trigger-map-gen.mjs --apply`.');
  }

  if (missing.length) {
    warn(`${missing.length} nome(s) anunciado(s) como skill que NÃO existem em .claude/skills/ — o modelo lê a lista, tenta Read() e improvisa: ${missing.join(', ')}. Instala a skill ou tira o nome da lista (o ~/CLAUDE.md é teu, o doctor não lhe toca).`);
  }
  if (misclassified.length) {
    warn(`${misclassified.length} nome(s) listado(s) como skill que existem com OUTRO tipo — classificação errada, não ficheiro em falta: ${misclassified.join(', ')}.`);
  }
  if (!missing.length && !misclassified.length) ok('todos os nomes citados como skills resolvem em .claude/skills/');
}

// ── 11. Git — branch default do origin ────────────────────────────────────────
section('11. Git — branch default do origin');

{
  const remotes = run('git', ['-C', ROOT, 'remote']);
  const hasOrigin = remotes.status === 0 && /(^|\n)origin(\r?\n|$)/.test(remotes.stdout || '');
  if (!hasOrigin) {
    warn('sem remote `origin` — /update-joca e /ship não têm com que sincronizar (ok se este clone é local).');
  } else {
    const head = run('git', ['-C', ROOT, 'symbolic-ref', 'refs/remotes/origin/HEAD']);
    if (head.status === 0 && (head.stdout || '').trim()) {
      ok(`origin/HEAD resolve → ${head.stdout.trim()}`);
    } else {
      err('git symbolic-ref refs/remotes/origin/HEAD não resolve — comandos que derivam a branch default em runtime falham em silêncio. Corrige: git remote set-head origin -a');
    }
  }

  // Refs git escritas à mão nos comandos (o /update-joca esteve morto em `origin/master`).
  const hard = [];
  for (const f of commandFiles) {
    const p = path.join(commandsDir, f);
    const text = readUtf8(p);
    if (text == null) continue;
    const hits = (text.match(/origin\/(master|main)\b/g) || []).length;
    if (!hits) continue;
    if (/symbolic-ref/.test(text)) continue;   // resolvido em runtime — ok
    hard.push(`${f} (${hits}×)`);
  }
  if (hard.length) {
    warn(`comando(s) com ref git fixa (origin/master|main) sem a resolver em runtime: ${hard.join(', ')}. Deriva a branch com \`git symbolic-ref refs/remotes/origin/HEAD\` — um repo que publique na outra branch deixa o comando morto sem erro.`);
  } else if (commandFiles.length) {
    ok('nenhum comando com origin/master|main fixo por resolver');
  }
}

// ── 12. Dataset de design vs bans ─────────────────────────────────────────────
section('12. Dataset de design vs anti-slop-bans');

{
  const ds = path.join(BRAIN, '.claude', 'scripts', 'check-design-dataset.mjs');
  if (!fs.existsSync(ds)) {
    warn('check-design-dataset.mjs em falta — a coluna Display do design-dataset não é validada contra os bans.');
  } else {
    const r = run(process.execPath, [ds], { cwd: BRAIN });
    const out = (r.stdout || '').trim();
    if (r.status === 0) ok(out || 'design-dataset sem fontes de display banidas');
    else if (r.status === 2) warn(`contradição entre design-dataset e anti-slop-bans (um agente recebe a combinação num brief e constrói sobre um hard-reject):\n${out.split(/\r?\n/).map((l) => `      ${l}`).join('\n')}`);
    else warn(`check-design-dataset.mjs não correu (status ${r.status}): ${out || (r.stderr || '').trim().slice(0, 200)}`);
  }
}

// ── 13. Description vs corpo das skills (heurístico, opt-in) ──────────────────
section('13. Description vs corpo das skills (heurístico)');

{
  const sp = path.join(BRAIN, '.claude', 'scripts', 'check-skill-promises.mjs');
  if (!fs.existsSync(sp)) {
    warn('check-skill-promises.mjs em falta.');
  } else if (!PROMISES) {
    console.log('  · auditoria heurística (falsos positivos por desenho: descriptions bilingues) — corre com --promises ou: node .claude/scripts/check-skill-promises.mjs');
  } else {
    const r = run(process.execPath, [sp], { cwd: BRAIN });
    const out = (r.stdout || '').trim();
    if (!out) warn('check-skill-promises.mjs não devolveu output.');
    else if (/^nenhuma skill/.test(out)) ok(out);
    else warn(`${out.split(/\r?\n/)[0]}\n${out.split(/\r?\n/).slice(1).map((l) => `    ${l}`).join('\n')}`);
  }
}

// ── 14. Orçamento de contexto (o que é re-enviado em CADA mensagem) ───────────
// Mecanismo em vez de prosa: pedir a alguém que "não engorde" os ficheiros auto-carregados
// não mede nada. Isto mede e avisa. Aviso, nunca bloqueio — a decisão é de quem escreve.
section('14. Orçamento de contexto (auto-carregado em cada sessão)');

// Estimativa deliberadamente grosseira: ~4 chars/token. Serve para ordem de grandeza,
// não para contabilidade — o tokenizer real varia com acentuação e código.
const aprox = (chars) => Math.round(chars / 4);

// 14a — soma das `description` dos agentes. Todas entram no registo de agentes que o
// modelo vê a cada sessão; 112 descriptions curtas custam menos do que 20 parágrafos.
const TECTO_DESCRIPTIONS_TOKENS = 2500;
{
  let total = 0, contados = 0, semDescription = [];
  const maiores = [];
  // ⚠ `listMd` devolve BASENAMES, não caminhos — sem o join, `readUtf8` lê relativo ao cwd
  // e devolve null (ou, pior, um ficheiro homónimo do cwd) e o check mede zero em silêncio.
  for (const nome of agentFiles) {
    const texto = readUtf8(path.join(agentsDir, nome));
    if (texto == null) continue;
    const fm = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) { semDescription.push(nome); continue; }
    const dm = fm[1].match(/^description:[ \t]*(.*)$/m);
    if (!dm) { semDescription.push(nome); continue; }
    const valor = dm[1].trim().replace(/^["']|["']$/g, '');
    total += valor.length;
    contados++;
    maiores.push([valor.length, nome]);
  }
  maiores.sort((a, b) => b[0] - a[0]);
  const tk = aprox(total);
  const topo = maiores.slice(0, 3).map(([n, f]) => `${f} (${n} chars)`).join(', ');
  if (tk > TECTO_DESCRIPTIONS_TOKENS) {
    warn(`descriptions dos agentes: ~${tk} tokens em ${contados} agentes — acima do tecto de ${TECTO_DESCRIPTIONS_TOKENS}. Encurta as maiores: ${topo}.`);
  } else {
    ok(`descriptions dos agentes: ~${tk} tokens em ${contados} agentes (tecto ${TECTO_DESCRIPTIONS_TOKENS})`);
  }
  if (semDescription.length) {
    warn(`${semDescription.length} agente(s) sem \`description\` no frontmatter — invisíveis à selecção por relevância: ${semDescription.slice(0, 5).join(', ')}${semDescription.length > 5 ? '…' : ''}`);
  }
}

// 14b — guard de orçamento para `.claude/rules/*.md`. O `guard-claudemd.js` só actua quando
// o basename do alvo é `CLAUDE.md` (`claudemd-budget.json` só tem chaves de `CLAUDE.md`), e
// as rules são auto-carregadas exactamente da mesma maneira: cada linha é re-enviada em cada
// mensagem. Excedente vai para `.claude/reference/` (Read() on-demand), não para aqui.
const ORC_RULE_CHARS = 18000;   // por ficheiro
const ORC_RULES_TOTAL = 56000;  // soma de .claude/rules/*.md
{
  const rulesDir = path.join(BRAIN, '.claude', 'rules');
  const ruleFiles = listMd(rulesDir) || [];
  if (!ruleFiles.length) {
    warn(`.claude/rules/ sem ficheiros .md — o Decision Filter do CLAUDE.md aponta para rules que não existem.`);
  } else {
    let soma = 0;
    const gordos = [];
    for (const nome of ruleFiles) {
      const texto = readUtf8(path.join(rulesDir, nome));
      if (texto == null) continue;
      soma += texto.length;
      if (texto.length > ORC_RULE_CHARS) gordos.push(`${nome} (${texto.length} chars, ~${aprox(texto.length)} tk)`);
    }
    for (const g of gordos) {
      warn(`rule acima do orçamento por ficheiro (${ORC_RULE_CHARS} chars): ${g}. Move o detalhe para .claude/reference/ e deixa um pointer.`);
    }
    if (soma > ORC_RULES_TOTAL) {
      warn(`.claude/rules/ soma ${soma} chars (~${aprox(soma)} tokens) — acima do orçamento total de ${ORC_RULES_TOTAL}. Isto é custo por MENSAGEM, não por sessão.`);
    } else if (!gordos.length) {
      ok(`.claude/rules/: ${ruleFiles.length} ficheiro(s), ${soma} chars (~${aprox(soma)} tokens) — dentro do orçamento (${ORC_RULES_TOTAL})`);
    }
  }
}

// 14c — «contexto fixo»: tudo o resto que entra em CADA sessão e que 14a/14b não medem.
// 2026-09-15: os gates de tokens mediam só `.claude/rules/`. A cadeia de `CLAUDE.md` (o do
// utilizador, o do repo, o do Brain e o que eles importam com `@`) e as descriptions das skills
// instaladas em `~/.claude/skills/` cresciam sem orçamento nenhum, e a subida de tokens só se viu
// quando o utilizador perguntou. Isto mede-a. Aviso, nunca bloqueio.
// Tecto: 32 000 chars (~8000 tokens). Medido a 2026-09-18 nesta máquina: 22 288 chars na cadeia
// CLAUDE.md. O tecto fica ~40% acima do medido — mesma folga relativa que o `ORC_RULES_TOTAL`
// (56 000 para 33 276 reais) — e abaixo dele de propósito: a cadeia é menor e muito mais estável
// que as rules, por isso um crescimento de 10k aqui é sinal, não ruído.
const ORC_FIXO_TOTAL = 32000;
{
  // Cadeia de CLAUDE.md: os pontos de entrada que o Claude Code carrega sempre, mais o que
  // eles importam com `@path` (o `JOCA_Brain/CLAUDE.md` importa o `memory/soul.md` assim).
  const entradas = [
    path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    path.join(os.homedir(), 'CLAUDE.md'),
    path.join(ROOT, 'CLAUDE.md'),
    path.join(BRAIN, 'CLAUDE.md'),
  ];
  const vistos = new Set();
  const pecas = [];   // [chars, label]
  const visitar = (p, profundidade = 0) => {
    const chave = path.resolve(p).toLowerCase();
    if (vistos.has(chave) || profundidade > 5) return;
    vistos.add(chave);
    const texto = readUtf8(p);
    if (texto == null) return;
    pecas.push([texto.length, p.startsWith(BRAIN) ? path.relative(BRAIN, p) : p]);
    for (const linha of texto.split(/\r?\n/)) {
      const m = linha.match(/^@(\S.*)$/);
      if (!m) continue;
      const alvo = m[1].trim();
      visitar(path.isAbsolute(alvo) ? alvo : path.join(path.dirname(p), alvo), profundidade + 1);
    }
  };
  for (const e of entradas) visitar(e);

  // Descriptions das skills instaladas em ~/.claude/skills/. Só a `description` do frontmatter
  // entra no contexto de cada sessão (o corpo carrega por Read()), mas são 1 por skill e somam.
  // As skills vivem a profundidades diferentes conforme a origem (`<nome>/SKILL.md` quando um CLI
  // de terceiros as instala; `synced/<uuid>/<nome>/SKILL.md` quando vêm da sincronização).
  const skillMds = (dir, out = [], profundidade = 0) => {
    if (profundidade > 4) return out;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) skillMds(p, out, profundidade + 1);
      else if (e.name === 'SKILL.md') out.push(p);
    }
    return out;
  };
  const homeSkills = skillMds(path.join(os.homedir(), '.claude', 'skills'));
  let descHome = 0;
  for (const p of homeSkills) {
    const texto = readUtf8(p);
    if (texto == null) continue;
    const fm = texto.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
    const dm = fm && fm[1].match(/^description:[ \t]*([\s\S]*?)(?=\n\w[\w-]*:|$)/m);
    if (dm) descHome += dm[1].trim().length;
  }

  const somaClaude = pecas.reduce((s, [n]) => s + n, 0);
  const total = somaClaude + descHome;
  pecas.sort((a, b) => b[0] - a[0]);
  const topo = pecas.slice(0, 3).map(([n, f]) => `${f} (${n})`).join(', ');
  const detalhe = `${pecas.length} CLAUDE.md/imports = ${somaClaude} chars + ${homeSkills.length} description(s) de ~/.claude/skills = ${descHome} chars`;
  if (total > ORC_FIXO_TOTAL) {
    warn(`contexto fixo: ${total} chars (~${aprox(total)} tokens) — acima do orçamento de ${ORC_FIXO_TOTAL}. ${detalhe}. Maiores: ${topo}. Move o detalhe para .claude/reference/ ou memory/projects/ (Read() on-demand). As .claude/rules/ contam à parte, em 14b.`);
  } else {
    ok(`contexto fixo: ${total} chars (~${aprox(total)} tokens) — dentro do orçamento (${ORC_FIXO_TOTAL}). ${detalhe}`);
  }
}

// ── 15. Cópias instaladas em ~/.claude vs canónico ────────────────────────────
// A statusline (e qualquer script apontado por caminho absoluto no ~/.claude/settings.json) corre de
// uma CÓPIA em ~/.claude/, não do repo. Uma sessão editou a instalada e só descobriu o canónico em
// `.claude/scripts/` por acaso — é a classe dos espelhos `.agents/`/`.codex/`, mas fora da árvore.
// Só leitura. Só compara o que existe dos DOIS lados, pelo basename. O `settings.json` NÃO se compara:
// o do utilizador e o do projecto têm papéis diferentes, e acusá-los seria ✗ falso em todas as máquinas.
section('15. Cópias instaladas em ~/.claude vs canónico (.claude/scripts · .claude/hooks)');

{
  const HOME_CLAUDE = path.join(os.homedir(), '.claude');
  const canonDirs = [path.join(BRAIN, '.claude', 'scripts'), path.join(BRAIN, '.claude', 'hooks')];
  const canon = new Map();                                   // basename → caminho canónico
  for (const d of canonDirs) {
    try { for (const f of fs.readdirSync(d)) if (/\.(js|mjs|cjs|sh|py)$/.test(f) && !canon.has(f)) canon.set(f, path.join(d, f)); } catch { /* dir inexistente */ }
  }
  const instalados = new Set();
  for (const d of [HOME_CLAUDE, path.join(HOME_CLAUDE, 'hooks'), path.join(HOME_CLAUDE, 'scripts')]) {
    try { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (canon.has(f) && fs.statSync(p).isFile()) instalados.add(p); } } catch { /* dir inexistente */ }
  }
  // Caminhos absolutos citados no ~/.claude/settings.json (statusLine + hooks) que vivem FORA do Brain.
  try {
    const us = JSON.parse(fs.readFileSync(path.join(HOME_CLAUDE, 'settings.json'), 'utf8'));
    const cmds = [];
    if (us.statusLine && us.statusLine.command) cmds.push(us.statusLine.command);
    for (const g of Object.values(us.hooks || {})) for (const e of Array.isArray(g) ? g : []) for (const h of e.hooks || []) if (h.command) cmds.push(h.command);
    for (const c of cmds) {
      for (const tok of c.split(/\s+/).map((t) => t.replace(/^["']|["']$/g, ''))) {
        if (!path.isAbsolute(tok) || tok.startsWith(BRAIN)) continue;
        if (canon.has(path.basename(tok)) && fs.existsSync(tok)) instalados.add(tok);
      }
    }
  } catch { /* sem ~/.claude/settings.json legível — só a varredura por pasta */ }

  const norm = (p) => { const t = readUtf8(p); return t == null ? null : t.replace(/\r\n/g, '\n'); };
  const difs = [];
  for (const p of instalados) {
    const c = canon.get(path.basename(p));
    if (norm(p) !== norm(c)) {
      const maisNovo = fs.statSync(p).mtimeMs > fs.statSync(c).mtimeMs ? 'instalada mais recente' : 'canónico mais recente';
      difs.push(`${p} ≠ ${path.relative(BRAIN, c)} (${maisNovo})`);
    }
  }
  if (!instalados.size) ok('nenhuma cópia de .claude/scripts|hooks instalada em ~/.claude — nada a comparar');
  else if (difs.length) err(`${difs.length} cópia(s) instalada(s) em ~/.claude diverge(m) do canónico — a edição de um lado não chega ao outro. Ver com \`diff <canónico> <instalada>\`, decidir qual ganha e copiar:\n${difs.map((d) => `      ${d}`).join('\n')}`);
  else ok(`${instalados.size} cópia(s) instalada(s) em ~/.claude idênticas ao canónico`);
}

// ── 15b. Skills de vídeo de terceiros soltas em ~/.claude/skills/ ─────────────
// 2026-09-15: as 29 skills de vídeo (HyperFrames + Picsart) foram movidas de `~/.claude/skills/`
// para a reserva `~/.claude/skills-video/`, e a porta passou a ser a skill `video` (Read() on
// demand). Corte medido: ~15 500 chars de contexto em cada sessão. O CLI do HyperFrames
// (`npx hyperframes init`, `skills update`) reinstala-as na pasta original e IGNORA `--skip-skills`
// — só `HYPERFRAMES_SKIP_SKILLS=1` o impede. Sem esta verificação o corte volta em silêncio.
// Só leitura: o doctor reporta e dá o comando, nunca mexe em `~/.claude` (nem com --fix).
// 2026-09-26: a reserva mudou-se para dentro do Brain (`JOCA_Brain/skills-video/`) — nada de skills em ~/.claude.
section('15b. Skills de vídeo de terceiros em ~/.claude/skills/ (reserva: JOCA_Brain/skills-video/)');

{
  const HOME_CLAUDE = path.join(os.homedir(), '.claude');
  const soltasDir = path.join(HOME_CLAUDE, 'skills');
  const reservaDir = path.join(BRAIN, 'skills-video');
  const subdirs = (d) => {
    try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
    catch { return []; }
  };
  // Fonte primária: o que já está na reserva. Um nome que exista nos dois sítios foi reinstalado.
  const naReserva = new Set(subdirs(reservaDir));
  // Rede para a máquina que ainda não tem reserva (ou para uma skill nova do pacote): os nomes
  // do pacote HyperFrames/Picsart citados em .claude/skills/video.md — nunca uma lista à mão aqui.
  const videoMd = readUtf8(path.join(BRAIN, '.claude', 'skills', 'video.md')) || '';
  for (const m of videoMd.matchAll(/skills-video\/([a-z0-9][a-z0-9-]*)\//g)) naReserva.add(m[1]);

  const reinstaladas = subdirs(soltasDir)
    .filter((n) => naReserva.has(n) && fs.existsSync(path.join(soltasDir, n, 'SKILL.md')));

  if (!reinstaladas.length) {
    ok(`~/.claude/skills/ sem skills de vídeo de terceiros (reserva: ${naReserva.size} nome(s) conhecido(s))`);
  } else {
    warn(`${reinstaladas.length} skill(s) de vídeo de terceiros soltas em ~/.claude/skills/ — voltam ao contexto de TODAS as sessões (~15 500 chars quando estão as 29): ${reinstaladas.slice(0, 8).join(', ')}${reinstaladas.length > 8 ? ` … (+${reinstaladas.length - 8})` : ''}. Move as pastas de volta para a reserva do Brain (JOCA_Brain/skills-video/) e corre o CLI com a variável de ambiente:\n      HYPERFRAMES_SKIP_SKILLS=1 npx hyperframes <cmd>   (o \`--skip-skills\` é ignorado)`);
  }
}

// ── 16. ~/CLAUDE.md (nível 1) vs ficha do projecto (nível 3) ──────────────────
// A linha de um projecto no ~/CLAUDE.md dizia «só GDD, sem git, sem stack, engine por decidir» meses
// depois de a ficha declarar a engine e um build jogável: nada reverificava. Heurística por marcadores fortes,
// só leitura, só ⚠ — o ~/CLAUDE.md é do utilizador e o doctor nunca lhe toca (nem com --fix).
section('16. ~/CLAUDE.md vs fichas de projecto (contradições por marcador)');

{
  const homeText = readUtf8(path.join(os.homedir(), 'CLAUDE.md'));
  const projDir = path.join(BRAIN, 'memory', 'projects');
  if (homeText == null) {
    ok('~/CLAUDE.md não existe nesta máquina — nada a comparar');
  } else {
    const SEM_GIT = /\bsem git\b/i;
    const SEM_STACK = /sem código|sem stack|stack por (definir|decidir)|engine por decidir|só GDD/i;
    const expandir = (p) => p.replace(/^~(?=\/)/, os.homedir());
    const contra = [];
    let n = 0;
    for (const linha of homeText.split(/\r?\n/)) {
      if (!/^\|/.test(linha)) continue;
      const fichas = [...linha.matchAll(/`([a-z0-9][a-z0-9-]*)(?:\.md|\/index\.md|\/)`/g)].map((m) => m[1]);
      if (!fichas.length) continue;
      const temSemGit = SEM_GIT.test(linha), temSemStack = SEM_STACK.test(linha);
      if (!temSemGit && !temSemStack) continue;
      const dirLocal = [...linha.matchAll(/`([^`]+)`/g)].map((m) => expandir(m[1]))
        .find((p) => path.isAbsolute(p) && fs.existsSync(p));
      for (const nome of fichas) {
        // index + áreas da pasta (sem arquivo.md)
        const fsFicha = ficheirosFicha(nome, projDir);
        if (!fsFicha.length) continue;
        const ficha = fsFicha.map((f) => readUtf8(f) || '').join('\n');
        n++;
        if (temSemGit && dirLocal && fs.existsSync(path.join(dirLocal, '.git'))) {
          contra.push(`${nome}: linha diz «sem git», mas ${dirLocal}/.git existe`);
        }
        if (temSemStack && /^(stack:\s*\S|\*\*Stack:\*\*\s*\S)/m.test(ficha)) {
          contra.push(`${nome}: linha diz «sem código/stack por decidir», mas a ficha declara stack (\`stack:\`/**Stack:**)`);
        }
      }
    }
    if (contra.length) warn(`${contra.length} contradição(ões) entre ~/CLAUDE.md e memory/projects/ — a linha de 1 frase caducou; corrige-a à mão (o doctor não lhe toca):\n${contra.map((c) => `      ${c}`).join('\n')}`);
    else ok(`${n} linha(s) com marcador «sem git»/«sem stack» coerentes com a ficha e o disco`);
  }
}

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log(`\nResumo: ${nOk} ✓ · ${nWarn} ⚠ · ${nErr} ✗${FIX ? ' (modo --fix)' : ''}`);
if (nErr > 0) console.log('Há erros — vê as mensagens ✗ acima.');
process.exit(nErr > 0 ? 1 : 0);
