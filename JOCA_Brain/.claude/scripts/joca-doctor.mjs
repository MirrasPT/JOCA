#!/usr/bin/env node
// joca-doctor.mjs — diagnóstico do JOCA. Node ESM, zero dependências npm.
//
// Uso:
//   node .claude/scripts/joca-doctor.mjs          # só diagnóstico
//   node .claude/scripts/joca-doctor.mjs --fix    # aplica correcções seguras
//
// Exit code: 0 = sem erros (warnings ok) · 1 = pelo menos um erro (✗).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(SCRIPT_DIR, '..', '..');          // JOCA_Brain/
const ROOT = path.dirname(BRAIN);                             // raiz do repo JOCA/
const OS_DIR = path.join(ROOT, 'JOCA_OS');
const FIX = process.argv.includes('--fix');
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
  warn('Python 3 não encontrado — build-skill-index.py e graphify indisponíveis. Instala Python 3.10+.');
}
if (IS_WIN) {
  warn('Windows: usa sempre `python`, não `python3` — o `python3` é o stub vazio da Microsoft Store (sem os teus pacotes, ex.: graphify).');
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

// README da raiz — contagens declaradas
const readmePath = path.join(ROOT, 'README.md');
let readme = null;
try { readme = fs.readFileSync(readmePath, 'utf8'); } catch { warn('README.md da raiz não encontrado — contagens não verificadas.'); }

if (readme) {
  const problems = [];
  const compRe = /\*\*(\d+) componentes:\*\*\s*(\d+) skills \+ (\d+) agents \+ (\d+) commands/;
  const comp = readme.match(compRe);
  const realTotal = skillFiles.length + agentFiles.length + commandFiles.length;
  if (!comp) {
    warn('README.md: linha "**N componentes:** X skills + Y agents + Z commands" não encontrada.');
  } else if (+comp[1] !== realTotal || +comp[2] !== skillFiles.length || +comp[3] !== agentFiles.length || +comp[4] !== commandFiles.length) {
    problems.push(`linha componentes diz ${comp[1]} (${comp[2]}+${comp[3]}+${comp[4]}), real é ${realTotal} (${skillFiles.length}+${agentFiles.length}+${commandFiles.length})`);
  }
  const headers = [
    ['Skills', skillFiles.length],
    ['Agents', agentFiles.length],
    ['Commands', commandFiles.length],
  ];
  for (const [label, real] of headers) {
    const m = readme.match(new RegExp(`^## ${label} \\((\\d+)\\)`, 'm'));
    if (m && +m[1] !== real) problems.push(`header "## ${label} (${m[1]})" — real: ${real}`);
  }
  if (!problems.length) {
    ok('README.md: contagens (componentes + headers) batem certo com o disco');
  } else if (FIX) {
    let updated = readme;
    updated = updated.replace(compRe, `**${realTotal} componentes:** ${skillFiles.length} skills + ${agentFiles.length} agents + ${commandFiles.length} commands`);
    for (const [label, real] of headers) {
      updated = updated.replace(new RegExp(`^## ${label} \\(\\d+\\)`, 'm'), `## ${label} (${real})`);
    }
    fs.writeFileSync(readmePath, updated);
    ok(`--fix: README.md actualizado (${problems.length} contagem(ns) corrigida(s))`);
  } else {
    warn(`README.md dessincronizado: ${problems.join('; ')}. Corre com --fix para corrigir.`);
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
    warn(`${label} stale — fonte .claude/ é mais recente (${new Date(srcM).toISOString()} vs ${new Date(dstM).toISOString()}). Corre: bash .claude/scripts/compile-bridges.sh`);
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

// ── 9. Integridade de conteúdo ────────────────────────────────────────────────
// As secções 1-8 contam ficheiros e validam JSON. Nada disso apanha a classe de defeito
// mais cara do toolkit: o ficheiro existe, o índice bate certo, e o conteúdo aponta para
// o vazio ou é inalcançável. Quatro checks, quatro falhas reais já pagas.
section('9. Integridade de conteúdo');

const rulesDir = path.join(BRAIN, '.claude', 'rules');
const DIRS_MD = [
  [skillsDir, 'skills'],
  [agentsDir, 'agents'],
  [commandsDir, 'commands'],
  [rulesDir, 'rules'],
];

// 9a. Ponteiros citados que não resolvem.
// `anima.md` apontava para 8 ficheiros numa pasta `./gsap/` que nunca existiu no repo, e
// `hyperframes.md` para mais 5. Um agente lê a skill, tenta o Read(), falha, e improvisa
// sem avisar. Só se contam paths ANCORADOS na árvore do Brain: `docs/…` é do projecto-alvo,
// não daqui, e `memory/{projects,feedback,knowledge}/` é estado gerado em runtime.
const RE_PATH = /`((?:\.claude|\.agents|\.codex|memory)\/[A-Za-z0-9._/-]+\.(?:md|mjs|js|cjs|py|sh|json))`/g;
const RUNTIME = /^memory\/(feedback|projects|knowledge|decisions|learnings|checkpoints)\//;
// Um ponteiro CONDICIONAL nao e um ponteiro morto: a skill ja trata a ausencia ("se existir",
// "if it exists"). Sem isto o check acusava 2 ficheiros que 15 skills citam de proposito como
// opcionais — e um aviso que grita por um nao-defeito treina quem le a ignorar a seccao.
// Bilingue de proposito: as skills importadas de terceiros estao em ingles.
// A forma real nas skills e `If \`<path>\` exists (or …)` — o verbo vem DEPOIS do path, por isso
// nao se procura uma frase contigua: basta a linha falar de existencia ou de verificar.
const OPCIONAL = /\b(exists?|existir|exista|existe|houver|opcional|optional|if present|if available|check for|verifica se)\b/i;
const mortos = new Map();
let pathsVerificados = 0;
for (const [dir, label] of DIRS_MD) {
  for (const f of listMd(dir) || []) {
    let texto;
    try { texto = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    for (const m of texto.matchAll(RE_PATH)) {
      const p = m[1];
      if (/[<>*]/.test(p) || RUNTIME.test(p)) continue;   // placeholder/glob ou estado de runtime
      // A linha onde o path aparece decide: citado como opcional -> nao e defeito.
      const linha = texto.slice(texto.lastIndexOf('\n', m.index) + 1, (texto.indexOf('\n', m.index) + 1 || texto.length));
      if (OPCIONAL.test(linha)) continue;
      pathsVerificados++;
      if (!fs.existsSync(path.join(BRAIN, p))) {
        if (!mortos.has(p)) mortos.set(p, []);
        mortos.get(p).push(`${label}/${f}`);
      }
    }
  }
}
if (mortos.size) {
  const linhas = [...mortos.entries()].slice(0, 6).map(([p, quem]) => `${p} (citado em ${quem.length}: ${quem.slice(0, 3).join(', ')}${quem.length > 3 ? '…' : ''})`);
  warn(`${mortos.size} ponteiro(s) não resolvem em ${pathsVerificados} paths citados: ${linhas.join(' · ')}${mortos.size > 6 ? ` … (+${mortos.size - 6})` : ''}. Corrige o path, cria o ficheiro, ou escreve "se existir" se for opcional.`);
} else {
  ok(`${pathsVerificados} path(s) citados em skills/agents/commands/rules resolvem no disco`);
}

// 9b. Cobertura do trigger map.
// Um pull do público removeu 14 linhas do trigger map com as skills todas presentes: 14
// skills existentes ficaram inalcançáveis, sem erro nenhum. Contar ficheiros não detecta isto.
const triggerAllow = path.join(BRAIN, '.claude', 'scripts', 'trigger-map-allowlist.json');
let allow = [];
if (fs.existsSync(triggerAllow)) {
  try { allow = JSON.parse(fs.readFileSync(triggerAllow, 'utf8')); } catch (e) { warn(`trigger-map-allowlist.json ilegível (${e.message}) — ignorado.`); }
}
const allowSet = new Set(Array.isArray(allow) ? allow : allow.skills || []);
try {
  const claudeMd = fs.readFileSync(path.join(BRAIN, 'CLAUDE.md'), 'utf8');
  const i = claudeMd.indexOf('### Trigger Map');
  if (i < 0) {
    warn('CLAUDE.md sem secção "### Trigger Map" — cobertura de skills não verificada.');
  } else {
    const mapa = claudeMd.slice(i);
    const semTrigger = skillFiles
      .map((f) => f.slice(0, -3))
      .filter((n) => !allowSet.has(n))
      .filter((n) => !new RegExp('`' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[`/ ]').test(mapa));
    if (semTrigger.length) {
      warn(`${semTrigger.length}/${skillFiles.length} skill(s) sem entrada no trigger map do CLAUDE.md — existem no disco mas nada as dispara: ${semTrigger.slice(0, 8).join(', ')}${semTrigger.length > 8 ? ` … (+${semTrigger.length - 8})` : ''}. Acrescenta a linha de trigger no CLAUDE.md (basta o nome entre crases numa linha de router, para sub-skills). Alternativa: cria .claude/scripts/trigger-map-allowlist.json com {"skills":["nome"],"motivos":{"nome":"porquê"}} para as que não se disparam sozinhas.`);
    } else {
      ok(`trigger map cobre as ${skillFiles.length} skills${allowSet.size ? ` (${allowSet.size} na allowlist)` : ''}`);
    }
  }
} catch (e) {
  warn(`CLAUDE.md ilegível (${e.message}) — cobertura do trigger map não verificada.`);
}

// 9c. Skill de execução sem agente gémeo.
// Despachar `unity-ui-agent` falhou 3x porque a skill existia e o agente não. Custou um
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

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log(`\nResumo: ${nOk} ✓ · ${nWarn} ⚠ · ${nErr} ✗${FIX ? ' (modo --fix)' : ''}`);
if (nErr > 0) console.log('Há erros — vê as mensagens ✗ acima.');
process.exit(nErr > 0 ? 1 : 0);
