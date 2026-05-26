---
name: design-tokens
description: "Defining or managing design tokens (colors, spacing, typography) in DTCG format. MUST be invoked when the user says: design tokens, tokens, CSS variables, custom properties, global tokens, semantic tokens, component tokens, token architecture. SHOULD also invoke when: DTCG, Style Dictionary, spacing scale, grid system, breakpoints, z-index."
triggers: design tokens, tokens, CSS variables, custom properties, global tokens, semantic tokens, component tokens, token architecture, DTCG, Style Dictionary, spacing scale, grid system, breakpoints, z-index, dark mode, dark theme, tema escuro, colour tokens, color tokens, shadow tokens, motion tokens, token file, tokens.css, tokens.json
---
# Design Tokens

Arquitectura de tokens em 3 camadas. Transforma DESIGN.md em ficheiros consumiveis pelo frontend.

**Activar** apos `brand-guidelines` gerar DESIGN.md, antes de qualquer UI.

---

## Arquitectura 3 tiers

```
global.json     → RAW VALUES (sem semantica)
    ↓ references
semantic.json   → NAMED INTENT (aliases para globals)
    ↓ references
component.json  → PER-COMPONENT (overrides consumidos por UI)
    ↓ compiled
tokens.css      → CSS custom properties flat (o que o frontend usa)
```

**Regra fundamental:** zero raw values nos tiers semantic e component. So `{references}` para globals. Raw values vivem APENAS em global.json.

---

## Output: tokens/global.json

Primitivas puras. Sem semantica — so valores.

