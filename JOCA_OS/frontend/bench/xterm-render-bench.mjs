// xterm renderer bench — DOM vs WebGL, same load, same machine, N repetitions.
//
//   node bench/xterm-render-bench.mjs [--reps 5] [--mb 3] [--headed]
//
// Serves the frontend folder on an ephemeral port (never 7491/7492/7591/7592), opens its
// own browser, and drives bench.html. Prints one row per repetition plus a median summary.
//
// WHY: the JOCA_OS terminal ran on xterm's DOM renderer. This measures whether the WebGL
// renderer is actually faster for THIS app's output, instead of assuming it is.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Playwright is not a dependency of this project. On this Mac it lives nested inside the
// globally installed @playwright/cli, where a bare `import 'playwright'` cannot find it.
async function loadPlaywright() {
  const require_ = createRequire(import.meta.url);
  const candidates = [];
  try { candidates.push(require_.resolve('playwright')); } catch { /* not local */ }
  const { execSync } = await import('node:child_process');
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    candidates.push(path.join(globalRoot, '@playwright/cli/node_modules/playwright/index.js'));
    candidates.push(path.join(globalRoot, 'playwright/index.js'));
  } catch { /* npm missing */ }
  for (const c of candidates) {
    if (!c || !fs.existsSync(c)) continue;
    const mod = await import(pathToFileURL(c).href);
    // playwright's entry is CommonJS: the namespace exposes it under `default`.
    return mod.chromium ? mod : mod.default;
  }
  throw new Error('playwright not found. Tried:\n  ' + candidates.join('\n  '));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? '/bench/bench.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found: ' + url); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? dflt : process.argv[i + 1];
}
const REPS = Number(arg('reps', 5));
const MB = Number(arg('mb', 3));
const MULTI = Number(arg('panes', 6));
const HEADED = process.argv.includes('--headed');

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function main() {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`bench server on ${base} (ephemeral port — not the dev instance)`);

  const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'];
  let browser;
  let launchedAs;
  if (HEADED) {
    browser = await chromium.launch({ headless: false, args });
    launchedAs = 'headed (bundled chromium)';
  } else {
    // The default headless build is the headless *shell*, which has no GPU at all and would
    // rig the comparison against WebGL. Try the full Chromium in new-headless mode first.
    try {
      browser = await chromium.launch({ headless: true, channel: 'chromium', args });
      launchedAs = 'headless (channel: chromium, new headless)';
    } catch {
      browser = await chromium.launch({ headless: true, args });
      launchedAs = 'headless (bundled chromium-headless-shell)';
    }
  }
  console.log(`browser: ${launchedAs}`);

  const results = { dom: [], webgl: [], multi: {} };
  let glRenderer = '?';

  try {
    for (let rep = 0; rep < REPS; rep++) {
      // Alternate order across reps so neither renderer systematically gets the cold machine.
      const order = rep % 2 === 0 ? ['dom', 'webgl'] : ['webgl', 'dom'];
      for (const renderer of order) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(base + '/bench/bench.html', { waitUntil: 'load' });
        if (glRenderer === '?') glRenderer = await page.evaluate(() => window.__bench.glRenderer());
        const r = await page.evaluate(
          (opts) => window.__bench.runOnce(opts),
          { renderer, targetBytes: Math.round(MB * 1048576), seed: 1234, chunkSize: 4096, scrollSteps: 120, streamFrames: 200 },
        );
        r.pageErrors = errors;
        results[renderer].push(r);
        console.log(
          `rep ${rep + 1} ${renderer.padEnd(5)} ${r.cols}x${r.rows}` +
          ` bulk1 ${String(r.renderedMs).padStart(7)}ms bulk2(warm) ${String(r.warmMs).padStart(7)}ms (${r.mbPerSec} MB/s)` +
          `  writeFrames p95 ${String(r.writeFrames.p95).padStart(6)} max ${String(r.writeFrames.max).padStart(7)}` +
          `  scrollFrames p50 ${String(r.scrollFrames.p50).padStart(5)} p95 ${String(r.scrollFrames.p95).padStart(6)} max ${String(r.scrollFrames.max).padStart(6)}` +
          `  streamFrames p50 ${String(r.echoFrames.p50).padStart(5)} p95 ${String(r.echoFrames.p95).padStart(6)}` +
          (r.webglError ? `  WEBGL-ERROR ${r.webglError}` : '') +
          (errors.length ? `  PAGE-ERRORS ${errors.length}` : ''),
        );
        await page.close();
      }
    }

    // --- multi-pane scenario + visual proof -------------------------------
    for (const renderer of ['dom', 'webgl']) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const errors = [];
      const console_ = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console_.push(m.text()); });
      await page.goto(base + '/bench/bench.html', { waitUntil: 'load' });
      const r = await page.evaluate(
        (opts) => window.__bench.runMulti(opts),
        { renderer, nTerms: MULTI, bytesPerTerm: Math.round(MB * 1048576 / 4), seed: 4321, chunkSize: 4096 },
      );
      // The screenshot is the honest check that the pane the user just switched to is not black.
      const shot = await page.screenshot({ type: 'png' });
      r.screenshotBytes = shot.length;
      fs.writeFileSync(path.join(__dirname, `after-switch-${renderer}.png`), shot);
      r.pageErrors = errors;
      r.console = [...new Set(console_)];
      results.multi[renderer] = r;
      console.log(
        `multi ${renderer.padEnd(5)} ${r.nTerms} panes ${r.cols}x${r.rows}` +
        `  total ${String(r.totalMs).padStart(8)}ms (${r.mbPerSec} MB/s)` +
        `  frames p50 ${String(r.frames.p50).padStart(5)} p95 ${String(r.frames.p95).padStart(6)} max ${String(r.frames.max).padStart(7)} >33ms:${r.frames.over33}` +
        `  switch ${String(r.switchMs).padStart(6)}ms` +
        `  heap ${r.heapMB}MB` +
        `  after-switch rowText=${r.afterSwitch.rowTextChars} canvas=${r.afterSwitch.canvasSizes || 'none'} png=${(r.screenshotBytes / 1024).toFixed(0)}KB` +
        (r.addonErrors.length ? `  ADDON-ERRORS ${JSON.stringify(r.addonErrors)}` : '') +
        (r.contextLosses.length ? `  CONTEXT-LOSS on panes ${JSON.stringify(r.contextLosses)}` : '') +
        (errors.length ? `  PAGE-ERRORS ${JSON.stringify(errors.slice(0, 2))}` : '') +
        (r.console.length ? `\n        console: ${JSON.stringify(r.console.slice(0, 3))}` : ''),
      );
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const summary = (key) => {
    const rows = results[key];
    return {
      writeMs: median(rows.map((r) => r.writeMs)),
      renderedMs: median(rows.map((r) => r.renderedMs)),
      warmMs: median(rows.map((r) => r.warmMs)),
      warmP95: median(rows.map((r) => r.warmFrames.p95)),
      warmMax: median(rows.map((r) => r.warmFrames.max)),
      mbPerSec: median(rows.map((r) => r.mbPerSec)),
      frameP95: median(rows.map((r) => r.writeFrames.p95)),
      frameMax: median(rows.map((r) => r.writeFrames.max)),
      scrollP50: median(rows.map((r) => r.scrollFrames.p50)),
      scrollP95: median(rows.map((r) => r.scrollFrames.p95)),
      scrollMax: median(rows.map((r) => r.scrollFrames.max)),
      streamP50: median(rows.map((r) => r.echoFrames.p50)),
      streamP95: median(rows.map((r) => r.echoFrames.p95)),
      streamMax: median(rows.map((r) => r.echoFrames.max)),
    };
  };

  const d = summary('dom');
  const w = summary('webgl');
  const pct = (a, b) => (a === 0 ? 'n/a' : `${(((a - b) / a) * 100).toFixed(0)}% faster`);

  console.log(`\nGL renderer reported by the page: ${glRenderer}`);
  console.log(`medians over ${REPS} reps · ${MB} MB corpus · 4 KB chunks · 1280x800 terminal\n`);
  console.log('metric                         DOM        WebGL      delta');
  const row = (label, a, b, unit = 'ms') =>
    console.log(`${label.padEnd(28)} ${String(a).padStart(9)}  ${String(b).padStart(9)}   ${pct(a, b)}`.replace('   n/a', '   n/a') + ` (${unit})`);
  row('bulk: parse+write', d.writeMs, w.writeMs);
  row('bulk: until rendered', d.renderedMs, w.renderedMs);
  row('bulk: throughput (higher=better)', d.mbPerSec, w.mbPerSec, 'MB/s');
  row('bulk: frame p95', d.frameP95, w.frameP95);
  row('bulk: frame max', d.frameMax, w.frameMax);
  row('bulk WARM: until rendered', d.warmMs, w.warmMs);
  row('bulk WARM: frame p95', d.warmP95, w.warmP95);
  row('bulk WARM: frame max', d.warmMax, w.warmMax);
  row('scroll: frame p50', d.scrollP50, w.scrollP50);
  row('scroll: frame p95', d.scrollP95, w.scrollP95);
  row('scroll: frame max', d.scrollMax, w.scrollMax);
  row('stream: frame p50', d.streamP50, w.streamP50);
  row('stream: frame p95', d.streamP95, w.streamP95);
  row('stream: frame max', d.streamMax, w.streamMax);

  const out = path.join(__dirname, 'last-run.json');
  fs.writeFileSync(out, JSON.stringify({ glRenderer, launchedAs, reps: REPS, mb: MB, results }, null, 2));
  console.log(`\nraw: ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
