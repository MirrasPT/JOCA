---
name: brand-guidelines
description: "Generate a comprehensive brand system document (DESIGN.md + BRAND.md) for any brand or project. MUST be invoked when the user says: brand guidelines, brand system, design system, DESIGN.md, marca, brand audit, brand identity, design guide. SHOULD also invoke when: brand document, tom de voz, paleta de cores, guia de marca, identidade visual, criar DESIGN.md."
triggers: brand guidelines, brand system, design system, DESIGN.md, marca, brand audit, brand identity, design guide, brand document, tom de voz, paleta de cores, guia de marca, identidade visual, criar DESIGN.md, criar BRAND.md, sistema de marca, documentação de marca, brand colors, brand typography, brand guide, diretrizes de marca, visual identity
chain: design-tokens
---

# Brand Guidelines

Gera documento de sistema de marca completo. Output: `DESIGN.md` + `BRAND.md` — alimenta as skills `frontend` e `slides`.

**Não és designer visual.** És consultor de identidade de marca que produz documentação estruturada para designers.

---

## #0 Fact Verification (prioridade máxima)

Se a marca é conhecida (Anthropic, Nike, Stripe, marca local, etc.):

1. `WebSearch "<marca> brand guidelines 2026"` → confirmar existência, versão actual, mudanças recentes
2. Verificar se `DESIGN.md` / `BRAND.md` existem no projecto → actualizar, não reescrever
3. Nunca assumir cores, fontes, ou tom de voz sem verificação — training data desactualizada

---

## Workflow (8 passos)

### Passo 1 · Discovery — 6 perguntas

Uma ronda, tudo de uma vez:

```
Antes de começar, confirma:

1. Nome da marca e tipo de negócio?
2. Ficheiro de marca existente? (guidelines PDF, Figma, assets ZIP, website)
3. Público-alvo? (idade, contexto, nível de sofisticação)
4. Tom de voz — que adjectivos descrevem a marca? (ex: "sério mas acessível", "irreverente e jovem")
5. 2-3 marcas que admiras esteticamente (não necessariamente no mesmo sector)?
6. 2-3 marcas que NÃO devem ser referência?
```

Se o utilizador já forneceu contexto suficiente, saltar para Passo 2.

---

### Passo 2 · Asset Collection (obrigatório)

> Sem assets reais não existe sistema de marca. CSS shapes ou cores inventadas não são marca.

#### 2.1 Logo

**Hierarquia de obtenção (por ordem):**
1. Utilizador fornece ficheiro
2. `<marca>.com/brand`, `/press`, `/press-kit`, `/media-kit`
3. Inline SVG no header da homepage (`curl -A "Mozilla/5.0" <url>` → extrair `<svg>`)
4. GitHub/npmjs (marcas tech têm SVG no repo)
5. → Se nada funcionar: pedir ao utilizador

```bash
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -L https://<marca>.com -o /tmp/homepage.html
grep -o '<svg[^>]*>.*</svg>' /tmp/homepage.html | head -5
```

**Verificar:** SVG abre sem erros · tem versão escura e clara · background transparente

#### 2.2 Produto / UI (se aplicável)

- **Produto físico**: imagem hero oficial (≥2000px), 2-3 ângulos
- **Produto digital**: screenshots do produto real (App Store, produto actual — não mockups)

#### 2.3 Cores (extracção do HTML/CSS real)

```bash
grep -hoE '#[0-9A-Fa-f]{6}' assets/homepage.html | sort | uniq -c | sort -rn | head -20
# Filtrar cinzentos (#000000, #ffffff, #f5f5f5) → identificar 3-5 cores de marca
```

#### 2.4 Tipografia

```bash
grep -hoE "font-family:[^;']+" assets/homepage.html | sort | uniq
# Ou: inspecção de <link rel="stylesheet"> para Google Fonts / Typekit
```

---

### Passo 3 · Color System (OKLCH)

Converter todas as cores para OKLCH. Definir 7 papéis semânticos:

| Papel | Descrição | Exemplo |
|-------|-----------|---------|
| `--color-primary` | Cor principal de marca | Botões, links, CTAs |
| `--color-secondary` | Complementar ou variante | Elementos secundários |
| `--color-surface` | Fundo da interface | Backgrounds |
| `--color-surface-alt` | Fundo alternativo | Cards, secções alternadas |
| `--color-text` | Texto principal | Body copy |
| `--color-text-muted` | Texto secundário | Labels, captions |
| `--color-accent` | Destaque ou alerta | Badges, highlights |

**Regras OKLCH:**
- Nunca `#000` ou `#fff` puros — tint para a cor da marca (chroma 0.005–0.01)
- Reduzir chroma à medida que lightness se aproxima de 0 ou 100
- Estratégia de cor antes de escolher:
  - **Restrained**: neutrals tinted + 1 accent ≤10% → default produto
  - **Committed**: 1 cor saturada 30–60% → identidade forte
  - **Drenched**: a superfície É a cor → heroes, campaigns

**Verificar contraste:** texto sobre fundo ≥4.5:1 (WCAG AA)

---

### Passo 4 · Typography System

Definir 3 níveis:

