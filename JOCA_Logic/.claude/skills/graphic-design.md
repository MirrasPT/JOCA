---
name: graphic-design
description: "Print and graphic design in HTML/CSS → PDF. MUST be invoked when the user says: roll-up, flyer, trifold, bifold, poster, brochure, folheto, cartaz. SHOULD also invoke when: cartão de visita, business card, roll up, material gráfico, material de marketing, desdobrável."
triggers: roll-up, flyer, trifold, bifold, poster, brochure, folheto, cartaz, cartão de visita, business card, roll up, material gráfico, material de marketing, desdobrável, banner, standee, print design, design gráfico, exportar PDF, imprimir
---

# Graphic Design

Crias materiais gráficos impressos em HTML/CSS, com qualidade de impressão profissional. O HTML é o canvas — o PDF é a entrega.

**Não és um web designer.** Quando fazes um roll-up, não pensas em scroll ou responsivo. Pensas em impacto visual a 3 metros de distância.

---

## Formatos suportados

| Formato | Dimensões | Uso típico |
|---------|-----------|------------|
| **Roll-Up** | 85×200cm | Eventos, feiras, recepções |
| **Roll-Up largo** | 150×200cm | Palcos, exposições |
| **Flyer A5** | 148×210mm | Promoções, eventos |
| **Flyer A4** | 210×297mm | Apresentações, fichas técnicas |
| **Poster A3** | 297×420mm | Anúncios, decoração |
| **Poster A2** | 420×594mm | Exterior, montras |
| **Bifold A4** | 420×297mm (aberto) | Brochuras 4 páginas |
| **Trifold A4** | 630×297mm (aberto) | Brochuras 6 páginas |
| **Cartão de visita** | 90×55mm | Contactos |
| **Banner horizontal** | 300×100cm | Palcos, estrados |

---

## Workflow

### Passo 1 · Clarify (1 ronda, tudo de uma vez)

```
Antes de começar:
□ Formato? (roll-up / flyer / trifold / poster / outro)
□ Tens brand guidelines / DESIGN.md do projecto?
□ Conteúdo: trazes o texto todo, ou queres sugestão de estrutura?
□ Destino de impressão: serviço online, gráfica local, impressão própria?
□ Referências visuais? (URLs, ficheiros, marcas que admiras)
```

### Passo 2 · Design Philosophy

Para cada peça, definir a filosofia visual antes de qualquer código:

**Nome do movimento** (1-2 palavras): ex "Editorial Tensão", "Brutalismo Elegante", "Respiração Zen"

**3 parâmetros visuais:**
1. **Espaço** — denso vs aerado? cheio vs vazio?
2. **Temperatura de cor** — quente/frio/neutro? saturado/dessaturado?
3. **Tipografia** — display agressivo vs serif clássico vs sans limpo?

A filosofia guia todas as decisões. Se uma escolha vai contra a filosofia → rever.

**Exemplos de movimentos:**

| Movimento | Expressao visual |
|-----------|-----------------|
| Concrete Poetry | Blocos de cor monumentais, tipografia escultural, divisoes espaciais brutalistas. Polish poster energy meets Le Corbusier. |
| Chromatic Language | Precisao geometrica, zonas de cor criam significado. Josef Albers meets data viz. |
| Analog Meditation | Grao de papel, sangrias de tinta, negativo vasto. Estetica photobook japones. |
| Organic Systems | Formas arredondadas, arranjos organicos, cor da natureza via arquitectura. |
| Geometric Silence | Precisao de grelha, fotografia bold, negativo dramatico. Swiss formalism meets brutalismo. |

**Modo arte/poster artistico:**
Para pecas artisticas (nao comerciais): tratar o output como arte de museu, nao material de marketing. Padroes repetidos, formas perfeitas, tipografia como elemento visual (nao informacao). Texto minimo — a composicao comunica. Cada alinhamento fruto de refinamento intencional.

### Passo 3 · Brand Assets (se marca envolvida)

Ler `DESIGN.md` se existir. Se não:
1. Pedir logo (SVG ou PNG de alta resolução ≥300dpi)
2. Confirmar cores de marca (hex → OKLCH)
3. Confirmar tipografia de marca

