#!/usr/bin/env node
// joca-doctor.mjs — JOCA diagnostics. Node ESM, zero npm dependencies.
//
// Usage:
//   node .claude/scripts/joca-doctor.mjs          # diagnostics only
//   node .claude/scripts/joca-doctor.mjs --fix    # applies safe fixes
//
// Exit code: 0 = no errors (warnings ok) · 1 = at least one error (✗).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(SCRIPT_DIR, '..', '..');          // JOCA_Brain/
const ROOT = path.dirname(BRAIN);                             // root of the JOCA/ repo
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
else err(`Node ${process.version} — JOCA needs Node >= 18. Update it at https://nodejs.org`);

let pythonCmd = null;
for (const cand of IS_WIN ? ['python', 'python3'] : ['python3', 'python']) {
  const r = run(cand, ['--version']);
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status === 0 && /Python 3/.test(out)) { pythonCmd = cand; ok(`${cand} available (${out})`); break; }
}
if (!pythonCmd) {
  warn('Python 3 not found — build-skill-index.py and graphify unavailable. Install Python 3.10+.');
}
if (IS_WIN) {
  warn('Windows: always use `python`, not `python3` — `python3` is the empty Microsoft Store stub (without your packages, e.g. graphify).');
}

// ── 2. CLIs (informational) ───────────────────────────────────────────────────
section('2. CLIs on the PATH');

for (const [cli, note] of [
  ['claude', 'required in order to use JOCA'],
  ['codex', 'optional — Codex bridge (.codex/agents/)'],
  ['agy', 'optional — Antigravity/Gemini bridge (GEMINI.md)'],
]) {
  const p = whichCli(cli);
  if (p) ok(`${cli} → ${p}`);
  else warn(`${cli} is not on the PATH (${note}).`);
}

// ── 3. settings.json + hooks ──────────────────────────────────────────────────
section('3. .claude/settings.json + hooks');

const settingsPath = path.join(BRAIN, '.claude', 'settings.json');
let settings = null;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  ok('settings.json is valid JSON');
} catch (e) {
  err(`settings.json invalid or missing (${e.message}). Fix the JSON or run /install.`);
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
    err(`${withPlaceholder.length} hook(s) still carry an unsubstituted <JOCA_ROOT> placeholder — the hooks will NOT run. Run /install (or replace <JOCA_ROOT> with the real path: ${ROOT}).`);
  } else if (commands.length) {
    ok('No <JOCA_ROOT> placeholders left to substitute');
  }

  // Existence of the referenced files (resolving the placeholder to validate against the disk)
  let missing = [];
  let checked = 0;
  for (const c of commands) {
    for (const m of c.matchAll(/"([^"]+)"/g)) {
      const raw = m[1];
      if (raw.startsWith('$')) continue; // variables like $TOOL_INPUT_FILE_PATH
      if (!/\.(js|mjs|cjs|sh|py)$/.test(raw)) continue;
      const resolved = raw.replaceAll('<JOCA_ROOT>', ROOT);
      checked++;
      if (!fs.existsSync(resolved)) missing.push(raw);
    }
  }
  missing = [...new Set(missing)];
  if (missing.length) err(`Hooks reference files that do not exist: ${missing.join(', ')}`);
  else if (checked) ok(`${checked} hook reference(s) exist on disk`);
}

// ── 4. Inventory vs indexes ───────────────────────────────────────────────────
section('4. Inventory vs indexes');

const skillsDir = path.join(BRAIN, '.claude', 'skills');
const agentsDir = path.join(BRAIN, '.claude', 'agents');
const commandsDir = path.join(BRAIN, '.claude', 'commands');
const skillFiles = listMd(skillsDir) || [];
const agentFiles = listMd(agentsDir) || [];
const commandFiles = listMd(commandsDir) || [];
console.log(`  disk: ${skillFiles.length} skills · ${agentFiles.length} agents · ${commandFiles.length} commands`);

const indexPath = path.join(BRAIN, 'memory', 'SKILL_INDEX.json');
let indexStale = false;
try {
  const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const counts = {};
  for (const e of idx) counts[e.type] = (counts[e.type] || 0) + 1;
  const idxSkills = counts.skill || 0;
  const idxAgents = counts.agent || 0;
  if (idxSkills === skillFiles.length && idxAgents === agentFiles.length) {
    ok(`SKILL_INDEX.json in sync (${idxSkills} skills, ${idxAgents} agents; commands are not indexed)`);
  } else {
    indexStale = true;
    warn(`SKILL_INDEX.json out of sync — index: ${idxSkills} skills/${idxAgents} agents vs disk: ${skillFiles.length}/${agentFiles.length}. Run: ${pythonCmd || 'python'} .claude/scripts/build-skill-index.py`);
  }
} catch (e) {
  err(`SKILL_INDEX.json unreadable (${e.message}). Regenerate it: ${pythonCmd || 'python'} .claude/scripts/build-skill-index.py`);
  indexStale = true;
}