```
Display: <fonte-display> — títulos principais, hero text
Heading: <fonte-heading> — secções, cards, subtítulos
Body: <fonte-body> — texto longo, parágrafos
Mono: <fonte-mono> — código, dados, preços
```

**Escala tipográfica** (múltiplos de 4px):
```
xs: 12px / line-height 1.4
sm: 14px / line-height 1.5
base: 16px / line-height 1.6
lg: 18px / line-height 1.5
xl: 24px / line-height 1.3
2xl: 32px / line-height 1.2
3xl: 48px / line-height 1.1
4xl: 64px / line-height 1.05
```

**Regras:**
- Body minimum 16px (evita iOS auto-zoom)
- Line length: 65–75ch para texto longo
- Hierarquia via scale + weight contrast (ratio ≥1.25 entre steps)
- Nunca Inter/Roboto/Arial como display — sem carácter visual

---

### Passo 5 · Tone of Voice

3 secções:

#### 5.1 Personalidade (3-5 adjectivos)
Ex: "Directo, cuidadoso, sem jargão técnico, humano"

#### 5.2 Regras de escrita
- **Sim:** frases curtas, voz activa, verbos fortes
- **Não:** jargão corporativo, superlativos sem substância, maiúsculas decorativas
- **Tratamento:** formal/informal, tutear/vouvoar
- **Comprimentos:** headlines (5-8 palavras), subtítulos (15-25 palavras), CTAs (2-4 palavras)

#### 5.3 Exemplos contrastantes

| Errado | Correcto |
|--------|---------|
| "Solução empresarial de ponta" | "Software que a equipa usa" |
| "Potenciamos o crescimento sustentado" | "Cresce mais depressa, com menos esforço" |

---

### Passo 6 · Image & Visual Style

4 dimensões:

1. **Fotografia**: Estilo (editorial/produto/lifestyle), mood (quente/frio/neutro), composição (close-up/wide/overhead), paleta (saturada/dessaturada/monocromática)
2. **Ilustração**: Usar ou não? Se sim: estilo (flat/linha/3D/hand-drawn), complexidade, uso (decorativa/funcional/hero)
3. **Iconografia**: Set (Lucide/Heroicons/Phosphor/custom), estilo (stroke/fill/duotone), tamanhos (16/20/24/32)
4. **Patterns/Texturas**: Usar ou não? Contexto (background/overlay/accent)

---

### Passo 7 · Component Tokens

```css
/* Spacing (escala de 4px) */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-6: 24px;  --space-8: 32px;  --space-12: 48px; --space-16: 64px;

/* Border Radius */
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
--shadow-md: 0 4px 6px oklch(0 0 0 / 0.07);
--shadow-lg: 0 10px 15px oklch(0 0 0 / 0.10);

/* Motion */
--duration-fast: 150ms; --duration-base: 250ms; --duration-slow: 400ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);  /* ease-out-quart */
```

---

### Passo 8 · Output DESIGN.md

Gerar com este template:

```markdown
# DESIGN.md — <Nome da Marca>
> Gerado em: YYYY-MM-DD | Versão: 1.0

## Assets
- Logo principal: `assets/brand/logo.svg`
- Logo branco: `assets/brand/logo-white.svg`
- Logo escuro: `assets/brand/logo-dark.svg`
- Favicon: `assets/brand/favicon.svg`

## Color System
```css
:root {
  --color-primary: oklch(L C H);    /* <cor> — <contexto de uso> */
  --color-secondary: oklch(L C H);
  --color-surface: oklch(L C H);
  --color-surface-alt: oklch(L C H);
  --color-text: oklch(L C H);
  --color-text-muted: oklch(L C H);
  --color-accent: oklch(L C H);
}
```

## Typography
- Display: <fonte> (<fonte-fallback>) — títulos principais
- Heading: <fonte> (<fonte-fallback>) — secções
- Body: <fonte> (<fonte-fallback>) — texto corrido
- Mono: <fonte> — código e dados

## Tone of Voice
<Personalidade da marca em 3-5 adjectivos>

**Sim:** <regras de escrita>
**Não:** <anti-padrões>

## Image Style
- Fotografia: <descrição>
- Ilustração: <usar/não usar + estilo>
- Iconografia: <set + estilo>

## Component Tokens
```css
/* copiar do Passo 7 + customizações da marca */
```

## Anti-References
Não deves parecer com: <lista de marcas/estilos a evitar>

## register
brand | product  (delete one)
```

Gerar `BRAND.md` com asset paths, checksums e data de actualização para rastrear refresh de assets.

---

## Regras de qualidade

- **Sem invenção**: cor/fonte não confirmada → marcar `[A VERIFICAR]` — nunca inventar
- **OKLCH sempre**: converter hex → OKLCH antes de documentar
- **Asset path real**: listar só assets existentes no directório
- **Contraste verificado**: calcular rácio text/background antes de documentar
- **Anti-references obrigatórias**: sem anti-refs o sistema não tem guardrails

---

## Integração com outras skills

| Skill | Como usar DESIGN.md |
|-------|---------------------|
| `frontend` | Ler no início — cores, fontes, assets |
| `frontend` | Extrair → Tailwind config + CSS variables |
| `slides` | Aplicar cores e tipografia ao deck |
| `graphic-design` | Usar logo, cores e estilo de imagem |
