#!/usr/bin/env node
/**
 * trigger-map-gen.mjs — gera .claude/reference/trigger-map.md (a tabela detecção → skill).
 *
 * 2026-09-15: a tabela SAIU do JOCA_Brain/CLAUDE.md, onde custava ~12.5k chars em
 * CADA mensagem. O encaminhamento por mensagem é o hook .claude/hooks/prompt-triage.js sobre
 * memory/SKILL_INDEX.json; esta tabela passa a referência on-demand + fonte das pontes
 * AGENTS.md/GEMINI.md (compile-bridges.sh), que não têm o hook. O CLAUDE.md fica com um ponteiro.
 *
 * PORQUÊ: a tabela era escrita à mão, custava ~4.7k tokens em TODAS as sessões e cobria 136 das
 * 159 skills. Uma skill que não está lá é inalcançável por relevância — e o desvio acontece em
 * silêncio (foi assim que 14 skills ficaram órfãs num scrub anterior).
 *
 * O QUE É GERADO vs O QUE É PRESERVADO:
 *   - coluna "Detected"  → GERADA do frontmatter das skills (`triggers:`, com fallback às frases
 *     "MUST be invoked when the user says:" / "Invoke on:" / "Triggers:" da `description:`).
 *     Mesmo parsing do .claude/scripts/build-skill-index.py — não há um segundo dialecto.
 *   - coluna "Activates" → o nome da skill em backticks, FUNDIDO com as anotações manuais de
 *     .claude/scripts/trigger-map-notas.json: `(router — …)`, `(agent)`, `(rule)`, `(modo)`,
 *     `(guard-rail)`, `(plugin externo)`, negritos e notas de desambiguação. Essas anotações NÃO
 *     vivem no frontmatter e são exactamente o que impede o modelo de escolher a skill errada:
 *     perdê-las é regressão. As linhas que não são skills (agentes, rules, commands, plugins)
 *     vivem em `extras` do mesmo ficheiro, verbatim.
 *   - ordem das linhas → `ordem` do notas.json (curada). Skill nova sem entrada aí entra no fim,
 *     por ordem alfabética, e é anunciada na consola.
 *
 * FICHEIRO INTEIRO GERADO: .claude/reference/trigger-map.md não tem conteúdo escrito à mão — o
 * script escreve-o todo (cabeçalho + legenda + bloco entre <!-- TRIGGER-MAP:INICIO --> e
 * <!-- TRIGGER-MAP:FIM -->). O `--check` compara o ficheiro inteiro, byte a byte (salvo CRLF).
 *
 * USO:
 *   node .claude/scripts/trigger-map-gen.mjs            → --check (não escreve; exit 1 se stale)
 *   node .claude/scripts/trigger-map-gen.mjs --check
 *   node .claude/scripts/trigger-map-gen.mjs --apply    → escreve .claude/reference/trigger-map.md
 *   flags extra: --cap N (força o cap de triggers/linha), --orcamento N (tecto de sanidade em tokens, default 10000)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(HERE, '..', '..');
const SKILLS = path.join(BRAIN, '.claude', 'skills');
const NOTAS = path.join(HERE, 'trigger-map-notas.json');
const ALLOWLIST = path.join(HERE, 'trigger-map-allowlist.json');
const REF_MD = path.join(BRAIN, '.claude', 'reference', 'trigger-map.md');

const INICIO = '<!-- TRIGGER-MAP:INICIO -->';
const FIM = '<!-- TRIGGER-MAP:FIM -->';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const flag = (nome, def) => {
  const i = argv.indexOf(nome);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};
// Orçamento: a tabela escrita à mão custava 4.699 tokens (medida do pedido). O bloco gerado não
// pode passar disso — cobre mais skills pelo mesmo preço, não por mais.
// 2026-09-02: baixado de 4450 → 2900. Medido: cap 2 dá 11.389 chars / 2.847 tokens com as MESMAS
// 158/158 skills que o cap 4 (15.944 / 3.986). O 3º e 4º trigger por linha são sinónimos do 1º e
// 2º — pagavam-se 1.139 tokens por mensagem sem acrescentar encaminhamento. Se as skills crescerem
// ao ponto de o cap 2 não caber, o gerador desce sozinho a cap 1 (ainda 158/158, matching mais fino).
// 2026-09-15: 2900 → 3150 (decisão do utilizador) para caberem as 14 skills novas do /upgrade-joca; a mesma corrida
// cortou ~560 tokens às rules, o saldo por mensagem continua negativo. Sai quando a tabela sair do CLAUDE.md.
// 2026-09-15: a tabela saiu do contexto fixo para .claude/reference/trigger-map.md, lida
// on-demand. O orçamento apertado deixou de ter razão de ser: cap fixo 4 (o 3º/4º trigger voltam —
// sinónimos custam só quando alguém abre a referência) e o orçamento passa a TECTO DE SANIDADE
// (10000 tokens) que só apanha uma skill com frontmatter descontrolado, não uma regra de custo.
const ORCAMENTO_TOKENS = flag('--orcamento', 10000);
const CAP_FORCADO = flag('--cap', 0);
const CAP_DEFAULT = 4;
const MAX_CHARS_LINHA = 140;  // travão por linha: uma skill verbosa não transforma a tabela em prosa

// ── parsing do frontmatter (porte de build-skill-index.py: mesmas regras, mesmo resultado) ─────

function parseFrontmatter(texto) {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/.exec(texto);
  if (!m) return {};
  const fm = {};
  const linhas = m[1].split(/\r?\n/);
  let i = 0;
  while (i < linhas.length) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(linhas[i]);
    if (!kv) { i++; continue; }
    const chave = kv[1];
    let val = kv[2].trim();
    // Block scalars YAML (`description: |` / `>`): o valor vive nas linhas indentadas seguintes.
    if (['|', '>', '|-', '>-', '|+', '>+'].includes(val)) {
      const fold = val.startsWith('>');
      const bloco = [];
      i++;
      while (i < linhas.length && (linhas[i].trim() === '' || /^[ \t]/.test(linhas[i]))) {
        bloco.push(linhas[i].trim());
        i++;
      }
      fm[chave] = bloco.filter(Boolean).join(fold ? ' ' : '\n');
      continue;
    }
    fm[chave] = val.replace(/^["']|["']$/g, '');
    i++;
  }
  return fm;
}

// Frases de invocação que vivem DENTRO da description. 43% das skills só têm os triggers assim.
const FRASES = [
  /MUST be invoked when(?:ever)? the user (?:says|mentions)/,
  /MUST be invoked when(?:ever)? the user/,
  /MUST be invoked when/,
  /SHOULD also invoke when/,
  /Invocar quando o utilizador disser/,
  /Invocar quando/,
  /Invoke on/,
  /Triggered by/,
  /Triggers?/,
];

function extrairTriggers(texto, description) {
  const out = [];

  // frontmatter `triggers: a, b, c`
  const inline = /^triggers?:[ \t]*(?!\r?\n)(.+)$/m.exec(texto);
  if (inline) for (const it of inline[1].split(',')) { const v = limpa(it); if (v) out.push(v); }

  // frontmatter `triggers:` em lista YAML
  const lista = /^triggers?:\s*\r?\n((?:[ \t]+-[ \t]+.+\r?\n)+)/m.exec(texto);
  if (lista) {
    for (const l of lista[1].split(/\r?\n/)) {
      const mm = /^[ \t]+-[ \t]+(.+)$/.exec(l);
      if (mm) { const v = limpa(mm[1]); if (v) out.push(v); }
    }
  }

  // frases dentro da description (nunca contra o ficheiro todo: passaria a apanhar chain:/compatibility:)
  for (const frase of FRASES) {
    const re = new RegExp(frase.source + ':\\s*([\\s\\S]+?)(?:\\.\\s|\\.$|$)', 'gi');
    let m;
    while ((m = re.exec(description || '')) !== null) {
      for (const it of m[1].split(',')) {
        const v = limpa(it);
        if (v && v.length <= 60 && (v.split(' ').length - 1) <= 6) out.push(v);
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  return dedup(out);
}

const limpa = (s) => s.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\.$/, '').trim();
const norm = (s) => s.toLowerCase().replace(/[\s\-_./]+/g, '');
const palavras = (s) => s.toLowerCase().split(/[\s\-_/]+/).filter(Boolean);

function dedup(lista) {
  const visto = new Set(), out = [];
  for (const t of lista) {
    const k = norm(t);
    if (k && !visto.has(k)) { visto.add(k); out.push(t); }
  }
  return out;
}

// ── selecção dos triggers mais distintivos ─────────────────────────────────────────────────────

/** Corta os que outro trigger da MESMA linha já contém ("wp" cobre "wp-cli"): sinónimos fora. */
function podarRedundantes(triggers) {
  const espac = triggers.map((t) => ' ' + palavras(t).join(' ') + ' ');
  return triggers.filter((_, i) => !espac.some((outro, j) => j !== i && espac[i] !== outro
    && (espac[i].includes(outro) || (espac[i] === outro && j < i))));
}

