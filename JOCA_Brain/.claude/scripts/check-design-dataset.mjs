#!/usr/bin/env node
// check-design-dataset.mjs — valida a coluna Display do design-dataset contra a lista de bans.
//
// Motivo: o `design-dataset.md` ofereceu `Space Grotesk` como display no par "Geo-humanista"
// enquanto o `anti-slop-bans.md` a bane como hard-reject. Um agente recebeu a combinação num
// brief e construiu uma variante inteira sobre um hard-reject.
//
// Uso:
//   node .claude/scripts/check-design-dataset.mjs
//
// Exit code: 0 = sem contradições · 2 = pelo menos uma fonte de display banida · 1 = ficheiro em falta.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(SCRIPT_DIR, '..', '..');

const DATASET = path.join(BRAIN, '.claude', 'reference', 'design-dataset.md');
const BANS = path.join(BRAIN, '.claude', 'reference', 'frontend', 'anti-slop-bans.md');

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const dataset = read(DATASET);
const bans = read(BANS);
if (dataset == null || bans == null) {
  console.log(`ficheiro em falta: ${dataset == null ? '.claude/reference/design-dataset.md' : ''}${bans == null ? ' .claude/reference/frontend/anti-slop-bans.md' : ''}`.trim());
  process.exit(1);
}

// ── Coluna Display do dataset ────────────────────────────────────────────────
// Tabelas markdown cujo header tenha uma coluna "Display".
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const pairs = [];   // { nome, display }
let col = -1, nameCol = 0;
for (const line of dataset.split(/\r?\n/)) {
  if (!line.trim().startsWith('|')) { col = -1; continue; }
  const c = cells(line);
  if (col === -1) {
    const i = c.findIndex((x) => /^display$/i.test(x));
    if (i >= 0) { col = i; nameCol = i === 0 ? 1 : 0; }
    continue;
  }
  if (/^-+$/.test((c[0] || '').replace(/[: ]/g, ''))) continue;  // linha separadora
  const display = (c[col] || '').replace(/\([^)]*\)/g, '').replace(/[`*]/g, '').trim();
  if (display) pairs.push({ nome: c[nameCol] || '?', display });
}

if (!pairs.length) {
  console.log('nenhuma tabela com coluna "Display" encontrada em design-dataset.md — parser desactualizado?');
  process.exit(1);
}

// ── Fontes banidas como display ──────────────────────────────────────────────
// Só linhas do anti-slop-bans que falam de display/heading (evita apanhar menções a body fallback).
const banLines = bans.split(/\r?\n/).filter((l) => /display|heading|hard-reject|⬛/i.test(l));

const findings = [];
for (const { nome, display } of pairs) {
  const esc = display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-z-])${esc}([^A-Za-z-]|$)`);
  const hit = banLines.find((l) => re.test(l));
  if (hit) findings.push({ nome, display, hit: hit.trim() });
}

if (!findings.length) {
  console.log(`${pairs.length} par(es) tipográfico(s) verificados — nenhuma fonte de display banida.`);
  process.exit(0);
}

for (const f of findings) {
  console.log(`"${f.nome}" usa "${f.display}" como Display, mas anti-slop-bans.md bane-a: ${f.hit.slice(0, 120)}`);
}
process.exit(2);
