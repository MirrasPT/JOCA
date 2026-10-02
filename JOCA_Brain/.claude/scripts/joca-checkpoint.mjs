#!/usr/bin/env node
/**
 * joca-checkpoint — snapshots de sessão restauráveis (adaptado de gstack context-save/restore).
 * Append-only por projecto, frontmatter (ts/branch/slug/status), poda aos últimos N.
 * Restauro cross-branch (não filtra por branch — permite handoff entre branches/sessões).
 *
 * Store: <JOCA_Brain>/memory/checkpoints/<slug>/<ts>-<title>.md
 *
 * Uso:
 *   echo "<markdown body>" | joca-checkpoint save [--slug X] [--title "x"] [--status wip|done]
 *   joca-checkpoint save --body-file <f.md> [--slug X] …   # corpo de ficheiro (sem pipe)
 *   joca-checkpoint latest [--slug X]      # imprime o checkpoint mais recente
 *   joca-checkpoint list   [--slug X]      # lista checkpoints (mais recente primeiro)
 *
 * ⚠ Sem --slug o slug é inferido do repo git do CWD DO PROCESSO — sob JOCA_OS/`/save` o cwd é
 * quase sempre `JOCA_Brain`, e o checkpoint de outro projecto cai em `checkpoints/JOCA...`
 * (aconteceu com quatro projectos diferentes). Passar sempre
 * `--slug <projecto resolvido no PASSO 1 do /save>`. `--project` é alias de `--slug`.
 *
 * Umbrella vs sub-entrada: o slug é o da ENTRADA onde o trabalho foi feito (a sub-entrada, a que tem
 * `umbrella: <pai>` no frontmatter de memory/projects/<slug>/index.md), nunca o da umbrella. `save` numa
 * umbrella avisa com as sub-entradas; `latest` sem checkpoints numa sub-entrada cai para a umbrella
 * (e vice-versa), sempre com nota no stderr.
 *
 * Stdin: `save` sem pipe NÃO espera — TTY → erro (exit 2); pipe sem dados nem EOF durante
 * STDIN_SILENCIO_MS → erro (exit 2). `</dev/null` passa (EOF imediato) e grava «(sem corpo)».
 */
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, renameSync } from 'fs';
import jocaSlug from './joca-slug.cjs';
const { normalizeSlug } = jocaSlug;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEM = join(__dirname, '..', '..', 'memory');
// Podas SEPARADAS por natureza. Uma janela única contava os dois tipos juntos, e desde que passou
// a existir o `auto-checkpoint.js` (PostToolUse, a cada 12 ficheiros/45 min) os automáticos passaram
// a expulsar os deliberados: medido a 2026-08-20 numa instalação real — 9 checkpoints, 7 deles `-auto`,
// e 6 checkpoints NOMEADOS de `/save` (fechos de projectos de cliente)
// tinham sido podados. Sobreviviam só na pasta-ponte, que entretanto passou a espelhar com
// `--delete` — ou seja, a rede de segurança estava a apagar o histórico que devia proteger.
// ⚠ 2026-09-01: a pasta-ponte foi ABANDONADA (só git). O que esta poda cortar antes de um commit
// deixa de ter onde sobreviver — daí o KEEP alto e o nunca-podar-nomeados abaixo.
// ⚠ KEEP=12 era de quando `memory/checkpoints/` estava no `.gitignore`: a poda travava o
// crescimento de estado que ninguém guardava. Desde 2026-08-20 as pastas viajam por git, e a poda
// por contagem passou a cortar só a utilidade do `/resume` (que lê a working tree) a troco de nada
// — 1-3 KB por ficheiro, ~400/ano no slug mais activo. Medido nesse dia: 3 slugs já acima de 12
// (22, 17 e 13 checkpoints), prestes a perder 10, 5 e 1 no `/save` seguinte.
// Um checkpoint NOMEADO é intenção humana: não se poda por contagem. O 200 é só travão
// anti-loop, não política de arrumação.
const KEEP = 200;       // NOMEADOS (`/save`) — travão anti-runaway, não poda de rotina
const KEEP_AUTO = 6;    // `-auto.md` — rede de segurança entre saves, descartáveis por desenho
// `save` pendurava >120 s quando corrido sem pipe por uma ferramenta que deixa o stdin aberto sem EOF
// (feedback 2026-09-02). 10 s sem um único byte = ninguém vai escrever.
const STDIN_SILENCIO_MS = 10000;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
// O slug e um IDENTIFICADOR, nao um nome proprio: normaliza-se sempre para minusculas.
// Sem isto, `--slug joca` aterra em `JOCA/` no Windows (FS case-insensitive) e cria uma
// pasta `joca/` NOVA no macOS (case-sensitive) -> o `latest` do /resume devolve vazio
// numa das maquinas. (As grafias da pasta do toolkit foram consolidadas em `joca/` a 2026-09-15.)
// + alias de pasta → slug da memória (ex.: JOCA_Brain → joca): fonte única em joca-slug.cjs.
function sanitize(s) { return normalizeSlug(s); }
let slugInferido = false;
function slug() {
  const ex = arg('slug') || arg('project'); // --project = alias de --slug
  if (ex) return sanitize(ex);
  slugInferido = true;
  try { return sanitize(basename(execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())); }
  catch (_) { return sanitize(basename(process.cwd())); }
}
function branch() {
  try { return execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown'; }
  catch (_) { return 'unknown'; }
}
// Se ja existir uma pasta que difere SO em maiusculas/minusculas, usa-se ESSA (nunca se cria
// a irma). Vale para os 3 verbos porque toda a gente passa por aqui -- se `save` escrevesse na
// normalizada e `latest` lesse da antiga, o /resume continuava a devolver historico vazio.
let dirCache = null;
function dirFor(s) {
  if (dirCache) return dirCache;
  const base = join(MEM, 'checkpoints');
  let nome = s;
  try {
    const irmas = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    if (!irmas.includes(s)) {
      const variante = irmas.find((n) => n.toLowerCase() === s.toLowerCase());
      if (variante) {
        nome = variante;
        // Pendente accionável, não só aviso: o comando em 2 passos é o único que funciona em FS
        // case-insensitive (macOS/Windows) — `git mv X x` directo falha ou não faz nada.
        console.error(`[checkpoint] ⚠ PENDENTE: pasta existente difere só em maiúsculas — a usar "${variante}" para o slug "${s}".`);
        console.error(`[checkpoint]   consolidar (a partir de JOCA_Brain; regista no PASSO 8 do /save se não o fizeres agora):`);
        console.error(`[checkpoint]   git mv "memory/checkpoints/${variante}" "memory/checkpoints/${s}.tmp-case" && git mv "memory/checkpoints/${s}.tmp-case" "memory/checkpoints/${s}"`);
      }
    }
  } catch (_) { /* checkpoints/ ainda não existe — segue com o nome normalizado */ }
  dirCache = join(base, nome);
  return dirCache;
}
function ckptList(s) {
  const d = dirFor(s);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith('.md')).sort().reverse(); // ts prefix → reverse = recente 1º
}

