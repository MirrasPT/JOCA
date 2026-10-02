#!/usr/bin/env node
// Escolha de modelo + effort por agente — passo opcional do /install e do /update-joca (F2.9).
//
// Cada agente traz uma SUGESTÃO em campos que o Claude Code ignora (campo desconhecido no
// frontmatter é ignorado sem erro — https://code.claude.com/docs/en/sub-agents):
//   modelo-sugerido: sonnet | opus | haiku | inherit
//   effort-sugerido: low | medium | high | xhigh | max
//   porque-modelo:   "1 linha"
// A sugestão NÃO se activa sozinha. Só `--aplicar` escreve `model:`/`effort:` (os campos oficiais),
// e só com o que o utilizador escolheu. A escolha fica em `.claude/modelos-agentes.local.json` e
// `--reaplicar` repõe-na depois de um update ou de regenerar os agentes.
// Por omissão os agentes saem com `model: inherit` e sem `effort:` (herdam da sessão); a sugestão
// fica escrita nos campos acima, inactiva, até o utilizador a confirmar.
//
// Uso:
//   node .claude/scripts/modelos-agentes.mjs --tabela [--todos] [--json]
//       agentes ainda sem escolha (com --todos: todos). --json devolve um ficheiro de escolhas
//       já preenchido com as sugestões, pronto a editar e a passar a --aplicar.
//   node .claude/scripts/modelos-agentes.mjs --aplicar <escolhas.json>
//       { "agentes": { "<nome>": { "model": "sonnet", "effort": "low" } } }
//       model: inherit | sonnet | opus | haiku | fable | claude-<id> | manter (regista o actual)
//       effort: low | medium | high | xhigh | max | null (tira a linha: herda da sessão)
//   node .claude/scripts/modelos-agentes.mjs --reaplicar
//       repõe todas as escolhas guardadas (correr depois de importar/regenerar agentes).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AGENTS = path.join(ROOT, '.claude', 'agents');
const ESCOLHAS = path.join(ROOT, '.claude', 'modelos-agentes.local.json');

const MODELOS = /^(inherit|sonnet|opus|haiku|fable|claude-[a-z0-9-]+)$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// ── Hash dos agentes gerados (cópia exacta do skill-agents.mjs) ────────────────
// Um agente gerado leva `content-hash`. Mudar-lhe `model:` sem voltar a selar fazia o gerador
// tratá-lo como «editado à mão» e deixar de o regenerar. Só se re-sela se o hash batia ANTES —
// senão havia edições manuais e selar por cima entregava-as ao gerador para as apagar.
const HASH_LINE = /^content-hash: .*$\n?/m;
const bodyHash = (text) =>
  crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n').replace(HASH_LINE, '')).digest('hex').slice(0, 16);
const storedHash = (text) => (text.match(/^content-hash: (\w+)$/m) || [])[1] || '';

// ── Frontmatter (só chaves de 1 linha — é o que interessa aqui) ────────────────
function lerAgente(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const fm = {};
  if (m) for (const l of m[1].split('\n')) {
    const kv = l.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { raw, eol, text, fm, temFm: !!m };
}

function listarAgentes() {
  return fs.readdirSync(AGENTS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ nome: f.slice(0, -3), file: path.join(AGENTS, f), ...lerAgente(path.join(AGENTS, f)) }));
}

function lerEscolhas() {
  if (!fs.existsSync(ESCOLHAS)) return { agentes: {} };
  const j = JSON.parse(fs.readFileSync(ESCOLHAS, 'utf8'));
  return { ...j, agentes: j.agentes || {} };
}

function gravarEscolhas(j) {
  j._nota = 'Escolhas de modelo/effort por agente (F2.9). Edita-se com modelos-agentes.mjs --aplicar; '
    + '--reaplicar repõe-nas depois de /update-joca ou de regenerar agentes.';
  fs.writeFileSync(ESCOLHAS, JSON.stringify(j, null, 2) + '\n');
}