```json
{
  "color": {
    "brand": {
      "50":  { "$value": "oklch(0.97 0.01 260)", "$type": "color" },
      "100": { "$value": "oklch(0.93 0.03 260)", "$type": "color" },
      "200": { "$value": "oklch(0.85 0.06 260)", "$type": "color" },
      "300": { "$value": "oklch(0.75 0.12 260)", "$type": "color" },
      "400": { "$value": "oklch(0.65 0.18 260)", "$type": "color" },
      "500": { "$value": "oklch(0.55 0.22 260)", "$type": "color" },
      "600": { "$value": "oklch(0.45 0.20 260)", "$type": "color" },
      "700": { "$value": "oklch(0.35 0.16 260)", "$type": "color" },
      "800": { "$value": "oklch(0.25 0.12 260)", "$type": "color" },
      "900": { "$value": "oklch(0.15 0.08 260)", "$type": "color" }
    },
    "neutral": {
      "0":   { "$value": "oklch(0.99 0.002 260)", "$type": "color", "$description": "near-white tinted to brand hue" },
      "50":  { "$value": "oklch(0.97 0.003 260)", "$type": "color" },
      "100": { "$value": "oklch(0.93 0.005 260)", "$type": "color" },
      "200": { "$value": "oklch(0.87 0.005 260)", "$type": "color" },
      "300": { "$value": "oklch(0.78 0.006 260)", "$type": "color" },
      "400": { "$value": "oklch(0.65 0.008 260)", "$type": "color" },
      "500": { "$value": "oklch(0.55 0.008 260)", "$type": "color" },
      "600": { "$value": "oklch(0.43 0.008 260)", "$type": "color" },
      "700": { "$value": "oklch(0.33 0.008 260)", "$type": "color" },
      "800": { "$value": "oklch(0.22 0.008 260)", "$type": "color" },
      "900": { "$value": "oklch(0.13 0.008 260)", "$type": "color" },
      "950": { "$value": "oklch(0.07 0.005 260)", "$type": "color" }
    },
    "success": {
      "500": { "$value": "oklch(0.60 0.18 145)", "$type": "color" }
    },
    "warning": {
      "500": { "$value": "oklch(0.75 0.15 85)", "$type": "color" }
    },
    "error": {
      "500": { "$value": "oklch(0.55 0.22 25)", "$type": "color" }
    }
  },
  "space": {
    "0":  { "$value": "0px", "$type": "dimension" },
    "1":  { "$value": "4px", "$type": "dimension" },
    "2":  { "$value": "8px", "$type": "dimension" },
    "3":  { "$value": "12px", "$type": "dimension" },
    "4":  { "$value": "16px", "$type": "dimension" },
    "5":  { "$value": "20px", "$type": "dimension" },
    "6":  { "$value": "24px", "$type": "dimension" },
    "8":  { "$value": "32px", "$type": "dimension" },
    "10": { "$value": "40px", "$type": "dimension" },
    "12": { "$value": "48px", "$type": "dimension" },
    "16": { "$value": "64px", "$type": "dimension" },
    "20": { "$value": "80px", "$type": "dimension" },
    "24": { "$value": "96px", "$type": "dimension" }
  },
  "radius": {
    "none": { "$value": "0px", "$type": "dimension" },
    "sm":   { "$value": "4px", "$type": "dimension" },
    "md":   { "$value": "8px", "$type": "dimension" },
    "lg":   { "$value": "12px", "$type": "dimension" },
    "xl":   { "$value": "16px", "$type": "dimension" },
    "2xl":  { "$value": "24px", "$type": "dimension" },
    "full": { "$value": "9999px", "$type": "dimension" }
  },
  "shadow": {
    "sm":  { "$value": "0 1px 2px oklch(0 0 0 / 0.05)", "$type": "shadow" },
    "md":  { "$value": "0 4px 6px oklch(0 0 0 / 0.07)", "$type": "shadow" },
    "lg":  { "$value": "0 10px 15px oklch(0 0 0 / 0.10)", "$type": "shadow" },
    "xl":  { "$value": "0 20px 25px oklch(0 0 0 / 0.12)", "$type": "shadow" }
  },
  "duration": {
    "instant": { "$value": "0ms", "$type": "duration" },
    "fast":    { "$value": "150ms", "$type": "duration" },
    "base":    { "$value": "250ms", "$type": "duration" },
    "slow":    { "$value": "400ms", "$type": "duration" },
    "slower":  { "$value": "600ms", "$type": "duration" }
  },
  "easing": {
    "default":    { "$value": "cubic-bezier(0.16, 1, 0.3, 1)", "$type": "cubicBezier", "$description": "ease-out-quart" },
    "in":         { "$value": "cubic-bezier(0.55, 0, 1, 0.45)", "$type": "cubicBezier" },
    "out":        { "$value": "cubic-bezier(0, 0.55, 0.45, 1)", "$type": "cubicBezier" },
    "in-out":     { "$value": "cubic-bezier(0.45, 0, 0.55, 1)", "$type": "cubicBezier" },
    "spring":     { "$value": "cubic-bezier(0.34, 1.56, 0.64, 1)", "$type": "cubicBezier", "$description": "overshoot" }
  },
  "breakpoint": {
    "sm":  { "$value": "640px", "$type": "dimension" },
    "md":  { "$value": "768px", "$type": "dimension" },
    "lg":  { "$value": "1024px", "$type": "dimension" },
    "xl":  { "$value": "1280px", "$type": "dimension" },
    "2xl": { "$value": "1536px", "$type": "dimension" }
  },
  "grid": {
    "columns-sm":    { "$value": "4", "$type": "number" },
    "columns-md":    { "$value": "8", "$type": "number" },
    "columns-lg":    { "$value": "12", "$type": "number" },
    "gutter":        { "$value": "{space.4}", "$type": "dimension" },
    "margin-sm":     { "$value": "{space.4}", "$type": "dimension" },
    "margin-md":     { "$value": "{space.6}", "$type": "dimension" },
    "margin-lg":     { "$value": "{space.8}", "$type": "dimension" },
    "max-width":     { "$value": "1280px", "$type": "dimension" }
  },
  "z-index": {
    "base":    { "$value": "0", "$type": "number" },
    "raised":  { "$value": "10", "$type": "number" },
    "dropdown":{ "$value": "100", "$type": "number" },
    "sticky":  { "$value": "200", "$type": "number" },
    "overlay": { "$value": "300", "$type": "number" },
    "modal":   { "$value": "400", "$type": "number" },
    "popover": { "$value": "500", "$type": "number" },
    "toast":   { "$value": "600", "$type": "number" }
  }
}
```

---

## Output: tokens/semantic.json

Aliases com intent. Referenciam globals.

