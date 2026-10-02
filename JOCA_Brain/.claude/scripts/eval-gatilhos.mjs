#!/usr/bin/env node
// Banco de avaliação dos gatilhos (F1.3): mede se o hook prompt-triage sugere a skill certa.
// Corre o hook REAL (o próprio ficheiro, num contexto vm com stdin/stdout simulados — sem duplicar a
// pontuação) para cada consulta de .claude/evals/gatilhos/<skill>.json e lê a linha « [skill] ...».
//
//   node .claude/scripts/eval-gatilhos.mjs                      → resumo no ecrã
//   node .claude/scripts/eval-gatilhos.mjs --gravar <base.json>  → grava JSON + <base>.md legível
//   node .claude/scripts/eval-gatilhos.mjs --comparar <base.json> → exit 1 se alguma skill desce
//   node .claude/scripts/eval-gatilhos.mjs --brain <dir>         → hook + SKILL_INDEX de outra cópia
//   node .claude/scripts/eval-gatilhos.mjs --auto-teste [skill]  → determinismo + mutação em temp
//   node .claude/scripts/eval-gatilhos.mjs --pares-do-lint       → regrava _pares.json a partir do lint F1.2
//
// Banco: { "skill": "x", "deve": [consultas que devem sugerir x], "quase": [near-miss que não devem] }.
// Métricas: top-1/top-3 sobre «deve»; falsos = «quase» com x no top-3. Pares em _pares.json (do lint).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BANCO = path.join(RAIZ, '.claude', 'evals', 'gatilhos');
const HOOK_REL = path.join('.claude', 'hooks', 'prompt-triage.js');
const require = createRequire(import.meta.url);
const SAIDA = Symbol('exit');

// Corre o hook de <brain> sobre um prompt e devolve as skills sugeridas, por ordem.
function hookDe(brain) {
  const ficheiro = path.join(brain, HOOK_REL);
  const script = new vm.Script(fs.readFileSync(ficheiro, 'utf8').replace(/^#!.*/, ''), { filename: ficheiro });
  return (prompt) => {
    const h = {}; let out = '';
    const proc = {
      stdin: { on: (ev, fn) => { h[ev] = fn; } },
      stdout: { write: (s) => { out += s; } },
      exit: () => { throw SAIDA; },
    };
    script.runInNewContext({
      // O registo de uso (F1.1) não pode receber as consultas do banco: stub sem efeitos.
      require: (m) => (/registo-uso/.test(m) ? { registar() {} } : require(m)), process: proc, Buffer, console, __dirname: path.dirname(ficheiro), __filename: ficheiro,
      setTimeout: () => ({ unref() {} }),
    });
    try { h.data(Buffer.from(JSON.stringify({ prompt }))); h.end(); } catch (e) { if (e !== SAIDA) throw e; }
    const ctx = (JSON.parse(out || '{}').hookSpecificOutput || {}).additionalContext || '';
    const m = ctx.match(/ \[skill\] (.*?) → Read\(/);
    if (!m) return [];
    return m[1].replace(/ «[^»]*»/g, '').replace(/ \(agente\)/g, '').split(', ').map((s) => s.trim()).filter(Boolean);
  };
}

function carregarBanco() {
  const bancos = fs.readdirSync(BANCO).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(BANCO, f), 'utf8')));
  const pares = JSON.parse(fs.readFileSync(path.join(BANCO, '_pares.json'), 'utf8')).pares;
  return { bancos, pares };
}

const pct = (a, n) => (n ? Math.round((1000 * a) / n) / 10 : null);

