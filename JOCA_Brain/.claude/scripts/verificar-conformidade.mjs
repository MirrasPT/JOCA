#!/usr/bin/env node
// verificar-conformidade.mjs — torna exigíveis as regras de um design system com tokens (React/TSX + Tailwind).
//
// PORQUÊ: uma regra de design system sem verificador é ignorada dentro de duas semanas. Portado do
// verificador de um projecto próprio (2026-08-21), que levou 4 rondas de afinação — a
// 1.ª corrida deu 171 achados, quase todos ruído. Aqui ficam as correcções universais:
//   (1) remover comentários DESLOCA as linhas — troca-se cada comentário por espaços/linhas vazias;
//   (2) descascar TODAS as variantes do Tailwind (`after:`, `has-[]`, `group-hover/nome:`), não só as comuns;
//   (3) o `build()` do Tailwind devolve sempre o CSS base e acumula candidatos entre chamadas —
//       o oráculo procura o SELECTOR, nunca o tamanho do output; e autotesta-se com controlo bom/mau.
//
// Nada do projecto está embutido: tokens, exclusões e classes de controlo vêm do config.
//
// Regras:
//   R2  valores crus (hex, rgb/hsl, z-[..], px arbitrário)          erro
//   R3  `dark:` — o token é que deve mudar sozinho                    erro
//   R4  curva de animação sem a duração irmã (só com config)          erro
//   R5  transição de layout (`transition-[height]`, `transition-all`) erro
//   R6  véu de estado + `hover:bg-*` somados (só com config)          erro
//   R8  `outline-none` sem substituto de foco (componentes)           aviso
//   R9  `export default` em componentes                               erro
//   R10 componente sem `className`/`cn()`                             aviso
//   R11 classe Tailwind sem CSS (falha em silêncio; precisa do tailwindcss v4 do projecto) erro
//
// Uso:
//   node .claude/scripts/verificar-conformidade.mjs --raiz <projecto>
//   node .claude/scripts/verificar-conformidade.mjs --raiz <projecto> --config conformidade.json --so R2,R11
//   node .claude/scripts/verificar-conformidade.mjs --auto-teste     → prova que cada regra acusa
//
// Flags:
//   --raiz <dir>      raiz do projecto (default: cwd)
//   --config <f>      JSON (default: <raiz>/conformidade.json, se existir). Campos, todos opcionais:
//     src             pasta a varrer, relativa à raiz (default "src")
//     extensoes       [".tsx", ".ts"]
//     componentes     regex (string) que marca ficheiros de componente (default "/components/")
//     regras          lista de regras activas (default: todas)
//     excluir         { "R2": ["regex", ...], ... } — ficheiros a saltar por regra
//     css             CSS de entrada do Tailwind para R11 (default "src/app/globals.css")
//     controloBom     classe que TEM de existir no oráculo R11 (default "flex")
//     r4              { "curvas": ["regex"], "duracoes": ["regex"] } — sem isto, R4 não corre
//     r6              { "veu": "nome-da-classe" } — sem isto, R6 não corre
//     nome            título do relatório · docRegras: path mostrado no rodapé
//   --so R2,R11       só estas regras
//   --auto-teste      injecta violações num temporário FORA do projecto e exige que cada regra acuse
//   --help
//
// Saída: 0 = sem erros (avisos não falham) · 1 = erros, auto-teste partido ou uso inválido.
// Uma regra que não conseguiu medir (ex.: tailwindcss não importável) sai como AVISO "NÃO verificada",
// nunca como silêncio.

import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, extname, resolve, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
const opt = (nome, def) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

