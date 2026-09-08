// Proves the WebGL fallback in TerminalPane actually keeps the terminal readable.
//
//   node bench/webgl-fallback-check.mjs
//
// Three runs, each a different way for WebGL to fail, each ending in a screenshot:
//   1. healthy       — WebGL available and kept
//   2. lose-context  — the GL context is destroyed for real (WEBGL_lose_context)
//   3. no-webgl      — browser launched with WebGL switched off, so activate() throws
//
// Pass criterion for 2 and 3: the terminal still paints text. A blank pane is the failure the
// whole guard exists to prevent, so it is checked with a picture, not with a return value.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
    return mod.chromium ? mod : mod.default;
  }
  throw new Error('playwright not found. Tried:\n  ' + candidates.join('\n  '));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? '/bench/bench.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// A terminal full of text compresses to well over 40 KB of PNG; a blank one to a few KB.
const BLANK_PNG_LIMIT = 40 * 1024;

async function main() {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    { name: 'healthy', mode: 'keep', args: [] },
    { name: 'lose-context', mode: 'lose-context', args: [] },
    { name: 'no-webgl', mode: 'keep', args: ['--disable-webgl', '--disable-webgl2'] },
  ];
  let failures = 0;
  for (const c of cases) {
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: c.args }).catch(
      () => chromium.launch({ headless: true, args: c.args }));
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + '/bench/bench.html', { waitUntil: 'load' });
    const r = await page.evaluate((o) => window.__bench.runFallback(o), { mode: c.mode, seed: 77 });
    const shot = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(__dirname, `fallback-${c.name}.png`), shot);
    const readable = shot.length > BLANK_PNG_LIMIT;
    const ok = readable && errors.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${c.name.padEnd(13)}` +
      ` activateThrew=${r.activateThrew ? JSON.stringify(r.activateThrew.slice(0, 40)) : 'no'}` +
      ` contextLoss=${r.contextLossSeen} webglStillLoaded=${r.webglStillLoaded}` +
      ` canvases ${r.canvasesBefore}->${r.canvasesAfter} domRowText=${r.rowTextChars}` +
      ` png=${(shot.length / 1024).toFixed(0)}KB${errors.length ? ' pageErrors=' + JSON.stringify(errors) : ''}`,
    );
    await browser.close();
  }
  server.close();
  console.log(failures ? `\n${failures} case(s) left the terminal blank or threw.` : '\nAll cases kept the terminal readable.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