// Trocar/inserir/tirar uma chave de 1 linha no frontmatter, sem tocar no resto.
function definirChave(text, chave, valor, depoisDe) {
  const end = text.indexOf('\n---\n', 4);
  let fm = text.slice(4, end);
  const rest = text.slice(end);
  const re = new RegExp(`^${chave}:.*$`, 'm');
  if (valor === null) {
    fm = fm.replace(new RegExp(`^${chave}:.*\\n?`, 'm'), '').replace(/\n$/, '');
  } else if (re.test(fm)) {
    fm = fm.replace(re, `${chave}: ${valor}`);
  } else {
    // Âncora = chave de 1 linha (nunca `tools:`/`skills:`, que podem abrir uma lista YAML).
    const k = depoisDe.find((x) => new RegExp(`^${x}:\\s*\\S`, 'm').test(fm));
    fm = k
      ? fm.replace(new RegExp(`^${k}:.*$`, 'm'), (l) => `${l}\n${chave}: ${valor}`)
      : `${fm}\n${chave}: ${valor}`;
  }
  return `---\n${fm}${rest}`;
}

function aplicarNoFicheiro(ag, model, effort) {
  if (!ag.temFm) return 'sem-frontmatter';
  const gerado = !!storedHash(ag.text);
  const hashOk = gerado && bodyHash(ag.text) === storedHash(ag.text);
  let t = definirChave(ag.text, 'model', model, ['description']);
  t = definirChave(t, 'effort', effort, ['model']);
  if (t === ag.text) return 'igual';
  if (hashOk) t = t.replace(HASH_LINE, `content-hash: ${bodyHash(t)}\n`);
  fs.writeFileSync(ag.file, ag.eol === '\r\n' ? t.replace(/\n/g, '\r\n') : t);
  return gerado && !hashOk ? 'mudou (gerado já editado à mão: hash não re-selado)' : 'mudou';
}

function sugestao(fm) {
  const m = fm['modelo-sugerido'];
  // Sem sugestão → «manter»: «aplicar todas» nunca mexe em quem não tem recomendação (D3).
  if (!m) return { model: 'manter', effort: null, porque: 'sem sugestão no agente — fica como está' };
  return { model: m, effort: fm['effort-sugerido'] || null, porque: fm['porque-modelo'] || '' };
}

const ROTULO = { manter: 'manter o actual', inherit: 'herdar do chat principal', sonnet: 'Sonnet', opus: 'Opus', haiku: 'Haiku', fable: 'Fable' };
const rot = (m, e) => `${ROTULO[m] || m}${e ? ' · ' + e : ''}`;

