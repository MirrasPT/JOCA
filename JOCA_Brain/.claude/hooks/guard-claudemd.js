#!/usr/bin/env node
// PreToolUse(Edit|Write) hook — guarda anti-inchaço dos CLAUDE.md (+ aviso de orçamento das rules).
// Actua quando o basename do alvo é `CLAUDE.md` (qualquer caminho, incl. o global do user), e avisa
// quando um `.claude/rules/*.md` cresce.
// 1. BLOQUEIA linhas NOVAS gordas (>250 chars) com detalhe de projecto (caminhos de disco, ou linha de
//    tabela com path entre backticks) em TODOS os CLAUDE.md — global e de projecto. Decisão D2
//    (2026-09-15), contra a proposta de só avisar no de projecto: o detalhe vai para
//    memory/projects/<slug>/ e o `/save` PASSO 3 já não o manda para o CLAUDE.md do projecto.
// 2. Acima do orçamento de tamanho (default 12000; excepções em claudemd-budget.json): BLOQUEIA
//    crescimento > MAX_CRESCIMENTO só no CLAUDE.md global; nos outros, aviso.
// 3. Antes de deixar passar uma edição a um CLAUDE.md existente, cópia carimbada em
//    <JOCA_Brain>/.joca/backups/claudemd/ (gitignored; últimas BACKUPS_POR_FICHEIRO por ficheiro).
//    O `~/CLAUDE.md` não está em git: sem isto uma escrita má não tinha volta.
// 4. `.claude/rules/*.md` que cresce → aviso (carregado em todas as mensagens; mover para reference/).
// Modo leitura: `node guard-claudemd.js --auditar <CLAUDE.md> [...]` lista as linhas gordas JÁ
// existentes (imunes ao bloqueio, que só vê linhas novas) + tamanho vs orçamento. Exit 1 se houver.
// Fail-OPEN: qualquer erro → allow (um hook que crasha bloqueia o trabalho todo).
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_LINHA = 250;
const BUDGET_DEFAULT = 12000;
const MAX_CRESCIMENTO = 200; // acima do orçamento, o crescimento máximo tolerado por edição
const EXCERTO = 80;
const BACKUPS_POR_FICHEIRO = 20;
const DIR_BACKUP = path.join(__dirname, '..', '..', '.joca', 'backups', 'claudemd');

function allow() { process.exit(0); }

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_) { return ''; }
}

// Linha "de projecto": caminho de disco, ou linha de tabela md com path entre backticks.
const RE_PATH = /([A-Za-z]:\\)|(\/Users\/)|(\\Users\\)/;

// Só os spans de código (1º, 3º, … backtick). Um regex ingénuo casa o texto ENTRE dois
// spans e dá falso positivo a qualquer `x` … barra … `y` na mesma linha.
function temPathEmBackticks(linha) {
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(linha)) !== null) if (/[\/\\]/.test(m[1])) return true;
  return false;
}

function pareceProjecto(linha) {
  if (RE_PATH.test(linha)) return true;
  return linha.trimStart().startsWith('|') && temPathEmBackticks(linha);
}

// Substituição sem interpretar $& e afins (String.replace com padrão string fá-lo).
function substituir(texto, velho, novo, todas) {
  if (!velho || !texto.includes(velho)) return null;
  if (todas) return texto.split(velho).join(novo);
  const i = texto.indexOf(velho);
  return texto.slice(0, i) + novo + texto.slice(i + velho.length);
}

function orcamento(alvo) {
  let cfg = null;
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'claudemd-budget.json'), 'utf8'));
  } catch (_) { return BUDGET_DEFAULT; } // ausente ou inválido → só o default
  const norm = String(alvo).replace(/\\/g, '/');
  const excepcoes = (cfg && cfg.excepcoes) || {};
  for (const chave of Object.keys(excepcoes)) {
    const k = String(chave).replace(/\\/g, '/');
    if (norm === k || norm.endsWith('/' + k)) return Number(excepcoes[chave]) || BUDGET_DEFAULT;
  }
  return Number(cfg && cfg.default) || BUDGET_DEFAULT;
}

