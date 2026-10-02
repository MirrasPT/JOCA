#!/usr/bin/env node
/**
 * joca-repath — reescreve um caminho de projecto em TODA a memória do JOCA.
 *
 * Porquê: mover uma pasta de projecto quebra em SILÊNCIO todas as referências de
 * caminho na memória. Numa sessão foram 5 projectos movidos, corrigidos à mão um a
 * um, e mesmo assim uma memória de cliente só apareceu partida no /save
 * seguinte. Isto é trabalho de máquina.
 *
 * Uso:
 *   node .claude/scripts/joca-repath.mjs <path-antigo> <path-novo>            # dry-run (default)
 *   node .claude/scripts/joca-repath.mjs <path-antigo> <path-novo> --apply    # escreve
 *   ... [--json]                                                             # relatório machine-readable
 *
 * Alvos varridos:
 *   ~/CLAUDE.md · <toolkit>/CLAUDE.md · <Brain>/CLAUDE.md · memory/INDEX.md
 *   memory/PROJECTOS.md · memory/projects/ · memory/checkpoints/ (recursivos)
 *
 * Trata as duas grafias do mesmo caminho no Windows (`C:\Users\...` e `/c/Users/...`),
 * a forma com barras normais (`C:/Users/...`) e a forma com barras escapadas
 * (`C:\\Users\\...`, como aparece dentro de JSON/regex). Caminhos Windows casam
 * case-insensitive (o FS é); caminhos POSIX casam exactamente.
 *
 * NÃO toca em linhas históricas datadas — qualquer linha com uma data ISO
 * (20\d\d-\d\d-\d\d) regista um FACTO PASSADO ("movido de X a 2026-08-16") e
 * reescrevê-la falsifica o histórico. Essas linhas são listadas à parte.
 *
 * Escrita atómica: .tmp + rename. Nunca trunca o destino.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN = join(__dirname, '..', '..');       // JOCA_Brain
const MEM = join(BRAIN, 'memory');

const DATA_ISO = /20\d\d-\d\d-\d\d/;             // marca de facto passado — não se reescreve

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const JSONOUT = argv.includes('--json');
const posicionais = argv.filter((a) => !a.startsWith('--'));
const [ANTIGO, NOVO] = posicionais;

if (!ANTIGO || !NOVO) {
  console.log([
    'joca-repath — reescreve um caminho de projecto em toda a memória do JOCA.',
    '',
    '  node .claude/scripts/joca-repath.mjs <path-antigo> <path-novo> [--apply] [--json]',
    '',
    '  sem --apply = dry-run (mostra ficheiro:linha + antes/depois, não escreve nada)',
    '  linhas com data ISO (20xx-xx-xx) ficam intactas e são listadas à parte',
  ].join('\n'));
  process.exit(posicionais.length ? 1 : 0);
}

// ------------------------------------------------------------------ grafias
/** Parte um caminho em { drive|null, resto[] }. Aceita C:\x, C:/x, /c/x, /Users/x. */
function partir(p) {
  const s = String(p).trim().replace(/^["']|["']$/g, '');
  let m = s.match(/^([A-Za-z]):[\\/]?(.*)$/);             // C:\x  |  C:/x
  if (m) return { drive: m[1], resto: m[2].split(/[\\/]+/).filter(Boolean) };
  m = s.match(/^\/([A-Za-z])\/(.*)$/);                    // /c/x (Git Bash / MSYS)
  if (m) return { drive: m[1], resto: m[2].split(/[\\/]+/).filter(Boolean) };
  return { drive: null, resto: s.split(/[\\/]+/).filter(Boolean), absoluto: s.startsWith('/') };
}

/**
 * Grafias de um caminho, por ordem de aplicação (mais específica primeiro).
 * O índice i de grafias(antigo) corresponde ao índice i de grafias(novo).
 */
function grafias(p) {
  const { drive, resto, absoluto } = partir(p);
  const corpo = resto.join('/');
  if (drive) {
    const D = drive.toUpperCase();
    return [
      { txt: D + ':\\\\' + resto.join('\\\\'), ci: true },   // C:\\Users\\… (escapado)
      { txt: D + ':\\' + resto.join('\\'), ci: true },       // C:\Users\…
      { txt: D + ':/' + corpo, ci: true },                   // C:/Users/…
      { txt: '/' + drive.toLowerCase() + '/' + corpo, ci: true }, // /c/Users/…
    ];
  }
  const base = (absoluto ? '/' : '') + corpo;
  return [
    { txt: base.replace(/\//g, '\\\\'), ci: false },
    { txt: base.replace(/\//g, '\\'), ci: false },
    { txt: base, ci: false },
  ];
}

const GA = grafias(ANTIGO);
const GN = grafias(NOVO);
if (GA.length !== GN.length) {
  console.error('[repath] ⚠ antigo e novo têm formas diferentes (um tem letra de drive, o outro não).');
  console.error('[repath]   passa os dois na mesma convenção — ex.: ambos C:\\... ou ambos /Users/...');
  process.exit(2);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REGRAS = GA.map((g, i) => ({
  re: new RegExp(esc(g.txt), g.ci ? 'gi' : 'g'),
  de: g.txt,
  para: GN[i].txt,
}));

/** Aplica todas as grafias a uma linha. Devolve null se nada mudou. */
function reescrever(linha) {
  let out = linha;
  for (const r of REGRAS) { r.re.lastIndex = 0; out = out.replace(r.re, r.para); }
  return out === linha ? null : out;
}
function bate(linha) {
  return REGRAS.some((r) => { r.re.lastIndex = 0; return r.re.test(linha); });
}

// -------------------------------------------------------------------- alvos
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const alvos = [];
const push = (p) => {
  try { if (existsSync(p) && statSync(p).isFile() && !alvos.includes(p)) alvos.push(p); }
  catch (_) { /* inacessível — ignora */ }
};

push(join(homedir(), 'CLAUDE.md'));
push(join(BRAIN, 'CLAUDE.md'));
push(join(BRAIN, '..', 'CLAUDE.md'));           // CLAUDE.md da raiz do toolkit
push(join(MEM, 'INDEX.md'));
push(join(MEM, 'PROJECTOS.md'));
for (const f of walk(join(MEM, 'projects'))) push(f);
for (const f of walk(join(MEM, 'checkpoints'))) push(f);

// ------------------------------------------------------------------ varredura
const hits = [];        // { ficheiro, linha, antes, depois }
const ignorados = [];   // { ficheiro, linha, texto }  — histórico datado
const tocados = new Map();

for (const f of alvos) {
  let txt;
  try { txt = readFileSync(f, 'utf8'); } catch (_) { continue; }
  const eol = txt.includes('\r\n') ? '\r\n' : '\n';
  const linhas = txt.split(/\r?\n/);
  let mudou = false;

  for (let i = 0; i < linhas.length; i++) {
    if (!bate(linhas[i])) continue;
    if (DATA_ISO.test(linhas[i])) {
      ignorados.push({ ficheiro: f, linha: i + 1, texto: linhas[i].trim().slice(0, 200) });
      continue;
    }
    const novo = reescrever(linhas[i]);
    if (novo === null) continue;
    hits.push({ ficheiro: f, linha: i + 1, antes: linhas[i].trim().slice(0, 200), depois: novo.trim().slice(0, 200) });
    linhas[i] = novo;
    mudou = true;
  }
  if (mudou) tocados.set(f, linhas.join(eol));
}

// -------------------------------------------------------------------- escrita
let escritos = 0;
if (APPLY) {
  for (const [f, conteudo] of tocados) {
    const tmp = f + '.tmp.' + process.pid;
    writeFileSync(tmp, conteudo, 'utf8');   // escreve ao lado
    renameSync(tmp, f);                     // e só depois substitui — atómico
    escritos++;
  }
}

// ------------------------------------------------------------------ relatório
const rel = (p) => { const r = relative(BRAIN, p); return r.startsWith('..') ? p : r.replace(/\\/g, '/'); };

if (JSONOUT) {
  console.log(JSON.stringify({
    antigo: ANTIGO, novo: NOVO, aplicado: APPLY,
    grafias: REGRAS.map((r) => ({ de: r.de, para: r.para })),
    ficheirosVarridos: alvos.length, hits, ignorados, ficheirosEscritos: escritos,
  }, null, 2));
} else {
  console.log('# repath ' + (APPLY ? '(APLICADO)' : '(dry-run — nada escrito)'));
  console.log('  de:   ' + ANTIGO);
  console.log('  para: ' + NOVO);
  console.log('  grafias procuradas: ' + REGRAS.map((r) => r.de).join('  |  '));
  console.log('  ficheiros varridos: ' + alvos.length);
  console.log('');
  if (!hits.length) console.log('(nenhum hit reescrevível)');
  let atual = null;
  for (const h of hits) {
    if (h.ficheiro !== atual) { atual = h.ficheiro; console.log('\n' + rel(h.ficheiro)); }
    console.log('  ' + h.linha + ':');
    console.log('    - ' + h.antes);
    console.log('    + ' + h.depois);
  }
  if (ignorados.length) {
    console.log('\n## hits ignorados (histórico datado) — ' + ignorados.length);
    for (const h of ignorados) console.log('  ' + rel(h.ficheiro) + ':' + h.linha + '  ' + h.texto);
  }
  console.log('\n→ ' + hits.length + ' linha(s) em ' + tocados.size + ' ficheiro(s) · ' + ignorados.length + ' ignorada(s) por data');
  if (!APPLY && hits.length) console.log('→ para escrever: repete o comando com --apply');
  if (APPLY) console.log('→ ' + escritos + ' ficheiro(s) escrito(s)');
}

process.exit(0);
