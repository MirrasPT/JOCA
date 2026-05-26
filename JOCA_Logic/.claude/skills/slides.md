---
name: slides
description: "Use when creating HTML/CSS presentations, pitch decks, or slide-based content at 1920x1080."
triggers: slides, apresentação, presentation, pitch deck, deck, powerpoint, pptx, pitch, slide, keynote, html slides, html deck, apresentação html, criar slides, fazer apresentação, pitch institucional, deck de vendas
---
# Slides

Designer de apresentações. HTML é o canvas — decks que correm em qualquer browser, exportam para PDF e PPTX, e não se parecem com templates genéricos.

**Não é esta skill:**
- Web components, UI, app mockups → `frontend`
- Animação exportada como MP4/GIF → `video`
- Materiais impressos (flyers, roll-ups) → `graphic-design`

---

## #0 Fact Verification

Se a tarefa envolve produto, marca, ou tecnologia específica: **WebSearch primeiro, nunca assumir.**
Igual ao `frontend` skill rule #0.

---

## #1 DESIGN.md Integration

Se existir `DESIGN.md` no projecto → **ler antes de qualquer código**.

```
Read("DESIGN.md")
```

Extrair: `--color-*`, tipografia, logo paths. Aplicar directamente no deck CSS.

Se não existir e há marca definida → sugerir `brand-guidelines` skill, ou pedir assets.

---

## #2 Architecture Decision (primeiro, sempre)

**Decidir antes de escrever uma linha.** Escolha errada = reescrever tudo.

| Cenário | Arquitectura | Asset chave |
|---------|-------------|-------------|
| ≤10 slides, pitch/portfolio, estado partilhado | **Single-file** (`deck_stage.js` web component) | script do projecto — ver #9 |
| ≥10 slides, curso, build multi-agente paralelo | **Multi-file** (cada slide = HTML próprio, agregado) | `deck_index.html` template — ver #9 |

**Single-file regras hardcoded (CSS/JS scope issues se violadas):**
- `<script>` tag vai **depois** de `</deck-stage>` (nunca antes)
- `display: flex` em sections só na classe `.active`, nunca no base `section`

**Multi-file regras hardcoded:**
- Cada slide é self-contained (sem CSS partilhado, sem estado partilhado)
- Rename `deck_index.html` → `index.html`, editar MANIFEST para listar todos os slides
- iFrame isolation previne CSS bleeding entre slides

Anunciar escolha ao utilizador com uma frase de justificação. Aguardar confirmação antes de escrever.

---

## #3 Design Philosophy (antes de qualquer código)

Para cada deck, definir filosofia antes de escolher cores ou layout:

**Nome do movimento** (1-2 palavras): ex "Tensão Editorial", "Brutalismo Calculado", "Respiração Minimalista"

**3 parâmetros:**
1. **Espaço** — denso vs aerado? Comprimido vs respirado?
2. **Temperatura de cor** — quente/frio/neutro? Saturado/dessaturado?
3. **Tipografia** — display agressivo vs serif clássico vs sans limpo?

A filosofia guia todas as decisões. Escolha que vai contra a filosofia → rever.

### Estratégia de cor (OKLCH)

```css
:root {
  --color-primary: oklch(L C H);   /* nunca #000/#fff puros */
  --color-surface: oklch(L C H);
  --color-text: oklch(L C H);
  --color-accent: oklch(L C H);
}
```

Estratégia antes das cores:
- **Restrained** — neutrals + 1 accent ≤10% dos slides
- **Committed** — 1 cor saturada 30-60% com presença forte
- **Drenched** — a superfície É a cor (slides de impacto, transições)

---

## #4 Junior Designer Mode

Mostrar o raciocínio antes de executar. Sempre.

1. Definir: quantos slides, narrativa, direcção estética → mostrar ao utilizador
2. Construir 2 slides showcase → Playwright screenshot → "Grammar visual correcta?"
3. Aguardar confirmação antes de construir o deck completo
4. Check-in a ~50% do deck

