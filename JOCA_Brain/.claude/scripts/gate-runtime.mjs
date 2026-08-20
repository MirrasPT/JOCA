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
//   · contraste do texto contra o pixel PINTADO (alpha composto sobre os ancestrais;
//     gradiente/imagem de fundo é assinalado, não adivinhado)
//   · `document.elementFromPoint` no centro de cada alvo interactivo — auditar `href`
//     não é testar o clique
//   · sangramento horizontal por `getBoundingClientRect().right`, DESCARTANDO elementos
//     com ancestral `overflow-x: auto|scroll|hidden|clip` (sem esse filtro, tabs mobile
//     dão 15 rotas "partidas" que não estão)
//   · erros de consola e `pageerror`
//   · respostas HTTP >= 400
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
//   --out <pasta>       destino do relatório e screenshots (default: ./.joca/gate-runtime)
//   --esperar <ms>      espera após carga, antes de medir (default: 500)
//
// Exit code: 0 = tudo limpo · 1 = pelo menos uma rota com problema.
//
// Playwright: resolvido pela receita da skill `browser-automate` — dependência do
// projecto primeiro, depois `npm root -g`, depois `PLAYWRIGHT_PATH`. Nunca um caminho
// cravado: um gate que não arranca é um gate que não existe.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
const TEMAS = flag('temas', cfg.temas) ? lista(flag('temas', cfg.temas)) : [null];
const VIEWPORTS = lista(flag('viewports', cfg.viewports || '1440x900,390x844')).map((v) => {
  const [w, h] = v.toLowerCase().split('x').map(Number);
  return { w, h, n: `${w}x${h}` };
});
const CLICAR = flag('clicar', cfg.clicar || null);
const ESPERAR = Number(flag('esperar', cfg.esperar ?? 500));
const OUT = path.resolve(flag('out', cfg.out || path.join('.joca', 'gate-runtime')));

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
  const parse = s => {
    if (!s) return null;
    const m = s.match(/-?[\\d.]+/g);
    if (!m || !s.startsWith('rgb')) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
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

  const visivel = el => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const temScrollerAcima = el => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (['auto', 'scroll', 'hidden', 'clip'].includes(ox)) return true;
      n = n.parentElement;
    }
    return false;
  };

  const contraste = [], alvos = [], sangra = [], gradiente = [];
  const vistos = new Set();

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (!visivel(el)) continue;
    const cs = getComputedStyle(el);

    // Só nós de texto PRÓPRIOS — herdar o texto dos filhos duplica tudo.
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (txt.length > 1) {
      const fgRaw = parse(cs.color);
      if (fgRaw && fgRaw.a > 0.1) {
        const { cor: bg, pintura } = bgOf(el);
        const fg = fgRaw.a >= 0.99 ? fgRaw : sobre(fgRaw, bg);
        const cr = ratio(fg, bg);
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

    if (r.right > window.innerWidth + 1 && !temScrollerAcima(el)) {
      sangra.push({ tag: el.tagName, right: Math.round(r.right), vw: window.innerWidth, cls: (el.className?.toString?.() || '').slice(0, 80) });
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
    // Nome acessível: um <button> NUNCA é nomeado por label[for] — só por conteúdo,
    // aria-label, aria-labelledby ou title. Armadilha transversal a Radix/shadcn/Headless.
    const nomeado = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('alt');
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

  return {
    contraste: contraste.sort((a, b) => a.ratio - b.ratio).slice(0, 20),
    contrasteTotal: contraste.length,
    gradienteNaoMedivel: gradiente.slice(0, 10),
    sangramento: sangra.slice(0, 10),
    sangramentoTotal: sangra.length,
    alvosCobertos: cobertos.slice(0, 15),
    alvosPequenos: pequenos.slice(0, 10),
    semNomeAcessivel: semNome.slice(0, 10),
    alvosMedidos,
    alvosForaDoEcra: foraDoEcra,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
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
async function lancar() {
  const tentativas = [
    {},
    { channel: 'chrome' },
    ...(process.env.CHROME_BIN ? [{ executablePath: process.env.CHROME_BIN }] : []),
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
const navegador = await lancar();
const relatorio = [];

for (const rota of ROTAS) {
  for (const tema of TEMAS) {
    for (const vp of VIEWPORTS) {
      const pagina = await navegador.newPage({ viewport: { width: vp.w, height: vp.h } });
      const erros = [];
      pagina.on('pageerror', (e) => erros.push('PAGEERROR ' + String(e).slice(0, 160)));
      pagina.on('console', (m) => {
        if (m.type() !== 'error') return;
        // `m.text()` de uma falha de rede não traz o URL ("Failed to load resource: …404").
        // O URL vive no `location()` — é por lá que se distingue o ícone que o browser
        // pediu sozinho de um asset que a página precisa.
        if (ehRuidoDeBrowser(m.location?.()?.url)) return;
        erros.push(m.text().slice(0, 160));
      });

      const etiqueta = `${rota} [${tema || 'default'}/${vp.n}]`;
      let status = 0;
      try {
        const resp = await pagina.goto(BASE.replace(/\/$/, '') + rota, { waitUntil: 'networkidle', timeout: 45000 });
        status = resp?.status() ?? 0;
        if (tema) await pagina.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema);
        await pagina.waitForTimeout(ESPERAR);
        const medida = await pagina.evaluate(MEDIR);

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

        relatorio.push({ rota, tema, vp: vp.n, status, erros: [...erros], cliques, ...medida });
        const nome = (rota.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'home') + `__${tema || 'default'}_${vp.n}`;
        await pagina.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: true });
      } catch (e) {
        relatorio.push({ rota, tema, vp: vp.n, status, erroFatal: String(e).slice(0, 200), erros: [...erros] });
      }
      await pagina.close();
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
  if (r.erros?.length) f.push(`${r.erros.length} erro(s) consola`);
  if (r.contrasteTotal) f.push(`${r.contrasteTotal} contraste`);
  if (r.sangramentoTotal) f.push(`${r.sangramentoTotal} sangra`);
  if (r.alvosCobertos?.length) f.push(`${r.alvosCobertos.length} alvo tapado`);
  if (r.alvosPequenos?.length) f.push(`${r.alvosPequenos.length} alvo <24px`);
  if (r.semNomeAcessivel?.length) f.push(`${r.semNomeAcessivel.length} sem nome`);
  if (r.cliques?.length) f.push(`${r.cliques.length} clique com erro`);
  if (f.length) falhas++;
  const nota = [];
  if (r.gradienteNaoMedivel?.length) nota.push(`${r.gradienteNaoMedivel.length} texto sobre gradiente/imagem (medir as 2 pontas à mão)`);
  if (r.alvosForaDoEcra) nota.push(`${r.alvosForaDoEcra} alvo fora do ecrã (não clicável sem scroll — não medido)`);
  linhas.push(`${f.length ? '✗' : '✓'} ${r.rota} [${r.tema || 'default'}/${r.vp}] ${f.join(' · ') || 'limpo'}${nota.length ? `  ⚠ ${nota.join(' · ')}` : ''}`);
}
console.log(linhas.join('\n'));
console.log(`\n${relatorio.length - falhas}/${relatorio.length} combinações limpas · relatório: ${path.join(OUT, 'relatorio.json')}`);
if (!CLICAR) console.log('⚠ Sem --clicar: mediu o estado de REPOUSO. Overlays/menus/modais exigem accionar o gatilho.');
process.exit(falhas > 0 ? 1 : 0);
