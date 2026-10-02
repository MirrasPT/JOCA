---
name: browser-automate
description: "Automate a local canvas/litegraph web app via Playwright headless — load a workflow template, serialize the graph via page.evaluate, POST to the job API, poll history. MUST be invoked when the user says: Playwright canvas, automate ComfyUI, drive litegraph, page.evaluate workflow, headless browser automation, POST to prompt API, poll history endpoint, automate local web app, QA de jogo Phaser, cliques no canvas não registam, trusted input, page.mouse.click."
metadata:
  version: 1.0.0
  origin: local
---

# Browser Automate

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

Playwright-based automation for canvas/litegraph web apps (ComfyUI, InvokeAI, or any litegraph host). Drives the JS app object — never clicks canvas coordinates. Submits via HTTP API; uses the browser only for serialization the app exposes.

## Core Principle

Canvas apps render to a single `<canvas>` with no per-node DOM. Two-layer strategy:
1. **Browser layer** — reach the global JS app object via `page.evaluate` to load templates and serialize graph state
2. **HTTP layer** — submit the serialized prompt, poll results, fetch outputs

Never click canvas coordinates. Never submit the saved UI JSON to the API — always submit the `output` object (flat, node-id-keyed API format).

---

## Setup — System Browser, No Download

> ⚠ **O `require('playwright')` nu dos exemplos abaixo pode NÃO resolver.** Em várias instalações não existe pacote `playwright` instalável por import — só `@playwright/cli`, com o módulo **aninhado** lá dentro. Ler **"Realidade instalada do Playwright"** mais abaixo (e correr a sonda de 1 linha) ANTES de escrever qualquer script; os exemplos seguintes assumem que já resolveste o `chromium` por esse caminho.

```js
const { chromium } = require('playwright');

// Use installed Chrome — no `npx playwright install` needed
const browser = await chromium.launch({ channel: 'chrome' });

// Fallback: explicit path when channel auto-detect fails
// const browser = await chromium.launch({
//   executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
// });

// CI: set env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 to skip bundled Chromium
// Edge: channel: 'msedge'
// Chrome Beta: channel: 'chrome-beta'
```

Note: Playwright 1.57 ships "Chrome for Testing" (memory-heavy). `channel: 'chrome'` drives the real system install and avoids that overhead.

---

## Wait for App Readiness

Canvas apps boot async. Always wait before touching the app object:

```js
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8188');  // adjust port/path

// Generic: wait for the app object and graph to exist
await page.waitForFunction(() => !!window.app?.graph, { timeout: 15000 });
```

ComfyUI-specific: `window.app` is the canonical handle. For other litegraph apps, substitute the actual global (e.g., `window.editor`, `window.LiteGraph.active`).

---

## Load Template

```js
import workflowJson from './my-template.json' assert { type: 'json' };

// Loads the full UI workflow (nodes, links, groups, widget values)
await page.evaluate((g) => window.app.loadGraphData(g), workflowJson);
```

To patch widget values before submitting (avoid mutating the source file):

```js
await page.evaluate(({ nodeId, widgetIndex, value }) => {
  const node = window.app.graph._nodes_by_id[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found`);
  node.widgets[widgetIndex].value = value;
}, { nodeId: '42', widgetIndex: 0, value: 'my prompt text' });
```

---

## Serialize Graph

`graphToPrompt()` returns two objects. Only `output` goes to the API:

```js
const { workflow, output } = await page.evaluate(() =>
  window.app.graphToPrompt()
);
// workflow  — full UI snapshot (for /save, not for /prompt)
// output    — flat, node-id-keyed API prompt; excludes muted/bypassed nodes
```

`output` is what the backend executor understands. Never POST `workflow` to `/prompt`.

---

## Submit Job

```js
import { randomUUID } from 'crypto';

const clientId = randomUUID();

const res = await fetch('http://127.0.0.1:8188/prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: output, client_id: clientId }),
});

