#!/usr/bin/env node
// check-skill-promises.mjs — auditoria HEURÍSTICA: o que a `description` promete existe no corpo?
//
// Motivo: `design-tokens.md` (392 linhas) descrevia-se como cobrindo "colors, spacing, typography"
// e não tinha um único token tipográfico. A `description` é o que alimenta o matching por
// relevância — a skill era escolhida para trabalho que não sabia fazer.
//
// ⚠ HEURÍSTICO, com falsos positivos por desenho: as descriptions são bilingues (PT+EN) e o corpo
// costuma ser inglês, portanto "responsivo" vs "responsive" conta como ausente. Calibração medida
// nesta instalação: ~83 de 146 skills têm ≥1 promessa "ausente" — a esmagadora maioria é morfologia
// ou tradução, não buraco real. Por isso NÃO entra no diagnóstico normal do `joca-doctor`; corre-se
// à mão, ou pelo `joca-doctor --promises`, e lê-se como lista de candidatos a inspecção manual.
//
// Sinal utilizável: só enumerações da `description` ("a, b, c" — promessa explícita de cobertura),
// e só se sinaliza a skill a partir de MIN_MISSING promessas ausentes (o caso design-tokens).
//
// Uso:
//   node .claude/scripts/check-skill-promises.mjs           # top 15
//   node .claude/scripts/check-skill-promises.mjs --all     # todas
//   node .claude/scripts/check-skill-promises.mjs --min 2   # baixar o limiar
//
// Exit code: sempre 0 (report-only — heurística não trava nada).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(SCRIPT_DIR, '..', '..');
const SKILLS = path.join(BRAIN, '.claude', 'skills');

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const minIdx = argv.indexOf('--min');
const MIN_MISSING = minIdx >= 0 ? Math.max(1, parseInt(argv[minIdx + 1], 10) || 3) : 3;
const TOP = 15;

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STOP = new Set(['etc', 'outros', 'others', 'mais', 'more', 'entre', 'and', 'com', 'para']);

let files = [];
try { files = fs.readdirSync(SKILLS).filter((f) => f.endsWith('.md')); } catch {
  console.log('.claude/skills/ não encontrado.');
  process.exit(0);
}

const rows = [];
for (const f of files) {
  let text;
  try { text = fs.readFileSync(path.join(SKILLS, f), 'utf8'); } catch { continue; }
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) continue;
  const body = norm(text.slice(fm[0].length));
  const desc = ((fm[1].match(/^description:\s*(.*)$/m) || [])[1] || '').replace(/^["']|["']$/g, '');
  if (!desc) continue;

  const missing = [];
  // Enumerações de ≥3 itens: "colors, spacing, typography"
  for (const m of norm(desc).matchAll(/([a-z][a-z0-9+/ -]{2,30})(,\s*[a-z][a-z0-9+/ -]{2,30}){2,}/g)) {
    for (const item of m[0].split(',').map((s) => s.trim())) {
      const w = item.split(/[ /]/).filter((x) => x.length >= 6).pop();
      if (!w || STOP.has(w) || missing.includes(w)) continue;
      if (!body.includes(w.slice(0, 6))) missing.push(w);   // prefixo-6 absorve plural/conjugação
    }
  }
  if (missing.length >= MIN_MISSING) rows.push({ f, missing });
}

rows.sort((a, b) => b.missing.length - a.missing.length);

if (!rows.length) {
  console.log(`nenhuma skill com ≥${MIN_MISSING} promessas ausentes (heurístico).`);
  process.exit(0);
}

console.log(`${rows.length} skill(s) com ≥${MIN_MISSING} palavras da \`description\` ausentes do corpo (heurístico — confirmar à mão):`);
for (const r of (ALL ? rows : rows.slice(0, TOP))) {
  console.log(`  ${r.f} (${r.missing.length}): ${r.missing.join(', ')}`);
}
if (!ALL && rows.length > TOP) console.log(`  … (+${rows.length - TOP}; usa --all)`);
process.exit(0);
