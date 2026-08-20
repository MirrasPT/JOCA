---
name: site-capture
description: "Pipeline repetível para screenshots headless limpos + QA visual, e para extrair um asset de imagem de uma screenshot/mockup quando o ficheiro original não existe. MUST invoke quando o user diz: captura de site, screenshot limpo, screenshot full-page, QA visual, headless screenshot, extrair imagem de print, extrair imagem de mockup, site-capture. SHOULD invoke quando: página em branco na screenshot, secção com opacity 0 na captura, viewport a cortar secções vh, contact sheet do site, slice de página longa, imagem só existe num print/mockup."
triggers: captura de site, screenshot limpo, screenshot full-page, QA visual, headless screenshot, extrair imagem de print, extrair imagem de mockup, site-capture, page.screenshot, playwright-core, intro curtain, reveal-on-scroll, contact sheet, slice de captura, fatiar screenshot, secção vh cortada, lazy-load não disparou
origin: local
chain: design-review, tester-ui-ux
---

# Site Capture

Pipeline validado: URL(s) (ou screenshot existente) → captura limpa e correctamente enquadrada (full-page ou por secção), opcionalmente fatiada em bandas + thumbnail rotulado, ou um asset extraído. Re-derivado ~8x antes desta skill existir — usar isto, não reinventar.

Distinto de `browser-automate` (que automatiza apps canvas/litegraph via JS app object). Aqui o alvo é sempre um **site real** — DOM, não canvas.

---

## 1. Cadeia de lançamento (fallback order)

| Ordem | Ferramenta | Quando | Falha típica → próximo |
|---|---|---|---|
| 1 | MCP `claude-in-chrome` (se registado nesta sessão) | Sessão Chrome logada, sem fricção | "extension not connected" / não registado → passo 2 |
| 2 | Chrome headless CLI | Sem login necessário — sem extensão | Insuficiente para páginas autenticadas → passo 3 |
| 3 | MCP `playwright` | Páginas autenticadas / QA interactivo | "Browser is already in use ... use --isolated" (Chrome órfão a segurar o profile) → passo 4 |
| 4 | Playwright scripted (via `@playwright/cli`) | MCP bloqueado; controlo total do browser | — |

⏳ **Receita de arranque verificada (macOS, 2026-08-20) — está em `browser-automate`, secção
"Receita de arranque do Playwright". Ler de lá, não reinventar: custou 4 tentativas por sessão
enquanto não estava escrita.** Resumo dos três tropeços:

1. `playwright` **não resolve por nome** (não está no projecto nem global) — vive em
   `$(npm root -g)/@playwright/cli/node_modules/playwright`. `playwright-core` **não** está
   instalado à parte nesta máquina.
2. É **CommonJS** → num `.mjs` precisa de `createRequire(import.meta.url)`.
3. O browser que o pacote pede pode **não estar no cache** (pede 1224, o cache tem 1148/1223/1234) →
   `executablePath` explícito, escolhido em runtime de `~/Library/Caches/ms-playwright/`.