// Relação umbrella ↔ sub-entrada, lida do frontmatter `umbrella:` do index da pasta
// (memory/projects/<slug>/index.md).
const fichaDe = (nome) => join(MEM, 'projects', nome, 'index.md');
function frontUmbrella(nome) {
  try {
    const t = readFileSync(fichaDe(nome), 'utf8');
    const fm = t.startsWith('---') ? t.slice(3, t.indexOf('\n---', 3)) : '';
    const m = fm.match(/^umbrella:\s*["']?([^"'\s#]+)/m);
    return m && m[1] !== 'null' ? m[1] : null;
  } catch (_) { return null; }
}
function subEntradas(nome) {
  try {
    const dir = join(MEM, 'projects');
    const nomes = new Set();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && existsSync(join(dir, e.name, 'index.md'))) nomes.add(e.name);
    }
    return [...nomes].filter((n) => n !== nome && frontUmbrella(n) === nome);
  } catch (_) { return []; }
}

function falharStdin(msg) {
  console.error(`[checkpoint] ✗ ${msg}`);
  console.error('[checkpoint]   usa: printf "<corpo>" | joca-checkpoint save --slug <p> --title "<t>"');
  console.error('[checkpoint]   ou:  joca-checkpoint save --body-file <ficheiro.md> --slug <p> --title "<t>"');
  console.error('[checkpoint]   nada foi escrito.');
  process.exit(2);
}
async function lerCorpo() {
  const f = arg('body-file');
  if (f) {
    try { return readFileSync(f, 'utf8'); } catch (e) { console.error(`[checkpoint] ✗ --body-file ilegível: ${f} (${e.code || e.message}); nada foi escrito.`); process.exit(2); }
  }
  if (process.stdin.isTTY) falharStdin('save sem corpo: o stdin é um terminal (não há pipe) — não fico à espera.');
  return new Promise((resolve) => {
    let buf = '';
    let t = setTimeout(() => falharStdin(`stdin aberto sem dados nem EOF há ${STDIN_SILENCIO_MS / 1000} s.`), STDIN_SILENCIO_MS);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; clearTimeout(t); t = setTimeout(() => falharStdin(`stdin parou sem EOF há ${STDIN_SILENCIO_MS / 1000} s.`), STDIN_SILENCIO_MS); });
    process.stdin.on('end', () => { clearTimeout(t); resolve(buf); });
    process.stdin.on('error', () => { clearTimeout(t); resolve(buf); });
  });
}