```json
{
  "color": {
    "interactive":     { "$value": "{color.brand.500}", "$type": "color" },
    "interactive-hover": { "$value": "{color.brand.400}", "$type": "color" },
    "surface":         { "$value": "{color.neutral.0}", "$type": "color" },
    "surface-raised":  { "$value": "{color.neutral.50}", "$type": "color" },
    "surface-sunken":  { "$value": "{color.neutral.100}", "$type": "color" },
    "border":          { "$value": "{color.neutral.200}", "$type": "color" },
    "border-strong":   { "$value": "{color.neutral.300}", "$type": "color" },
    "text":            { "$value": "{color.neutral.900}", "$type": "color" },
    "text-secondary":  { "$value": "{color.neutral.600}", "$type": "color" },
    "text-muted":      { "$value": "{color.neutral.400}", "$type": "color" },
    "text-on-interactive": { "$value": "{color.neutral.0}", "$type": "color" },
    "focus-ring":      { "$value": "{color.brand.400}", "$type": "color" },
    "success":         { "$value": "{color.success.500}", "$type": "color" },
    "warning":         { "$value": "{color.warning.500}", "$type": "color" },
    "error":           { "$value": "{color.error.500}", "$type": "color" }
  },
  "space": {
    "component-gap":   { "$value": "{space.4}", "$type": "dimension" },
    "section-gap":     { "$value": "{space.12}", "$type": "dimension" },
    "page-padding":    { "$value": "{space.6}", "$type": "dimension" }
  },
  "motion": {
    "enter-duration":  { "$value": "{duration.base}", "$type": "duration" },
    "exit-duration":   { "$value": "{duration.fast}", "$type": "duration", "$description": "exits faster than enters" },
    "enter-easing":    { "$value": "{easing.out}", "$type": "cubicBezier" },
    "exit-easing":     { "$value": "{easing.in}", "$type": "cubicBezier" }
  }
}
```

---

## Output: tokens/component.json

Per-component. Referenciam semantics.

```json
{
  "button": {
    "bg-primary":     { "$value": "{color.interactive}", "$type": "color" },
    "bg-primary-hover": { "$value": "{color.interactive-hover}", "$type": "color" },
    "fg-primary":     { "$value": "{color.text-on-interactive}", "$type": "color" },
    "bg-secondary":   { "$value": "{color.surface-raised}", "$type": "color" },
    "fg-secondary":   { "$value": "{color.text}", "$type": "color" },
    "radius":         { "$value": "{radius.md}", "$type": "dimension" },
    "padding-x":      { "$value": "{space.4}", "$type": "dimension" },
    "padding-y":      { "$value": "{space.2}", "$type": "dimension" },
    "height-sm":      { "$value": "32px", "$type": "dimension" },
    "height-md":      { "$value": "40px", "$type": "dimension" },
    "height-lg":      { "$value": "48px", "$type": "dimension" },
    "focus-ring-width":  { "$value": "2px", "$type": "dimension" },
    "focus-ring-offset": { "$value": "2px", "$type": "dimension" },
    "disabled-opacity":  { "$value": "0.4", "$type": "number" }
  },
  "input": {
    "bg":             { "$value": "{color.surface}", "$type": "color" },
    "border":         { "$value": "{color.border}", "$type": "color" },
    "border-focus":   { "$value": "{color.interactive}", "$type": "color" },
    "border-error":   { "$value": "{color.error}", "$type": "color" },
    "radius":         { "$value": "{radius.md}", "$type": "dimension" },
    "padding-x":      { "$value": "{space.3}", "$type": "dimension" },
    "height":         { "$value": "40px", "$type": "dimension" }
  },
  "card": {
    "bg":             { "$value": "{color.surface-raised}", "$type": "color" },
    "border":         { "$value": "{color.border}", "$type": "color" },
    "radius":         { "$value": "{radius.lg}", "$type": "dimension" },
    "shadow":         { "$value": "{shadow.sm}", "$type": "shadow" },
    "padding":        { "$value": "{space.6}", "$type": "dimension" }
  }
}
```

---

## Output: tokens/tokens.css

Compilado flat. O que o frontend importa.