if (FIX && indexStale && pythonCmd) {
  const r = run(pythonCmd, [path.join(BRAIN, '.claude', 'scripts', 'build-skill-index.py')], { cwd: BRAIN });
  if (r.status === 0) ok(`--fix: SKILL_INDEX.json regenerated (${(r.stdout || '').trim()})`);
  else err(`--fix: build-skill-index.py failed: ${(r.stderr || '').trim()}`);
} else if (FIX && indexStale && !pythonCmd) {
  warn('--fix: could not regenerate SKILL_INDEX.json — Python unavailable.');
}

// Root README — declared counts
const readmePath = path.join(ROOT, 'README.md');
let readme = null;
try { readme = fs.readFileSync(readmePath, 'utf8'); } catch { warn('Root README.md not found — counts not verified.'); }

if (readme) {
  const problems = [];
  const compRe = /\*\*(\d+) components:\*\*\s*(\d+) skills \+ (\d+) agents \+ (\d+) commands/;
  const comp = readme.match(compRe);
  const realTotal = skillFiles.length + agentFiles.length + commandFiles.length;
  if (!comp) {
    warn('README.md: line "**N components:** X skills + Y agents + Z commands" not found.');
  } else if (+comp[1] !== realTotal || +comp[2] !== skillFiles.length || +comp[3] !== agentFiles.length || +comp[4] !== commandFiles.length) {
    problems.push(`components line says ${comp[1]} (${comp[2]}+${comp[3]}+${comp[4]}), real is ${realTotal} (${skillFiles.length}+${agentFiles.length}+${commandFiles.length})`);
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
    ok('README.md: counts (components + headers) match the disk');
  } else if (FIX) {
    let updated = readme;
    updated = updated.replace(compRe, `**${realTotal} components:** ${skillFiles.length} skills + ${agentFiles.length} agents + ${commandFiles.length} commands`);
    for (const [label, real] of headers) {
      updated = updated.replace(new RegExp(`^## ${label} \\(\\d+\\)`, 'm'), `## ${label} (${real})`);
    }
    fs.writeFileSync(readmePath, updated);
    ok(`--fix: README.md updated (${problems.length} count(s) fixed)`);
  } else {
    warn(`README.md out of sync: ${problems.join('; ')}. Run with --fix to fix it.`);
  }
}

// ── 5. Cross-CLI bridges ──────────────────────────────────────────────────────
section('5. Cross-CLI bridges (.agents/ + .codex/)');

const TOL = 2000; // ms — tolerance for copies made within the same second
for (const [srcDir, dstDir, label] of [
  [skillsDir, path.join(BRAIN, '.agents', 'skills'), '.agents/skills/'],
  [agentsDir, path.join(BRAIN, '.codex', 'agents'), '.codex/agents/'],
]) {
  const srcM = newestMtime(srcDir, ['.md']);
  const dstM = newestMtime(dstDir, null);
  if (dstM == null) warn(`${label} does not exist — the bridge was never compiled. Run: bash .claude/scripts/compile-bridges.sh`);
  else if (srcM != null && srcM - dstM > TOL) {
    warn(`${label} stale — the .claude/ source is newer (${new Date(srcM).toISOString()} vs ${new Date(dstM).toISOString()}). Run: bash .claude/scripts/compile-bridges.sh`);
  } else ok(`${label} up to date against the source`);
}

// TOMLs with a malformed description (symptom of the fragile parser: the description contains "name:")
const codexAgentsDir = path.join(BRAIN, '.codex', 'agents');
try {
  const bad = [];
  for (const f of fs.readdirSync(codexAgentsDir).filter((x) => x.endsWith('.toml'))) {
    const text = fs.readFileSync(path.join(codexAgentsDir, f), 'utf8');
    const m = text.match(/^description = """([\s\S]*?)"""/);
    if (m && (/(^|\s)name:\s/.test(m[1]) || m[1].trim() === '|' || m[1].trim() === '')) bad.push(f);
  }
  if (bad.length) {
    warn(`${bad.length} .toml in .codex/agents/ with a malformed description (symptom of the frontmatter parser): ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ` … (+${bad.length - 6})` : ''}. Recompile: bash .claude/scripts/compile-bridges.sh --target codex`);
  } else {
    ok('.codex/agents/*.toml with no malformed descriptions');
  }
} catch { /* dir does not exist — already reported above */ }