function avaliar(brain) {
  const sugere = hookDe(brain);
  const { bancos, pares } = carregarBanco();
  const skills = {}; const res = {};
  let n = 0, t1 = 0, t3 = 0, nq = 0, fq = 0;
  for (const b of bancos) {
    const deve = b.deve.map((q) => ({ q, s: sugere(q) }));
    const quase = b.quase.map((q) => ({ q, s: sugere(q) }));
    res[b.skill] = deve;
    const a1 = deve.filter((d) => d.s[0] === b.skill).length;
    const a3 = deve.filter((d) => d.s.includes(b.skill)).length;
    const f = quase.filter((d) => d.s.includes(b.skill));
    skills[b.skill] = {
      deve: deve.length, top1: pct(a1, deve.length), top3: pct(a3, deve.length),
      quase: quase.length, falsos: f.length,
      falhas: deve.filter((d) => d.s[0] !== b.skill).map((d) => ({ q: d.q, sugeriu: d.s })),
      falsosQ: f.map((d) => ({ q: d.q, sugeriu: d.s })),
    };
    n += deve.length; t1 += a1; t3 += a3; nq += quase.length; fq += f.length;
  }
  // Par A/B: acerto nas consultas «deve» dos dois lados, e quantas vezes um lado aparece à frente do outro.
  const antes = (s, x, y) => s.includes(x) && (!s.includes(y) || s.indexOf(x) < s.indexOf(y));
  const paresR = pares.map(([a, b, cos]) => {
    const da = res[a] || [], db = res[b] || [], todos = [...da.map((d) => [a, d.s]), ...db.map((d) => [b, d.s])];
    return {
      par: `${a} / ${b}`, cosseno: cos, consultas: todos.length,
      top1: pct(todos.filter(([x, s]) => s[0] === x).length, todos.length),
      top3: pct(todos.filter(([x, s]) => s.includes(x)).length, todos.length),
      [`${a}→${b}`]: da.filter((d) => antes(d.s, b, a)).length,
      [`${b}→${a}`]: db.filter((d) => antes(d.s, a, b)).length,
      ...(res[a] && res[b] ? {} : { semBanco: [a, b].filter((x) => !res[x]) }),
    };
  });
  return {
    global: { skills: bancos.length, deve: n, top1: pct(t1, n), top3: pct(t3, n), quase: nq, falsos: fq, falsosPct: pct(fq, nq) },
    skills, pares: paresR,
  };
}

const nota = (s) => (s.top1 + s.top3) / 2;
function piores(r, k = 10) {
  return Object.entries(r.skills).sort((a, b) => nota(a[1]) - nota(b[1]) || b[1].falsos - a[1].falsos || a[0].localeCompare(b[0])).slice(0, k);
}
function pioresPares(r, k = 5) {
  return [...r.pares].sort((a, b) => a.top1 - b.top1 || a.top3 - b.top3 || a.par.localeCompare(b.par)).slice(0, k);
}

function resumo(r, data) {
  const g = r.global;
  const L = [`# Linha de base dos gatilhos — ${data}`, '',
    `Hook: \`${HOOK_REL.replace(/\\/g, '/')}\` · índice: \`memory/SKILL_INDEX.json\` · banco: \`.claude/evals/gatilhos/\` (${g.skills} skills).`, '',
    `**Global:** top-1 **${g.top1}%** · top-3 **${g.top3}%** em ${g.deve} consultas «deve» · falsos positivos ${g.falsos}/${g.quase} «quase» (${g.falsosPct}%).`, '',
    '## Piores 10 skills', '', '| Skill | top-1 | top-3 | falsos (quase) |', '|---|---|---|---|',
    ...piores(r).map(([n, s]) => `| \`${n}\` | ${s.top1}% | ${s.top3}% | ${s.falsos}/${s.quase} |`), '',
    '## Piores 5 pares', '', '| Par | top-1 | top-3 | confusão |', '|---|---|---|---|',
    ...pioresPares(r).map((p) => `| ${p.par} | ${p.top1}% | ${p.top3}% | ${Object.entries(p).filter(([k]) => k.includes('→')).map(([k, v]) => `${k} ${v}`).join(' · ')} |`), '',
    '## Todas as skills', '', '| Skill | top-1 | top-3 | falsos |', '|---|---|---|---|',
    ...Object.entries(r.skills).map(([n, s]) => `| \`${n}\` | ${s.top1}% | ${s.top3}% | ${s.falsos}/${s.quase} |`), '',
    '## Todos os pares', '', '| Par | top-1 | top-3 | confusão |', '|---|---|---|---|',
    ...r.pares.map((p) => `| ${p.par} | ${p.top1}% | ${p.top3}% | ${Object.entries(p).filter(([k]) => k.includes('→')).map(([k, v]) => `${k} ${v}`).join(' · ')} |`), ''];
  return L.join('\n');
}

// Regressões face a uma linha de base: top-1/top-3 que descem ou falsos que sobem.
function regressoes(base, r) {
  const out = [];
  for (const [n, b] of Object.entries(base.skills)) {
    const s = r.skills[n];
    if (!s) { out.push(`${n}: sem banco`); continue; }
    if (s.top1 < b.top1) out.push(`${n}: top-1 ${b.top1}% → ${s.top1}%`);
    if (s.top3 < b.top3) out.push(`${n}: top-3 ${b.top3}% → ${s.top3}%`);
    if (s.falsos > b.falsos) out.push(`${n}: falsos ${b.falsos} → ${s.falsos}`);
  }
  return out;
}