if (!res.ok) throw new Error(`POST /prompt failed: ${res.status}`);
const { prompt_id } = await res.json();
```

Queue depth (lightweight): `GET /prompt`
Full queue: `GET /queue`

---

## Poll History

```js
async function waitForResult(promptId, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`http://127.0.0.1:8188/history/${promptId}`);
    if (!r.ok) throw new Error(`GET /history failed: ${r.status}`);
    const history = await r.json();
    if (history[promptId]?.outputs) return history[promptId];
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for prompt ${promptId}`);
}

const result = await waitForResult(prompt_id);
```

Alternative: WebSocket push (avoids polling):

```js
const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'executing' && msg.data.prompt_id === prompt_id && msg.data.node === null) {
    // null node = execution complete
  }
};
```

---

## Fetch Output Files

```js
// result.outputs is keyed by node id
for (const [nodeId, nodeOutput] of Object.entries(result.outputs)) {
  for (const img of nodeOutput.images ?? []) {
    const url = `http://127.0.0.1:8188/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
    const blob = await fetch(url).then(r => r.buffer());
    fs.writeFileSync(img.filename, blob);
  }
}
```

---

## Asserting Canvas State

No DOM nodes to query. Three valid assertion approaches:

```js
// 1. Read app state via evaluate
const nodeCount = await page.evaluate(() => window.app.graph._nodes.length);

// 2. Visual snapshot (canvas locator)
await expect(page.locator('canvas')).toHaveScreenshot('baseline.png');

// 3. Bounding rect works; pixel reads from getContext('2d') do NOT
//    (Playwright bug #29594 — canvas 2D context returns empty object)
const box = await page.locator('canvas').boundingBox();
```

---

## Windows: Detecting the Server Process

**Never query by the app's unique name** — the querying PowerShell process self-matches on `CommandLine` searches that include the app name as a string.

```powershell
# Wrong — self-matches when PowerShell evaluates the WQL string containing "comfyui"
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*comfyui*" }

# Correct — filter Name=python.exe + CommandLine contains main.py
Get-WmiObject Win32_Process |
  Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*main.py*' }
```

**Prefer HTTP health-check over process detection:**

```powershell
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8188/system_stats' -UseBasicParsing -TimeoutSec 2
  $running = $r.StatusCode -eq 200
} catch {
  $running = $false
}
```

**Port-owner lookup (fallback):**

```powershell
try {
  $conn = Get-NetTCPConnection -LocalPort 8188 -ErrorAction Stop
  Get-Process -Id $conn.OwningProcess
} catch {
  # No process on that port — throws non-zero, must catch
}
```

`netstat -b` needs admin privileges; silently omits exe names otherwise. `Get-NetTCPConnection` throws when no match — always wrap in try/catch.

---

## ComfyUI: Full End-to-End Example

```js
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8188';
const template = JSON.parse(fs.readFileSync('./workflow.json', 'utf8'));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(BASE);
await page.waitForFunction(() => !!window.app?.graph, { timeout: 15000 });

// Load + patch
await page.evaluate((g) => window.app.loadGraphData(g), template);
await page.evaluate(({ nodeId, wi, value }) => {
  window.app.graph._nodes_by_id[nodeId].widgets[wi].value = value;
}, { nodeId: '6', wi: 0, value: 'a red fox in the snow, photorealistic' });

// Serialize
const { output } = await page.evaluate(() => window.app.graphToPrompt());

