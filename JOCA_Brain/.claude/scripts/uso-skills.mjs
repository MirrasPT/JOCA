#!/usr/bin/env node
// Relatório do registo de uso de skills e agentes (F1.1) — lê `.joca/uso-skills.jsonl`.
//   node .claude/scripts/uso-skills.mjs                  → relatório: usadas · nunca usadas ·
//                                                         sugeridas e não lidas · custo em caracteres
//   node .claude/scripts/uso-skills.mjs --resumo-mensal [AAAA-MM]
//        → memory/uso-skills/AAAA-MM-<maquina>.json (só contagens por nome; sem prompts, sessões nem
//          caminhos). Mês por omissão: o corrente. Gerado — reescreve o do mesmo mês e máquina.
// Raiz: CLAUDE_PROJECT_DIR ou o Brain onde o script vive. `maquina` = a do registo-uso.js (JOCA_MAQUINA, senão win/mac/local).
// Leitura de uma skill numa sessão que a editou (linha `manut` com o mesmo nome) conta como manut.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAQUINA = createRequire(import.meta.url)('../hooks/registo-uso.js').maquina();

function linhas() {
  let txt = '';
  try { txt = fs.readFileSync(path.join(RAIZ, '.joca', 'uso-skills.jsonl'), 'utf8'); } catch { return []; }
  return txt.split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

function nomes(dir) {
  try { return fs.readdirSync(path.join(RAIZ, '.claude', dir)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)); }
  catch { return []; }
}

const conta = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const obj = (m) => Object.fromEntries([...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

function agregar(regs) {
  const manutSessao = new Set(regs.filter((r) => r.tipo === 'manut').map((r) => `${r.sessao}|${r.nome}`));
  const lidaSessao = new Set(regs.filter((r) => r.tipo === 'skill' || r.tipo === 'agente').map((r) => `${r.sessao}|${r.nome}`));
  const skills = new Map(); const agentes = new Map(); const manut = new Map();
  const sugeridas = new Map(); const naoLidas = new Map();
  for (const r of regs) {
    if (r.tipo === 'skill') conta(manutSessao.has(`${r.sessao}|${r.nome}`) ? manut : skills, r.nome);
    else if (r.tipo === 'agente') conta(agentes, r.nome);
    else if (r.tipo === 'manut') conta(manut, r.nome);
    else if (r.tipo === 'sugerida') {
      conta(sugeridas, r.nome);
      if (!lidaSessao.has(`${r.sessao}|${r.nome}`)) conta(naoLidas, r.nome);
    }
  }
  return { skills, agentes, manut, sugeridas, naoLidas };
}

const args = process.argv.slice(2);
const regs = linhas();

if (args[0] === '--resumo-mensal') {
  const mes = args[1] || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) { console.error('uso: --resumo-mensal [AAAA-MM]'); process.exit(2); }
  const a = agregar(regs.filter((r) => String(r.ts).startsWith(mes)));
  const destino = path.join(RAIZ, 'memory', 'uso-skills', `${mes}-${MAQUINA}.json`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify({
    mes, maquina: MAQUINA,
    skills: obj(a.skills), agentes: obj(a.agentes), manut: obj(a.manut),
    sugeridas: obj(a.sugeridas), sugeridas_nao_lidas: obj(a.naoLidas),
  }, null, 2) + '\n');
  console.log(`resumo ${mes} (${MAQUINA}) → ${path.relative(RAIZ, destino).replace(/\\/g, '/')}`);
  process.exit(0);
}

const a = agregar(regs);
const chars = (n) => { try { return fs.readFileSync(path.join(RAIZ, '.claude', 'skills', `${n}.md`), 'utf8').length; } catch { return 0; } };
const lista = (m) => [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
const out = [];
out.push(`# Uso de skills e agentes — ${regs.length} registos (${MAQUINA})`, '');
out.push('## Usadas — skills (leituras · caracteres lidos)');
let total = 0;
for (const [n, c] of lista(a.skills)) { const t = c * chars(n); total += t; out.push(`- ${n}: ${c} · ${t}`); }
out.push(`Custo total em caracteres (tamanho actual × leituras): ${total}`, '');
out.push('## Usados — agentes');
for (const [n, c] of lista(a.agentes)) out.push(`- ${n}: ${c}`);
out.push('', '## Manutenção (leituras/edições numa sessão que edita a skill — fora das usadas)');
for (const [n, c] of lista(a.manut)) out.push(`- ${n}: ${c}`);
const usados = new Set([...a.skills.keys(), ...a.agentes.keys(), ...a.manut.keys()]);
out.push('', '## Nunca usadas');
out.push(`- skills: ${nomes('skills').filter((n) => !usados.has(n)).join(', ') || '—'}`);
out.push(`- agentes: ${nomes('agents').filter((n) => !usados.has(n)).join(', ') || '—'}`);
out.push('', '## Sugeridas e não lidas (sugestões do prompt-triage sem leitura na mesma sessão)');
for (const [n, c] of lista(a.naoLidas)) out.push(`- ${n}: ${c} de ${a.sugeridas.get(n)} sugestões`);
console.log(out.join('\n'));