/**
 * Selecção: a ORDEM do frontmatter é a classificação do autor — `laravel-specialist` começa em
 * "Laravel, Eloquent, Artisan", `frontend` em "website, landing page, site". Ordenar por
 * raridade (IDF) foi tentado e deitou fora exactamente a palavra de entrada mais usada,
 * deixando o `frontend` a disparar por "tile grid" e o `laravel-specialist` sem "Laravel".
 * Portanto: podar sinónimos, ficar com os primeiros `cap`, e cortar pela cauda até caber.
 */
function escolher(triggers, cap) {
  const podados = podarRedundantes(triggers);
  const base = podados.length ? podados : triggers;
  const escolhidos = base.slice(0, cap);
  while (escolhidos.length > 2 && escolhidos.join(' · ').length > MAX_CHARS_LINHA) escolhidos.pop();
  return escolhidos;
}

// ── carregar skills + notas ────────────────────────────────────────────────────────────────────

function lerJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function carregarSkills() {
  const allowRaw = lerJson(ALLOWLIST, {});
  const allow = new Set(Array.isArray(allowRaw) ? allowRaw : (allowRaw.skills || allowRaw.allow || []));
  const out = [];
  for (const f of fs.readdirSync(SKILLS).filter((x) => x.endsWith('.md')).sort()) {
    const nome = f.slice(0, -3);
    if (allow.has(nome)) continue;
    const texto = fs.readFileSync(path.join(SKILLS, f), 'utf8');
    const fm = parseFrontmatter(texto);
    out.push({ nome, triggers: extrairTriggers(texto, fm.description || '') });
  }
  return { skills: out, allow: [...allow].sort() };
}

