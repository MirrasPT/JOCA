/* eslint-disable */
// In-page half of the xterm renderer bench. Loaded by bench.html, driven by
// xterm-render-bench.mjs through page.evaluate(). Plain script, no bundler.
//
// Everything here is deterministic: the same seed produces byte-identical output for the
// DOM run and for the WebGL run, so the two are fed exactly the same work.

(function () {
  const TerminalCtor = window.Terminal;
  const FitAddonCtor = (window.FitAddon && window.FitAddon.FitAddon) || window.FitAddon;
  const WebglAddonCtor = (window.WebglAddon && window.WebglAddon.WebglAddon) || window.WebglAddon;

  // --- deterministic PRNG -------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- corpus -------------------------------------------------------------
  // Output that looks like a coding CLI: file paths, diffs, log levels, spinners,
  // 256-color and truecolour SGR, bold/dim, the occasional box-drawing rule.
  const WORDS = ['src', 'components', 'TerminalPane.tsx', 'server.ts', 'session', 'pty',
    'websocket', 'buffer', 'resize', 'chunk', 'render', 'commit', 'branch', 'ok', 'warn',
    'failed', 'passed', 'skipped', 'module', 'import', 'export', 'const', 'return', 'await',
    'frontend', 'backend', 'vite', 'node_modules', 'lint', 'build', 'tsc', 'eslint'];

  function buildCorpus(targetBytes, seed) {
    const rnd = mulberry32(seed);
    const pick = (arr) => arr[(rnd() * arr.length) | 0];
    const out = [];
    let bytes = 0;
    while (bytes < targetBytes) {
      const kind = rnd();
      let line;
      if (kind < 0.12) {
        // box-drawing rule (wide-ish glyphs, exercises the glyph atlas)
        line = '\x1b[38;5;240m' + '─'.repeat(60 + ((rnd() * 30) | 0)) + '\x1b[0m';
      } else if (kind < 0.3) {
        // log line with level color + dim timestamp
        const lvl = pick([['\x1b[32m', 'INFO '], ['\x1b[33m', 'WARN '], ['\x1b[31m', 'ERROR'], ['\x1b[36m', 'DEBUG']]);
        let msg = '';
        for (let i = 0; i < 6 + ((rnd() * 8) | 0); i++) msg += pick(WORDS) + ' ';
        line = '\x1b[2m' + (1700000000000 + ((rnd() * 1e7) | 0)) + '\x1b[0m ' + lvl[0] + lvl[1] + '\x1b[0m ' + msg;
      } else if (kind < 0.45) {
        // diff-ish line, truecolour
        const add = rnd() < 0.5;
        const fg = add ? '\x1b[38;2;74;222;128m+' : '\x1b[38;2;240;106;106m-';
        let body = '';
        for (let i = 0; i < 4 + ((rnd() * 10) | 0); i++) body += pick(WORDS) + ' ';
        line = fg + ' ' + body + '\x1b[0m';
      } else if (kind < 0.6) {
        // 256-color segments, several SGR switches per line (worst case for cell attrs)
        let s = '';
        for (let i = 0; i < 5 + ((rnd() * 6) | 0); i++) {
          s += '\x1b[38;5;' + ((rnd() * 255) | 0) + 'm' + pick(WORDS) + ' ';
        }
        line = s + '\x1b[0m';
      } else if (kind < 0.7) {
        line = '\x1b[1m' + pick(WORDS) + '/' + pick(WORDS) + '\x1b[0m \x1b[2m' + ((rnd() * 1000) | 0) + ' ms\x1b[0m';
      } else {
        let s = '';
        for (let i = 0; i < 8 + ((rnd() * 12) | 0); i++) s += pick(WORDS) + ' ';
        line = s;
      }
      out.push(line);
      bytes += line.length + 2;
    }
    return out.join('\r\n') + '\r\n';
  }

  function chunkify(text, size) {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
    return chunks;
  }

  // --- frame sampler ------------------------------------------------------
  function frameSampler() {
    let running = true;
    const deltas = [];
    let last = performance.now();
    function tick(now) {
      if (!running) return;
      deltas.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      stop() { running = false; return deltas; },
    };
  }

  function stats(arr) {
    if (!arr.length) return { n: 0 };
    const s = arr.slice().sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return {
      n: s.length,
      p50: +q(0.5).toFixed(2),
      p95: +q(0.95).toFixed(2),
      max: +s[s.length - 1].toFixed(2),
      over33: s.filter((d) => d > 33).length,   // dropped >1 frame @60Hz
      over100: s.filter((d) => d > 100).length, // visible stutter
    };
  }

  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

  function glRenderer() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'none';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    } catch (e) { return 'error: ' + e.message; }
  }

  // --- one run ------------------------------------------------------------
  // renderer: 'dom' | 'webgl'
  async function runOnce({ renderer, targetBytes, seed, chunkSize, scrollSteps, streamFrames }) {
    const host = document.getElementById('term');
    host.innerHTML = '';

    // Same options as JOCA_OS TerminalPane, so the measurement is about this app.
    const term = new TerminalCtor({
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 8000,
      allowTransparency: false,
      minimumContrastRatio: 4.5,
      theme: { background: '#0c0c0c', foreground: '#e0e0e0', cursor: '#ff4500' },
    });
    const fit = new FitAddonCtor();
    term.loadAddon(fit);
    term.open(host);
    fit.fit(); // without this the terminal stays at 80x24 and the render cost is a fiction

    let webglActive = false;
    let webglError = null;
    if (renderer === 'webgl') {
      try {
        const addon = new WebglAddonCtor();
        term.loadAddon(addon);
        webglActive = true;
      } catch (e) {
        webglError = String(e && e.message || e);
      }
    }

    await raf(); await raf();

    // Proof the renderer really switched: xterm's DOM renderer paints <span>s and creates no
    // canvas; the WebGL addon creates them. Without this check a silently-failed activate()
    // would just look like "WebGL is no faster".
    const canvases = host.querySelectorAll('canvas').length;

    const text = buildCorpus(targetBytes, seed);
    const chunks = chunkify(text, chunkSize);

    // Phase 1 — bulk output, the way a fast PTY actually arrives: chunks are pushed as they
    // come and xterm buffers them internally. (Awaiting each chunk's callback would instead
    // measure xterm's ~4ms write-callback scheduling and hide the renderer entirely.)
    const sampler = frameSampler();
    const t0 = performance.now();
    for (let i = 0; i < chunks.length - 1; i++) term.write(chunks[i]);
    await new Promise((res) => term.write(chunks[chunks.length - 1], res));
    const writeMs = performance.now() - t0;
    await raf(); await raf();
    const renderedMs = performance.now() - t0;
    const writeFrames = stats(sampler.stop());

    // Phase 1b — the SAME bulk write again, now that the WebGL shaders are compiled and the
    // glyph atlas is populated. Phase 1 measures first-paint cost; this measures steady state,
    // which is what a session that has been open for hours actually lives in.
    const sampler1b = frameSampler();
    const t1b = performance.now();
    for (let i = 0; i < chunks.length - 1; i++) term.write(chunks[i]);
    await new Promise((res) => term.write(chunks[chunks.length - 1], res));
    await raf(); await raf();
    const warmMs = performance.now() - t1b;
    const warmFrames = stats(sampler1b.stop());

    // Phase 2 — scrollback navigation with a full buffer. This is the "app got slow
    // after hours" symptom: every step repaints the whole viewport.
    const sampler2 = frameSampler();
    const t2 = performance.now();
    for (let i = 0; i < scrollSteps; i++) {
      term.scrollLines(i % 2 === 0 ? -12 : 11);
      await raf();
    }
    const scrollMs = performance.now() - t2;
    const scrollFrames = stats(sampler2.stop());

    // Phase 3 — streaming, the shape of an agent CLI actually printing: a little output every
    // frame, so the viewport is repainted `streamFrames` times instead of once. This is where a
    // renderer that cannot finish inside a frame shows up as jank.
    term.scrollToBottom();
    await raf();
    const sampler3 = frameSampler();
    const t3 = performance.now();
    for (let i = 0; i < streamFrames; i++) {
      term.write('\x1b[38;5;' + (30 + (i % 200)) + 'm' + WORDS[i % WORDS.length] + ' \x1b[0m'
        + '\x1b[2m' + i + '\x1b[0m ' + WORDS[(i * 7) % WORDS.length] + '\r\n');
      await raf();
    }
    const echoMs = performance.now() - t3;
    const echoFrames = stats(sampler3.stop());

    const result = {
      renderer,
      webglActive,
      webglError,
      canvases,
      cols: term.cols,
      rows: term.rows,
      bytes: text.length,
      chunks: chunks.length,
      writeMs: +writeMs.toFixed(1),
      renderedMs: +renderedMs.toFixed(1),
      warmMs: +warmMs.toFixed(1),
      warmFrames,
      mbPerSec: +((text.length / 1048576) / (writeMs / 1000)).toFixed(2),
      writeFrames,
      scrollMs: +scrollMs.toFixed(1),
      scrollFrames,
      echoMs: +echoMs.toFixed(1),
      echoFrames,
    };

    term.dispose();
    host.innerHTML = '';
    return result;
  }

  // --- multi-pane scenario ------------------------------------------------
  // JOCA_OS keeps EVERY session's pane mounted and hides the inactive ones with display:none
  // (see TerminalPane.tsx). So the real machine is not one terminal: it is N terminals all
  // receiving output, of which one is visible. This is the shape of "it gets slow after a while".
  async function runMulti({ renderer, nTerms, bytesPerTerm, seed, chunkSize }) {
    const root = document.getElementById('term');
    root.innerHTML = '';

    const opts = {
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13, lineHeight: 1.4, letterSpacing: 0, cursorBlink: true, cursorStyle: 'bar',
      cursorWidth: 2, scrollback: 8000, allowTransparency: false, minimumContrastRatio: 4.5,
      theme: { background: '#0c0c0c', foreground: '#e0e0e0', cursor: '#ff4500' },
    };

    const terms = [];
    const addonErrors = [];
    const contextLosses = [];
    let cols = 80, rows = 24;
    for (let i = 0; i < nTerms; i++) {
      const host = document.createElement('div');
      host.style.cssText = 'width:100%;height:100%;' + (i === 0 ? '' : 'display:none;');
      root.appendChild(host);
      const term = new TerminalCtor(opts);
      const fit = new FitAddonCtor();
      term.loadAddon(fit);
      term.open(host);
      if (i === 0) { fit.fit(); cols = term.cols; rows = term.rows; }
      else { term.resize(cols, rows); } // hidden panes cannot fit; the app resizes them too
      if (renderer === 'webgl') {
        try {
          const a = new WebglAddonCtor();
          term.loadAddon(a);
          // Chrome caps live WebGL contexts per page (~16). This app keeps EVERY pane mounted,
          // so past that many terminals the browser kills the oldest contexts. xterm then fires
          // onContextLoss — but only after a 3000ms wait for a possible restore, during which
          // the pane shows a dead canvas. Disposing here is exactly what TerminalPane does.
          a.onContextLoss(() => { contextLosses.push('addon' + i); try { a.dispose(); } catch (e2) { /* gone */ } });
        } catch (e) { addonErrors.push('term' + i + ': ' + (e && e.message || e)); }
      }
      terms.push({ term, host });
    }

    await raf(); await raf();

    const text = buildCorpus(bytesPerTerm, seed);
    const chunks = chunkify(text, chunkSize);

    // Round-robin: every terminal gets every chunk, interleaved, like N busy sessions.
    const sampler = frameSampler();
    const t0 = performance.now();
    for (let c = 0; c < chunks.length; c++) {
      for (let i = 0; i < terms.length; i++) terms[i].term.write(chunks[c]);
      if (c % 8 === 7) await raf(); // let frames happen, as a real socket would
    }
    await new Promise((res) => terms[0].term.write('\r\n', res));
    await raf(); await raf();
    const totalMs = performance.now() - t0;
    const frames = stats(sampler.stop());

    // Switching panes is what the user does all day: hide the visible one, show a hidden one.
    // The WebGL renderer is the one at risk here — its canvas had zero size while hidden.
    const t1 = performance.now();
    terms[0].host.style.display = 'none';
    terms[1].host.style.display = '';
    terms[1].term.resize(cols, rows);
    await raf(); await raf(); await raf();
    const switchMs = performance.now() - t1;

    // Is the now-visible pane actually painting? DOM renderer → text in the row spans.
    // WebGL → a canvas whose backing store is non-zero. Both checked, plus a screenshot
    // taken by the driver, because "renders nothing" is the failure that matters most.
    const visible = terms[1];
    const rowText = (visible.host.querySelector('.xterm-rows') || { textContent: '' }).textContent.trim().length;
    const cvs = Array.from(visible.host.querySelectorAll('canvas'))
      .map((c) => c.width + 'x' + c.height).join(',');

    // xterm's WebglAddon holds a 3000ms grace period after `webglcontextlost` before it
    // fires onContextLoss, so anything shorter than that reads as 'no loss happened'.
    await new Promise((r) => setTimeout(r, 4000));

    const result = {
      renderer, nTerms, cols, rows, addonErrors, contextLosses,
      bytesTotal: text.length * nTerms,
      totalMs: +totalMs.toFixed(1),
      mbPerSec: +(((text.length * nTerms) / 1048576) / (totalMs / 1000)).toFixed(2),
      frames,
      switchMs: +switchMs.toFixed(1),
      afterSwitch: { rowTextChars: rowText, canvasSizes: cvs },
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };

    // Left alive on purpose: the driver screenshots the page right after this resolves.
    window.__benchKeepAlive = terms;
    return result;
  }

  // --- fallback scenario --------------------------------------------------
  // Proves the TerminalPane guard, with the same shape as the real code: try WebGL, drop the
  // addon on context loss, keep painting. The terminal is left on screen for the driver's
  // screenshot, because "it renders nothing" is a claim only a picture can settle.
  async function runFallback({ mode, seed }) {
    const host = document.getElementById('term');
    host.innerHTML = '';
    const term = new TerminalCtor({
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13, lineHeight: 1.4, cursorBlink: true, cursorStyle: 'bar', cursorWidth: 2,
      scrollback: 8000, allowTransparency: false, minimumContrastRatio: 4.5,
      theme: { background: '#0c0c0c', foreground: '#e0e0e0', cursor: '#ff4500' },
    });
    const fit = new FitAddonCtor();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    // --- the TerminalPane guard, verbatim in shape ---
    let webglAddon = null;
    let contextLossSeen = false;
    const dropWebgl = () => {
      if (!webglAddon) return;
      const a = webglAddon;
      webglAddon = null;
      try { a.dispose(); } catch (e) { /* already gone */ }
    };
    let activateThrew = null;
    let lossWaitMs = 0;
    try {
      const addon = new WebglAddonCtor();
      term.loadAddon(addon);
      webglAddon = addon;
      addon.onContextLoss(() => { contextLossSeen = true; dropWebgl(); });
    } catch (e) {
      activateThrew = String(e && e.message || e);
      webglAddon = null;
    }
    // --- end guard ---

    term.write(buildCorpus(60000, seed));
    await new Promise((res) => term.write('\r\n--- before ---\r\n', res));
    await raf(); await raf();
    const canvasesBefore = host.querySelectorAll('canvas').length;

    if (mode === 'lose-context' && webglAddon) {
      // Ask the browser to kill the context for real, the way a driver reset would.
      for (const c of host.querySelectorAll('canvas')) {
        const gl = c.getContext('webgl2');
        const ext = gl && gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
      // xterm's WebglAddon waits 3000ms for a `webglcontextrestored` before it gives up and
      // fires onContextLoss. Until that timer expires the terminal shows a dead canvas, so the
      // wait here is not padding: it is the length of the blank window the user would see.
      lossWaitMs = 4000;
      await new Promise((r) => setTimeout(r, lossWaitMs));
    }

    // Whatever happened above, the terminal has to keep showing output.
    term.write(buildCorpus(40000, seed + 1));
    await new Promise((res) => term.write('\r\n--- after the fallback ---\r\n', res));
    await raf(); await raf(); await raf();

    const rows = host.querySelector('.xterm-rows');
    return {
      mode,
      activateThrew,
      lossWaitMs,
      contextLossSeen,
      webglStillLoaded: !!webglAddon,
      canvasesBefore,
      canvasesAfter: host.querySelectorAll('canvas').length,
      // DOM renderer paints text into the row spans; if we fell back, this must be non-zero.
      rowTextChars: rows ? rows.textContent.trim().length : 0,
    };
  }

  window.__bench = { runOnce, runMulti, runFallback, glRenderer };
})();