```css
:root {
  /* ═══ Global: Colors ═══ */
  --blue-50: oklch(0.97 0.01 260);
  --blue-500: oklch(0.55 0.22 260);
  /* ... full palette ... */

  /* ═══ Global: Space ═══ */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* ═══ Global: Layout ═══ */
  --grid-columns: 12;
  --grid-gutter: 16px;
  --grid-max-width: 1280px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  /* ═══ Global: Z-Index ═══ */
  --z-base: 0;
  --z-raised: 10;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 600;

  /* ═══ Semantic: Colors ═══ */
  --color-interactive: var(--blue-500);
  --color-interactive-hover: var(--blue-400);
  --color-surface: var(--neutral-0);
  --color-surface-raised: var(--neutral-50);
  --color-text: var(--neutral-900);
  --color-text-secondary: var(--neutral-600);
  --color-border: var(--neutral-200);
  --color-focus-ring: var(--blue-400);

  /* ═══ Components: Button ═══ */
  --button-bg-primary: var(--color-interactive);
  --button-bg-primary-hover: var(--color-interactive-hover);
  --button-fg-primary: var(--neutral-0);
  --button-radius: var(--radius-md);
  --button-height-md: 40px;

  /* ═══ Components: Input ═══ */
  --input-bg: var(--color-surface);
  --input-border: var(--color-border);
  --input-border-focus: var(--color-interactive);
  --input-radius: var(--radius-md);
  --input-height: 40px;

  /* ═══ Components: Card ═══ */
  --card-bg: var(--color-surface-raised);
  --card-border: var(--color-border);
  --card-radius: var(--radius-lg);
  --card-shadow: var(--shadow-sm);
}

/* ═══ Dark Mode ═══ */
[data-theme="dark"],
.dark {
  --color-surface: var(--neutral-950);
  --color-surface-raised: var(--neutral-900);
  --color-surface-sunken: var(--neutral-950);
  --color-border: var(--neutral-700);
  --color-border-strong: var(--neutral-600);
  --color-text: var(--neutral-50);
  --color-text-secondary: var(--neutral-300);
  --color-text-muted: var(--neutral-500);

  --card-bg: var(--neutral-900);
  --card-border: var(--neutral-700);
  --input-bg: var(--neutral-900);
  --input-border: var(--neutral-700);
}

/* ═══ Reduced Motion ═══ */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
  }
}
```

---

## Geracao

### Input

1. **DESIGN.md** — ler cores, tipografia, tokens existentes (obrigatorio)
2. **Projecto existente** — se ja tem CSS/Tailwind, extrair valores actuais
3. Se nenhum existir: sugerir correr `brand-guidelines` primeiro

### Processo

1. Ler DESIGN.md
2. Extrair cores → gerar paleta completa (50-950) em OKLCH para cada cor de marca
3. Gerar neutral palette tinted ao hue da cor primaria
4. Mapear spacing, radius, shadows do DESIGN.md para global.json
5. Definir breakpoints e grid (perguntar se nao especificado)
6. Gerar semantic.json com aliases
7. Gerar component.json para componentes base (button, input, card, badge, avatar)
8. Compilar tokens.css
9. Gerar dark mode resolver
10. Apresentar ao utilizador para review

### Perguntas minimas (so se DESIGN.md nao responde)

- "Breakpoints custom ou defaults (640/768/1024/1280)?"
- "Grid: 12 colunas ou outro?"
- "Dark mode necessario?"

---

## Regras non-negotiable

1. **OKLCH everywhere** — zero hex, zero hsl, zero rgb nos ficheiros de tokens
2. **Neutrals tinted** — nunca `#000` ou `#fff` puros; tint para o hue da cor primaria (chroma 0.002-0.008)
3. **No raw in semantic/component** — so `{references}`. Raw values = global.json APENAS
4. **4px grid** — todo spacing e multiplo de 4
5. **Contrast check** — text sobre surface >= 4.5:1 (WCAG AA); large text >= 3:1
6. **Reduced motion** — sempre incluir `@media (prefers-reduced-motion: reduce)`

---

## Actualizacao

Actualizar tokens quando:
- DESIGN.md muda (novas cores, fonts)
- Componente novo adicionado ao sistema
- Dark mode adicionado ou modificado
- Feedback do `design-system-audit` agent

Processo: editar ficheiros JSON, recompilar tokens.css, verificar que semantic/component refs ainda resolvem.

---

## Workflow

Pipeline desta skill na sequencia JOCA:

→ **antes**: `brand-guidelines` (DESIGN.md como input)
→ **apos**: `component-system` (consome tokens para specs de componentes)

Notificar ao concluir: `→ proximo: component-system`