// ── render ─────────────────────────────────────────────────────────────────────────────────────

const escapaCelula = (s) => s.replace(/\|/g, '\\|');

function render(skills, notas, cap) {
  const porNome = new Map(skills.map((s) => [s.nome, s]));

  const ordem = Array.isArray(notas.ordem) ? notas.ordem.slice() : [];
  const anotacoes = notas.anotacoes || {};
  const extras = notas.extras || {};
  const manuais = notas.detected_manual || {};

  const naOrdem = new Set(ordem);
  const novas = skills.map((s) => s.nome).filter((n) => !naOrdem.has(n)).sort();
  const linhasChave = ordem.concat(novas);

  const linhas = [];
  const semTriggers = [];
  const usadas = new Set();
  for (const chave of linhasChave) {
    if (chave.startsWith('extra:')) {
      const ex = extras[chave];
      if (ex) linhas.push(`| ${ex.detected} | ${ex.activates} |`);
      continue;
    }
    const sk = porNome.get(chave);
    if (!sk) continue;                       // skill apagada (ou allowlisted) — linha cai
    if (usadas.has(chave)) continue;
    usadas.add(chave);
    const det = escolher(sk.triggers, cap);
    // `detected_manual` é FALLBACK, não override: só entra quando o frontmatter não dá nada
    // (skills de terceiros que só têm prosa "Use when …"). Assim não se pode usar para
    // contornar a geração — se a skill ganhar `triggers:`, o gerado passa à frente.
    if (!det.length) semTriggers.push(chave + (manuais[chave] ? ' (usou detected_manual)' : ''));
    const detected = det.length
      ? det.map(escapaCelula).join(' · ')
      : (manuais[chave] || chave);
    const activates = anotacoes[chave] || '`' + chave + '`';
    linhas.push(`| ${detected} | ${activates} |`);
  }

  const bloco = [
    '# Trigger Map — detecção → skill',
    '',
    '<!-- gerado por .claude/scripts/trigger-map-gen.mjs (anotações: trigger-map-notas.json) — não editar à mão -->',
    '',
    'Referência **on-demand** — não é auto-carregada. O encaminhamento a cada mensagem é o hook',
    '`.claude/hooks/prompt-triage.js` sobre `memory/SKILL_INDEX.json`; esta tabela serve para consulta',
    'e alimenta as pontes `AGENTS.md`/`GEMINI.md` (`compile-bridges.sh`), que não têm o hook.',
    '',
    '## Trigger Map',
    'Sufixo = tipo do componente: **sem sufixo → skill** (`.claude/skills/`); `(agent)`, `(rule)`, `(modo)`, `(auto)`, `(agent + skill)`, `(plugin externo)` → o que diz. Tabela gerada: anotar em `.claude/scripts/trigger-map-notas.json`, nunca à mão.',
    INICIO,
    '| Detected | Activates |',
    '|---|---|',
    ...linhas,
    FIM,
  ].join('\n');

  return { bloco, linhas: linhas.length, semTriggers, novas, cobertas: usadas.size };
}

