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
| 4 | `playwright-core` scripted | MCP bloqueado; controlo total do browser | — |

`playwright-core` global **não** vem com browser bundled → lançar sempre com Chrome do sistema:

```js
const { chromium } = require('playwright-core'); // ~/.npm-global/lib/node_modules/.../playwright-core
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
```

---

## 2. Snippet de captura (copy-paste)

```js
const { chromium } = require('playwright-core');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
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
    window.scrollTo(0, y);
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
| `Error: Browser is already in use ... --isolated` | Chrome órfão de sessão anterior segura o profile | Matar PID órfão + `crashpad-handler`, OU script directo `playwright-core` com `executablePath` |
| `claude-in-chrome`: "extension not connected" | Extensão desligada | Fallback: Chrome headless CLI (sem login) ou MCP `playwright` (com login) |

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

## Próximo passo (chain)

Após captura/QA visual → `design-review` (avaliar o resultado) → `tester-ui-ux` (se houver regressão a validar). Ambos reversíveis — encadear sem perguntar, notificar `[chain → design-review]`.

## Related Skills

- **browser-automate** — automação de apps canvas/litegraph (paradigma diferente: JS app object, não DOM); a secção "Visual QA in a Browser" lá cobre a mesma cadeia de fallback para casos ad-hoc — esta skill é a referência canónica para o pipeline completo (fatiar/thumbnail/extract-asset)
- **design-review** — avalia o output desta skill
- **graphic-design** — quando o output é para produção visual, não só QA
