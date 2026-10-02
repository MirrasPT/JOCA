#!/usr/bin/env node
// gate-runtime.mjs — o gate de runtime das `rules/pipelines.md`, como artefacto.
//
// PORQUÊ: `tsc`/`eslint`/`build` verdes provam que COMPILA, não que FUNCIONA. A regra
// existe desde sempre em `.claude/rules/pipelines.md` §Gates e em
// `.claude/reference/gates-runtime.md`, mas não tinha código — cada projecto reescrevia
// ~250 linhas do zero e cada reescrita perdia uma das armadilhas. Este ficheiro é a
// versão parametrizada: aponta-se a um URL base e a uma lista de rotas.
//
// O que mede (e que nenhum gate estático apanha):
//   · contraste do texto contra o pixel PINTADO — cor RASTERIZADA num canvas 1x1, nunca
//     lida por regex (ver `parse`); alpha e `opacity` dos ancestrais compostos;
//     gradiente/imagem de fundo é assinalado, não adivinhado
//   · `document.elementFromPoint` no centro de cada alvo interactivo — auditar `href`
//     não é testar o clique
//   · texto TAPADO, linha a linha (`TreeWalker` + `Range.getClientRects`) — o centro de um
//     parágrafo de 3 linhas cai entre linhas e uma sobreposição escapa ao rect do bloco
//   · sangramento horizontal por `getBoundingClientRect().right`, descartando SÓ ancestrais
//     com `overflow-x: auto|scroll` (carris intencionais). `hidden|clip` NÃO se descarta:
//     não há barra de scroll, mas o conteúdo está cortado em silêncio — defeito real
//   · erros de consola, `pageerror`, respostas HTTP >= 400
//   · `content-type` de cada `<script>`/`<link rel=stylesheet>` servido (um painel esteve
//     um dia inteiro inutilizável com 200 em todos os assets e JS servido como `text/html`)
//
// O QUE O GATE DIZ QUANDO NÃO CONSEGUE MEDIR: um zero silencioso lê-se como aprovação, e foi
// assim que este script passou páginas inteiras. Por isso todas as rotas trazem
// `autoteste` (sondas injectadas que TÊM de acusar), `corIlegivel` (valores de cor que o
// browser não soube ler), `paresMedidos` (o denominador) e `documentoVisivel`. Se o medidor
// esteve cego, a rota FALHA — nunca sai "limpo".
//
// LIMITE ASSUMIDO: mede o estado de repouso da carga. Um gate que nunca clica é um gate
// de layout — overlays, menus e modais exigem accionar o gatilho (ver `--clicar`).
//
// Uso:
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --rotas /,/precos,/sobre
//   node .claude/scripts/gate-runtime.mjs --config gate-runtime.json
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --clicar "header a,nav button"
//
// Flags:
//   --base <url>        URL base (obrigatório, ou `base` no --config)
//   --rotas a,b,c       lista de rotas (default: "/")
//   --config <ficheiro> JSON com { base, rotas, temas, viewports, clicar, out, esperar }
//   --temas a,b         valores postos em `data-theme` no <html> (default: nenhum)
//   --viewports WxH,... default: 1440x900,390x844
//   --clicar <seletor>  além de medir, clica em cada elemento que casa e conta erros novos
//   --dispensar <sel>   seletor do botão que fecha o overlay de consentimento/cookies. A
//                       heurística de CMP corre sempre; isto é o escape para quando falha.
//                       A heurística só clica em RECUSAR/REJEITAR — nunca aceita cookies; o
//                       seletor dado deve ser o do recusar. GTM/GA/DoubleClick são sempre abortados.
//   --out <pasta>       destino do relatório e screenshots (default: ./.joca/gate-runtime)
//   --esperar <ms>      espera após carga, antes de medir (default: 500)
//   --estado <ficheiro> storageState do Playwright (sessão já autenticada). Sem isto, um
//                       site com login mede só a página de login e dá-a por limpa. Gera-se
//                       com `npx playwright open --save-storage=estado.json <url>`.
//   --login <ficheiro>  JSON `{ url, campos: { "<seletor>": "<valor>" }, submeter, esperar }`
//                       — faz o login UMA vez e usa a sessão resultante em todas as rotas.
//                       Alternativa ao `--estado` quando não há sessão pré-fabricada: um
//                       `--estado` gerado à mão caduca e ninguém repara. O ficheiro leva
//                       credenciais — mantém-no fora do git. Se depois do login o URL final
//                       ainda for um ecrã de entrada, o gate ABORTA: medir a página de login
//                       e dá-la por limpa é exactamente a falha que isto existe para evitar.
//   --medir <lista>     medidores OPCIONAIS (só correm quando pedidos), cada um com autoteste:
//                         barra      barra de acento à esquerda: `border-left` assimétrica,
//                                    `box-shadow: inset Npx 0 0` e `::before/::after` fino colado
//                         icones     `<svg>` colapsados (<4px) e glifos Unicode no texto pintado
//                                    (setas, geométricos, dingbats, braille, emoji); setas
//                                    simples e ✓/✗ de copy contam à parte, não falham
//                         transbordo filho em fluxo que sai da caixa do pai (x e y), fora de carris
//                         canvas     contraste de texto por cima de um `<canvas>`, medido nos
//                                    PIXELS (3 capturas: sem texto · texto magenta · sem texto) —
//                                    P10 dos rácios sobre a máscara de glifos, não a cor computada
//   --classes <lista|diff[:ref]>
//                       classes utilitárias que TÊM de existir: mede cada string EXACTA num
//                       elemento de teste (`getComputedStyle` + procura da regra nas folhas).
//                       `diff` extrai-as das linhas acrescentadas de `git diff <ref>` (default HEAD).
//                       Controlos: classe injectada tem de contar, classe inventada tem de dar inerte.
//
// ⚠ Correr contra o BUILD DE PRODUÇÃO, não contra o dev server: o overlay de dev do Next
// (`nextjs-portal`) é um elemento posicionado que tapa texto e não existe em produção — e o
// `networkidle` nunca chega com HMR ligado (há fallback, mas mede uma página que ninguém vê).
//
// Exit code: 0 = tudo limpo · 1 = pelo menos uma rota com problema (ou com o medidor cego).
//
// Playwright: resolvido pela receita da skill `browser-automate` — dependência do
// projecto primeiro, depois `npm root -g`, depois `PLAYWRIGHT_PATH`. Nunca um caminho
// cravado: um gate que não arranca é um gate que não existe.

import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';