// ── 6. GEMINI.md / AGENTS.md ──────────────────────────────────────────────────
section('6. GEMINI.md / AGENTS.md');

const geminiExists = fs.existsSync(path.join(BRAIN, 'GEMINI.md'));
const agentsMdExists = fs.existsSync(path.join(BRAIN, 'AGENTS.md'));
if (geminiExists && agentsMdExists) ok('GEMINI.md and AGENTS.md exist');
else warn(`${!geminiExists ? 'GEMINI.md ' : ''}${!agentsMdExists ? 'AGENTS.md ' : ''}missing — run: bash .claude/scripts/compile-bridges.sh`);

// Since 2026-08-20 both files are COMPILED from the canonical source (CLAUDE.md + soul.md +
// rules/*) with counts derived from the disk. Check exactly that, instead of warning about
// a static heredoc that no longer exists.
for (const [file, exists] of [['GEMINI.md', geminiExists], ['AGENTS.md', agentsMdExists]]) {
  if (!exists) continue;
  const txt = fs.readFileSync(path.join(BRAIN, file), 'utf8');
  if (!/GENERATED FILE/.test(txt)) {
    warn(`${file} without the "GENERATED FILE" header — it was hand-edited or comes from an old version. Run: bash .claude/scripts/compile-bridges.sh`);
    continue;
  }
  const declared = {
    Skills: txt.match(/^\| Skills \| (\d+) \|/m),
    Agents: txt.match(/^\| Agents \| (\d+) \|/m),
    Commands: txt.match(/^\| Commands \| (\d+) \|/m),
  };
  const real = { Skills: skillFiles.length, Agents: agentFiles.length, Commands: commandFiles.length };
  const bad = Object.entries(declared)
    .filter(([k, m]) => !m || +m[1] !== real[k])
    .map(([k, m]) => `${k}: ${m ? m[1] : 'missing'} (real ${real[k]})`);
  if (bad.length) warn(`${file} out of sync — ${bad.join('; ')}. Run: bash .claude/scripts/compile-bridges.sh`);
  else ok(`${file} compiled from the canonical source and in sync with the disk`);
}

// ── 7. memory/ ────────────────────────────────────────────────────────────────
section('7. memory/');

const soulPath = path.join(BRAIN, 'memory', 'soul.md');
try {
  const soul = fs.readFileSync(soulPath, 'utf8');
  const placeholders = soul.match(/<YOUR_[A-Z_]+>/g);
  if (placeholders) warn(`soul.md still has an unfilled template (${[...new Set(placeholders)].join(', ')}) — run /install or fill in the "User Alignment" section.`);
  else ok('soul.md personalized (no template placeholders)');
} catch {
  err('memory/soul.md missing — JOCA loses its base personality. Restore it from the repo.');
}

for (const d of ['projects', 'feedback']) {
  const p = path.join(BRAIN, 'memory', d);
  if (fs.existsSync(p)) ok(`memory/${d}/ exists`);
  else if (FIX) { fs.mkdirSync(p, { recursive: true }); ok(`--fix: memory/${d}/ created`); }
  else warn(`memory/${d}/ does not exist — /save and /feedback-joca will fail. Run with --fix to create it.`);
}

// ── 8. JOCA_OS (read-only) ────────────────────────────────────────────────────
section('8. JOCA_OS (read-only)');