if (argv.includes('--help') || argv.includes('-h')) {
  const txt = readFileSync(new URL(import.meta.url), 'utf8').split('\n');
  const fim = txt.findIndex((l) => l.startsWith('import '));
  console.log(txt.slice(1, fim).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const RAIZ = resolve(opt('raiz', process.cwd()));
if (!existsSync(RAIZ)) { console.error(`✗ --raiz não existe: ${RAIZ}`); process.exit(1); }

const caminhoConfig = opt('config', null);
let CFG = {};
{
  const p = caminhoConfig ? (isAbsolute(caminhoConfig) ? caminhoConfig : join(RAIZ, caminhoConfig)) : join(RAIZ, 'conformidade.json');
  if (caminhoConfig && !existsSync(p)) { console.error(`✗ --config não existe: ${p}`); process.exit(1); }
  if (existsSync(p)) {
    try { CFG = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { console.error(`✗ config inválido (${p}): ${e.message}`); process.exit(1); }
  }
}

const SRC = join(RAIZ, CFG.src ?? 'src');
const EXTS = CFG.extensoes ?? ['.tsx', '.ts'];
const RE_COMPONENTE = new RegExp(CFG.componentes ?? '/components/');
const EXCLUIR = Object.fromEntries(Object.entries(CFG.excluir ?? {}).map(([r, l]) => [r, l.map((s) => new RegExp(s))]));
const excluido = (regra, f) => (EXCLUIR[regra] ?? []).some((re) => re.test(f));
const autoTeste = argv.includes('--auto-teste');
const so = opt('so', null)?.split(',').map((s) => s.trim());

/* ------------------------------------------------------------------ */

function ficheiros(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...ficheiros(p));
    else if (EXTS.includes(extname(nome))) out.push(p);
  }
  return out;
}

/** Remove comentários SEM alterar a numeração de linhas (apagá-los deslocava todos os números do relatório). */
function semComentarios(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');
}

/** Só as strings que são de facto listas de classes. `id=`, `aria-label=`, chaves de variantes cva não contam. */
function stringsDeClasses(txt) {
  const out = [];
  const OUTROS_ATRIBUTOS = /\b(?:id|htmlFor|name|type|value|placeholder|href|src|alt|title|role|key|aria-[a-z-]+|data-(?!state|side|orientation)[a-z-]+)\s*=\s*$/;
  txt.split('\n').forEach((l, i) => {
    if (!/className|\bcn\(|\bcva\(|\bclsx\(|^\s*"[a-z-]/.test(l)) return;
    for (const m of l.matchAll(/["'`]([^"'`\n]{2,300})["'`]/g)) {
      const antes = l.slice(Math.max(0, m.index - 40), m.index).replace(/\{$/, '');
      if (OUTROS_ATRIBUTOS.test(antes)) continue;
      if (/^\s*:/.test(l.slice(m.index + m[0].length))) continue; // nome de variante, não classes
      out.push({ linha: i + 1, texto: m[1] });
    }
  });
  return out;
}

const achados = [];
function acusar(regra, ficheiro, linha, msg, severidade = 'erro') {
  achados.push({ regra, ficheiro: relative(RAIZ, ficheiro) || '.', linha, msg, severidade });
}
const linhas = (f) => semComentarios(readFileSync(f, 'utf8')).split('\n');

const TSX = ficheiros(SRC);
const COMPONENTES = TSX.filter((f) => RE_COMPONENTE.test(f));

/* ---------------- R2 — valores crus ---------------- */
function R2(alvos = TSX) {
  const padroes = [
    [/#[0-9a-fA-F]{3,8}\b/, 'cor em hexadecimal'],
    [/\brgba?\(/, 'rgb()/rgba()'],
    [/\bhsla?\(/, 'hsl()/hsla()'],
    [/\bz-\[[^\]]+\]/, 'z-index arbitrário'],
    [/\b(?:[whpm]|min-[wh]|max-[wh]|gap|top|left|right|bottom|inset)-\[\d+px\]/, 'medida em px arbitrária'],
  ];
  for (const f of alvos) {
    if (excluido('R2', f)) continue;
    linhas(f).forEach((l, i) => {
      for (const [re, nome] of padroes) if (re.test(l)) acusar('R2', f, i + 1, `${nome}: ${l.trim().slice(0, 70)}`);
    });
  }
}

/* ---------------- R3 — dark: ---------------- */
function R3(alvos = TSX) {
  for (const f of alvos) {
    if (excluido('R3', f)) continue;
    linhas(f).forEach((l, i) => {
      if (/\bdark:[a-z[]/.test(l)) acusar('R3', f, i + 1, `dark: — o token é que deve mudar sozinho: ${l.trim().slice(0, 60)}`);
    });
  }
}

/* ---------------- R4 — curva sem a duração irmã (tokens do projecto, via config) ---------------- */
function R4(alvos = TSX, cfg = CFG.r4) {
  if (!cfg?.curvas?.length || !cfg?.duracoes?.length) {
    acusar('R4', RAIZ, 1, 'sem `r4.curvas`/`r4.duracoes` no config — regra NÃO verificada', 'aviso');
    return;
  }
  const curvas = cfg.curvas.map((s) => new RegExp(s));
  const duracoes = cfg.duracoes.map((s) => new RegExp(s));
  for (const f of alvos) {
    if (excluido('R4', f)) continue;
    for (const { linha, texto } of stringsDeClasses(semComentarios(readFileSync(f, 'utf8')))) {
      if (/animate-/.test(texto)) continue;
      if (curvas.some((re) => re.test(texto)) && !duracoes.some((re) => re.test(texto)))
        acusar('R4', f, linha, `curva sem duração ao lado: ${texto.trim().slice(0, 66)}`);
    }
  }
}

/* ---------------- R5 — layout animado ---------------- */
function R5(alvos = TSX) {
  const proibidas = /\b(width|height|top|left|right|bottom|margin|padding)\b/;
  for (const f of alvos) {
    if (excluido('R5', f)) continue;
    linhas(f).forEach((l, i) => {
      const m = /transition-\[([^\]]+)\]/.exec(l);
      if (m && proibidas.test(m[1])) acusar('R5', f, i + 1, `transição de layout: transition-[${m[1]}]`);
      if (/\btransition-all\b/.test(l)) acusar('R5', f, i + 1, 'transition-all: anima tudo, incluindo layout');
    });
  }
}

/* ---------------- R6 — véu de estado duplicado (classe do projecto, via config) ---------------- */
function R6(alvos = TSX, cfg = CFG.r6) {
  if (!cfg?.veu) { acusar('R6', RAIZ, 1, 'sem `r6.veu` no config — regra NÃO verificada', 'aviso'); return; }
  const veu = new RegExp(`(?:^|[\\s"'\`])${cfg.veu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_-])`);
  for (const f of alvos) {
    if (excluido('R6', f)) continue;
    linhas(f).forEach((l, i) => {
      if (veu.test(l) && /\bhover:bg-/.test(l)) acusar('R6', f, i + 1, `${cfg.veu} e hover:bg-* somam-se: ${l.trim().slice(0, 60)}`);
    });
  }
}

/* ---------------- R8 — foco visível ---------------- */
function R8(alvos = COMPONENTES) {
  for (const f of alvos) {
    if (excluido('R8', f)) continue;
    for (const { linha, texto } of stringsDeClasses(semComentarios(readFileSync(f, 'utf8')))) {
      if (!/\boutline-none\b/.test(texto)) continue;
      const temSubstituto =
        /focus-visible:|focusRing|focus:ring|\bring-\d/.test(texto) ||
        /data-\[highlighted\]|aria-selected|data-\[state=(?:on|checked)\]/.test(texto);
      if (!temSubstituto) acusar('R8', f, linha, `outline-none sem substituto visível de foco: ${texto.trim().slice(0, 60)}`, 'aviso');
    }
  }
}

/* ---------------- R9 — export default ---------------- */
function R9(alvos = COMPONENTES) {
  for (const f of alvos) {
    if (excluido('R9', f)) continue;
    linhas(f).forEach((l, i) => { if (/^\s*export default\b/.test(l)) acusar('R9', f, i + 1, 'export default em componentes'); });
  }
}

/* ---------------- R10 — className aceite ---------------- */
function R10(alvos = COMPONENTES) {
  for (const f of alvos) {
    if (extname(f) !== '.tsx' || excluido('R10', f)) continue;
    const txt = readFileSync(f, 'utf8');
    if (!/export (function|const) [A-Z]/.test(txt)) continue;
    if (!/className=|class=/.test(txt) && !/<[a-z]/.test(txt)) continue; // não pinta nada
    if (!/className/.test(txt)) acusar('R10', f, 1, 'componente não menciona className — quem consome não consegue sobrepor', 'aviso');
    else if (!/\bcn\(/.test(txt)) acusar('R10', f, 1, 'usa className sem cn() — conflitos de Tailwind não são resolvidos', 'aviso');
  }
}

/* ---------------- R11 — classe inexistente ---------------- */
/** Folha de estilo de um pacote: `exports["."].style` → `style` → `index.css`. */
function folhaDoPacote(id, require) {
  const nomePacote = id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0];
  let dir = null;
  for (const base of require.resolve.paths(nomePacote) ?? []) {
    if (existsSync(join(base, nomePacote, 'package.json'))) { dir = join(base, nomePacote); break; }
  }
  if (!dir) throw new Error(`pacote não encontrado: ${id}`);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const sub = id === nomePacote ? '.' : './' + id.slice(nomePacote.length + 1);
  const exp = pkg.exports?.[sub];
  const rel = (typeof exp === 'object' && exp?.style) || (sub === '.' && pkg.style) || (sub === '.' ? 'index.css' : sub);
  return join(dir, rel);
}

async function R11(alvos = TSX) {
  const require = createRequire(join(RAIZ, 'package.json'));
  let compilar;
  try {
    const mod = await import(pathToFileURL(require.resolve('tailwindcss')).href);
    compilar = mod.compile ?? mod.default?.compile;
    if (typeof compilar !== 'function') throw new Error('sem compile() — tailwindcss < v4?');
  } catch (e) {
    acusar('R11', join(RAIZ, 'package.json'), 1, `tailwindcss v4 não importável (${String(e.message).split('\n')[0].slice(0, 60)}) — regra NÃO verificada`, 'aviso');
    return;
  }

  const css = join(RAIZ, CFG.css ?? 'src/app/globals.css');
  let compilado;
  try {
    compilado = await compilar(readFileSync(css, 'utf8'), {
      base: dirname(css),
      loadStylesheet: async (id, base) => {
        const p = id.startsWith('.') || id.startsWith('/') ? resolve(base, id) : folhaDoPacote(id, require);
        return { base: dirname(p), path: p, content: readFileSync(p, 'utf8') };
      },
    });
  } catch (e) {
    acusar('R11', css, 1, `CSS não compilou: ${String(e).slice(0, 70)} — regra NÃO verificada`, 'aviso');
    return;
  }

  const candidatas = new Set();
  for (const f of alvos) {
    if (excluido('R11', f)) continue;
    for (const { texto } of stringsDeClasses(semComentarios(readFileSync(f, 'utf8')))) {
      for (const c of texto.split(/\s+/)) {
        if (!/^[a-z]/.test(c) || c.includes('${')) continue;
        // Descasca TODAS as variantes, encadeadas (`sm:hover:focus:`). Sem isto, `after:absolute` é "inexistente".
        const limpa = c.replace(
          /^(?:(?:group|peer)(?:\/[a-z-]+)?-)?(?:hover|focus|focus-visible|focus-within|active|disabled|visited|target|open|checked|indeterminate|required|invalid|placeholder|placeholder-shown|autofill|read-only|before|after|first-letter|first-line|marker|selection|file|backdrop|first|last|only|odd|even|first-of-type|last-of-type|empty|sm|md|lg|xl|2xl|min-\[[^\]]+\]|max-[a-z]+|dark|light|motion-safe|motion-reduce|contrast-more|print|portrait|landscape|rtl|ltr|aria-[a-z-]+|aria-\[[^\]]+\]|data-\[[^\]]+\]|has-\[[^\]]+\]|not-[a-z-]+|supports-\[[^\]]+\]|\[&[^\]]*\]|\*|\*\*):/g,
          '',
        );
        if (limpa.includes('(') || limpa.includes('[')) continue; // valores arbitrários: não cobertos, e diz-se
        if (/^(?:aria|data)-/.test(limpa)) continue; // nomes de atributo em código
        if (limpa.length > 1 && /^[a-z][a-z0-9-]*$/.test(limpa) && limpa.includes('-')) candidatas.add(limpa);
      }
    }
  }

  // `build()` acumula e devolve sempre o CSS base: "produziu output" NÃO é sinal. Vale o SELECTOR.
  const CONTROLO_BOM = CFG.controloBom ?? 'flex';
  const CONTROLO_MAU = 'bg-inventado-xpto-zzz';
  const saida = compilado.build([...candidatas, CONTROLO_BOM, CONTROLO_MAU]);
  const esc = (s) => s.replace(/[.:()[\]/%!#,]/g, (m) => '\\' + m);
  const existe = (c) => new RegExp('\\.' + esc(c) + '(?![a-zA-Z0-9_-])').test(saida);

  if (!existe(CONTROLO_BOM) || existe(CONTROLO_MAU)) {
    acusar('R11', css, 1, `AUTO-TESTE FALHOU: o oráculo não distingue "${CONTROLO_BOM}" de classe inventada — regra NÃO verificada`, 'aviso');
    return;
  }
  for (const c of [...candidatas].sort().filter((c) => !existe(c))) acusar('R11', SRC, 1, `classe sem CSS (falha em silêncio): "${c}"`);
  console.log(`  [R11] ${candidatas.size} classes verificadas · valores arbitrários não cobertos`);
}

/* ------------------------------------------------------------------ */

const REGRAS = { R2, R3, R4, R5, R6, R8, R9, R10, R11 };

if (autoTeste) {
  // Um teste que nunca acusou não é prova. Temporário FORA do projecto (o scanner do Tailwind vê a árvore).
  console.log('AUTO-TESTE — cada regra tem de acusar uma violação injectada\n');
  const dir = join(mkdtempSync(join(tmpdir(), 'conformidade-')), 'components');
  mkdirSync(dir, { recursive: true });
  const casos = {
    R2: ['export function Mau(){return <div className="bg-[#ff0000]" />}'],
    R3: ['export function Mau(){return <div className="dark:bg-surface" />}'],
    R4: ['export function Mau(){return <div className="ease-x" />}', { curvas: ['\\bease-x\\b'], duracoes: ['\\bduration-x\\b'] }],
    R5: ['export function Mau(){return <div className="transition-[height]" />}'],
    R6: ['export function Mau(){return <div className="veu hover:bg-surface" />}', { veu: 'veu' }],
    R8: ['export function Mau(){return <button className="outline-none" />}'],
    R9: ['export default function Mau(){return null}'],
    R10: ['export function Mau(){return <div />}'],
  };
  let falhas = 0;
  for (const [regra, [codigo, cfg]] of Object.entries(casos)) {
    const f = join(dir, `mau-${regra}.tsx`);
    writeFileSync(f, codigo);
    achados.length = 0;
    REGRAS[regra]([f], cfg);
    const acusou = achados.some((a) => a.regra === regra && !/NÃO verificada/.test(a.msg));
    console.log(`  ${acusou ? '✓' : '✗'} ${regra} ${acusou ? 'acusa' : 'NÃO ACUSA — verificador partido'}`);
    if (!acusou) falhas++;
  }
  // Controlo negativo: código limpo não pode acusar nada.
  const limpo = join(dir, 'limpo.tsx');
  writeFileSync(limpo, 'import { cn } from "x";\nexport function Bom({ className }){return <div className={cn("bg-surface p-4", className)} />}');
  achados.length = 0;
  for (const r of ['R2', 'R3', 'R5', 'R9', 'R10']) REGRAS[r]([limpo]);
  console.log(`  ${achados.length === 0 ? '✓' : '✗'} código limpo ${achados.length === 0 ? 'não acusa' : 'ACUSA — falso positivo'}`);
  if (achados.length) falhas++;
  rmSync(dirname(dir), { recursive: true, force: true });
  console.log(falhas === 0 ? '\n✓ Todos os verificadores acusam.\n' : `\n✗ ${falhas} verificador(es) partido(s).\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

if (!existsSync(SRC)) { console.error(`✗ pasta a varrer não existe: ${SRC} (ajusta \`src\` no config)`); process.exit(1); }

const activas = Object.keys(REGRAS).filter((r) => (!CFG.regras || CFG.regras.includes(r)) && (!so || so.includes(r)));
if (so && !activas.length) { console.error(`✗ --so sem regras válidas (${Object.keys(REGRAS).join(', ')})`); process.exit(1); }
for (const nome of activas) await REGRAS[nome]();

const erros = achados.filter((a) => a.severidade === 'erro');
const avisos = achados.filter((a) => a.severidade === 'aviso');

console.log(`\nCONFORMIDADE — ${CFG.nome ?? relative(dirname(RAIZ), RAIZ)}  (${TSX.length} ficheiros)\n`);
if (!achados.length) console.log('  Sem achados.\n');
for (const nome of activas) {
  const meus = achados.filter((a) => a.regra === nome);
  if (!meus.length) continue;
  console.log(`  ${nome} — ${meus.length}`);
  for (const a of meus.slice(0, 12)) console.log(`    ${a.severidade === 'erro' ? '✗' : '!'} ${a.ficheiro}:${a.linha} ${a.msg}`);
  if (meus.length > 12) console.log(`    … mais ${meus.length - 12}`);
  console.log('');
}
console.log(`  ${erros.length} erro(s) · ${avisos.length} aviso(s)`);
if (CFG.docRegras) console.log(`  Detalhe de cada regra em ${CFG.docRegras}`);
console.log('');
process.exit(erros.length > 0 ? 1 : 0);