// ── Ruído do browser ≠ defeito da página ──────────────────────────────────────
// O browser PEDE sozinho o ícone por omissão (`/favicon.ico`, `apple-touch-icon*.png`)
// mesmo quando o HTML nunca lhes toca — o 404 desses é do BROWSER, não da página.
// Qualquer projecto sem favicon falhava o gate por isto, e um gate que falha por ruído
// é um gate que se aprende a ignorar.
//
// O filtro é deliberadamente ESTREITO: casa só os caminhos que o browser inventa por
// omissão. Um 404 de um asset que a PÁGINA pede (`/logo.svg`, `/app.js`, ou até um
// `<link rel="icon" href="/marca/icone.png">`) É um defeito e continua a contar.
// Filtrar por "404" no texto, ou por extensão de imagem, tapava defeitos reais.
const RUIDO_URL = /\/(favicon\.ico|apple-touch-icon(-[\w.-]+)?\.png)$/i;
const ehRuidoDeBrowser = (url) => RUIDO_URL.test(String(url || '').split(/[?#]/)[0]);

// ── Argumentos ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (nome, def = null) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

let cfg = {};
const configPath = flag('config');
if (configPath) {
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`✗ --config ${configPath} ilegível: ${e.message}`);
    process.exit(1);
  }
}

const lista = (v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean);

const BASE = flag('base', cfg.base);
if (!BASE) {
  console.error('✗ Falta o URL base. Uso: --base http://localhost:3000 [--rotas /,/precos]');
  process.exit(1);
}
const ROTAS = lista(flag('rotas', cfg.rotas || '/'));
// Git Bash (MSYS) converte `/login` em `C:/Program Files/Git/login` antes de o Node o ver: o gate
// media outra rota e dava verde. Uma rota que não começa por `/` nunca é o que se pediu.
const rotasMas = ROTAS.filter((r) => !r.startsWith('/'));
if (rotasMas.length) {
  console.error(`✗ Rota(s) sem "/" inicial: ${rotasMas.join(', ')} — no Git Bash corre com MSYS_NO_PATHCONV=1 (a shell reescreveu o caminho).`);
  process.exit(1);
}
const TEMAS = flag('temas', cfg.temas) ? lista(flag('temas', cfg.temas)) : [null];
let ESTADO = flag('estado', cfg.estado || null);   // `let`: o `--login` preenche-o (ver abaixo)
const LOGIN = flag('login', cfg.login || null);
const VIEWPORTS = lista(flag('viewports', cfg.viewports || '1440x900,390x844')).map((v) => {
  const [w, h] = v.toLowerCase().split('x').map(Number);
  return { w, h, n: `${w}x${h}` };
});
const CLICAR = flag('clicar', cfg.clicar || null);
const DISPENSAR = flag('dispensar', cfg.dispensar || null);
const ESPERAR = Number(flag('esperar', cfg.esperar ?? 500));
const OUT = path.resolve(flag('out', cfg.out || path.join('.joca', 'gate-runtime')));

// ── Medidores opcionais (`--medir`, `--classes`) ──────────────────────────────
// Só correm quando pedidos: sem estas flags o gate faz exactamente o que sempre fez. Nasceram
// de sondas escritas à mão em sessões reais que morreram no scratchpad (um `text-3xs` inerte em
// 12 ficheiros com tsc+eslint+build verdes; contraste "verde" por cima de um campo de partículas).
const FAMILIAS = ['barra', 'icones', 'transbordo', 'canvas'];
const MEDIDORES = flag('medir', cfg.medir) ? lista(flag('medir', cfg.medir)) : [];
const familiaDesconhecida = MEDIDORES.filter((m) => !FAMILIAS.includes(m));
if (familiaDesconhecida.length) {
  console.error(`✗ --medir: família desconhecida (${familiaDesconhecida.join(', ')}). Válidas: ${FAMILIAS.join(', ')}`);
  process.exit(1);
}

// Classes das linhas ACRESCENTADAS do diff. Só `class=`/`className=` e argumentos string de
// cn/clsx/cx/twMerge/cva — classes montadas em runtime (`${}`) não se vêem e não se inventam.
function classesDoDiff(ref) {
  let saida;
  try {
    saida = execFileSync('git', ['diff', '-U0', ref || 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error(`✗ --classes diff: \`git diff ${ref || 'HEAD'}\` falhou (${String(e.stderr || e).trim().slice(0, 160)})`);
    process.exit(1);
  }
  const strings = [];
  for (const l of saida.split('\n')) {
    if (!l.startsWith('+') || l.startsWith('+++')) continue;
    for (const m of l.matchAll(/\bclass(?:Name)?\s*=\s*\{?\s*(["'`])([^"'`]*)\1/g)) strings.push(m[2]);
    for (const m of l.matchAll(/\b(?:cn|clsx|cx|twMerge|cva)\(([^)]*)\)/g)) {
      for (const s of m[1].matchAll(/(["'`])([^"'`]*)\1/g)) strings.push(s[2]);
    }
  }
  const achadas = new Set();
  for (const s of strings) {
    for (const t of s.split(/\s+/)) if (t && !t.includes('${') && /^[!-]?[a-z0-9@[][^\s"'`{}]*$/i.test(t)) achadas.add(t);
  }
  return [...achadas];
}
const CLASSES_PEDIDO = flag('classes', cfg.classes || null);
let CLASSES = null;
if (CLASSES_PEDIDO) {
  const v = Array.isArray(CLASSES_PEDIDO) ? null : String(CLASSES_PEDIDO);
  CLASSES = v && /^diff(:|$)/.test(v) ? classesDoDiff(v.slice(5) || null) : lista(CLASSES_PEDIDO);
  // Zero classes para medir é falhar ALTO: "0 inertes" e "0 medidas" imprimiriam a mesma linha.
  if (!CLASSES.length) {
    console.error(`✗ --classes ${v || ''}: 0 classes para medir — nada a provar (diff vazio ou sem class/className?)`);
    process.exit(1);
  }
}

// ── Playwright (receita da skill browser-automate) ────────────────────────────
async function obterChromium() {
  // `@playwright/cli` está aqui de propósito: é o pacote que o `npm i -g` instala nesta
  // casa, e o `playwright` real vive ANINHADO dentro dele (ver skill `browser-automate`).
  const nomes = ['playwright', 'playwright-core', '@playwright/test', '@playwright/cli'];
  for (const n of nomes) {
    try {
      const m = await import(n);
      if (m.chromium) return m.chromium;
    } catch { /* segue */ }
  }
  const raizes = [];
  if (process.env.PLAYWRIGHT_PATH) raizes.push(process.env.PLAYWRIGHT_PATH);
  try {
    raizes.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { /* npm pode não estar no PATH */ }
  // Caches do `npx`: um Playwright que veio de `npx playwright ...` NÃO está em `npm root -g`
  // — vive em `<npm cache>/_npx/<hash>/node_modules`. Sem procurar aqui, o gate anuncia
  // "Playwright não encontrado" numa máquina onde o Playwright existe e funciona.
  try {
    const cache = execSync('npm config get cache', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const npx = path.join(cache, '_npx');
    for (const d of fs.readdirSync(npx)) raizes.push(path.join(npx, d, 'node_modules'));
  } catch { /* sem cache _npx nesta máquina */ }
  for (const raiz of raizes.filter(Boolean)) {
    for (const n of nomes) {
      // O `playwright` global vem muitas vezes aninhado dentro do `@playwright/cli`.
      for (const sufixo of ['', '/node_modules/playwright']) {
        const alvo = path.join(raiz, n + sufixo, 'index.mjs');
        try {
          const m = await import(`file://${alvo.replace(/\\/g, '/')}`);
          if (m.chromium) return m.chromium;
        } catch { /* segue */ }
      }
    }
  }
  throw new Error(
    'Playwright não encontrado.\n' +
    '  No projecto:  npm i -D playwright && npx playwright install chromium\n' +
    '  Ou aponta uma instalação existente:  PLAYWRIGHT_PATH=<pasta node_modules> node ...'
  );
}

// ── A medição, avaliada dentro da página ──────────────────────────────────────
// String e não função: é injectada por `page.evaluate` e não pode fechar sobre nada
// do Node. `page.evaluate(fn, arg)` recebe UM argumento — daí o objecto.
const MEDIR = `(() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

  // ── Cor: RASTERIZAR, nunca regex ────────────────────────────────────────────
  // \`getComputedStyle\` devolve \`oklab()/oklch()/lab()\` em qualquer stack moderno
  // (Tailwind v4 por omissão). Duas maneiras de errar, ambas já vividas:
  //   · aceitar só \`rgb\` → mede ZERO pares e reporta 0, que se lê como aprovação;
  //   · ler os números com regex → \`oklab(0.999 0.00004 0.00001)\` vira rgb(1,0,0), quase
  //     preto, e inventa falhas de 1.6:1 em texto que está a 7:1.
  // Ler \`ctx.fillStyle\` de volta NÃO normaliza (devolve a string tal como entrou). O que
  // normaliza é PINTAR num canvas 1x1 e amostrar o pixel — é a única via fiável.
  const _cv = document.createElement('canvas'); _cv.width = _cv.height = 1;
  const _ctx = _cv.getContext('2d', { willReadFrequently: true });
  const parse = s => {
    s = String(s == null ? '' : s).trim();
    if (!s) return null;
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    // Sentinela DUPLA: \`fillStyle\` fica inalterado quando o valor é ilegível, e também
    // quando o valor é igual à sentinela. Duas sentinelas diferentes desfazem o empate —
    // e um valor que nenhuma das duas move é ilegível, o que se REPORTA, não se ignora.
    let legivel = false;
    for (const sent of ['#ff00ff', '#00ff00']) {
      _ctx.fillStyle = sent;
      _ctx.fillStyle = s;
      if (_ctx.fillStyle !== sent) { legivel = true; break; }
    }
    if (!legivel) return null;
    _ctx.clearRect(0, 0, 1, 1);
    _ctx.fillStyle = s;
    _ctx.fillRect(0, 0, 1, 1);
    const d = _ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const sobre = (fg, bg) => ({            // composição alpha: o que o olho vê, não o token
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  // Fundo EFECTIVO: sobe a árvore compondo cada camada semi-transparente. Se pelo
  // caminho houver gradiente ou imagem, marca-o — um valor único mentiria (o pior caso
  // de um gradiente está numa das pontas, e isso não se mede por getComputedStyle).
  const bgOf = el => {
    const camadas = [];
    let n = el, pintura = false;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') pintura = true;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        if (c.a >= 0.99) { camadas.push(c); break; }
        camadas.push(c);
      }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (!base || base.a < 0.99) base = { r: 255, g: 255, b: 255, a: 1 };
    let acc = camadas.length && camadas[camadas.length - 1].a >= 0.99 ? camadas.pop() : base;
    for (let i = camadas.length - 1; i >= 0; i--) acc = sobre(camadas[i], acc);
    return { cor: acc, pintura };
  };

  // \`opacity\` NÃO herda (o computed style do filho diz sempre 1), mas MULTIPLICA-SE na
  // pintura: um ancestral a 0.6 pinta o texto do filho a 60% sobre o que está por baixo.
  // Medir só a cor do próprio elemento dá um contraste que ninguém vê no ecrã.
  const opacidadeAcumulada = el => {
    let a = 1, n = el;
    while (n && n.nodeType === 1) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(o)) a *= o;
      if (a <= 0) return 0;
      n = n.parentElement;
    }
    return a;
  };

  // Visível = o PRÓPRIO e os ANCESTRAIS. Sem \`getClientRects()\` um gémeo responsivo (o
  // mesmo menu duplicado para mobile, escondido por \`display:none\` no PAI) é medido como se
  // estivesse no ecrã e dá falso positivo em tudo o que se lhe meça.
  const visivel = el => {
    if (!el.getClientRects().length) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({
      checkOpacity: true, checkVisibilityCSS: true,          // nomes antigos
      opacityProperty: true, visibilityProperty: true,       // nomes do standard
      contentVisibilityAuto: true,
    })) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse' || cs.display === 'none') return false;
    return opacidadeAcumulada(el) > 0.01;
  };

  // ── Sangramento: descartar SÓ carris intencionais ───────────────────────────
  // O filtro antigo descartava \`auto|scroll|hidden|clip\` e contradizia-se: descartava por
  // \`clip\` e ao mesmo tempo avisava que \`clip\` esconde defeito real. Num CSS com
  // \`main{overflow-x:clip}\` — comum — descartava a PÁGINA INTEIRA e o gate devolvia 0
  // sempre. \`auto|scroll\` é um carril que o utilizador arrasta (tabs mobile, tabelas);
  // \`hidden|clip\` é conteúdo cortado em silêncio, que é o defeito.
  const carrilAcima = el => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      n = n.parentElement;
    }
    return false;
  };
  const nome = n => n.tagName + ((n.className?.toString?.() || '').trim().split(/\\s+/)[0] ? '.' + (n.className?.toString?.() || '').trim().split(/\\s+/)[0] : '');
  const corteAcima = el => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'hidden' || ox === 'clip') return nome(n);
      n = n.parentElement;
    }
    return null;
  };

  const contraste = [], alvos = [], sangra = [], gradiente = [], corIlegivel = [];
  const vistos = new Set();
  let paresMedidos = 0;   // o DENOMINADOR: sem ele, 0 falhas e 0 medições são a mesma linha

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (!visivel(el)) continue;
    const cs = getComputedStyle(el);

    // Só nós de texto PRÓPRIOS — herdar o texto dos filhos duplica tudo.
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (txt.length > 1) {
      const fgRaw = parse(cs.color);
      if (!fgRaw) {
        // O browser não soube ler esta cor. DIZER que não se mediu: um zero silencioso aqui
        // é indistinguível de "está tudo bem", e foi assim que stacks modernos passaram.
        const ki = 'i|' + cs.color;
        if (!vistos.has(ki)) { vistos.add(ki); corIlegivel.push({ valor: String(cs.color).slice(0, 60), tag: el.tagName, texto: txt.slice(0, 40) }); }
      } else if (fgRaw.a > 0.1) {
        const { cor: bg, pintura } = bgOf(el);
        // Alpha da cor × \`opacity\` acumulada dos ancestrais — o olho vê o produto dos dois.
        const aEfectivo = fgRaw.a * opacidadeAcumulada(el);
        const fg = aEfectivo >= 0.99 ? fgRaw : sobre({ r: fgRaw.r, g: fgRaw.g, b: fgRaw.b, a: aEfectivo }, bg);
        const cr = ratio(fg, bg);
        paresMedidos++;
        const px = parseFloat(cs.fontSize);
        const grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
        const min = grande ? 3 : 4.5;
        const k = txt.slice(0, 40) + '|' + cs.color + '|' + px;
        if (cr < min && !vistos.has(k)) {
          vistos.add(k);
          contraste.push({ texto: txt.slice(0, 60), ratio: +cr.toFixed(2), min, fontSize: cs.fontSize, weight: cs.fontWeight, color: cs.color, tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 90) });
        } else if (pintura && !vistos.has('g' + k)) {
          // Fundo com gradiente/imagem: o valor medido não é prova. Verificar as duas pontas à mão.
          vistos.add('g' + k);
          gradiente.push({ texto: txt.slice(0, 60), tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 60) });
        }
      }
    }

    if (r.right > window.innerWidth + 1 && !carrilAcima(el)) {
      sangra.push({
        tag: el.tagName, right: Math.round(r.right), vw: window.innerWidth,
        // Se há \`overflow-x: hidden|clip\` acima, o conteúdo está a ser CORTADO sem barra de
        // scroll — não se descarta, nomeia-se o culpado.
        cortadoPor: corteAcima(el),
        cls: (el.className?.toString?.() || '').slice(0, 80),
      });
    }
  }

  // Alvos interactivos: tamanho, nome acessível e — o que só o runtime sabe — se o
  // clique chega lá. Auditar o atributo href não é testar o clique.
  const SEL = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [onclick]';
  const cobertos = [], pequenos = [], semNome = [];
  let alvosMedidos = 0, foraDoEcra = 0;
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !visivel(el)) continue;

    if (r.height < 24 || r.width < 24) {
      pequenos.push({ tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), texto: (el.textContent || '').trim().slice(0, 40) });
    }
    // Nome acessível: conteúdo, aria-label, aria-labelledby, title, alt — e <label> associado.
    // \`el.labels\` é a associação da própria spec (WHATWG «labelable elements»: button, input
    // não-hidden, meter, output, progress, select, textarea; por \`for\` ou por conter o controlo).
    // Um <button role=checkbox> com <label for> É nomeado (Radix/shadcn <Label htmlFor>).
    const porLabel = el.labels ? Array.from(el.labels).some(l => (l.textContent || '').trim()) : false;
    const nomeado = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('alt') || porLabel;
    if (!nomeado) semNome.push({ tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 80) });

    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) { foraDoEcra++; continue; }
    alvosMedidos++;
    const topo = document.elementFromPoint(cx, cy);
    if (!topo || !(topo === el || el.contains(topo) || topo.contains(el))) {
      cobertos.push({
        tag: el.tagName,
        texto: (el.textContent || '').trim().slice(0, 40),
        href: el.getAttribute('href'),
        tapadoPor: topo ? topo.tagName + '.' + (topo.className?.toString?.() || '').slice(0, 50) : 'nada',
      });
    }
  }

  // Um overlay de consentimento tapa TUDO. Se um só occluder responde pela maioria dos
  // alvos, o defeito é «não se dispensou o overlay», não N alvos partidos — 18 alvos de uma
  // loja foram dados como tapados por causa de um banner de cookies, e a leitura natural
  // era procurar o bug no tema.
  let bloqueadoPor = null;
  if (cobertos.length >= 3) {
    const conta = {};
    for (const c of cobertos) conta[c.tapadoPor] = (conta[c.tapadoPor] || 0) + 1;
    const dom = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
    if (dom && dom[1] >= cobertos.length * 0.6) bloqueadoPor = dom[0] + ' (' + dom[1] + '/' + cobertos.length + ' alvos)';
  }

  // ── Texto tapado ────────────────────────────────────────────────────────────
  // LINHA A LINHA, nunca pelo rect do bloco: o centro de um parágrafo de 3 linhas cai ENTRE
  // linhas e uma sobreposição de 42px escapa-lhe. Três exclusões obrigatórias — sem elas o
  // check passa o controlo negativo e não vale nada.
  const posicionado = el => {
    let n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'absolute' || p === 'fixed' || p === 'sticky') return true;
      n = n.parentElement;
    }
    return false;
  };
  // Exclusão 3: overlay de DEV do Next. É um elemento posicionado que tapa texto no canto e
  // NÃO existe em produção — medir em dev é medir uma página que ninguém vê.
  const overlayDeDev = el => !!(el && el.closest && el.closest('nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog], #__next-build-watcher, #vite-error-overlay'));
  const textoTapado = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let no;
  while ((no = tw.nextNode())) {
    if (textoTapado.length >= 15) break;
    const t = (no.textContent || '').trim();
    if (t.length < 3) continue;
    const pai = no.parentElement;
    if (!pai) continue;
    // Exclusão 1: invisível — um carrossel devolve rects para os slides inactivos.
    if (!visivel(pai)) continue;
    const pr = pai.getBoundingClientRect();
    // Exclusão 2: só-para-leitor-de-ecrã — o padrão \`1x1 + clip-path\`.
    if (pr.width <= 2 || pr.height <= 2) continue;
    if (overlayDeDev(pai)) continue;
    const rng = document.createRange();
    rng.selectNodeContents(no);
    for (const lr of Array.from(rng.getClientRects())) {
      if (lr.width < 4 || lr.height < 4) continue;
      if (lr.bottom < 0 || lr.top > window.innerHeight || lr.right < 0 || lr.left > window.innerWidth) continue;
      const y = lr.top + lr.height / 2;
      let culpado = null;
      for (const x of [lr.left + 3, lr.left + lr.width / 2, lr.right - 3]) {
        if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) continue;
        const topo = document.elementFromPoint(x, y);
        if (!topo || topo === pai || pai.contains(topo) || topo.contains(pai)) continue;
        if (overlayDeDev(topo)) continue;
        // Só occluder POSICIONADO: sem isto, irmãos na mesma linha dão ruído.
        if (!posicionado(topo)) continue;
        culpado = nome(topo);
        break;
      }
      if (culpado) { textoTapado.push({ texto: t.slice(0, 50), tapadoPor: culpado, y: Math.round(y) }); break; }
    }
  }

  return {
    contraste: contraste.sort((a, b) => a.ratio - b.ratio).slice(0, 20),
    contrasteTotal: contraste.length,
    paresMedidos,
    corIlegivel: corIlegivel.slice(0, 10),
    corIlegivelTotal: corIlegivel.length,
    textoTapado,
    bloqueadoPor,
    gradienteNaoMedivel: gradiente.slice(0, 10),
    sangramento: sangra.slice(0, 10),
    sangramentoTotal: sangra.length,
    alvosCobertos: cobertos.slice(0, 15),
    alvosPequenos: pequenos.slice(0, 10),
    semNomeAcessivel: semNome.slice(0, 10),
    alvosMedidos,
    alvosForaDoEcra: foraDoEcra,
    // ⚠ \`scrollWidth - clientWidth\` dá 0 FALSO com \`overflow-x: hidden|clip\` num ancestral —
    // está aqui como contexto, nunca como prova de que não há sangramento.
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    // Uma página em segundo plano não pinta nem anima: medi-la devolve números plausíveis e
    // errados. A 1.ª sonda diz o estado; quem decide o que fazer com ele é o resumo.
    documentoVisivel: document.visibilityState,
    temFoco: typeof document.hasFocus === 'function' ? document.hasFocus() : null,
    textoVisivel: document.body.innerText.trim().length,
    h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) || null,
  };
})()`;

// ── Execução ──────────────────────────────────────────────────────────────────
const chromium = await obterChromium();
fs.mkdirSync(OUT, { recursive: true });

// O Playwright global costuma vir SEM os binários descarregados (`npx playwright install`
// nunca correu para ele). Nesse caso usa-se o Chrome já instalado na máquina — é o que a
// skill `browser-automate` manda fazer, e evita 200 MB de download por gate.
// Binários que o `npx playwright install` deixou na máquina, mesmo quando o MÓDULO que os
// descarregou já não está resolvível: `%LOCALAPPDATA%\\ms-playwright` (Windows),
// `~/Library/Caches/ms-playwright` (macOS), `~/.cache/ms-playwright` (Linux).
function chromiumsDescarregados() {
  const bases = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Caches', 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
  ].filter(Boolean);
  const achados = [];
  for (const base of bases) {
    let dirs = [];
    try { dirs = fs.readdirSync(base); } catch { continue; }
    for (const d of dirs.filter((x) => /^chromium/.test(x))) {
      for (const rel of ['chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome']) {
        const p = path.join(base, d, rel);
        if (fs.existsSync(p)) achados.push(p);
      }
    }
  }
  return achados;
}

async function lancar() {
  const tentativas = [
    {},
    { channel: 'chrome' },
    ...(process.env.CHROME_BIN ? [{ executablePath: process.env.CHROME_BIN }] : []),
    ...chromiumsDescarregados().map((p) => ({ executablePath: p })),
    { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    { executablePath: '/usr/bin/google-chrome' },
    { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  ];
  let ultimo;
  for (const opts of tentativas) {
    try { return await chromium.launch(opts); } catch (e) { ultimo = e; }
  }
  throw new Error(`Nenhum browser arrancou. Última falha: ${String(ultimo).slice(0, 300)}\n` +
    '  Corrige com `npx playwright install chromium` ou aponta o Chrome com CHROME_BIN=<caminho>.');
}
// ── Overlay de consentimento: dispensa-se ANTES de medir ──────────────────────
// A regra dos gates já diz que um componente interactivo se verifica accionando o gatilho;
// falta-lhe o inverso. Uma loja que vende na UE carrega com o banner de cookies por cima e
// TODOS os alvos saem "tapados" — 18 defeitos que não existem, e a leitura natural é
// procurar o bug no tema. NUNCA pelo primeiro botão do overlay: num CMP costuma ser "gerir
// preferências", que abre um SEGUNDO overlay.
// NUNCA ACEITAR (N33): «Aceitar todos» num localhost carrega o GTM real e manda hits de teste
// para a analítica de PRODUÇÃO do cliente. Dispensa-se só por «Recusar/Rejeitar/Reject all» (e
// variantes «só necessários»). Sem botão de recusar NÃO se clica nada: o overlay fica, o gate
// acusa «bloqueado por …» e avisa — dispensar à mão com `--dispensar <seletor do recusar>`.
// Em paralelo, os pedidos a GTM/GA/DoubleClick são abortados (ver RASTREADORES).
const DISPENSAR_CMP = `((seletor) => {
  const recusar = /^(recusar([\\s\\u00a0]+(tudo|todos|todas|cookies|e fechar))?|rejeitar([\\s\\u00a0]+(tudo|todos|todas|cookies))?|n[ãa]o[\\s\\u00a0]+aceitar|(aceitar[\\s\\u00a0]+)?(apenas|s[óo])[\\s\\u00a0]+(os[\\s\\u00a0]+)?(necess[áa]rios|essenciais)|reject([\\s\\u00a0]+all)?|decline([\\s\\u00a0]+all)?|deny([\\s\\u00a0]+all)?|refuse([\\s\\u00a0]+all)?|(accept[\\s\\u00a0]+)?(only[\\s\\u00a0]+)?(necessary|essential)([\\s\\u00a0]+(cookies[\\s\\u00a0]+)?only)?)$/i;
  const aceitar = /^(aceitar([\\s\\u00a0]+(tudo|todos|todas|cookies|e fechar))?|accept([\\s\\u00a0]+all)?|allow all|permitir([\\s\\u00a0]+tudo)?|concordo|i agree|agree|entendi|got it)$/i;
  const contentorFixo = el => {
    let n = el;
    while (n && n.nodeType === 1) { if (getComputedStyle(n).position === 'fixed') return n; n = n.parentElement; }
    return null;
  };
  const feitos = [];
  const candidatos = [];
  let soAceitar = '';
  if (seletor) for (const el of document.querySelectorAll(seletor)) candidatos.push([el, 'seletor dado']);
  for (const b of document.querySelectorAll('button, [role="button"], a[role="button"], input[type="button"], input[type="submit"]')) {
    const t = (b.textContent || b.value || '').replace(/\\s+/g, ' ').trim();
    const ehRecusa = recusar.test(t);
    if (!ehRecusa && !aceitar.test(t)) continue;
    const cx = contentorFixo(b);
    if (!cx) continue;                                    // um CMP é sempre fixo ao viewport
    const r = cx.getBoundingClientRect();
    if (r.width * r.height < window.innerWidth * window.innerHeight * 0.08) continue;
    if (!ehRecusa) { soAceitar = soAceitar || t.slice(0, 40); continue; }   // aceitar NUNCA se clica
    candidatos.push([b, t.slice(0, 40)]);
  }
  for (const [el, etiq] of candidatos.slice(0, 2)) {
    try { el.click(); feitos.push(etiq); } catch (e) { /* segue */ }
  }
  return { feitos, semRecusar: feitos.length ? '' : soAceitar };
})`;

// Analítica/publicidade de terceiros abortada em TODAS as páginas do gate: medir num localhost
// não pode mandar hits para a propriedade de produção do cliente (N33). As falhas de rede que
// isto provoca na consola não contam como erro da página.
const RASTREADORES = /^https?:\/\/([^/?#]*\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com)(?=[/:?#]|$)/i;
const ehRastreador = (url) => RASTREADORES.test(String(url || ''));
async function bloquearRastreadores(alvo, contador) {
  await alvo.route(RASTREADORES, (r) => { if (contador) contador.n++; return r.abort(); });
}

// ── Autoteste: um gate que nunca falhou é um gate por testar ──────────────────
// Injecta na página real duas sondas que TÊM de acusar e volta a medir pelo MESMO caminho
// de produção. Se um contador não subir, o medidor está cego e a rota não é prova de nada:
// era exactamente este controlo que faltava quando o filtro de `overflow-x:clip` descartava
// a página inteira, e quando `oklch()` fazia o contraste medir zero pares em silêncio.
const SONDAS = `(() => {
  const lw = document.documentElement.clientWidth;
  const fora = (x) => 'position:absolute;top:0;left:' + x + 'px;width:150px;height:14px;';
  // Sonda 1: sangra e não tem nada acima — prova que a aritmética do rect e o contador vivem.
  const s = document.createElement('div');
  s.setAttribute('data-gate-runtime-sonda', 'sangramento');
  s.textContent = 'sonda de sangramento';
  s.style.cssText = fora(lw + 80);
  document.body.appendChild(s);
  // Sonda 2: sangra DENTRO de um \`overflow-x: clip\` — prova a POLÍTICA, não só o contador.
  // O filtro antigo descartava \`hidden|clip\` e, num CSS com \`main{overflow-x:clip}\`, devolvia
  // zero para a página inteira. Uma sonda só no topo do body passava com o defeito reposto:
  // um controlo que não desce ao caminho defeituoso é um controlo que nunca falha.
  const w = document.createElement('div');
  w.setAttribute('data-gate-runtime-sonda', 'clip');
  w.style.cssText = 'overflow-x:clip;';
  const s2 = document.createElement('div');
  s2.textContent = 'sonda de sangramento cortada';
  s2.style.cssText = fora(lw + 260);
  w.appendChild(s2);
  document.body.appendChild(w);
  const c = document.createElement('p');
  c.setAttribute('data-gate-runtime-sonda', 'contraste');
  c.textContent = 'sonda de contraste do gate';
  // Cor MODERNA de propósito: é a forma que passava a zero sem ninguém dar por isso.
  c.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;font-size:13px;color:oklch(0.95 0 0);background-color:oklch(1 0 0);';
  document.body.appendChild(c);
  return true;
})()`;
const REMOVER_SONDAS = `(() => { document.querySelectorAll('[data-gate-runtime-sonda]').forEach(n => n.remove()); return true; })()`;

// ── Medidores opcionais: barra · icones · transbordo (`--medir`) ──────────────
// Função-string que recebe a lista de famílias. Os helpers repetem-se de propósito: cada string
// é avaliada sozinha na página e não fecha sobre nada.
const MEDIR_EXTRA = `((familias) => {
  const quer = new Set(familias);
  const px = v => parseFloat(v) || 0;
  const visivel = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    let a = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const o = parseFloat(getComputedStyle(n).opacity); if (Number.isFinite(o)) a *= o; }
    return a > 0.01;
  };
  const nome = n => {
    const c = (n.className && n.className.baseVal !== undefined ? n.className.baseVal : (n.className || '')).toString().trim().split(/\\s+/)[0];
    return n.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  const out = {};

  // Barra de acento: a regra do utilizador proíbe-a, e já voltou DISFARÇADA de
  // \`box-shadow: inset 3px 0 0\` — um grep por \`border-left\` não a vê. Três formas, por estilo computado.
  if (quer.has('barra')) {
    const partes = s => { const r = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { r.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) r.push(cur); return r; };
    const achados = [];
    let medidos = 0;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16 || !visivel(el)) continue;
      medidos++;
      const cs = getComputedStyle(el);
      let via = null;
      const bl = px(cs.borderLeftWidth);
      if (bl >= 2 && bl <= 8 && cs.borderLeftStyle !== 'none' && px(cs.borderRightWidth) < bl && px(cs.borderTopWidth) < bl) via = 'border-left ' + bl + 'px';
      if (!via && cs.boxShadow && cs.boxShadow !== 'none') {
        for (const p of partes(cs.boxShadow)) {
          if (!/inset/.test(p)) continue;
          const nums = (p.replace(/[a-z-]+\\([^)]*\\)/gi, '').match(/-?[\\d.]+px/g) || []).map(parseFloat);
          const [x = 0, y = 0, blur = 0] = nums;
          if (x >= 2 && x <= 8 && Math.abs(y) < 0.5 && blur < 0.5) { via = 'box-shadow inset ' + x + 'px'; break; }
        }
      }
      if (!via) {
        for (const ps of ['::before', '::after']) {
          const pc = getComputedStyle(el, ps);
          if (pc.content === 'none' || pc.content === 'normal' || pc.display === 'none') continue;
          if (pc.position !== 'absolute' && pc.position !== 'fixed') continue;
          const w = px(pc.width);
          const alto = (pc.height.endsWith('px') && px(pc.height) >= r.height * 0.5) || (pc.top !== 'auto' && pc.bottom !== 'auto' && px(pc.top) <= 2 && px(pc.bottom) <= 2);
          const pintado = pc.backgroundImage !== 'none' || !/^(transparent|rgba\\(0, 0, 0, 0\\))$/.test(pc.backgroundColor);
          if (w >= 2 && w <= 8 && alto && pc.left !== 'auto' && px(pc.left) <= 2 && pintado) { via = ps + ' ' + w + 'px'; break; }
        }
      }
      if (via) achados.push({ el: nome(el), via, texto: (el.textContent || '').trim().slice(0, 40) });
    }
    out.barra = { medidos, total: achados.length, achados: achados.slice(0, 15) };
  }

  // Ícones: uma app MORTA passou os três gates estáticos e só esta contagem a apanhou. Colapsado
  // = svg com desenho e caixa <4px; glifo = símbolo Unicode que ficou no texto a fazer de ícone.
  if (quer.has('icones')) {
    let svgs = 0;
    const colapsados = [];
    for (const s of document.querySelectorAll('svg')) {
      if (s.parentElement && s.parentElement.closest('svg')) continue;
      if (s.querySelector('symbol') || !s.querySelector('path, circle, rect, line, polyline, polygon, ellipse, use, text, image')) continue;
      if (!s.getClientRects().length) continue;
      const cs = getComputedStyle(s);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      svgs++;
      const r = s.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) colapsados.push({ el: nome(s), pai: nome(s.parentElement || s), w: Math.round(r.width), h: Math.round(r.height) });
    }
    const GLIFO = /[\\u2190-\\u21FF\\u2300-\\u23FF\\u25A0-\\u27BF\\u27F0-\\u297F\\u2B00-\\u2BFF]|[\\u{1F300}-\\u{1FAFF}]/gu;
    // Glifos de COPY (setas «Ver mais →», visto/cruz de listas): tipografia, não ícone a fazer de
    // svg. Acusá-los era ruído que ensinava a ignorar o medidor — contam-se à parte, como nota.
    const COPIA = new Set(['\\u2190', '\\u2191', '\\u2192', '\\u2193', '\\u2197', '\\u2198', '\\u2713', '\\u2714', '\\u2715', '\\u2717', '\\u2718']);
    const glifos = [];
    let nosTexto = 0, glifosCopia = 0;
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let no;
    while ((no = tw.nextNode())) {
      const pai = no.parentElement;
      const t = no.textContent || '';
      if (!pai || !t.trim() || pai.closest('script, style, noscript, template') || !visivel(pai)) continue;
      nosTexto++;
      let m = null;
      for (const x of t.matchAll(GLIFO)) { if (COPIA.has(x[0])) glifosCopia++; else if (!m) m = x; }
      if (m) glifos.push({ glifo: m[0], codigo: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase(), el: nome(pai), texto: t.trim().slice(0, 40) });
    }
    out.icones = { svgs, colapsadosTotal: colapsados.length, colapsados: colapsados.slice(0, 15), glifosTotal: glifos.length, glifos: glifos.slice(0, 15), glifosCopia, nosTexto };
  }

  // Transbordo: filho EM FLUXO que sai da caixa de conteúdo do pai. Posicionados e inline ficam
  // de fora (dropdowns e texto corrido transbordam por desenho); pai com \`overflow: auto|scroll\`
  // é carril. \`hidden|clip\` NÃO se descarta — é corte silencioso, nomeia-se.
  if (quer.has('transbordo')) {
    const achados = [];
    let medidos = 0;
    for (const el of document.querySelectorAll('body *')) {
      const pai = el.parentElement;
      if (!pai || pai === document.body || pai === document.documentElement) continue;
      const cs = getComputedStyle(el);
      if (/^(absolute|fixed|sticky)$/.test(cs.position) || cs.display === 'inline' || cs.display === 'contents') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !visivel(el)) continue;
      const pr = pai.getBoundingClientRect();
      if (!pr.width || !pr.height) continue;
      medidos++;
      const pcs = getComputedStyle(pai);
      const rolaX = /^(auto|scroll)$/.test(pcs.overflowX), rolaY = /^(auto|scroll)$/.test(pcs.overflowY);
      const ex = rolaX ? 0 : Math.max(r.right - (pr.right - px(pcs.borderRightWidth)), (pr.left + px(pcs.borderLeftWidth)) - r.left);
      const ey = rolaY ? 0 : r.bottom - (pr.bottom - px(pcs.borderBottomWidth));
      const eixos = [ex > 1 ? 'x' : '', ey > 1 ? 'y' : ''].filter(Boolean);
      if (!eixos.length) continue;
      const cortado = /^(hidden|clip)$/.test(pcs.overflowX) || /^(hidden|clip)$/.test(pcs.overflowY);
      achados.push({ el: nome(el), pai: nome(pai), eixo: eixos.join('+'), excesso: Math.round(Math.max(ex, ey)), cortadoPor: cortado ? 'overflow ' + pcs.overflow : null });
    }
    out.transbordo = { medidos, total: achados.length, achados: achados.slice(0, 15) };
  }
  return out;
})`;

// Sondas dos medidores opcionais: nascem FORA do ecrã (não sujam capturas) e têm de acusar.
const SONDAS_EXTRA = `((familias) => {
  const quer = new Set(familias);
  const host = document.createElement('div');
  host.setAttribute('data-gate-runtime-sonda', 'extra');
  host.style.cssText = 'position:absolute;left:-6000px;top:0;';
  const caixa = css => { const d = document.createElement('div'); d.textContent = 'sonda'; d.style.cssText = 'width:120px;height:30px;margin:4px 0;' + css; host.appendChild(d); return d; };
  if (quer.has('barra')) {
    caixa('border-left:3px solid #c00;');
    caixa('box-shadow:inset 3px 0 0 #c00;');
    const e = document.createElement('style');
    e.setAttribute('data-gate-runtime-sonda', 'extra');
    e.textContent = '[data-gate-runtime-barra]{position:relative}[data-gate-runtime-barra]::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#c00}';
    document.head.appendChild(e);
    caixa('').setAttribute('data-gate-runtime-barra', '');
  }
  if (quer.has('icones')) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.style.display = 'inline-block';
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M0 0L10 10');
    s.appendChild(p); host.appendChild(s);
    const g = document.createElement('span'); g.textContent = '\\u283F arrastar'; host.appendChild(g);
  }
  if (quer.has('transbordo')) {
    const c = caixa('overflow:visible;');
    c.textContent = '';
    const f = document.createElement('div');
    f.style.cssText = 'width:170px;height:60px;';
    c.appendChild(f);
  }
  document.body.appendChild(host);
  return true;
})`;

// ── Medidor opcional: contraste sobre `<canvas>` (`--medir canvas`) ───────────
// A cor computada do fundo mente por cima de um canvas (partículas, WebGL, gradiente pintado):
// o gate dava verde. Três agentes re-derivaram o método e dois falharam por armadilhas
// conhecidas — tirar a cor do texto do pixel de maior diferença falha JUSTAMENTE quando o
// contraste é baixo; varrer a caixa inteira apanha o espaço entre linhas. Aqui: a cor do texto
// vem do estilo (rasterizado), a MÁSCARA de glifos vem de pintar o texto a magenta, e o fundo de
// cada pixel da máscara vem da captura sem texto. Pixels cujo fundo mudou entre as duas capturas
// sem texto (animação) ficam de fora e contam-se.
const CANVAS_CANDIDATOS = `((seletor) => {
  const _cv = document.createElement('canvas'); _cv.width = _cv.height = 1;
  const _ctx = _cv.getContext('2d', { willReadFrequently: true });
  const parse = s => { _ctx.clearRect(0, 0, 1, 1); _ctx.fillStyle = '#000'; _ctx.fillStyle = String(s || ''); _ctx.fillRect(0, 0, 1, 1); const d = _ctx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const opacidade = el => { let a = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const o = parseFloat(getComputedStyle(n).opacity); if (Number.isFinite(o)) a *= o; } return a; };
  document.querySelectorAll('[data-gate-runtime-canvas]').forEach(n => n.removeAttribute('data-gate-runtime-canvas'));
  const canvases = [...document.querySelectorAll('canvas')].filter(c => c.getClientRects().length && getComputedStyle(c).visibility !== 'hidden');
  const out = [];
  let foraDoEcra = 0;
  for (const el of document.querySelectorAll(seletor || 'body *')) {
    if (out.length >= 12) break;
    if (el.tagName === 'CANVAS' || el.closest('canvas') || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || opacidade(el) <= 0.01) continue;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (txt.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const sob = canvases.find(c => { if (c.contains(el) || el.contains(c)) return false; const q = c.getBoundingClientRect(); return cx >= q.left && cx <= q.right && cy >= q.top && cy <= q.bottom; });
    if (!sob) continue;
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) { foraDoEcra++; continue; }
    if (document.elementFromPoint(cx, cy) === sob) continue;   // canvas POR CIMA do texto: é texto tapado, não contraste
    const fg = parse(cs.color);
    const fpx = parseFloat(cs.fontSize);
    el.setAttribute('data-gate-runtime-canvas', String(out.length));
    out.push({
      i: out.length, texto: txt.slice(0, 50),
      x: Math.floor(r.left), y: Math.floor(r.top), w: Math.ceil(r.width), h: Math.ceil(r.height),
      fg: { r: fg.r, g: fg.g, b: fg.b, a: fg.a * opacidade(el) },
      min: fpx >= 24 || (fpx >= 18.66 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5,
    });
  }
  return { candidatos: out, foraDoEcra, canvases: canvases.length };
})`;

// Pinta (ou repõe) a cor do texto de um candidato. O \`style\` original guarda-se para repor à letra.
const CANVAS_PINTAR = `(([sel, cor]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  window.__gateRuntimeCss = window.__gateRuntimeCss || new Map();
  if (cor === null) {
    if (window.__gateRuntimeCss.has(el)) { const o = window.__gateRuntimeCss.get(el); if (o === null) el.removeAttribute('style'); else el.setAttribute('style', o); window.__gateRuntimeCss.delete(el); }
    el.removeAttribute('data-gate-runtime-canvas');
    return true;
  }
  if (!window.__gateRuntimeCss.has(el)) window.__gateRuntimeCss.set(el, el.getAttribute('style'));
  el.style.setProperty('transition', 'none', 'important');
  for (const p of ['color', '-webkit-text-fill-color']) el.style.setProperty(p, cor, 'important');
  el.style.setProperty('text-shadow', 'none', 'important');
  return true;
})`;

// Corre numa página auxiliar em branco (sem a CSP do site): descodifica as 3 capturas e mede.
const CANVAS_CONTRASTE = `(async ({ pngs, fg, min }) => {
  const dados = [];
  for (const b64 of pngs) {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    dados.push(ctx.getImageData(0, 0, cv.width, cv.height).data);
  }
  const [B, M, B2] = dados;
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratios = [];
  let glifo = 0, instaveis = 0;
  for (let p = 0; p < B.length; p += 4) {
    const dMB = Math.abs(M[p] - B[p]) + Math.abs(M[p + 1] - B[p + 1]) + Math.abs(M[p + 2] - B[p + 2]);
    if (dMB < 90) continue;
    glifo++;
    const dBB = Math.abs(B2[p] - B[p]) + Math.abs(B2[p + 1] - B[p + 1]) + Math.abs(B2[p + 2] - B[p + 2]);
    if (dBB > 30) { instaveis++; continue; }
    const bg = { r: B[p], g: B[p + 1], b: B[p + 2] };
    const t = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const [x, y] = [lum(t), lum(bg)].sort((a, b) => b - a);
    ratios.push((x + 0.05) / (y + 0.05));
  }
  ratios.sort((a, b) => a - b);
  const q = f => ratios.length ? +ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * f))].toFixed(2) : null;
  // Fundo a mexer em >20% da máscara: a própria máscara está contaminada pela animação — não se mede.
  const medivel = ratios.length >= 20 && instaveis <= glifo * 0.2;
  return { pixelsGlifo: glifo, pixelsInstaveis: instaveis, pixelsMedidos: ratios.length, p10: q(0.1), mediana: q(0.5), min, medivel, falha: medivel && q(0.1) < min };
})`;

const SONDAS_CANVAS = `(() => {
  const cv = document.createElement('canvas');
  cv.setAttribute('data-gate-runtime-sonda', 'canvas');
  cv.width = 360; cv.height = 60;
  cv.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:60px;z-index:2147483600;';
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 360, 60);
  document.body.appendChild(cv);
  const texto = (cor, x, id) => { const t = document.createElement('div'); t.setAttribute('data-gate-runtime-sonda', id); t.textContent = 'sonda canvas'; t.style.cssText = 'position:fixed;top:14px;left:' + x + 'px;z-index:2147483601;margin:0;font:bold 22px sans-serif;background:transparent;color:' + cor + ';'; document.body.appendChild(t); };
  texto('#eeeeee', 10, 'canvas-baixo');   // TEM de acusar
  texto('#111111', 190, 'canvas-alto');   // NÃO pode acusar
  return true;
})()`;

// ── Medidor opcional: classes que têm de existir (`--classes`) ────────────────
// O Tailwind v4 só gera o que encontra ESCRITO: \`border-warning-ink\` existe e
// \`border-warning-ink/30\` pode não existir — mede-se a string exacta do código. Uma classe conta
// como viva se muda o estilo computado de um elemento de teste (ou dos 2 filhos: \`space-y-*\`) OU
// se há regra com esse selector numa folha legível (classe que repõe o valor por omissão, ex.
// \`font-normal\`, não muda nada e existe). Folhas cross-origin não se lêem: contam-se.
const MEDIR_CLASSES = `((classes) => {
  const host = document.createElement('div');
  host.setAttribute('data-gate-runtime-sonda', 'classes');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:600px;';
  document.body.appendChild(host);
  const novo = cls => { const el = document.createElement('div'); if (cls != null) el.setAttribute('class', cls); el.append(document.createElement('div'), document.createElement('div')); host.appendChild(el); return el; };
  const foto = el => [el, ...el.children].map(n => { const cs = getComputedStyle(n); const o = {}; for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]); return o; });
  const base = novo(null); const fb = foto(base); base.remove();
  const difere = f => { let d = 0; for (let k = 0; k < f.length; k++) for (const p of new Set([...Object.keys(f[k]), ...Object.keys(fb[k])])) if (f[k][p] !== fb[k][p]) d++; return d; };
  const selectores = [];
  let folhasIlegiveis = 0;
  const recolher = regras => { for (const r of regras) { if (r.selectorText) selectores.push(r.selectorText); if (r.cssRules) recolher(r.cssRules); } };
  const lerFolhas = () => { selectores.length = 0; folhasIlegiveis = 0; for (const s of document.styleSheets) { try { recolher(s.cssRules); } catch (e) { folhasIlegiveis++; } } };
  const temRegra = cls => { const alvo = '.' + CSS.escape(cls); return selectores.some(s => { let i = s.indexOf(alvo); while (i >= 0) { const c = s[i + alvo.length]; if (c === undefined || !/[\\w\\\\-]/.test(c)) return true; i = s.indexOf(alvo, i + 1); } return false; }); };
  const viva = cls => { const el = novo(cls); const d = difere(foto(el)); el.remove(); return { difere: d > 0, regra: temRegra(cls) }; };

  // Controlos: uma classe injectada que MUDA estilo, uma que só existe como regra (valor por
  // omissão) e uma inventada. As duas primeiras têm de contar; a inventada tem de dar inerte.
  const estilo = document.createElement('style');
  estilo.setAttribute('data-gate-runtime-sonda', 'classes');
  estilo.textContent = '.gate-runtime-classe-viva{margin-left:7px}.gate-runtime-classe-padrao{display:block}';
  document.head.appendChild(estilo);
  lerFolhas();
  const cv = viva('gate-runtime-classe-viva'), cp = viva('gate-runtime-classe-padrao');
  const ci = viva('gate-runtime-classe-inventada-' + Math.random().toString(36).slice(2));
  const controlo = { viva: cv.difere, padrao: cp.regra, inventada: ci.difere || ci.regra };
  estilo.remove();
  lerFolhas();

  const inertes = [], comVariante = [], marcadores = [];
  for (const cls of classes) {
    const v = viva(cls);
    if (v.difere || v.regra) continue;
    if (/^(group|peer)(\\/.*)?$/.test(cls)) marcadores.push(cls);
    else if (cls.includes(':')) comVariante.push(cls);
    else inertes.push(cls);
  }
  host.remove();
  return { medidas: classes.length, inertes, comVariante, marcadores, folhasIlegiveis, controlo };
})`;

// ── `content-type` dos assets ─────────────────────────────────────────────────
// Um painel esteve um dia inteiro inutilizável com HTTP 200 em todos os assets: o servidor
// devolvia `text/html` para os `.js`. Status não é prova; o corpo é.
const CT_OK = { script: /(javascript|ecmascript|application\/json)/i, stylesheet: /text\/css/i };

// Um ecrã de entrada devolve HTTP 200 — o status nunca denuncia a sessão perdida; o URL sim.
const ehLoginUrl = (u) => /\/(login|signin|sign-in|entrar|auth|sessions?\/new)(\/|\?|$)/i.test(String(u || ''));

const navegador = await lancar();

// Página auxiliar em branco para descodificar capturas (a CSP do site pode bloquear `data:`).
let paginaAux = null;
async function medirCanvas(pagina, seletor) {
  const { candidatos, foraDoEcra, canvases } = await pagina.evaluate(`${CANVAS_CANDIDATOS}(${JSON.stringify(seletor || null)})`);
  const vp = pagina.viewportSize();
  const textos = [];
  for (const c of candidatos) {
    const sel = `[data-gate-runtime-canvas="${c.i}"]`;
    const clip = { x: c.x, y: c.y, width: Math.max(1, Math.min(c.w, vp.width - c.x)), height: Math.max(1, Math.min(c.h, vp.height - c.y)) };
    const pintar = (cor) => pagina.evaluate(`${CANVAS_PINTAR}(${JSON.stringify([sel, cor])})`);
    const pngs = [];
    try {
      for (const cor of ['transparent', '#ff00ff', 'transparent']) {
        await pintar(cor);
        await pagina.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))').catch(() => {});
        pngs.push((await pagina.screenshot({ clip })).toString('base64'));
      }
    } finally {
      await pintar(null).catch(() => {});
    }
    if (!paginaAux) paginaAux = await navegador.newPage();
    const m = await paginaAux.evaluate(`${CANVAS_CONTRASTE}(${JSON.stringify({ pngs, fg: c.fg, min: c.min })})`);
    textos.push({ texto: c.texto, i: c.i, ...m });
  }
  return { canvases, candidatos: candidatos.length, foraDoEcra, textos };
}

// ── `--login`: fabricar a sessão aqui, em vez de a exigir feita ───────────────
// O `--estado` só serve quem já tem um `storageState`; gerado à mão, caduca em silêncio e a
// corrida seguinte mede a página de login por limpa. Este bloco corre o formulário UMA vez,
// grava a sessão em `<out>/estado-login.json` e passa-a a todas as rotas.
async function fabricarSessao(spec) {
  const ctx = await navegador.newContext();
  await bloquearRastreadores(ctx);
  const pag = await ctx.newPage();
  const urlLogin = /^https?:/i.test(spec.url || '') ? spec.url : BASE.replace(/\/$/, '') + (spec.url || '/login');
  await pag.goto(urlLogin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (const [sel, valor] of Object.entries(spec.campos || {})) {
    // `fill()` não acorda o estado de campos controlados (React) — escreve-se tecla a tecla.
    const campo = pag.locator(sel).first();
    await campo.click({ timeout: 5000 });
    await campo.pressSequentially(String(valor), { delay: 20 });
  }
  if (spec.submeter) await pag.locator(spec.submeter).first().click({ timeout: 5000 });
  else await pag.keyboard.press('Enter');
  if (spec.esperar) await pag.waitForSelector(spec.esperar, { timeout: 15000 }).catch(() => {});
  else await pag.waitForLoadState('domcontentloaded').catch(() => {});
  await pag.waitForTimeout(500);
  const urlPosLogin = pag.url();
  const ficheiro = path.join(OUT, 'estado-login.json');
  await ctx.storageState({ path: ficheiro });
  await ctx.close();
  return { ficheiro, urlPosLogin };
}

if (LOGIN) {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(LOGIN, 'utf8'));
  } catch (e) {
    console.error(`✗ --login ${LOGIN} ilegível: ${e.message}`);
    await navegador.close();
    process.exit(1);
  }
  let sessao;
  try {
    sessao = await fabricarSessao(spec);
  } catch (e) {
    // Seletor que não casa, campo desactivado, timeout: o login não aconteceu. Dizê-lo e
    // parar — continuar mediria o ecrã de entrada e chamar-lhe-ia resultado.
    console.error(`✗ --login falhou a executar o formulário: ${String(e).slice(0, 200)}`);
    await navegador.close();
    process.exit(1);
  }
  const { ficheiro, urlPosLogin } = sessao;
  // Falhar ALTO: se continuamos num ecrã de entrada, o login não passou. Seguir daqui seria
  // medir a página de login e devolver "limpo" — o defeito original, agora com mais passos.
  if (ehLoginUrl(urlPosLogin)) {
    console.error(`✗ --login falhou: depois de submeter continuamos em ${urlPosLogin}`);
    await navegador.close();
    process.exit(1);
  }
  ESTADO = ficheiro;
  process.stderr.write(`  sessão fabricada por --login → ${urlPosLogin}\n`);
}

const relatorio = [];

for (const rota of ROTAS) {
  for (const tema of TEMAS) {
    for (const vp of VIEWPORTS) {
      // Com --estado a página nasce dentro de um contexto com os cookies da sessão;
      // sem ele, `newPage` directo (comportamento de sempre).
      const contexto = ESTADO
        ? await navegador.newContext({ viewport: { width: vp.w, height: vp.h }, storageState: ESTADO })
        : null;
      const pagina = contexto
        ? await contexto.newPage()
        : await navegador.newPage({ viewport: { width: vp.w, height: vp.h } });
      const erros = [];
      const naoHidratou = [];
      const assetsMalServidos = [];
      const avisos = [];
      const rastreadores = { n: 0 };
      await bloquearRastreadores(pagina, rastreadores);
      pagina.on('pageerror', (e) => erros.push('PAGEERROR ' + String(e).slice(0, 160)));
      pagina.on('console', (m) => {
        if (m.type() !== 'error') return;
        // `m.text()` de uma falha de rede não traz o URL ("Failed to load resource: …404").
        // O URL vive no `location()` — é por lá que se distingue o ícone que o browser
        // pediu sozinho de um asset que a página precisa.
        if (ehRuidoDeBrowser(m.location?.()?.url)) return;
        if (ehRastreador(m.location?.()?.url)) return;     // abortado por nós, não defeito da página
        const t = m.text().slice(0, 160);
        // HMR morto = a página renderiza (o HTML vem do servidor) e NÃO reage a cliques.
        // Screenshots das duas origens são indistinguíveis; só a consola o diz.
        if (/websocket/i.test(t) && /(fail|error|clos)/i.test(t)) naoHidratou.push('HMR: ' + t);
        erros.push(t);
      });
      pagina.on('response', (r) => {
        const tipo = r.request().resourceType();
        const url = r.url();
        // Chunks de cliente com 4xx: o alvo está lá, é clicável, e o clique não faz nada.
        if (r.status() >= 400 && /\/(_next|_nuxt|@vite|build|assets)\//.test(url)) {
          naoHidratou.push(`${r.status()} ${url.slice(0, 100)}`);
        }
        if (!CT_OK[tipo]) return;
        const ct = (r.headers()['content-type'] || '').toLowerCase();
        if (!CT_OK[tipo].test(ct)) assetsMalServidos.push({ tipo, status: r.status(), contentType: ct || '(vazio)', url: url.slice(0, 110) });
      });

      const etiqueta = `${rota} [${tema || 'default'}/${vp.n}]`;
      const alvoUrl = BASE.replace(/\/$/, '') + rota;
      let status = 0;
      try {
        // `networkidle` NUNCA chega num dev server com HMR (o socket fica aberto de propósito)
        // nem em páginas com polling. Timeout aqui não é defeito da página — é o critério
        // errado; volta-se a carregar com `domcontentloaded` e diz-se que se fez isso.
        let resp;
        try {
          resp = await pagina.goto(alvoUrl, { waitUntil: 'networkidle', timeout: 20000 });
        } catch (e) {
          if (!/timeout/i.test(String(e))) throw e;
          avisos.push('networkidle nunca chegou (dev server/polling?) — medido após domcontentloaded');
          resp = await pagina.goto(alvoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        status = resp?.status() ?? 0;
        if (tema) await pagina.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema);

        // Sessão: um `--estado` caducado devolve a página de login com HTTP 200 e o gate
        // mede-a por limpa. A prova é o URL FINAL, não o status.
        const urlFinal = pagina.url();
        const sessaoPerdida = ESTADO && ehLoginUrl(urlFinal) && !ehLoginUrl(rota);
        // Rota efectiva: um redirect (ou uma rota reescrita pela shell) mede OUTRA página com
        // HTTP 200. Compara-se o pathname final com o pedido, sem a barra final.
        const semBarra = (p) => { try { p = decodeURI(p); } catch { /* fica cru */ } return p.length > 1 ? p.replace(/\/+$/, '') : p; };
        const pathPedido = semBarra(new URL(alvoUrl).pathname);
        const pathFinal = semBarra(new URL(urlFinal).pathname);
        const rotaDesviada = !sessaoPerdida && pathFinal !== pathPedido ? pathFinal : null;

        // `evaluate` com uma STRING avalia-a como expressão e IGNORA o argumento — o seletor
        // tem de entrar embutido, ou a dispensa corre com `seletor` a `undefined` em silêncio.
        const cmp = await pagina
          .evaluate(`${DISPENSAR_CMP}(${JSON.stringify(DISPENSAR)})`)
          .catch((e) => { avisos.push('dispensa de overlay falhou: ' + String(e).slice(0, 90)); return { feitos: [] }; });
        const overlaysDispensados = cmp.feitos || [];
        if (cmp.semRecusar) avisos.push(`banner de cookies só com «${cmp.semRecusar}» (sem recusar) — NÃO aceite; dispensa à mão com --dispensar <seletor do recusar>`);
        if (rastreadores.n) avisos.push(`${rastreadores.n} pedido(s) de analítica (GTM/GA/DoubleClick) bloqueado(s)`);
        // Geometria medida antes das webfonts carregarem é a do fallback: larguras, quebras e
        // sangramento mudam depois (visto num projecto de cliente). Tecto de 5 s para não pendurar.
        const fontes = await pagina
          .evaluate('document.fonts ? Promise.race([document.fonts.ready.then(() => "ok"), new Promise((r) => setTimeout(() => r("timeout"), 5000))]) : "sem-api"')
          .catch(() => 'erro');
        if (fontes !== 'ok') avisos.push(`document.fonts.ready: ${fontes} — geometria pode ser a da fonte de fallback`);
        await pagina.waitForTimeout(ESPERAR);
        const medida = await pagina.evaluate(MEDIR);

        // Controlo negativo + positivo, na página real e pelo mesmo caminho de medição.
        // Guardam-se os DELTAS, não booleanos: 1 em 2 sondas de sangramento diz exactamente
        // qual metade do filtro se partiu.
        let autoteste = { sangramento: null, contraste: null };
        try {
          await pagina.evaluate(SONDAS);
          const comSondas = await pagina.evaluate(MEDIR);
          autoteste = {
            sangramento: comSondas.sangramentoTotal - medida.sangramentoTotal,   // esperado: 2
            contraste: comSondas.contrasteTotal - medida.contrasteTotal,         // esperado: 1
          };
        } finally {
          await pagina.evaluate(REMOVER_SONDAS).catch(() => {});
        }

        // Medidores opcionais — cada família com o seu autoteste. Sem as flags não corre nada.
        let medidores = null;
        if (MEDIDORES.length || CLASSES) {
          medidores = { cegos: [] };
          const fam = MEDIDORES.filter((x) => x !== 'canvas');
          if (fam.length) {
            const antes = await pagina.evaluate(`${MEDIR_EXTRA}(${JSON.stringify(fam)})`);
            Object.assign(medidores, antes);
            try {
              await pagina.evaluate(`${SONDAS_EXTRA}(${JSON.stringify(fam)})`);
              const com = await pagina.evaluate(`${MEDIR_EXTRA}(${JSON.stringify(fam)})`);
              if (antes.barra && com.barra.total - antes.barra.total < 3) {
                medidores.cegos.push(`${com.barra.total - antes.barra.total}/3 sondas de barra (border-left · box-shadow inset · ::before) acusaram`);
              }
              if (antes.icones && (com.icones.colapsadosTotal - antes.icones.colapsadosTotal < 1 || com.icones.glifosTotal - antes.icones.glifosTotal < 1)) {
                medidores.cegos.push('a sonda de ícone colapsado ou a de glifo (U+283F) não acusou');
              }
              if (antes.transbordo && com.transbordo.total - antes.transbordo.total < 1) {
                medidores.cegos.push('a sonda de transbordo não acusou');
              }
            } finally {
              await pagina.evaluate(REMOVER_SONDAS).catch(() => {});
            }
          }
          if (MEDIDORES.includes('canvas')) {
            medidores.canvas = await medirCanvas(pagina, null);
            try {
              await pagina.evaluate(SONDAS_CANVAS);
              const t = await medirCanvas(pagina, '[data-gate-runtime-sonda^="canvas-"]');
              const baixo = t.textos.find((x) => x.i === 0), alto = t.textos.find((x) => x.i === 1);
              if (!baixo?.falha || !alto?.medivel || alto.falha) {
                medidores.cegos.push(`sondas de canvas: texto #eee sobre branco ${baixo?.falha ? 'acusou' : 'NÃO acusou'} · texto #111 ${alto?.medivel && !alto.falha ? 'passou' : 'NÃO passou'}`);
              }
            } finally {
              await pagina.evaluate(REMOVER_SONDAS).catch(() => {});
            }
          }
          if (CLASSES) {
            medidores.classes = await pagina.evaluate(`${MEDIR_CLASSES}(${JSON.stringify(CLASSES)})`);
            const k = medidores.classes.controlo;
            if (!k.viva || !k.padrao || k.inventada) {
              medidores.cegos.push(`controlos de classes: injectada ${k.viva ? 'contou' : 'NÃO contou'} · só-regra ${k.padrao ? 'contou' : 'NÃO contou'} · inventada ${k.inventada ? 'CONTOU' : 'inerte'}`);
            }
          }
        }

        // Componente interactivo: um gate que nunca clica é um gate de layout.
        let cliques = null;
        if (CLICAR) {
          cliques = [];
          const alvos = await pagina.$$(CLICAR);
          for (const [i, alvo] of alvos.entries()) {
            const antes = erros.length;
            try {
              await alvo.click({ timeout: 3000 });
              await pagina.waitForTimeout(250);
              if (erros.length > antes) cliques.push({ i, errosNovos: erros.slice(antes) });
              await pagina.keyboard.press('Escape').catch(() => {});
            } catch (e) {
              cliques.push({ i, erro: String(e).slice(0, 120) });
            }
          }
        }

        const registo = {
          rota, tema, vp: vp.n, status, urlFinal, sessaoPerdida, rotaDesviada, erros: [...erros],
          naoHidratou, assetsMalServidos, overlaysDispensados, avisos, autoteste, cliques, medidores, ...medida,
        };
        relatorio.push(registo);
        const nome = (rota.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'home') + `__${tema || 'default'}_${vp.n}`;
        // A captura tem o seu próprio try: falhar aqui caía no catch geral, que fazia um 2.º push
        // e a mesma página saía duas vezes no relatório. A medição já está feita e vale.
        try {
          await pagina.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: true });
        } catch (e) {
          registo.capturaFalhou = String(e).slice(0, 160);
        }
      } catch (e) {
        relatorio.push({ rota, tema, vp: vp.n, status, erroFatal: String(e).slice(0, 200), erros: [...erros], naoHidratou, assetsMalServidos, avisos });
      }
      await pagina.close();
      if (contexto) await contexto.close();
      process.stderr.write(`  medido ${etiqueta}\n`);
    }
  }
}
await navegador.close();

fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(relatorio, null, 2));

// ── Resumo ────────────────────────────────────────────────────────────────────
let falhas = 0;
const linhas = [];
for (const r of relatorio) {
  const f = [];
  if (r.erroFatal) f.push(`FALHOU: ${r.erroFatal}`);
  if (r.status >= 400) f.push(`HTTP ${r.status}`);

  // ── Primeiro: o medidor estava a ver? ───────────────────────────────────────
  // Contar ausências numa página de erro, em segundo plano, ou com o medidor cego é
  // indistinguível de sucesso. Estas linhas vêm ANTES das medições de propósito.
  if (r.documentoVisivel && r.documentoVisivel !== 'visible') {
    f.push(`MEDIÇÃO INVÁLIDA: página em segundo plano (visibilityState=${r.documentoVisivel})`);
  }
  if (typeof r.autoteste?.sangramento === 'number' && r.autoteste.sangramento < 2) {
    f.push(`MEDIDOR CEGO: ${r.autoteste.sangramento}/2 sondas de sangramento acusaram` +
      (r.autoteste.sangramento === 1
        ? ' — o filtro está a descartar `overflow-x: hidden|clip`, que é corte silencioso, não carril'
        : ' (ou o <body> é ele próprio um carril horizontal)'));
  }
  if (typeof r.autoteste?.contraste === 'number' && r.autoteste.contraste < 1) {
    f.push('MEDIDOR CEGO: a sonda de contraste em `oklch()` não acusou — o gate não sabe ler cor moderna');
  }
  if (!r.erroFatal && r.textoVisivel > 0 && r.paresMedidos === 0) {
    f.push('MEDIÇÃO INVÁLIDA: 0 pares de cor medidos numa página com texto');
  }
  if (r.corIlegivelTotal) f.push(`${r.corIlegivelTotal} cor(es) que o gate NÃO soube ler`);
  if (r.sessaoPerdida) f.push(`SESSÃO PERDIDA: --estado levou a ${r.urlFinal}`);
  if (r.rotaDesviada) f.push(`ROTA DESVIADA: pedida ${r.rota}, medida ${r.rotaDesviada} (redirect?) — se o destino é o esperado, pede a rota final`);
  if (r.naoHidratou?.length) f.push(`a página não hidratou — resultados inválidos (${r.naoHidratou[0]})`);
  if (r.assetsMalServidos?.length) f.push(`${r.assetsMalServidos.length} asset com content-type errado (${r.assetsMalServidos[0].tipo}: ${r.assetsMalServidos[0].contentType})`);

  if (r.erros?.length) f.push(`${r.erros.length} erro(s) consola`);
  if (r.contrasteTotal) f.push(`${r.contrasteTotal} contraste`);
  if (r.sangramentoTotal) {
    const cortados = (r.sangramento || []).filter((s) => s.cortadoPor).length;
    f.push(`${r.sangramentoTotal} sangra${cortados ? ` (${cortados} cortado em silêncio por overflow-x:hidden|clip)` : ''}`);
  }
  if (r.textoTapado?.length) f.push(`${r.textoTapado.length} texto tapado`);
  // Um overlay por dispensar é UM defeito, não N alvos tapados.
  if (r.bloqueadoPor) f.push(`bloqueado por ${r.bloqueadoPor}`);
  else if (r.alvosCobertos?.length) f.push(`${r.alvosCobertos.length} alvo tapado`);
  if (r.alvosPequenos?.length) f.push(`${r.alvosPequenos.length} alvo <24px`);
  if (r.semNomeAcessivel?.length) f.push(`${r.semNomeAcessivel.length} sem nome`);
  if (r.cliques?.length) f.push(`${r.cliques.length} clique com erro`);
  const md = r.medidores;
  if (md) {
    for (const c of md.cegos || []) f.push(`MEDIDOR CEGO: ${c}`);
    if (md.barra?.total) f.push(`${md.barra.total} barra de acento à esquerda (${md.barra.achados[0].el}: ${md.barra.achados[0].via})`);
    if (md.icones?.colapsadosTotal) f.push(`${md.icones.colapsadosTotal} ícone svg colapsado`);
    if (md.icones?.glifosTotal) f.push(`${md.icones.glifosTotal} glifo no texto (${md.icones.glifos[0].codigo} em ${md.icones.glifos[0].el})`);
    if (md.transbordo?.total) f.push(`${md.transbordo.total} transborda o contentor (${md.transbordo.achados[0].el} em ${md.transbordo.achados[0].pai}, ${md.transbordo.achados[0].eixo})`);
    const cvFalha = (md.canvas?.textos || []).filter((t) => t.falha);
    if (cvFalha.length) f.push(`${cvFalha.length} contraste sobre canvas (P10 ${cvFalha[0].p10} < ${cvFalha[0].min}: "${cvFalha[0].texto}")`);
    if (md.classes?.inertes.length) f.push(`${md.classes.inertes.length} classe(s) sem efeito nem regra (${md.classes.inertes.slice(0, 5).join(' ')})`);
  }
  if (f.length) falhas++;
  const nota = [];
  if (md?.icones) nota.push(`${md.icones.svgs} ícone(s) svg medido(s)`);
  if (md?.icones?.glifosCopia) nota.push(`${md.icones.glifosCopia} glifo(s) de copy (setas, ✓/✗) não contado(s) como ícone`);
  if (r.capturaFalhou) nota.push(`captura de ecrã falhou (medição válida): ${r.capturaFalhou.slice(0, 80)}`);
  if (md?.canvas) {
    const nm = md.canvas.textos.filter((t) => !t.medivel);
    nota.push(`canvas: ${md.canvas.canvases} canvas · ${md.canvas.candidatos} texto(s) por cima medido(s)`);
    if (nm.length) nota.push(`${nm.length} texto sobre canvas NÃO medível (fundo a mudar entre capturas — congelar a animação e repetir)`);
    if (md.canvas.foraDoEcra) nota.push(`${md.canvas.foraDoEcra} texto sobre canvas fora do ecrã (não medido)`);
  }
  if (md?.classes?.comVariante.length) nota.push(`${md.classes.comVariante.length} classe com variante inerte em repouso (${md.classes.comVariante.slice(0, 3).join(' ')}) — confirmar no estado`);
  if (md?.classes?.folhasIlegiveis) nota.push(`${md.classes.folhasIlegiveis} folha(s) CSS ilegível(is) (cross-origin) — classe "inerte" pode viver lá`);
  if (r.gradienteNaoMedivel?.length) nota.push(`${r.gradienteNaoMedivel.length} texto sobre gradiente/imagem (medir as 2 pontas à mão)`);
  if (r.alvosForaDoEcra) nota.push(`${r.alvosForaDoEcra} alvo fora do ecrã (não clicável sem scroll — não medido)`);
  if (r.overlaysDispensados?.length) nota.push(`overlay dispensado: ${r.overlaysDispensados.join(' · ')}`);
  if (r.temFoco === false) nota.push('página sem foco (hover/`:focus-visible` não medidos)');
  for (const a of r.avisos || []) nota.push(a);
  linhas.push(`${f.length ? '✗' : '✓'} ${r.rota} [${r.tema || 'default'}/${r.vp}] ${f.join(' · ') || 'limpo'}${nota.length ? `  ⚠ ${nota.join(' · ')}` : ''}`);
}
console.log(linhas.join('\n'));
console.log(`\n${relatorio.length - falhas}/${relatorio.length} combinações limpas · relatório: ${path.join(OUT, 'relatorio.json')}`);
// O denominador declara-se: "0 falhas" e "0 medições" imprimem a mesma linha sem isto.
const pares = relatorio.reduce((s, r) => s + (r.paresMedidos || 0), 0);
const alvos = relatorio.reduce((s, r) => s + (r.alvosMedidos || 0), 0);
console.log(`Medido: ${pares} par(es) de cor · ${alvos} alvo(s) interactivo(s).`);
if (!CLICAR) console.log('⚠ Sem --clicar: mediu o estado de REPOUSO. Overlays/menus/modais exigem accionar o gatilho.');
console.log('⚠ POR VERIFICAR sempre: fundo com gradiente/imagem, alvos fora do ecrã, e tudo o que só aparece depois de interagir.');
process.exit(falhas > 0 ? 1 : 0);