const cmd = process.argv[2];
const s = slug();

if (cmd === 'save') {
  const body = await lerCorpo();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  // Acentos saem pela decomposição NFD (decisão → decisao), não viram '-' (decis-o).
  const title = String(arg('title', 'checkpoint')).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80).toLowerCase() || 'checkpoint'; // título: sem aliases de slug
  const status = arg('status', 'wip');
  const d = dirFor(s);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const fm = `---\nts: ${new Date().toISOString()}\nbranch: ${branch()}\nslug: ${s}\nstatus: ${status}\n---\n\n`;
  const file = join(d, `${ts}-${title}.md`);
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, fm + (body.trim() || '(sem corpo)') + '\n', 'utf8');
  renameSync(tmp, file); // atómico
  // poda — duas janelas independentes: um `-auto` nunca empurra um checkpoint nomeado para fora
  const all = ckptList(s);
  const autos = all.filter((f) => f.endsWith('-auto.md'));
  const nomeados = all.filter((f) => !f.endsWith('-auto.md'));
  for (const old of [...nomeados.slice(KEEP), ...autos.slice(KEEP_AUTO)]) {
    // A poda NUNCA apaga o que o git nunca viu. Um ficheiro fora da janela mas ainda por commitar
    // não tem cópia em lado nenhum: apagá-lo é perda definitiva, ao contrário de um já commitado
    // (que volta com `git show <ref>:<f>`). Protege a janela entre criar e commitar — que é curta
    // no papel e longa na prática, porque o `auto-checkpoint` escreve entre `/save`s.
    // Regra proposta por uma sessão paralela (2026-08-20) e adoptada aqui; ver reference/sessoes-paralelas.md.
    const p = join(d, old);
    try {
      const visto = execSync(`git log --oneline -1 -- "${p}"`, { cwd: MEM, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (!visto) { console.error(`[checkpoint] poupado (nunca commitado): ${old}`); continue; }
    } catch (_) { continue; }   // sem git / fora de repo → não apagar; o silêncio não autoriza
    try { unlinkSync(p); } catch (_) { /* best-effort */ }
  }
  console.log(`[checkpoint] ${s} → ${basename(file)} (${status})`);
  if (slugInferido) console.error(`[checkpoint] ⚠ slug inferido do cwd (${s}) — se o trabalho foi noutro projecto, re-corre com --slug <projecto> e apaga este ficheiro`);
  const subs = subEntradas(s);
  if (subs.length) console.error(`[checkpoint] ⚠ "${s}" é umbrella de: ${subs.join(', ')} — se o trabalho foi numa sub-entrada, re-corre com --slug <sub-entrada> e apaga este ficheiro`);
} else if (cmd === 'latest') {
  let all = ckptList(s);
  let dir = dirFor(s);
  if (!all.length) {
    // Sub-entrada sem checkpoints → a umbrella; umbrella sem checkpoints → a sub-entrada mais recente.
    const cand = [frontUmbrella(s), ...subEntradas(s)].filter(Boolean);
    let melhor = null;
    for (const c of cand) {
      dirCache = null;
      const l = ckptList(c);
      if (l.length && (!melhor || l[0] > melhor.f)) melhor = { c, f: l[0], d: dirFor(c) };
    }
    dirCache = null;
    if (!melhor) { console.log(`(sem checkpoints para ${s}${cand.length ? ` nem para ${cand.join(', ')}` : ''})`); process.exit(0); }
    console.error(`[checkpoint] ⚠ sem checkpoints para "${s}"; a mostrar o de "${melhor.c}" (umbrella/sub-entrada).`);
    all = [melhor.f]; dir = melhor.d;
  }
  console.log(readFileSync(join(dir, all[0]), 'utf8'));
} else if (cmd === 'list') {
  const all = ckptList(s);
  if (!all.length) { console.log(`(sem checkpoints para ${s})`); process.exit(0); }
  console.log(`# Checkpoints — ${s}`);
  for (const f of all) console.log(`- ${f}`);
} else {
  console.log([
    'joca-checkpoint — uso:',
    '  echo "<md>" | joca-checkpoint save [--slug X] [--title "x"] [--status wip|done]',
    '  joca-checkpoint save --body-file <f.md> [--slug X] [--title "x"] [--status wip|done]',
    '  joca-checkpoint latest [--slug X]',
    '  joca-checkpoint list   [--slug X]',
    '  (--project = alias de --slug; sem ele o slug vem do repo git do cwd do processo)',
  ].join('\n'));
  process.exit(cmd && cmd !== '--help' && cmd !== '-h' && cmd !== 'help' ? 1 : 0);
}