```js
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/@playwright/cli/node_modules/playwright`);
const CACHE = `${process.env.HOME}/Library/Caches/ms-playwright`;
const build = fs.readdirSync(CACHE).filter(d => d.startsWith('chromium-')).sort().pop();   // headed = render fiel
const browser = await chromium.launch({
  executablePath: `${CACHE}/${build}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  // ou o Chrome do sistema: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
```

Para captura preferir o build **headed** (`chromium-*`, Chrome for Testing): o
`chromium_headless_shell-*` é mais rápido mas não é o mesmo render.

---

## 2. Snippet de captura (copy-paste)

```js
// chromium + executablePath: ver §1 (receita verificada). Aqui abreviado.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); // nunca janela alta — ver gotcha vh
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(6000); // intro curtain (GSAP/ThemeREX/Elementor ~6s até 'load')
// se a captura ainda sair em branco → site mais lento: waitForSelector no alvo de reveal, ou dobrar o timeout

// reveal-on-scroll: IntersectionObserver não dispara num shot estático
await page.addStyleTag({
  content: '.bd-reveal,[data-reveal]{opacity:1!important;transform:none!important;}',
});

// lazy-load: percorrer a página inteira antes de forçar eager
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo({ top: y, behavior: 'instant' });   // 'smooth' falseia rects lidos a seguir
    await new Promise((r) => setTimeout(r, 150));
  }
  document.querySelectorAll('img[data-src]').forEach((img) => {
    img.loading = 'eager';
    img.src = img.dataset.src;
  });
});
await page.waitForFunction(() =>
  [...document.querySelectorAll('img')].every((img) => img.naturalWidth > 0)
);

// popup/cookies — recusar não-essenciais (privacy) ou esconder por selector antes de capturar
// await page.click('.cookie-accept').catch(() => {});

await page.screenshot({ path: 'capture.png', fullPage: true });

// secção isolada em vez de full-page:
// const el = await page.$('#hero');
// await el.screenshot({ path: 'hero.png' });

await browser.close();
```

---

## 3. Gotchas (tabela — causa real, não teoria)

| Sintoma | Causa | Fix |
|---|---|---|
| Página em branco no full-page shot | Intro curtain: `body`/`body_wrap` fica a 0px até evento `load` (~6s) | `waitUntil:'networkidle'` + `waitForTimeout(6000)` antes de capturar |
| Secções com `opacity:0` na captura | `.bd-reveal`/`[data-reveal]` só revela via IntersectionObserver — não dispara sem scroll real | `addStyleTag` a forçar `opacity:1!important;transform:none!important` |
| Secção `min-height:80vh` gigante ou cortada | Janela de captura muito alta infla `vh` (viewport = altura da janela) | Viewport normal (1440×900) + `fullPage:true`, OU `element.screenshot({clip})`/boundingBox |
| Imagens em branco/cinza | Lazy-load (`data-src`) nunca disparou fora do viewport visível | Scroll completo + `img.loading='eager'` + `img.src=dataset.src` + `waitForFunction naturalWidth>0` |
| Faixas pretas / "NO IMAGE" na captura | `<video>` e placeholders quebrados renderizam preto em headless | Recortar a faixa; costurar topo+baixo com PIL (fundo neutro = costura invisível) |
| `Error: Browser is already in use ... --isolated` | Chrome órfão de sessão anterior (ou outra sessão) segura o lock do profile. Nem `browser_close` recupera — não há saída pela própria ferramenta | `pkill -f ms-playwright-mcp` (mata a árvore + `crashpad-handler`) e apagar o `SingletonLock` do profile; OU arrancar o MCP isolado (`PLAYWRIGHT_MCP_ISOLATED=1`, = a flag `--isolated` do erro: perfil em memória); OU, mais fiável, o script directo do §1 com `executablePath` |
| `Cannot find package 'playwright'` · `Executable doesn't exist at .../chromium_headless_shell-<N>` | pacote só dentro do `@playwright/cli` (CommonJS) e o build pedido não está no cache | receita completa do §1 — resolver por `npm root -g` + `createRequire` + `executablePath` do cache |
| Medições plausíveis mas sobre os pixels errados (contraste, rects, `y` fora da viewport) | `scroll-behavior:smooth` torna o scroll **animado** — os rects lidos no mesmo tick vêm do sítio antigo | `behavior:'instant'` em todo o scroll de medição + confirmar `window.scrollY` antes de ler rects |
| Link/botão com `href` certo mas que não responde ao clique | outro elemento pinta por cima (irmão do Elementor, overlay, `::after`) — o HTML não o mostra | `document.elementFromPoint(cx,cy)` no centro da caixa, em carga limpa e depois do último reload (receita em `browser-automate`) |
| `claude-in-chrome`: "extension not connected" | Extensão desligada | Fallback: Chrome headless CLI (sem login) ou MCP `playwright` (com login) |
| MCP diz "screenshot guardado" e não há ficheiro | `filename` relativo no `browser_take_screenshot` — sucesso falso | Caminho **absoluto** dentro da raiz permitida (`<repo>/.playwright-mcp/`); ler, mover para o scratchpad, apagar a pasta (o cwd do MCP é o `JOCA_Brain`, produção read-only) |
| `browser_resize` não pega (pediste 390, `innerWidth` fica 1170) · `devicePixelRatio` 0.333, `innerWidth` 3× o pedido | Estado do browser MCP, não da página — persiste entre tabs | Não confiar no screenshot: medir por `browser_evaluate` (`getBoundingClientRect`, `gridTemplateColumns`, `scrollWidth`). Workarounds validados: pedir resize a 1/3 do valor; medir mobile dentro de um `<iframe>` com a largura alvo. Fiável: script `playwright-core` com `viewport` explícito |
| `locator('#id').screenshot()` devolve outra secção da página | Bug de composição da captura (o DOM está certo — `getBoundingClientRect`/`getComputedStyle` confirmam) | Quando a imagem contradiz o DOM, acreditar no `evaluate()` |
| `page.screenshot({fullPage:true})` põe elementos `position:fixed` a meio da página | Comportamento conhecido do fullPage | Confirmar qualquer suspeita de sobreposição com uma captura de viewport normal ANTES de a tratar como defeito |
| Script pendura para sempre no `img.decode()` | `decode()` numa imagem `loading="lazy"` ainda não pedida nunca resolve | Pôr `loading='eager'` antes de percorrer a página + correr `decode()` contra um timeout |
| `file://` bloqueado (MCP playwright e Chrome headless `--print-to-pdf`) | Protocolo recusado | Servir sempre por HTTP local: `python3 -m http.server` com `run_in_background: true` (numa chamada Bash normal o servidor morre no fim da chamada) + versionar assets (`site.css?v=N`), senão o `http.server` manda `Last-Modified` e o browser serve CSS/JS em cache após cada edição |

### Chrome headless CLI: full-page pelo ficheiro-sombra

`--headless=new --screenshot` só captura o **viewport**. Forçar `--window-size=1440,7000` para "apanhar tudo" rebenta qualquer hero com `min-height:100svh` (passa a 7000px) — a captura sai sem erro e com o layout errado.

Padrão: copiar o HTML para `_shot.html` com um `<style>` extra a fixar o `min-height` dos heros e a forçar `.reveal{opacity:1}`, capturar esse ficheiro, apagar no fim.

`--window-size=390` também não dá viewport de 390px (renderiza a ~485px, `clientWidth ≠ window`) — os cortes à direita são artefacto, não overflow. Diagnóstico fiável de overflow, sem MCP nenhum:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth  // sem overflow
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth)
```

Nota: `python -m playwright` pode não estar instalado mesmo com o MCP playwright activo.

---

## 4. Fatiar + contact-sheet (PIL)

```python
#!/opt/homebrew/bin/python3
from PIL import Image

img = Image.open('capture.png')
w, h = img.size
band_h = 1200  # altura legível por banda
bands = [img.crop((0, y, w, min(y + band_h, h))) for y in range(0, h, band_h)]
for i, b in enumerate(bands):
    b.save(f'band_{i:02d}.png')

# contact-sheet normalizado — mistura portrait/landscape parte ffmpeg tile; usar PIL
THUMB_W = 400
thumbs = [b.resize((THUMB_W, int(b.height * THUMB_W / b.width))) for b in bands]
max_h = max(t.height for t in thumbs)
sheet = Image.new('RGB', (THUMB_W * len(thumbs), max_h), 'white')
for i, t in enumerate(thumbs):
    sheet.paste(t, (i * THUMB_W, 0))
sheet.save('contact-sheet.png')
```

Mac: interpretador é `python3`, nunca `python`. Pillow em `/opt/homebrew/bin/python3`.

---

## 5. Extrair asset de uma screenshot/mockup (ficheiro original em falta)

```python
#!/opt/homebrew/bin/python3
from PIL import Image

img = Image.open('screenshot.png')
region = img.crop((x0, y0, x1, y1))  # medir a região no ficheiro-fonte antes de recortar

print(f'região extraída: {region.width}x{region.height}px')
if region.width < 1920:
    print('⚠ abaixo de 4K — screenshot 2x/retina rende a região a ~metade da largura real.')
    print('  Pedir o ficheiro original ao cliente/marca. NUNCA fazer upscale silencioso.')

region.save('asset.webp', 'WEBP', quality=90)
```

Regra dura: se a resolução medida ficar abaixo do necessário, reportar o gap e pedir o ficheiro original — não fazer upscale e apresentar como se fosse a fonte real.

---

## 6. Prints multi-página (desktop + mobile)

Auditoria visual de N páginas × 2 viewports feita chamada-a-chamada no main loop (navigate→resize→screenshot ×14) é lenta e frágil. Padrão: **um script**, login uma vez, loop de rotas por viewport.

1. Extrair a lista de rotas do router (não escrever à mão).
2. Um `browser.newContext({viewport})` por viewport; autenticar uma vez, reutilizar o context.
3. Por rota: `goto` → esperar o reveal (ver §2) → `screenshot({fullPage:true})` para `<scratchpad>/shots/<viewport>/<rota>.png`.
4. Contact-sheet por viewport (§4) para a leitura lado-a-lado.

## 7. Provar antes de editar

Antes de tocar no ficheiro-fonte, provar o fix na página viva — poupa o ciclo editar→deploy→ver e produz números concretos (item a item) para mostrar ao cliente:

1. Reproduzir no viewport do defeito (ex.: 390×844).
2. Medir: `getBoundingClientRect()` (`left`/`right` vs largura do viewport) e `getComputedStyle` (contraste medido, não estimado).
3. `page.addStyleTag({ content: <css candidato> })`.
4. Re-medir. Só se os números mudarem no sentido certo é que se escreve no ficheiro.

## Próximo passo (chain)

Após captura/QA visual → `design-review` (avaliar o resultado) → `tester-ui-ux` (se houver regressão a validar). Ambos reversíveis — encadear sem perguntar, notificar `[chain → design-review]`.

## Related Skills

- **browser-automate** — automação de apps canvas/litegraph (paradigma diferente: JS app object, não DOM); a secção "Visual QA in a Browser" lá cobre a mesma cadeia de fallback para casos ad-hoc — esta skill é a referência canónica para o pipeline completo (fatiar/thumbnail/extract-asset)
- **design-review** — avalia o output desta skill
- **graphic-design** — quando o output é para produção visual, não só QA