// Cópia carimbada do original antes de uma edição que vai passar. Best-effort: nunca bloqueia.
function backup(alvo, original) {
  try {
    if (!original) return;
    fs.mkdirSync(DIR_BACKUP, { recursive: true });
    const chave = String(alvo).replace(/[\\/:]+/g, '_').replace(/^_+/, '');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(DIR_BACKUP, `${chave}.${ts}.bak`), original, 'utf8');
    const meus = fs.readdirSync(DIR_BACKUP).filter((f) => f.startsWith(chave + '.') && f.endsWith('.bak')).sort();
    for (const velho of meus.slice(0, Math.max(0, meus.length - BACKUPS_POR_FICHEIRO))) {
      try { fs.unlinkSync(path.join(DIR_BACKUP, velho)); } catch (_) { /* best-effort */ }
    }
  } catch (_) { /* sem backup não é razão para bloquear */ }
}

// Modo leitura: linhas gordas já existentes (o hook só vê linhas NOVAS) + tamanho vs orçamento.
function auditar(ficheiros) {
  let achados = 0;
  for (const f of ficheiros) {
    const alvo = path.resolve(process.cwd(), f);
    let txt;
    try { txt = fs.readFileSync(alvo, 'utf8'); } catch (e) { console.log(`✗ ${alvo}: ilegível (${e.code || e.message})`); achados++; continue; }
    const limite = orcamento(alvo);
    const gordas = [];
    txt.split(/\r?\n/).forEach((l, i) => { if (l.length > MAX_LINHA && pareceProjecto(l)) gordas.push([i + 1, l]); });
    console.log(`${alvo}: ${txt.length} / ${limite} chars${txt.length > limite ? ` (+${txt.length - limite} acima)` : ''} · ${gordas.length} linha(s) gorda(s) de projecto`);
    for (const [n, l] of gordas) console.log(`  #${n} (${l.length} chars) ${l.slice(0, EXCERTO)}…`);
    achados += gordas.length + (txt.length > limite ? 1 : 0);
  }
  if (achados) console.log('→ mover o detalhe para memory/projects/<slug>/; no CLAUDE.md fica o nome + ponteiro.');
  process.exit(achados ? 1 : 0);
}

function deny(rel, nLinha, linha) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[guard-claudemd] CLAUDE.md é só regras — detalhe de projecto não entra aqui.\n` +
        `  Ficheiro: ${rel}\n` +
        `  Linha #${nLinha} tem ${linha.length} chars e traz caminhos/estado de projecto.\n` +
        `  > ${linha.slice(0, EXCERTO)}…\n\n` +
        `Estrutura de 3 níveis:\n` +
        `  CLAUDE.md            → só o NOME do projecto + link\n` +
        `  memory/INDEX.md      → 1 linha de resumo (gerado por joca-memory-index.mjs)\n` +
        `  memory/projects/<slug>/ → todo o detalhe (index + áreas)\n\n` +
        `Move o detalhe para memory/projects/<slug>/ e deixa aqui só o nome.`,
    },
  }));
  process.exit(0);
}

const iAud = process.argv.indexOf('--auditar');
if (iAud >= 0) {
  const lista = process.argv.slice(iAud + 1).filter((a) => !a.startsWith('--'));
  if (!lista.length) { console.log('uso: node guard-claudemd.js --auditar <CLAUDE.md> [...]'); process.exit(2); }
  auditar(lista);
}