// ── main ───────────────────────────────────────────────────────────────────────────────────────

const { skills, allow } = carregarSkills();
const notas = lerJson(NOTAS, {});
if (!notas.ordem) {
  console.error(`[trigger-map] ERRO: ${NOTAS} sem "ordem" — as anotações manuais (router/agent/rule/notas) viriam vazias e isso é regressão. Aborta.`);
  process.exit(2);
}

let md = null;
try { md = fs.readFileSync(REF_MD, 'utf8'); } catch { /* 1ª corrida: o ficheiro ainda não existe */ }

// Cap fixo (determinístico: mesmo input → mesmo ficheiro). O orçamento é só tecto de sanidade.
const cap = CAP_FORCADO || CAP_DEFAULT;
const r = render(skills, notas, cap);
const tokens = Math.round(r.bloco.length / 4);
const { bloco, linhas, semTriggers, novas, cobertas } = r;

// O ficheiro inteiro é gerado: a comparação é byte a byte, e o `--apply` é idempotente (2ª corrida = 0 bytes).
const saida = `${bloco}\n`;
// CRLF ≠ drift: num clone Windows com core.autocrlf=true o checkout traz o ficheiro em CRLF, e o
// byte a byte acusava stale num clone acabado de fazer (o doctor dava ⚠ sem nada desactualizado).
const igual = md != null && saida === md.replace(/\r\n/g, '\n');

console.log(`[trigger-map] ${linhas} linhas · ${cobertas}/${skills.length} skills · cap ${cap} triggers/linha · ${bloco.length} chars ≈ ${tokens} tokens (tecto ${ORCAMENTO_TOKENS}; referência on-demand, fora do contexto fixo)`);
if (allow.length) console.log(`[trigger-map] fora por allowlist (${allow.length}): ${allow.join(', ')}`);
if (novas.length) console.log(`[trigger-map] skills novas acrescentadas no fim (sem lugar em notas.ordem): ${novas.join(', ')}`);
if (semTriggers.length) console.log(`[trigger-map] AVISO sem triggers extraíveis (linha ficou só com o nome): ${semTriggers.join(', ')}`);
if (cobertas !== skills.length) {
  const faltam = skills.map((s) => s.nome).filter((n) => !bloco.includes('`' + n + '`'));
  console.log(`[trigger-map] AVISO ${skills.length - cobertas} skill(s) fora da tabela: ${faltam.join(', ')}`);
}
if (tokens > ORCAMENTO_TOKENS) {
  console.error(`[trigger-map] ERRO: ${tokens} tokens > tecto de sanidade ${ORCAMENTO_TOKENS} — há frontmatter descontrolado, ou força --cap menor.`);
  process.exit(2);
}

if (!apply) {
  if (igual) { console.log('[trigger-map] --check: em dia.'); process.exit(0); }
  console.error('[trigger-map] --check: DESACTUALIZADO — corre `node .claude/scripts/trigger-map-gen.mjs --apply`.');
  process.exit(1);
}

if (igual) { console.log('[trigger-map] --apply: já em dia, nada escrito.'); process.exit(0); }
fs.mkdirSync(path.dirname(REF_MD), { recursive: true });
fs.writeFileSync(REF_MD, saida, 'utf8');
console.log(`[trigger-map] --apply: tabela escrita em ${REF_MD}.`);