// Submit
const clientId = randomUUID();
const { prompt_id } = await fetch(`${BASE}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: output, client_id: clientId }),
}).then(r => r.json());

// Poll
const result = await waitForResult(prompt_id);

// Save outputs
for (const nodeOutput of Object.values(result.outputs)) {
  for (const img of nodeOutput.images ?? []) {
    const buf = await fetch(`${BASE}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`).then(r => r.arrayBuffer());
    fs.writeFileSync(img.filename, Buffer.from(buf));
    console.log('saved', img.filename);
  }
}

await browser.close();
```

---

## Failure Handling

| Failure | Cause | Fix |
|---------|-------|-----|
| `waitForFunction` timeout | App still booting | Increase timeout; verify port with health-check first |
| `graphToPrompt` undefined | App not ComfyUI or version mismatch | Inspect `window` keys to find the actual app global |
| POST 400 to `/prompt` | Submitted `workflow` not `output` | Always use the `output` key from `graphToPrompt()` |
| History never populates | Wrong `prompt_id` or server error | Check `/queue` for queue state; check server logs |
| Canvas pixel reads empty | Playwright bug #29594 | Use `page.evaluate` app state or `toHaveScreenshot` instead |
| `Get-NetTCPConnection` throws | No process on port | Wrap in try/catch; use HTTP health-check instead |

---

## Adapting to Other Litegraph Apps

All litegraph apps share the same `LGraph` serialization model. To adapt:

1. **Find the global app handle** — open browser console, type `window.` and tab-complete, or search source for `new LGraph`
2. **Find the load method** — usually `loadGraphData`, `loadJSON`, or `fromJSON`
3. **Find the serialize method** — usually `serialize()`, `toJSON()`, or app-specific like `graphToPrompt()`
4. **Check the API** — inspect Network tab when the UI submits a job; replicate that request

The HTTP submit/poll pattern (job API + history/status endpoint) is standard across litegraph-based tools.

---

## Visual QA in a Browser

Ad-hoc verification of a real page/game (DOM or canvas). Canonical full pipeline (slicing, contact sheets, asset extraction) → `site-capture`.

### Canvas games need TRUSTED input

Phaser / PixiJS / Unity WebGL **ignore** synthetic `PointerEvent` dispatched via `canvas.dispatchEvent` — clicks never register, no error. Only CDP-generated events work:

```js
await page.mouse.click(x, y);   // trusted — works
// canvas.dispatchEvent(new PointerEvent('pointerdown', …))  // silently ignored
```

**Before any `page.mouse.click` on a canvas, measure and scale the coordinates.** With `devicePixelRatio ≠ 1` (0.333 seen repeatedly in practice) a click computed from 390×844 design coordinates lands outside the canvas:

```js
const box = await page.locator('canvas').boundingBox();
const sx = box.width / DESIGN_W, sy = box.height / DESIGN_H;
await page.mouse.click(box.x + designX * sx, box.y + designY * sy);
```

### Realidade instalada do Playwright (medido — perecível)

⚠ **Factos medidos, não doutrina.** A instalação global muda sem aviso — se algum destes falhar, **re-medir**, não assumir.

**Sonda barata, 1 comando, antes de escrever qualquer script** (evita as 4 tentativas falhadas que já custaram uma sessão):

```bash
ls "$(npm root -g)/@playwright/cli/node_modules/playwright/index.mjs"
```

| Facto (medido em instalações reais, 2026-08) | Consequência |
|---|---|
| Pode **não existir** pacote `playwright` instalável por `import` — só `@playwright/cli` (ex.: `0.1.13`). `require('playwright')` / `import { chromium } from 'playwright'` dá `ERR_MODULE_NOT_FOUND`, e o caminho óbvio `.../node_modules/playwright/` também **não** resolve. | Todo o snippet copiado da doc pública do Playwright falha à primeira linha. |
| O módulo está **aninhado**: `$(npm root -g)/@playwright/cli/node_modules/playwright/index.mjs` | É deste caminho que se importa (ver snippet abaixo e o bloco `createRequire` a seguir). |
| `chromium.launch()` sem canal pode falhar: `Executable doesn't exist … chromium_headless_shell-<N>` — a versão alpha do CLI pede um build que não está no cache `ms-playwright` (havia lá outros números, não o pedido). | Lançar **sempre** com `{ channel: 'chrome' }` (Chrome real instalado), nunca com o Chromium bundled. |
| Sem `@playwright/cli` global, a sonda acima devolve `No such file or directory` — mas o cache `ms-playwright` (macOS `~/Library/Caches/ms-playwright` · Windows `~/AppData/Local/ms-playwright`) pode existir na mesma, também sem o build pedido. | O caminho é via `npx`, ou instalar (`npm i -g @playwright/cli`, ver `memory/tools/clis.md`). Não reportar "o Playwright não funciona" — ver a linha seguinte. |

**Snippet mínimo que funciona** (caminho aninhado + Chrome do sistema):

```js
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const PW = `${execSync('npm root -g').toString().trim()}/@playwright/cli/node_modules/playwright`;
const { chromium } = require(PW);
const browser = await chromium.launch({ channel: 'chrome' });   // NUNCA sem channel — pede o build 1224 que não existe
```

**Consequência a dizer em voz alta: `npx playwright screenshot` FUNCIONA.** O que não funciona sem o caminho aninhado é qualquer script que precise da **API** — medir `getComputedStyle`, `document.fonts.check`, clicar, avaliar JS. Uma sessão chegou a dizer ao utilizador "o Playwright não está a funcionar", o que era **falso**: funciona pela via CLI, e a via API só precisava do path certo. Antes de declarar indisponibilidade, distinguir as duas vias.

**Alternativa validada para medições no browser:** o MCP `claude-in-chrome` com `javascript_tool` (Chrome real do utilizador, com sessão). Limites conhecidos:
- **Não lê nem captura `http://127.0.0.1:8188`** — devolve `Frame with ID 0 is showing error page`, aparentemente por falta de permissão de site para IPs locais. **Não insistir mais de 1 vez**; `open <url>` / `Start-Process <url>` por shell resolve num comando.
- **Servidores locais com bind IPv4-only exigem `127.0.0.1`, nunca `localhost`** — o Chrome resolve `::1` primeiro e bate em nada. O ComfyUI é um deles.

Para uma página atrás de SSO/Cloudflare Access (o `curl` bate no 302, o browser pede OTP por email — que não se pede ao utilizador), ver o padrão **"preview local com resposta real"** em `site-capture` §8.

### Run the script from the scratchpad, not the project tree

Repeated failure mode: a temp `.mjs` written inside the frontend folder (because `@playwright/test` only resolves from there), then left behind by agents. Put the script in the session scratchpad and resolve the package explicitly:

### Receita de arranque do Playwright — copiar tal e qual ⏳(verificado macOS 2026-08-20)

⏳ **Estado de máquina, não facto permanente.** Versões e builds mudam; a receita descobre-os em
runtime de propósito. Se falhar, re-verificar e re-datar esta secção — não cravar valores.

Três coisas partem sempre, por esta ordem (foram **4 tentativas** por sessão até isto estar escrito):

| # | Sintoma | Causa | Fix |
|---|---|---|---|
| 1 | `Cannot find package 'playwright'` | não está no `node_modules` do projecto nem no global **por nome** — vive dentro do `@playwright/cli` | resolver por `npm root -g` + `/@playwright/cli/node_modules/playwright` |
| 2 | `require is not defined` / `does not provide an export named 'chromium'` | o pacote é **CommonJS** (`package.json` sem `type`) e o script é `.mjs` | `createRequire(import.meta.url)` — ESM ignora `NODE_PATH` |
| 3 | `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1224/...` | o build que o pacote pede **não está no cache**; o que lá está é outro (1148/1223/1234) | `executablePath` explícito, escolhido do cache em runtime |

```js
import { createRequire } from 'node:module';   // ESM ignora NODE_PATH — createRequire é obrigatório
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);

// 1+2 — resolver o pacote (CommonJS) pelo caminho real da máquina, nunca cravado
const PW = process.env.PLAYWRIGHT_PKG
  || `${execSync('npm root -g').toString().trim()}/@playwright/cli/node_modules/playwright`;
const { chromium } = require(PW);

// 3 — escolher o build que EXISTE no cache (o pedido pelo pacote pode não estar lá)
//     headless → chromium_headless_shell-*  ·  headed/screenshots fiéis → chromium-*
const CACHE = `${process.env.HOME}/Library/Caches/ms-playwright`;          // macOS
//     ⚠ ordenação NUMÉRICA pelo número do build — `.sort()` é de TEXTO e, no dia em que
//       aparecer um build de 5 dígitos, escolheria em silêncio o mais antigo.
const build = fs.readdirSync(CACHE)
  .filter(d => /^chromium_headless_shell-\d+$/.test(d))
  .sort((a, b) => Number(a.split('-').pop()) - Number(b.split('-').pop()))
  .pop();
const exe = process.env.CHROME_BIN
  || `${CACHE}/${build}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;

const browser = await chromium.launch({ executablePath: exe });
```

Alternativas de `executablePath`, por ordem de preferência (confirmadas num Mac Apple Silicon):

| Alvo | Caminho |
|---|---|
| headless shell (rápido, default) | `~/Library/Caches/ms-playwright/chromium_headless_shell-<N>/chrome-headless-shell-mac-arm64/chrome-headless-shell` |
| Chrome for Testing (headed, render fiel) | `~/Library/Caches/ms-playwright/chromium-<N>/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` |
| Chrome do sistema (perfil real) | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |

⚠ `playwright-core` pode **não** estar instalado globalmente — só o `@playwright/cli` (que
o traz dentro). `require('playwright-core')` falha; usar a resolução acima.
(Outra fonte possível: `ls -d ~/.npm/_npx/*/node_modules/playwright | head -1` — o hash do cache npx
não é estável, nunca cravar.)

**Custo:** cada invocação do CLI custa ~20-40s. Encadear 3-4 comandos numa só chamada `Bash`
estoura o timeout de 120s — **1 comando por chamada**, ou um único `evaluate` que faça tudo dentro
do browser. E nunca deixar um passo ler um ficheiro intermédio sem verificar que não está vazio.

`page.evaluate(fn, arg)` takes **one** argument only — pass an object, not a positional list (`page.evaluate(fn, null, 2)` silently drops the extras).

### Provar que o clique acerta no alvo — `elementFromPoint`

Auditar `href` **não é** testar o clique, e ler `getComputedStyle` num ponto calculado não prova que
o rato lá está. Dois bugs chegaram ao utilizador por isto (itens de menu tapados por um irmão do
Elementor; um hover medido 13px ao lado do ícone depois de o layout reordenar num reload).

Regra: qualquer link/botão/overlay verifica-se com `elementFromPoint` no **centro da caixa**, em
carga limpa e **depois** do último reload — antes de ler qualquer estilo.

```js
const mortos = await page.evaluate(() => {
  const fora = [];
  for (const el of document.querySelectorAll('a[href], button')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;                       // escondido: não é o mesmo defeito
    const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (topo !== el && !el.contains(topo)) fora.push({ txt: el.textContent.trim().slice(0, 40), tapado: topo?.className });
  }
  return fora;
});
```

⚠ `elementFromPoint` só vê o **viewport** — um elemento fora do ecrã devolve `null`. Rolar até ele
primeiro (ver a regra do scroll abaixo).

### Scroll para medir: `behavior:'instant'`, sempre

`scrollIntoView()` / `scrollBy()` num documento com `html{scroll-behavior:smooth}` é **animado** — os
`getBoundingClientRect` lidos no mesmo tick vêm do sítio antigo. Deu `y=2166` numa viewport de 900 e
a medição de contraste saiu feita sobre os pixels errados: sem erro, só números plausíveis.

```js
el.scrollIntoView({ behavior: 'instant', block: 'center' });
window.scrollTo({ top: y, behavior: 'instant' });
```

E **confirmar a posição** (`window.scrollY`) antes de ler rects — não assumir que o scroll aterrou.

### Browser MCP = Claude in Chrome

Com o Claude in Chrome como MCP de browser (`mcp__claude-in-chrome__*`), o MCP do Playwright é dispensável. Para a API do Playwright como biblioteca, usar o script directo da receita acima.

### Don't verify live while a tester agent runs

Live Playwright verification from the main loop against the **same dev server** as a background `tester-ui-ux` makes the agent observe your own actions (creating/deleting a test record) as things appearing and vanishing — it reported that as a backend race / data-loss incident that did not exist. Either serialize, or state in the agent's brief that another session may be mutating shared state.

---

## Related Skills

- **site-capture** — canonical screenshot/visual-QA pipeline for real sites (DOM), incl. the launch fallback chain and site recipes (e.g. Reddit via Playwright + `shreddit-*`, §3 Gotchas)
- **comfyui** — ComfyUI-specific skill (node types, ControlNet, workflows, model management)
- **video** — programmatic video via HyperFrames (different paradigm: code, not canvas)
- **webhooks** — if the app exposes webhook callbacks instead of polling
