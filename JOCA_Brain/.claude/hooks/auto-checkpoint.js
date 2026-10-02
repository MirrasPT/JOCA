#!/usr/bin/env node
// PostToolUse (Write|Edit) — rede de segurança ENTRE saves.
//
// Porquê: um /clear acidental apagou meio dia de trabalho e a memória do projecto
// tinha o estado de 3 dias antes; a recuperação foi arqueologia no disco
// (find -newermt, mtimes, md5). O /save corre no FIM — entre saves, uma sessão
// longa não tem rede. O checkpoint estruturado já existe e é barato; o que
// faltava era dispará-lo sem o utilizador pedir.
//
// Dispara `joca-checkpoint save` a cada N ficheiros escritos OU passados M minutos
// desde o último checkpoint automático, o que vier primeiro.
//
// Complementa (não substitui) o `stop-checkpoint.js`: aquele corre no Stop, ou
// seja no fim do turno; este corre DURANTE o turno. Títulos diferentes de
// propósito — `auto-wip` aqui, `auto` lá — para não se podarem um ao outro nem
// se confundirem com os checkpoints do /save.
//
// Contrato: input JSON em stdin (tool_input.file_path), fallback argv[2].
// NUNCA bloqueia nem atrasa a ferramenta: registado com "async": true, tudo
// dentro de try/catch, exit 0 sempre (fail-open silencioso).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const N_FICHEIROS = 12;      // ficheiros escritos entre checkpoints
const MINUTOS = 45;          // ou tempo desde o último checkpoint automático
const KEEP_AUTO_WIP = 4;     // poda própria — não empurra os manuais para fora do KEEP=12
const TITULO = 'auto-wip';   // sufixo do ficheiro: <ts>-auto-wip.md

const BRAIN = path.resolve(__dirname, '..', '..');
const CKPT = path.join(BRAIN, '.claude', 'scripts', 'joca-checkpoint.mjs');
const ESTADO_DIR = path.join(BRAIN, '.joca');                     // gitignored
const ESTADO = path.join(ESTADO_DIR, 'auto-checkpoint.json');
const CKPT_DIR = path.join(BRAIN, 'memory', 'checkpoints');

function sair() { process.exit(0); }

try {
  // ---------------------------------------------------------------- entrada
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* sem stdin */ }
  let ficheiro = '';
  try {
    const d = JSON.parse(raw || '{}');
    const ti = d.tool_input || {};
    ficheiro = ti.file_path || ti.path || '';
  } catch (_) { /* input não-JSON */ }
  if (!ficheiro && process.argv[2]) ficheiro = process.argv[2];
  if (!ficheiro) sair();

  const norm = String(ficheiro).replace(/\\/g, '/');
  // não contar o que o próprio mecanismo escreve (evita realimentação)
  if (/\/memory\/checkpoints\//.test(norm) || /\/\.joca\//.test(norm)) sair();

  // ------------------------------------------------------------------ slug
  // Mesma regra do joca-checkpoint: identificador, sempre minúsculas (o mesmo
  // slug tem de bater certo no Windows e no macOS — ver joca-checkpoint.mjs).
  const cwd = process.cwd();
  let slug;
  try {
    slug = path.basename(execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000,
    }).toString().trim());
  } catch (_) { slug = path.basename(cwd); }
  slug = require(path.join(BRAIN, '.claude', 'scripts', 'joca-slug.cjs')).normalizeSlug(slug); // + alias de pasta

  // ----------------------------------------------------------------- estado
  if (!fs.existsSync(ESTADO_DIR)) fs.mkdirSync(ESTADO_DIR, { recursive: true });
  let estado = {};
  try { estado = JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch (_) { estado = {}; }
  const p = estado[slug] || { ficheiros: [], ultimo: 0 };

  if (!p.ficheiros.includes(ficheiro)) p.ficheiros.push(ficheiro);
  const agora = Date.now();
  const porTempo = p.ultimo > 0 && (agora - p.ultimo) >= MINUTOS * 60 * 1000 && p.ficheiros.length > 0;
  const porContagem = p.ficheiros.length >= N_FICHEIROS;

  function gravarEstado() {
    estado[slug] = p;
    const tmp = ESTADO + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2), 'utf8');
    fs.renameSync(tmp, ESTADO);           // atómico
  }

  if (!porContagem && !porTempo) {
    if (!p.ultimo) p.ultimo = agora;      // arranca o relógio no 1º ficheiro da sessão
    gravarEstado();
    sair();
  }

  // ------------------------------------------------------------ checkpoint
  const motivo = porContagem
    ? p.ficheiros.length + ' ficheiros escritos'
    : Math.round((agora - p.ultimo) / 60000) + ' min desde o último';

  const corpo =
    '## Checkpoint AUTOMÁTICO (a meio da sessão)\n' +
    '- Disparado por: ' + motivo + '\n' +
    '- NÃO é um /save: sem prosa, sem feedback, sem decisões registadas.\n' +
    '- Existe só como rede contra /clear ou crash a meio do trabalho.\n\n' +
    '## Ficheiros escritos desde o último checkpoint automático\n' +
    p.ficheiros.slice(0, 40).map((f) => '- ' + f).join('\n') +
    (p.ficheiros.length > 40 ? '\n- (+' + (p.ficheiros.length - 40) + ')' : '') + '\n';

  try {
    execFileSync('node', [CKPT, 'save', '--slug', slug, '--title', TITULO, '--status', 'wip'], {
      input: corpo, cwd, stdio: ['pipe', 'ignore', 'ignore'], timeout: 15000,
    });
  } catch (_) { /* falhou o checkpoint — não é motivo para incomodar a ferramenta */ }

  // poda própria: só os KEEP_AUTO_WIP mais recentes com este título
  try {
    const dir = fs.readdirSync(CKPT_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .find((n) => n.toLowerCase() === slug);     // a pasta real pode diferir em maiúsculas
    if (dir) {
      const alvo = path.join(CKPT_DIR, dir);
      const autos = fs.readdirSync(alvo).filter((f) => f.endsWith('-' + TITULO + '.md')).sort().reverse();
      for (const velho of autos.slice(KEEP_AUTO_WIP)) {
        try { fs.unlinkSync(path.join(alvo, velho)); } catch (_) { /* best-effort */ }
      }
    }
  } catch (_) { /* sem pasta de checkpoints ainda */ }

  p.ficheiros = [];
  p.ultimo = agora;
  gravarEstado();
  sair();
} catch (_) {
  process.exit(0);   // fail-open: um hook nunca parte a sessão
}