try {
  const raw = readStdin();
  if (!raw) allow();
  const input = JSON.parse(raw);
  const ti = (input && input.tool_input) || {};
  const filePath = ti.file_path || ti.path;
  if (!filePath) allow();
  const alvo = path.resolve(process.cwd(), String(filePath));
  const eRule = /[\\/]\.claude[\\/]rules[\\/][^\\/]+\.md$/i.test(alvo);
  if (path.basename(String(filePath)).toUpperCase() !== 'CLAUDE.MD' && !eRule) allow();

  let original = '';
  try { original = fs.readFileSync(alvo, 'utf8'); } catch (_) { original = ''; }

  // Texto resultante. Write → content. Edit → aplicar a substituição sobre o original.
  let resultante = null;
  let novoTexto = '';
  if (typeof ti.content === 'string') {
    resultante = ti.content;
    novoTexto = ti.content;
  } else if (typeof ti.new_string === 'string') {
    novoTexto = ti.new_string;
    resultante = substituir(original, ti.old_string, ti.new_string, ti.replace_all === true);
  } else if (Array.isArray(ti.edits)) {
    let acc = original;
    for (const e of ti.edits) {
      if (!e || typeof e.new_string !== 'string') continue;
      novoTexto += (novoTexto ? '\n' : '') + e.new_string;
      const r = substituir(acc, e.old_string, e.new_string, e.replace_all === true);
      if (r === null) { acc = null; break; }
      acc = r;
    }
    resultante = acc;
  }
  if (resultante === null && !novoTexto) allow();

  // Rules: re-enviadas em TODAS as mensagens — crescer custa tokens recorrentes. Só aviso.
  if (eRule) {
    if (resultante !== null && resultante.length > original.length) {
      process.stdout.write(JSON.stringify({
        systemMessage:
          `[guard-claudemd] ${path.basename(alvo)} (rules/) cresce ${resultante.length - original.length} chars ` +
          `(${original.length} → ${resultante.length}). As rules vão em cada mensagem: paga a linha nova ` +
          `movendo texto existente para .claude/reference/, com ponteiro de 1 linha.`,
      }));
    }
    process.exit(0);
  }

  // Linhas NOVAS = as do texto resultante que não existiam no original (evita bloquear
  // reformatações que só mexem à volta de linhas gordas já lá presentes).
  const antigas = new Set(original.split(/\r?\n/));
  const base = resultante !== null ? resultante : novoTexto;
  const linhas = base.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.length <= MAX_LINHA) continue;
    if (antigas.has(l)) continue;
    if (pareceProjecto(l)) deny(alvo, i + 1, l);
  }

  if (resultante !== null) {
    const limite = orcamento(alvo);
    if (resultante.length > limite) {
      const cresceu = resultante.length - original.length;
      // ESTE bloqueio (crescimento acima do orçamento) é só para o CLAUDE.md GLOBAL (o da home):
      // "só regras + nome do projecto", sem append legítimo. Num CLAUDE.md de PROJECTO fica aviso —
      // o `/save` PASSO 3 ainda lhe acrescenta linhas curtas (regra + ponteiro para
      // memory/projects/<slug>/). ⚠ Não confundir com o bloqueio das linhas GORDAS acima, que
      // vale em TODOS os CLAUDE.md (decisão D2, 2026-09-15).
      const eGlobal = path.dirname(alvo) === os.homedir();
      // Acima do orçamento o ficheiro só pode encolher — ou crescer o suficiente para
      // UMA linha nova de projecto (o que o /save PASSO 7 autoriza), nunca um dossiê.
      // Um aviso que nunca impede nada deixa de ser lido: este ficheiro chegou a 4x o
      // orçamento com o aviso a disparar em cada edição.
      if (eGlobal && cresceu > MAX_CRESCIMENTO) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
              `[guard-claudemd] ${path.basename(alvo)} já está ${resultante.length - limite} chars ` +
              `acima do orçamento (${resultante.length} / ${limite}) e esta edição acrescenta ` +
              `mais ${cresceu}.\n\n` +
              `Acima do orçamento só passam edições que encolhem o ficheiro, ou que crescem ` +
              `até ${MAX_CRESCIMENTO} chars (o nome de um projecto novo).\n\n` +
              `Detalhe de projecto pertence a memory/projects/<slug>/. ` +
              `Se este ficheiro precisa mesmo de mais espaço, sobe o orçamento em ` +
              `.claude/hooks/claudemd-budget.json — de propósito, não por acidente.`,
          },
        }));
        process.exit(0);
      }
      backup(alvo, original);
      process.stdout.write(JSON.stringify({
        systemMessage:
          `[guard-claudemd] ${path.basename(alvo)} fica com ${resultante.length} chars ` +
          `(orçamento ${limite}). Detalhe de projecto pertence a memory/projects/<slug>/; ` +
          `o CLAUDE.md fica só com regras + nome do projecto.`,
      }));
      process.exit(0);
    }
  }
  backup(alvo, original);
  process.exit(0);
} catch (_) {
  allow(); // fail-open
}