function autoTeste(skill) {
  const r1 = avaliar(RAIZ), r2 = avaliar(RAIZ);
  const det = JSON.stringify(r1) === JSON.stringify(r2);
  console.log(`${det ? 'OK ' : 'FALHA'} determinismo: duas corridas ${det ? 'iguais' : 'diferentes'}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-gatilhos-'));
  let detectou = false;
  try {
    for (const rel of [HOOK_REL, path.join('memory', 'SKILL_INDEX.json'), path.join('.claude', 'reference', 'trigger-map.md')]) {
      fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, rel), path.join(tmp, rel));
    }
    const idxF = path.join(tmp, 'memory', 'SKILL_INDEX.json');
    const idx = JSON.parse(fs.readFileSync(idxF, 'utf8'));
    const sem = idx.filter((s) => s.name !== skill);
    if (sem.length === idx.length) throw new Error(`skill ${skill} não está no SKILL_INDEX`);
    fs.writeFileSync(idxF, JSON.stringify(sem));
    const reg = regressoes(r1, avaliar(tmp));
    detectou = reg.some((x) => x.startsWith(`${skill}:`));
    console.log(`${detectou ? 'OK ' : 'FALHA'} mutação: ${skill} retirada do SKILL_INDEX (cópia em temp) → ${reg.length ? reg.join('; ') : 'nenhuma regressão'}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  process.exit(det && detectou ? 0 : 1);
}

// Pares canónicos = os do lint F1.2 (uma só fonte): lê a secção «Pares confundiveis» do validate-skill.py.
function paresDoLint() {
  const cmd = `${process.platform === 'win32' ? 'python' : 'python3'} .claude/scripts/validate-skill.py --all`;
  const out = execSync(cmd, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
  const sec = out.split(/^## Pares confundiveis[^\n]*\n/m)[1];
  if (!sec) throw new Error('secção «Pares confundiveis» não encontrada na saída do lint');
  const pares = [...sec.split(/^## /m)[0].matchAll(/^\s*-\s+([\d.]+)\s+(\S+)\s+<->\s+(\S+)\s*$/gm)].map((m) => [m[2], m[3], Number(m[1])]);
  const data = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(BANCO, '_pares.json'), `${JSON.stringify({ fonte: cmd, data, pares }, null, 1)}\n`);
  console.log(`_pares.json: ${pares.length} pares do lint (${data})`);
}

const arg = (k) => { const i = process.argv.indexOf(k); return i < 0 ? undefined : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
if (arg('--pares-do-lint')) paresDoLint();
else if (arg('--auto-teste')) autoTeste(arg('--auto-teste') === true ? 'laravel-specialist' : arg('--auto-teste'));
else {
  const brain = typeof arg('--brain') === 'string' ? path.resolve(arg('--brain')) : RAIZ;
  const r = avaliar(brain);
  const g = r.global;
  console.log(`top-1 ${g.top1}% · top-3 ${g.top3}% (${g.deve} consultas, ${g.skills} skills) · falsos ${g.falsos}/${g.quase}`);
  for (const [n, s] of piores(r)) console.log(`  pior: ${n} top-1 ${s.top1}% top-3 ${s.top3}% falsos ${s.falsos}/${s.quase}`);
  for (const p of pioresPares(r)) console.log(`  par: ${p.par} top-1 ${p.top1}% top-3 ${p.top3}%`);
  const gravar = arg('--gravar');
  if (typeof gravar === 'string') {
    const data = (gravar.match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
    // Impressão digital do que foi medido: a mesma base só se compara com o mesmo hook/índice.
    const sha = (rel) => createHash('sha256').update(fs.readFileSync(path.join(brain, rel))).digest('hex').slice(0, 12);
    const fontes = { hook: sha(HOOK_REL), indice: sha(path.join('memory', 'SKILL_INDEX.json')), triggerMap: sha(path.join('.claude', 'reference', 'trigger-map.md')) };
    fs.writeFileSync(gravar, `${JSON.stringify({ data, fontes, ...r }, null, 1)}\n`);
    fs.writeFileSync(gravar.replace(/\.json$/, '.md'), resumo(r, data));
    console.log(`gravado: ${gravar} (+ .md)`);
  }
  const comp = arg('--comparar');
  if (typeof comp === 'string') {
    const reg = regressoes(JSON.parse(fs.readFileSync(comp, 'utf8')), r);
    console.log(reg.length ? `REGRESSÕES (${reg.length}):\n  ${reg.join('\n  ')}` : 'sem regressões face à linha de base');
    process.exit(reg.length ? 1 : 0);
  }
}