**Checkpoint script:** "Fiz X slides. A seguir: Y. Confirmas?" — e aguardar realmente.

Direcção errada em 2 slides = 10 min fix. Direcção errada em 20 slides = começar do zero.

---

## #5 Workflow

### Step 1 — Clarify (1 ronda, tudo de uma vez)

```
Antes de começar — confirmar (máx. 5 perguntas):
□ Quantos slides? (determina arquitectura)
□ Output final: HTML / PDF / PPTX editável?
□ Tens brand guidelines, DESIGN.md, ou deck de referência?
□ Audiência e contexto: pitch investidor / conferência / interno / curso?
□ Tom: informativo / persuasivo / visual-heavy / data-heavy?
```

### Step 2 — Architecture + Direction

Declarar: escolha de arquitectura + direcção estética (1 frase cada). Aguardar confirmação.

Se direcção pouco clara → oferecer 3 opções estéticas de escolas diferentes (nunca 2 da mesma). Gerar 2 slides demo por opção → Playwright screenshot → utilizador escolhe.

### Step 3 — Showcase First (≥5 slides)

2 slides showcase → screenshot → "Grammar visual correcta?" → só avançar após confirmação.

### Step 4 — Full Build

Construir slides restantes. Check-in a ~50%.

### Step 5 — Export

PDF, PPTX só se pedido explicitamente. HTML sempre incluído.

---

## #6 Variants, Not Answers

Nunca dar uma única direcção "correcta". Para briefs abertos, oferecer 3 variações em escolas diferentes:

| Escola | Carácter |
|--------|---------|
| Arquitectura de Informação (Pentagram) | Racional, data-driven, contido |
| Motion Poetry (Field.io) | Dinâmico, imersivo |
| Minimalismo (Kenya Hara) | Espaço negativo, refinado |
| Vanguarda Experimental | Avant-garde, impacto visual |

---

## #7 Design Rules

### Fixed-size rendering (obrigatório)

Slides são 1920×1080 fixos. Implementar JS auto-scale + letterboxing.

```js
// deck_stage.js gere automaticamente em single-file
// Multi-file: implementar scale wrapper por slide
function scaleSlide() {
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  document.querySelector('.slide').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', scaleSlide);
scaleSlide();
```

### Ritmo de layouts

Nunca repetir a mesma estrutura em slides consecutivos:

| Layout | Quando usar |
|--------|------------|
| **Hero text** | 1 afirmação bold, nada mais — transição, abertura, fecho |
| **Data** | gráfico/número é o hero; caption é secundário |
| **Image-dominant** | visual full-bleed, texto mínimo overlay |
| **Split** | visual esquerda + texto direita (ou invertido) |
| **Quote** | 1 citação atribuída, espaço negativo generoso |
| **List** | só quando enumeração serve genuinamente o conteúdo |
| **Transition** | entre secções — cor/tipografia diferentes, sem conteúdo denso |

### Posicionamento por slide

Antes de escrever cada slide, responder a 4 perguntas:

| Pergunta | Opções |
|----------|--------|
| **Papel narrativo** | Hero / Transição / Dados / Citação / Fecho |
| **Distância do viewer** | 10cm telefone / 1m laptop / 10m projecção |
| **Temperatura visual** | Quiet / Exciting / Calm / Authoritative / Warm / Tense |
| **Estimativa de conteúdo** | 3 thumbnails de 5s — cabe? |

### Tipografia para slides

- Display: fonte com carácter (Playfair Display, Cormorant, Clash Display, Space Grotesk — nunca Inter/Roboto como display)
- Contraste mínimo: bold/regular (não medium/regular — diferença insuficiente a distância)
- Hierarquia via scale + weight (ratio ≥1.5 entre levels em apresentações)
- Projecção (≥10m): headline mínimo 60px, body mínimo 28px

### Espaço e composição

- Grids assimétricos > colunas centradas
- Full-bleed images > imagem numa caixa
- Espaço negativo generoso > cramming
- 1 elemento dominante por slide — nunca vários a competir

---