// ── Comandos ──────────────────────────────────────────────────────────────────
function tabela({ todos, json }) {
  const escolhas = lerEscolhas().agentes;
  const linhas = listarAgentes()
    .filter((a) => todos || !escolhas[a.nome])
    .map((a) => ({ nome: a.nome, actual: rot(a.fm.model || 'inherit', a.fm.effort), ...sugestao(a.fm) }));
  if (json) {
    const out = { agentes: {} };
    for (const l of linhas) out.agentes[l.nome] = { model: l.model, effort: l.effort, actual: l.actual, porque: l.porque };
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (!linhas.length) { console.log('[modelos-agentes] todos os agentes já têm escolha. Nada a perguntar.'); return; }
  const ordem = ['sonnet', 'haiku', 'opus', 'fable', 'inherit', 'manter'];
  linhas.sort((a, b) => ordem.indexOf(a.model) - ordem.indexOf(b.model) || (a.effort || '').localeCompare(b.effort || '') || a.nome.localeCompare(b.nome));
  console.log(`[modelos-agentes] ${linhas.length} agente(s) ${todos ? 'no total' : 'sem escolha'}:\n`);
  console.log('| Agente | Actual | Sugestão | Porquê |');
  console.log('|---|---|---|---|');
  for (const l of linhas) console.log(`| ${l.nome} | ${l.actual} | ${rot(l.model, l.effort)} | ${l.porque} |`);
}

function validar(nome, e) {
  if (!e || typeof e !== 'object') return `${nome}: escolha inválida`;
  if (e.model !== 'manter' && !MODELOS.test(e.model || '')) return `${nome}: model inválido «${e.model}»`;
  if (e.effort != null && !EFFORTS.includes(e.effort)) return `${nome}: effort inválido «${e.effort}»`;
  return null;
}

function aplicar(ficheiro) {
  const entrada = JSON.parse(fs.readFileSync(ficheiro, 'utf8'));
  const pedido = entrada.agentes || entrada;
  const agentes = Object.fromEntries(listarAgentes().map((a) => [a.nome, a]));
  const erros = [];
  for (const [nome, e] of Object.entries(pedido)) {
    if (nome.startsWith('_')) continue;
    if (!agentes[nome]) { erros.push(`${nome}: agente não existe`); continue; }
    const err = validar(nome, e); if (err) erros.push(err);
  }
  if (erros.length) { console.error('[modelos-agentes] nada aplicado:\n  ' + erros.join('\n  ')); process.exit(1); }

  const guardado = lerEscolhas();
  const hoje = new Date().toISOString().slice(0, 10);
  let mudou = 0;
  for (const [nome, e] of Object.entries(pedido)) {
    if (nome.startsWith('_')) continue;
    const ag = agentes[nome];
    const model = e.model === 'manter' ? (ag.fm.model || 'inherit') : e.model;
    const effort = e.model === 'manter' ? (ag.fm.effort || null) : (e.effort ?? null);
    const r = aplicarNoFicheiro(ag, model, effort);
    if (r.startsWith('mudou')) mudou++;
    if (r !== 'igual' && r !== 'mudou') console.log(`  ${nome}: ${r}`);
    guardado.agentes[nome] = { model, effort, em: hoje };
  }
  gravarEscolhas(guardado);
  console.log(`[modelos-agentes] ${Object.keys(pedido).filter((n) => !n.startsWith('_')).length} escolha(s) guardada(s), ${mudou} ficheiro(s) alterado(s).`);
}

function reaplicar() {
  const { agentes: escolhas } = lerEscolhas();
  const agentes = Object.fromEntries(listarAgentes().map((a) => [a.nome, a]));
  let mudou = 0; const orfaos = [];
  for (const [nome, e] of Object.entries(escolhas)) {
    if (!agentes[nome]) { orfaos.push(nome); continue; }
    if (validar(nome, e)) { console.log(`  ${nome}: escolha inválida, ignorada`); continue; }
    const r = aplicarNoFicheiro(agentes[nome], e.model, e.effort ?? null);
    if (r.startsWith('mudou')) mudou++;
    if (r !== 'igual' && r !== 'mudou') console.log(`  ${nome}: ${r}`);
  }
  console.log(`[modelos-agentes] reaplicadas ${Object.keys(escolhas).length - orfaos.length} escolha(s), ${mudou} ficheiro(s) reposto(s).`);
  if (orfaos.length) console.log(`[modelos-agentes] escolhas de agentes que já não existem (ignoradas): ${orfaos.join(', ')}`);
}

const a = process.argv.slice(2);
if (a.includes('--tabela')) tabela({ todos: a.includes('--todos'), json: a.includes('--json') });
else if (a.includes('--aplicar')) {
  const f = a[a.indexOf('--aplicar') + 1];
  if (!f) { console.error('uso: --aplicar <escolhas.json>'); process.exit(2); }
  aplicar(f);
} else if (a.includes('--reaplicar')) reaplicar();
else { console.error('uso: modelos-agentes.mjs --tabela [--todos] [--json] | --aplicar <f.json> | --reaplicar'); process.exit(2); }
