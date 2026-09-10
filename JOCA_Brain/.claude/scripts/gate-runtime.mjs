#!/usr/bin/env node
// gate-runtime.mjs — the runtime gate from `rules/pipelines.md`, as an artifact.
//
// WHY: green `tsc`/`eslint`/`build` prove that it COMPILES, not that it WORKS. The rule
// has always existed in `.claude/rules/pipelines.md` §Gates and in
// `.claude/reference/gates-runtime.md`, but it had no code — every project rewrote
// ~250 lines from scratch and every rewrite lost one of the pitfalls. This file is the
// parameterized version: you point it at a base URL and a list of routes.
//
// What it measures (and no static gate catches):
//   · text contrast against the PAINTED pixel (alpha composited over the ancestors;
//     a gradient/image background is flagged, not guessed)
//   · `document.elementFromPoint` at the center of every interactive target — auditing
//     `href` is not testing the click
//   · horizontal bleed via `getBoundingClientRect().right`, DISCARDING elements with an
//     `overflow-x: auto|scroll|hidden|clip` ancestor (without that filter, mobile tabs
//     give 15 "broken" routes that are not)
//   · console errors and `pageerror`
//   · HTTP responses >= 400
//
// ASSUMED LIMIT: it measures the resting state of the load. A gate that never clicks is a
// layout gate — overlays, menus and modals require triggering them (see `--clicar`).
//
// Usage:
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --rotas /,/precos,/sobre
//   node .claude/scripts/gate-runtime.mjs --config gate-runtime.json
//   node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --clicar "header a,nav button"
//
// Flags:
//   --base <url>        base URL (required, or `base` in --config)
//   --rotas a,b,c       list of routes (default: "/")
//   --config <file>     JSON with { base, rotas, temas, viewports, clicar, out, esperar }
//   --temas a,b         values put in `data-theme` on the <html> (default: none)
//   --viewports WxH,... default: 1440x900,390x844
//   --clicar <selector> besides measuring, clicks every matching element and counts new errors
//   --out <folder>      destination for the report and screenshots (default: ./.joca/gate-runtime)
//   --esperar <ms>      wait after load, before measuring (default: 500)
//
// Exit code: 0 = all clean · 1 = at least one route with a problem.
//
// Playwright: resolved by the `browser-automate` skill's recipe — project dependency
// first, then `npm root -g`, then `PLAYWRIGHT_PATH`. Never a hardcoded path:
// a gate that does not start is a gate that does not exist.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// ── Browser noise ≠ page defect ───────────────────────────────────────────────
// The browser REQUESTS the default icon on its own (`/favicon.ico`, `apple-touch-icon*.png`)
// even when the HTML never touches them — that 404 is the BROWSER's, not the page's.
// Any project without a favicon failed the gate over this, and a gate that fails on noise
// is a gate you learn to ignore.
//
// The filter is deliberately NARROW: it matches only the paths the browser invents by
// default. A 404 for an asset the PAGE requests (`/logo.svg`, `/app.js`, or even a
// `<link rel="icon" href="/marca/icone.png">`) IS a defect and still counts.
// Filtering on "404" in the text, or on image extension, would hide real defects.
const RUIDO_URL = /\/(favicon\.ico|apple-touch-icon(-[\w.-]+)?\.png)$/i;
const ehRuidoDeBrowser = (url) => RUIDO_URL.test(String(url || '').split(/[?#]/)[0]);

// ── Arguments ─────────────────────────────────────────────────────────────────
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
    console.error(`✗ --config ${configPath} unreadable: ${e.message}`);
    process.exit(1);
  }
}

const lista = (v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean);

const BASE = flag('base', cfg.base);
if (!BASE) {
  console.error('✗ Missing base URL. Usage: --base http://localhost:3000 [--rotas /,/precos]');
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

// ── Playwright (recipe from the browser-automate skill) ───────────────────────
async function obterChromium() {
  // `@playwright/cli` is here deliberately: it is the package `npm i -g` installs in this
  // house, and the real `playwright` lives NESTED inside it (see the `browser-automate` skill).
  const nomes = ['playwright', 'playwright-core', '@playwright/test', '@playwright/cli'];
  for (const n of nomes) {
    try {
      const m = await import(n);
      if (m.chromium) return m.chromium;
    } catch { /* carry on */ }
  }
  const raizes = [];
  if (process.env.PLAYWRIGHT_PATH) raizes.push(process.env.PLAYWRIGHT_PATH);
  try {
    raizes.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { /* npm may not be on the PATH */ }
  for (const raiz of raizes.filter(Boolean)) {
    for (const n of nomes) {
      // The global `playwright` often comes nested inside `@playwright/cli`.
      for (const sufixo of ['', '/node_modules/playwright']) {
        const alvo = path.join(raiz, n + sufixo, 'index.mjs');
        try {
          const m = await import(`file://${alvo.replace(/\\/g, '/')}`);
          if (m.chromium) return m.chromium;
        } catch { /* carry on */ }
      }
    }
  }
  throw new Error(
    'Playwright not found.\n' +
    '  In the project:  npm i -D playwright && npx playwright install chromium\n' +
    '  Or point at an existing install:  PLAYWRIGHT_PATH=<node_modules folder> node ...'
  );
}

// ── The measurement, evaluated inside the page ────────────────────────────────
// A string and not a function: it is injected by `page.evaluate` and cannot close over
// anything from Node. `page.evaluate(fn, arg)` takes ONE argument — hence the object.
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
  const sobre = (fg, bg) => ({            // alpha compositing: what the eye sees, not the token
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  // EFFECTIVE background: walks up the tree compositing each semi-transparent layer. If
  // there is a gradient or image along the way, it flags it — a single value would lie (a
  // gradient's worst case is at one of the ends, and that is not measurable by getComputedStyle).
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

    // OWN text nodes only — inheriting the children's text duplicates everything.
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
          // Gradient/image background: the measured value is not evidence. Check both ends by hand.
          vistos.add('g' + k);
          gradiente.push({ texto: txt.slice(0, 60), tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 60) });
        }
      }
    }

    if (r.right > window.innerWidth + 1 && !temScrollerAcima(el)) {
      sangra.push({ tag: el.tagName, right: Math.round(r.right), vw: window.innerWidth, cls: (el.className?.toString?.() || '').slice(0, 80) });
    }
  }

  // Interactive targets: size, accessible name and — what only the runtime knows — whether
  // the click gets there. Auditing the href attribute is not testing the click.
  const SEL = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [onclick]';
  const cobertos = [], pequenos = [], semNome = [];
  let alvosMedidos = 0, foraDoEcra = 0;
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !visivel(el)) continue;

    if (r.height < 24 || r.width < 24) {
      pequenos.push({ tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), texto: (el.textContent || '').trim().slice(0, 40) });
    }
    // Accessible name: a <button> is NEVER named by label[for] — only by content,
    // aria-label, aria-labelledby or title. A pitfall common to Radix/shadcn/Headless.
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
        tapadoPor: topo ? topo.tagName + '.' + (topo.className?.toString?.() || '').slice(0, 50) : 'nothing',
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