**Regra de resolução para print:**
- Imagens raster: mínimo 300dpi no tamanho final de impressão
- Ex: imagem 10×10cm a 300dpi = 1181×1181px mínimo

### Passo 4 · Build

Construir em HTML/CSS com dimensões reais em mm/cm usando `@page` e escala para preview.

### Passo 5 · Export PDF

```bash
# Via Playwright
npx playwright screenshot --viewport=<w>x<h> file:///path/to/design.html output.png

# Ou via node script para PDF com dimensões correctas
node export-print.mjs design.html output.pdf --format A4
```

---

## HTML/CSS para Print

### Template base

```html
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  /* Dimensões reais — escala para preview no browser */
  :root {
    --scale: 0.35;  /* Ajustar para caber no viewport */
    --width: 85cm;
    --height: 200cm;
  }
  
  body {
    background: #888;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px;
    min-height: 100vh;
  }
  
  .canvas {
    width: calc(var(--width) * var(--scale));
    height: calc(var(--height) * var(--scale));
    background: white;
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    
    /* Font scaling proporcional */
    font-size: calc(10px * var(--scale));
  }
  
  /* Para exportar: usar dimensões reais sem scale */
  @media print {
    body { padding: 0; background: none; }
    .canvas {
      width: var(--width);
      height: var(--height);
      font-size: 10px;
      box-shadow: none;
    }
  }
</style>
</head>
<body>
  <div class="canvas">
    <!-- Design aqui -->
  </div>
</body>
</html>
```

### Print-specific CSS rules

```css
/* Bleed area — 3mm extra em cada lado para corte */
.canvas {
  padding: calc(3mm * var(--scale));  /* Safe zone */
}

/* Zonas seguras */
.safe-zone {
  position: absolute;
  inset: calc(5mm * var(--scale));  /* 5mm de margem mínima */
}

/* Tipografia mínima para print */
.caption { font-size: calc(7px * var(--scale)); }    /* 7pt mínimo */
.body-text { font-size: calc(10px * var(--scale)); } /* 10pt confortável */
.headline { font-size: calc(36px * var(--scale)); }  /* Display */

/* Evitar aliasing em texto pequeno */
* { -webkit-font-smoothing: antialiased; }

/* Fontes via @font-face para garantir embed no PDF */
@font-face {
  font-family: 'BrandFont';
  src: url('assets/fonts/BrandFont.woff2') format('woff2');
}
```

---

## Templates por formato

### Roll-Up (85×200cm)

**Estrutura típica (de baixo para cima):**
```
┌──────────────────────┐ ← Topo (logo, tagline)
│    LOGO (topo)       │
│    TAGLINE           │
│                      │
│    HERO IMAGE        │ ← 40% da altura
│    (imagem impacto)  │
│                      │
│    TÍTULO PRINCIPAL  │ ← Grande, legível a 3m
│    subtítulo         │
│                      │
│    BULLETS / INFO    │ ← 3-4 pontos máximo
│    • Ponto 1         │
│    • Ponto 2         │
│    • Ponto 3         │
│                      │
│    CTA / CONTACTO    │ ← Website, QR code
│    QR CODE           │
└──────────────────────┘ ← Base (cor de fundo ou gradient)
```

**Regras de visibilidade para roll-up:**
- Texto principal ≥72pt (legível a 3 metros)
- Contraste mínimo 4.5:1 texto/fundo
- Máx 40 palavras no total
- 1 mensagem principal — não uma lista de funcionalidades
- Logo no topo E no rodapé (redundância intencional)

### Flyer A5/A4

```
┌────────────────────┐
│  HERO VISUAL       │ ← 50-60% do espaço
│  (foto/ilustração) │
├────────────────────┤
│  HEADLINE          │ ← Máx 6 palavras
│  Subtítulo         │ ← 1-2 linhas
│                    │
│  Corpo do texto    │ ← Conciso, listas curtas
│  • Ponto 1         │
│  • Ponto 2         │
│                    │
│  DATA / LOCAL      │ ← Info prática
│  LOGO + CONTACTO  │
└────────────────────┘
```

### Trifold A4

Dobras dividem em 3 painéis de 210×297mm cada (dobrado = 3 painéis visíveis):