## #8 Anti-Slop para Slides

**Reflex check (dois níveis):**
- Alguém consegue adivinhar o tema + paleta só pela categoria do slide? ("tech startup → dark blue + purple gradient") → rever
- Com categoria + anti-referências, ainda reconhecem a família estética genérica? → rever novamente

| Evitar | Porquê |
|--------|--------|
| Inter/Roboto como display | Google Docs — zero carácter visual |
| Mesmo layout em slides consecutivos | Monotonia = baixo esforço |
| Bullet list após bullet list | Death by PowerPoint |
| Gradientes roxos | Cliché AI-generated |
| Emoji em contexto business | Sinal amateur |
| Título centrado + body centrado em cada slide | Template padrão PowerPoint |
| Ícones decorativos em cada bullet | Icon slop — ruído visual, zero significado |
| Stats decorativos com gradient fills | Data slop — só dados reais e relevantes |
| Cards idênticas repetidas | Grid slop |

---

## #9 /export-pdf Command

Exportar deck para PDF via Playwright.

### Script de exportação

```js
// export-slides.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(`file://${process.cwd()}/deck.html`);

// Navegar por todos os slides e exportar
const slideCount = await page.evaluate(() => 
  document.querySelectorAll('section').length
);

await page.pdf({
  path: "deck.pdf",
  width: "1920px",
  height: "1080px",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log(`PDF exportado: deck.pdf (${slideCount} slides)`);
```

```bash
node export-slides.mjs
```

**Notas de exportação:**
- Texto é vector/searchable (não rasterizado)
- Animações GSAP: pausar no estado final antes de exportar (`gsap.globalTimeline.pause()`)
- Verificar no browser antes de exportar: todos os slides renderizam

---

## ⚠️ PPTX Warning

PPTX editável requer 4 constraints HTML estritas desde a primeira linha. Retrofit = 2-3h.

Se utilizador quer PPTX editável → confirmar no Step 1 → avisar o utilizador das 4 constraints antes de escrever qualquer código:

PDF only: sem constraints especiais, qualquer HTML válido funciona.

---

## #10 Speaker Notes

`deck_stage.js` suporta speaker notes — adicionar `<aside>` dentro de cada `<section>`. Premir `S` no browser para abrir speaker view.

---

## #11 Expert Critique

A pedido ("review", "score", "está bom?") — ou proactivamente quando output parece incerto:

0-10 em 5 dimensões:
1. **Coerência filosófica** — o deck parece intencional?
2. **Hierarquia visual** — percebe-se a prioridade em 3 segundos?
3. **Ritmo narrativo** — fluxo de layouts varia? Tem progressão?
4. **Execução de detalhe** — spacing, alinhamento, tipografia
5. **Originalidade** — evita os clichês listados acima?

Output: total + **Keep** (o que funciona) + **Fix** (⚠️ crítico / ⚡ importante / 💡 optimização) + **Quick Wins** (top 3 em menos de 5 min).

---

---

## Checklist antes de entregar

- [ ] Abre no browser, todos os slides renderizam
- [ ] Keyboard navigation funciona (setas, espaço, S para speaker view)
- [ ] Sem erros JS na consola
- [ ] Fixed-size content escala correctamente em diferentes tamanhos de janela
- [ ] Contraste texto/fundo ≥4.5:1
- [ ] Ritmo de layouts — nunca o mesmo em slides consecutivos
- [ ] Tipografia: display com carácter (não Inter/Roboto)
- [ ] PDF: texto é vector/searchable (não rasterizado)
- [ ] PPTX (se pedido): texto editável (double-click no PowerPoint = texto editável)

---

## Skills relacionadas

- `frontend` — protótipos web, UI, app mockups
- `video` — pipeline MP4/GIF para animações HTML exportadas
- `brand-guidelines` — gerar DESIGN.md antes desta skill
- `anima` — animações GSAP + Lottie
- `graphic-design` — materiais impressos (roll-ups, flyers, trifolds)
- `video` — exportar animação de slides como MP4/GIF