// ── Execution ─────────────────────────────────────────────────────────────────
const chromium = await obterChromium();
fs.mkdirSync(OUT, { recursive: true });

// The global Playwright usually comes WITHOUT the binaries downloaded (`npx playwright
// install` never ran for it). In that case it uses the Chrome already installed on the
// machine — which is what the `browser-automate` skill says to do, and avoids a 200 MB
// download per gate.
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
  throw new Error(`No browser started. Last failure: ${String(ultimo).slice(0, 300)}\n` +
    '  Fix it with `npx playwright install chromium` or point at Chrome with CHROME_BIN=<path>.');
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
        // `m.text()` of a network failure does not carry the URL ("Failed to load resource: …404").
        // The URL lives in `location()` — that is how you tell the icon the browser asked
        // for on its own from an asset the page needs.
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

        // Interactive component: a gate that never clicks is a layout gate.
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
      process.stderr.write(`  measured ${etiqueta}\n`);
    }
  }
}
await navegador.close();

fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(relatorio, null, 2));

// ── Summary ───────────────────────────────────────────────────────────────────
let falhas = 0;
const linhas = [];
for (const r of relatorio) {
  const f = [];
  if (r.erroFatal) f.push(`FAILED: ${r.erroFatal}`);
  if (r.status >= 400) f.push(`HTTP ${r.status}`);
  if (r.erros?.length) f.push(`${r.erros.length} console error(s)`);
  if (r.contrasteTotal) f.push(`${r.contrasteTotal} contrast`);
  if (r.sangramentoTotal) f.push(`${r.sangramentoTotal} bleed`);
  if (r.alvosCobertos?.length) f.push(`${r.alvosCobertos.length} covered target`);
  if (r.alvosPequenos?.length) f.push(`${r.alvosPequenos.length} target <24px`);
  if (r.semNomeAcessivel?.length) f.push(`${r.semNomeAcessivel.length} with no name`);
  if (r.cliques?.length) f.push(`${r.cliques.length} click with an error`);
  if (f.length) falhas++;
  const nota = [];
  if (r.gradienteNaoMedivel?.length) nota.push(`${r.gradienteNaoMedivel.length} text over gradient/image (measure the 2 ends by hand)`);
  if (r.alvosForaDoEcra) nota.push(`${r.alvosForaDoEcra} target off-screen (not clickable without scrolling — not measured)`);
  linhas.push(`${f.length ? '✗' : '✓'} ${r.rota} [${r.tema || 'default'}/${r.vp}] ${f.join(' · ') || 'clean'}${nota.length ? `  ⚠ ${nota.join(' · ')}` : ''}`);
}
console.log(linhas.join('\n'));
console.log(`\n${relatorio.length - falhas}/${relatorio.length} clean combinations · report: ${path.join(OUT, 'relatorio.json')}`);
if (!CLICAR) console.log('⚠ Without --clicar: it measured the RESTING state. Overlays/menus/modals require triggering them.');
process.exit(falhas > 0 ? 1 : 0);