```
FRENTE (aberto):
┌──────────┬──────────┬──────────┐
│ Painel 4 │ Painel 5 │ Painel 6 │
│ (back)   │ (inside) │ (inside) │
└──────────┴──────────┴──────────┘

TRÁS (dobrado):
┌──────────────────────────────────┐
│ Painel 1   │ Painel 2 │ Painel 3│
│ (capa)     │ (capa2)  │ (back)  │
└──────────────────────────────────┘
```

**Painel 1 = Capa** — headline + visual forte, sem informação densa
**Painel 6 = Back** — contactos, QR code, CTA final
**Painéis 2-5 = Interior** — conteúdo, serviços, benefícios

---

## Princípios de design gráfico

### Regras de composição

1. **Hierarquia visual** — o olhar segue: maior → mais contrastado → mais colorido. Garantir que o mais importante é o mais dominante.
2. **Espaço negativo** — breathing room não é espaço vazio, é design. Especialmente em formatos premium.
3. **Alinhamento** — só 2 alinhamentos por peça (ex: esquerda + centro). Misturar 3+ = caos visual.
4. **Repetição** — elementos repetidos (cor, forma, estilo) criam coesão. Mínimo 1 elemento repetido.
5. **Contraste** — sem contraste não há hierarquia. Usar escala, cor, peso, ou espaço.

### Anti-slop para print

| Evitar | Porquê |
|--------|--------|
| Clipart/stock genérico | Imagem de banco de imagens óbvia destrói credibilidade |
| Text over busy images sem legibilidade | Contraste insuficiente = ilegível impresso |
| Mais de 3 fontes por peça | Fragmentação visual |
| Gradientes de múltiplas cores | Impressão CMYK produz resultados imprevisíveis |
| Cores muito claras (< 15% opacidade) | Desaparecem na impressão |
| Imagens raster < 300dpi | Pixelado em print |
| Texto muito pequeno (< 7pt) | Ilegível impresso |

### Typography para print

- **Display/Headline**: serifas clássicas (Playfair Display, Cormorant, EB Garamond) ou sans-serif bold forte (Neue Haas, Aktiv Grotesk)
- **Body**: nunca menos de 10pt em impressão, linha máxima 65 caracteres
- **Contraste**: bold/regular (não medium/regular — diferença insuficiente para print)
- **EVITAR**: fontes Web light/ultralight (desaparecem em impressão pequena)

---

## Export para PDF

### Via Playwright (recomendado)

```js
// export-print.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${process.cwd()}/design.html`);

await page.pdf({
  path: "design.pdf",
  width: "85cm",      // dimensões reais
  height: "200cm",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log("PDF exportado: design.pdf");
```

### Via CSS @page

```css
@page {
  size: 85cm 200cm;   /* dimensões reais */
  margin: 0;
}

@media print {
  .canvas {
    width: 85cm;
    height: 200cm;
    transform: none;
    box-shadow: none;
  }
}
```

### Instruções de exportação para gráfica

Incluir no PDF output:
- Dimensões exactas em mm (ex: "85mm × 200mm finais + 3mm bleed = 91mm × 206mm")
- Perfil de cor: sRGB (para gráficas digitais) ou converter para CMYK manualmente
- Resolução: ≥300dpi para imagens raster
- Fontes embebidas (garantir que @font-face usa formato correcto)

---

## Integração com brand-guidelines

Se existir `DESIGN.md`:
```
1. Ler logo paths → usar nos assets
2. Ler --color-primary, --color-secondary → aplicar no design
3. Ler tipografia → usar as fontes de marca
4. Ler anti-references → confirmar que o design não se parece com estas
```

Se não existir `DESIGN.md` → correr brand-guidelines skill primeiro, ou pedir assets ao utilizador.

---

## Checklist antes de entregar

- [ ] Dimensões correctas em mm/cm
- [ ] Safe zone de 5mm respeitada
- [ ] Contraste texto/fundo ≥4.5:1
- [ ] Fontes ≥7pt em print (≥10pt para body)
- [ ] Imagens ≥300dpi (ou SVG)
- [ ] Logo em SVG ou PNG ≥600px
- [ ] PDF exportado + validado no browser
- [ ] Máx 3 fontes no total
- [ ] Hierarquia visual clara (1 elemento dominante)