if (!fs.existsSync(OS_DIR)) {
  warn('JOCA_OS/ does not exist next to JOCA_Brain — visual interface unavailable (fine if you only use the Brain).');
} else {
  const dataDir = path.join(OS_DIR, 'data');
  if (fs.existsSync(dataDir)) {
    const jsons = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
    const broken = [];
    for (const f of jsons) {
      try { JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { broken.push(f); }
    }
    if (broken.length) err(`JOCA_OS/data with invalid JSON: ${broken.join(', ')} — fix it by hand (the doctor does NOT touch JOCA_OS).`);
    else ok(`JOCA_OS/data: ${jsons.length} valid JSON file(s)`);
  } else {
    ok('JOCA_OS/data does not exist yet (it is created on first startup)');
  }
  for (const side of ['backend', 'frontend']) {
    const nm = path.join(OS_DIR, side, 'node_modules');
    if (fs.existsSync(nm)) ok(`JOCA_OS/${side}/node_modules installed`);
    else warn(`JOCA_OS/${side}/node_modules missing — run: cd JOCA_OS && npm run setup (informational).`);
  }
}

// ── 9. Content integrity ──────────────────────────────────────────────────────
// Sections 1-8 count files and validate JSON. None of that catches the toolkit's most
// expensive class of defect: the file exists, the index adds up, and the content points at
// nothing or is unreachable. Four checks, four real failures already paid for.
section('9. Content integrity');

const rulesDir = path.join(BRAIN, '.claude', 'rules');
const DIRS_MD = [
  [skillsDir, 'skills'],
  [agentsDir, 'agents'],
  [commandsDir, 'commands'],
  [rulesDir, 'rules'],
];

// 9a. Cited pointers that do not resolve.
// `anima.md` pointed at 8 files in a `./gsap/` folder that never existed in the repo, and
// `hyperframes.md` at 5 more. An agent reads the skill, tries the Read(), fails, and
// improvises without warning. Only paths ANCHORED in the Brain's tree count: `docs/…` belongs
// to the target project, not here, and `memory/{projects,feedback,knowledge}/` is runtime state.
const RE_PATH = /`((?:\.claude|\.agents|\.codex|memory)\/[A-Za-z0-9._/-]+\.(?:md|mjs|js|cjs|py|sh|json))`/g;
const RUNTIME = /^memory\/(feedback|projects|knowledge|decisions|learnings|checkpoints)\//;
// A CONDITIONAL pointer is not a dead pointer: the skill already handles the absence ("se
// existir", "if it exists"). Without this the check flagged 2 files that 15 skills cite
// deliberately as optional — and a warning that shouts about a non-defect trains the reader
// to ignore the section.
// Bilingual on purpose: the skills imported from third parties are in English.
// The real form in the skills is `If \`<path>\` exists (or …)` — the verb comes AFTER the path,
// so it does not look for a contiguous phrase: it is enough that the line talks about
// existence or about checking.
const OPCIONAL = /\b(exists?|existir|exista|existe|houver|opcional|optional|if present|if available|check for|verifica se)\b/i;
const mortos = new Map();
let pathsVerificados = 0;
for (const [dir, label] of DIRS_MD) {
  for (const f of listMd(dir) || []) {
    let texto;
    try { texto = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    for (const m of texto.matchAll(RE_PATH)) {
      const p = m[1];
      if (/[<>*]/.test(p) || RUNTIME.test(p)) continue;   // placeholder/glob or runtime state
      // The line the path appears on decides: cited as optional -> not a defect.
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
  const linhas = [...mortos.entries()].slice(0, 6).map(([p, quem]) => `${p} (cited in ${quem.length}: ${quem.slice(0, 3).join(', ')}${quem.length > 3 ? '…' : ''})`);
  warn(`${mortos.size} pointer(s) do not resolve out of ${pathsVerificados} cited paths: ${linhas.join(' · ')}${mortos.size > 6 ? ` … (+${mortos.size - 6})` : ''}. Fix the path, create the file, or write "if it exists" when it is optional.`);
} else {
  ok(`${pathsVerificados} path(s) cited in skills/agents/commands/rules resolve on disk`);
}

// 9b. Trigger map coverage.
// A pull from the public repo removed 14 lines from the trigger map with every skill still
// present: 14 existing skills became unreachable, with no error at all. Counting files does
// not detect this.
const triggerAllow = path.join(BRAIN, '.claude', 'scripts', 'trigger-map-allowlist.json');
let allow = [];
if (fs.existsSync(triggerAllow)) {
  try { allow = JSON.parse(fs.readFileSync(triggerAllow, 'utf8')); } catch (e) { warn(`trigger-map-allowlist.json unreadable (${e.message}) — ignored.`); }
}
const allowSet = new Set(Array.isArray(allow) ? allow : allow.skills || []);
try {
  const claudeMd = fs.readFileSync(path.join(BRAIN, 'CLAUDE.md'), 'utf8');
  const i = claudeMd.indexOf('### Trigger Map');
  if (i < 0) {
    warn('CLAUDE.md without a "### Trigger Map" section — skill coverage not verified.');
  } else {
    const mapa = claudeMd.slice(i);
    const semTrigger = skillFiles
      .map((f) => f.slice(0, -3))
      .filter((n) => !allowSet.has(n))
      .filter((n) => !new RegExp('`' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[`/ ]').test(mapa));
    if (semTrigger.length) {
      warn(`${semTrigger.length}/${skillFiles.length} skill(s) with no entry in the CLAUDE.md trigger map — they exist on disk but nothing triggers them: ${semTrigger.slice(0, 8).join(', ')}${semTrigger.length > 8 ? ` … (+${semTrigger.length - 8})` : ''}. Add the trigger line in CLAUDE.md (for sub-skills, the name in backticks on a router line is enough). Alternative: create .claude/scripts/trigger-map-allowlist.json with {"skills":["name"],"motivos":{"name":"why"}} for the ones that are not triggered on their own.`);
    } else {
      ok(`trigger map covers the ${skillFiles.length} skills${allowSet.size ? ` (${allowSet.size} in the allowlist)` : ''}`);
    }
  }
} catch (e) {
  warn(`CLAUDE.md unreadable (${e.message}) — trigger map coverage not verified.`);
}

// 9c. Execution skill with no twin agent.
// Dispatching `unity-ui-agent` failed 3x because the skill existed and the agent did not. It
// cost a whole turn. The curated list lives at the top of skill-agents.mjs — read it from
// there, do not copy it.
try {
  const src = fs.readFileSync(path.join(BRAIN, '.claude', 'scripts', 'skill-agents.mjs'), 'utf8');
  const bloco = src.match(/const EXECUTION_SKILLS = \{([\s\S]*?)\n\};/);
  if (!bloco) {
    warn('skill-agents.mjs with no recognizable EXECUTION_SKILLS block — twin agents not verified.');
  } else {
    const exec = [];
    for (const arr of bloco[1].matchAll(/\[([^\]]*)\]/g)) {
      for (const q of arr[1].matchAll(/['"]([a-z0-9][a-z0-9-]*)['"]/g)) exec.push(q[1]);
    }
    const semSkill = exec.filter((s) => !fs.existsSync(path.join(skillsDir, `${s}.md`)));
    const semAgente = exec.filter((s) => !fs.existsSync(path.join(agentsDir, `${s}-agent.md`)));
    if (semSkill.length) warn(`skill-agents.mjs lists skill(s) that do not exist: ${semSkill.join(', ')} — take them out of the curated list.`);
    if (semAgente.length) {
      warn(`${semAgente.length} execution skill(s) with no twin agent: ${semAgente.slice(0, 8).join(', ')}${semAgente.length > 8 ? ` … (+${semAgente.length - 8})` : ''}. Regenerate: node .claude/scripts/skill-agents.mjs`);
    } else if (!semSkill.length) {
      ok(`${exec.length} execution skill(s) have a twin agent`);
    }
  }
} catch (e) {
  warn(`skill-agents.mjs unreadable (${e.message}) — twin agents not verified.`);
}

// 9d. Line endings of the Windows launchers.
// cmd.exe reads batch by byte offset: a .bat saved with LF comes out truncated line by line
// ('edelayedexpansion' is not recognized). It only shows up when someone tries to start it —
// and there is no gate at all between the edit on the Mac and the startup on Windows.
const bats = [];
for (const d of [OS_DIR, ROOT]) {
  try {
    for (const f of fs.readdirSync(d)) if (/\.(bat|cmd)$/i.test(f)) bats.push(path.join(d, f));
  } catch { /* dir does not exist */ }
}
if (!bats.length) {
  ok('no .bat/.cmd launchers to check');
} else {
  const comLf = bats.filter((p) => {
    const t = fs.readFileSync(p, 'utf8');
    return /\n/.test(t) && /(^|[^\r])\n/.test(t);
  });
  if (!comLf.length) {
    ok(`${bats.length} .bat/.cmd launcher(s) in CRLF`);
  } else if (FIX) {
    for (const p of comLf) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    ok(`--fix: ${comLf.length} launcher(s) converted to CRLF: ${comLf.map((p) => path.basename(p)).join(', ')}`);
  } else {
    // It is only a FAILURE on the machine that runs them. Outside Windows it is a warning:
    // git's `core.autocrlf` may convert on checkout — what you cannot do is count on that,
    // which is why `.gitattributes` (`*.bat eol=crlf`) is the durable fix.
    const msg = `${comLf.length} .bat/.cmd launcher(s) with LF: ${comLf.map((p) => path.basename(p)).join(', ')} — on Windows cmd.exe reads batch by byte offset and truncates every line. Run with --fix and pin it in .gitattributes: *.bat eol=crlf`;
    if (IS_WIN) err(`${msg} (they will NOT start on this machine).`);
    else warn(`${msg} (warning: on this machine you do not run .bat).`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nSummary: ${nOk} ✓ · ${nWarn} ⚠ · ${nErr} ✗${FIX ? ' (--fix mode)' : ''}`);
if (nErr > 0) console.log('There are errors — see the ✗ messages above.');
process.exit(nErr > 0 ? 1 : 0);
