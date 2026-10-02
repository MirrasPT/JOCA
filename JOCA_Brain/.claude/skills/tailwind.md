---
name: tailwind
description: "Writing Tailwind CSS (v4) the right way — CSS-first @theme config, design-token mapping, cva+cn variants, dark mode, responsive, avoiding arbitrary-value sprawl. MUST be invoked when the user says: tailwind, tailwindcss, utility classes, @theme, cva, class-variance-authority, tailwind config, tailwind dark mode. SHOULD also invoke when: cn(), clsx, tailwind-merge, arbitrary values, responsive classes, shadcn styling, design tokens to tailwind."
triggers: oklab, tailwind, tailwindcss, tailwind 4, utility classes, utility-first, @theme, cva, class-variance-authority, tailwind config, tailwind.config, dark mode tailwind, cn(), clsx, tailwind-merge, twMerge, arbitrary values, responsive classes, breakpoints tailwind, shadcn, design tokens tailwind, container queries, @apply, variant
---
# Tailwind — Styling Specialist (v4)

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

Invoked by `frontend` (or directly) for the *how it looks via utilities* layer. Pairs with `react-composition` (component shape) and `design-system` (the token source of truth).

Default: **Tailwind CSS 4.** CSS-first config via `@theme`, no `tailwind.config.js` unless legacy.

Bias: **tokens as theme variables. Semantic over raw. cva for variants. arbitrary values are a smell.**

---

## 1. Setup (Tailwind 4 — CSS-first)

```css
/* globals.css */
@import "tailwindcss";

@theme {
  /* These become utilities AND CSS vars: bg-primary, text-fg, --color-primary */
  --color-primary: oklch(0.6 0.15 250);
  --color-fg: oklch(0.15 0.02 250);
  --color-bg: oklch(0.99 0.005 250);
  --color-muted: oklch(0.55 0.02 250);
  --color-focus-ring: oklch(0.6 0.15 250);

  --font-display: "Playfair Display", serif;
  --font-body: "Source Sans 3", sans-serif;

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```
No JS config needed. `@theme` keys map to namespaces: `--color-*` → `bg-*`/`text-*`/`border-*`, `--font-*` → `font-*`, `--radius-*` → `rounded-*`, `--spacing-*` → `p-*`/`m-*`/`gap-*`, `--text-*` → `text-*` (tamanho), `--z-index-*` → `z-*`, `--ease-*` · `--leading-*` · `--tracking-*` · `--shadow-*`. ⚠ **Token fora do namespace não gera classe, em silêncio** (`--z-nav` em vez de `--z-index-nav` → `z-nav` não existe; medido 2026-08-23) — ver §6 «classes que não existem».

Bridge to a design system: if the project has `tokens/tokens.css` from `design-system`, **import it and reference its vars inside `@theme`** — single source of truth, never duplicate values.

---

## 2. cn() — the merge helper (mandatory)

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
`twMerge` resolves conflicts so later classes win (`cn("px-2", "px-4")` → `px-4`). Always use `cn()` when composing conditional or override-able classes — never raw template strings (`px-2 ${maybe}`), which leave both conflicting utilities in the DOM.

---

## 3. Variants — cva, not booleans

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center font-medium rounded-md transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 " +
  "disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary/90",
        secondary: "bg-muted text-fg hover:bg-muted/80",
        ghost: "hover:bg-muted/20",
      },
      size: { sm: "h-9 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-8 text-base" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
```
`cva` replaces boolean-prop styling (`isPrimary isLarge`). The `className` escape hatch + `cn()` lets callers override safely. Maps directly to `design-system` component specs (variants/sizes/states).

---

## 4. Dark mode — semantic tokens, not per-class toggles

```css
/* Light is the @theme default; redefine semantic vars under .dark */
.dark {
  --color-fg: oklch(0.95 0.01 250);
  --color-bg: oklch(0.18 0.02 250);
  --color-muted: oklch(0.65 0.02 250);
}
```
```tsx
<body className="bg-bg text-fg">   {/* same utilities resolve correctly in both themes */}
```
- Design light + dark **together** (see `frontend` §3), not one after the other.
- Never `dark:bg-[#1a1a1a]` scattered everywhere — flip the token, utilities follow.
- `dark:` variant only for genuine per-element exceptions.

---

## 5. Responsive — mobile-first

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```
- Base = mobile; layer up with `sm: md: lg: xl:`. Never desktop-first with `max-*`.
- Default breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Align to `frontend` 375/768/1024/1440 mental model.
- **Container queries** for component-level responsiveness (independent of viewport):
```tsx
<div className="@container">
  <div className="grid @md:grid-cols-2 @lg:grid-cols-3">…</div>
</div>
```
- Fluid type/space with `clamp()` in a token rather than many breakpoint steps when it reads better.
- Escapar para CSS nativo quando a plataforma ja resolve (scroll-driven animations, `:has()`,
  `color-mix()`, `content-visibility`) → `Read(".claude/reference/frontend/modern-css.md")`.

---

## 6. Anti-patterns

| Smell | Fix |
|-------|-----|
| Arbitrary values everywhere `p-[13px] text-[#3b82f6]` | Add a token to `@theme`; arbitrary = escape hatch, not default |
| Raw hex in classes `bg-[#fff]` | Semantic token `bg-bg` / `bg-primary` |
| Duplicated long class strings across files | Extract a component (cva) — don't copy-paste utilities |
| `@apply` to fake components | Make a real React component; `@apply` only for true base/reset rules |
| Template-string class merge `\`px-2 ${x}\`` | `cn("px-2", x)` |
| Boolean styling props `isActive` toggling classes inline | `cva` variant |
| `!important` / `!` overrides | Fix specificity / order via `cn()`+`twMerge` |
| `space-x/y` on flex-wrap or RTL | `gap-*` |
| Disabling content-detection / safelisting huge lists | Keep class names static & complete strings (purge needs literals) |
| Arbitrary feature media query `[@media(hover:hover)and(pointer:fine)]:block` | **CSS inválido** → ecrã branco. Definir `@custom-variant` no globals.css |

**Purge rule:** class names must be complete static strings. `bg-${color}-500` won't be detected — map to full class names in an object instead.

### ⚠ v4: media-queries de feature + scan de `.md`/comentários (branqueiam a página)

Dois tells de Tailwind v4 que **passam `tsc` E `next build`** e só rebentam no dev/runtime (500 / ecrã branco):

1. **Arbitrary media query com `and` sem espaços = CSS inválido.** `[@media(hover:hover)and(pointer:fine)]:block` gera `@media (hover:hover)and(pointer:fine)` → "Unexpected token Function(and)" → derruba a página INTEIRA. `_and_` é frágil. **Fix:** declarar uma variant nomeada no globals.css e usá-la como classe:
   ```css
   @custom-variant fine-hover (@media (hover: hover) and (pointer: fine));
   ```
   ```html
   <div class="fine-hover:block">…</div>
   ```
2. **v4 faz content-scan de `.md` e de COMENTÁRIOS** à procura de candidatos a classes. Uma classe partida citada num comentário, num `.md` de docs, ou num resumo `.joca/intermediate/*.md` **regenera** a classe inválida e mantém o site branco MESMO depois de corrigir o `.tsx`. Sintoma traiçoeiro: corriges o componente e continua branco. **Fix:** sanitizar a string em qualquer ficheiro escaneado; excluir resumos/docs do content-scan (`@source not "..."`) ou escrevê-los fora da árvore do projecto. (Irmão do tell "adblock token branqueia site" do `frontend.md`. Fonte: caso real 2026-06-23.)

### ⚠ v4: medir cor com regex sobre `getComputedStyle` da numeros FALSOS (`oklab`)

Num projecto Tailwind v4 o `getComputedStyle` devolve a cor em **`oklab()`**, nao em `rgb()`:
`oklab(0.999994 0.0000455 0.0000165 / 0.75)`. Uma regex que apanha os tres primeiros numeros le-os
como RGB e conclui **quase preto** — num caso real deu 1,63:1 num texto que esta a 7,2:1. A auditoria
de contraste acusa falhas que nao existem, e a correccao "obvia" estraga o design que estava certo.

⚠ **`canvas.fillStyle` NAO normaliza `oklab`/`oklch`** — o getter devolve a string inalterada, por
isso ler `ctx.fillStyle` depois de a atribuir nao converte nada. A unica leitura fiavel e **pintar
num canvas 1x1 e ler o pixel**:

```js
// cor real em sRGB, seja qual for o espaco de cor que o CSS declara
function corSRGB(cssColor, fundo = null) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(0, 0, 1, 1); }  // cor com alpha: pintar o fundo primeiro
  ctx.fillStyle = cssColor;            // aceita oklab()/oklch(); e o PIXEL que converte, nao o getter
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}
```

Vale para qualquer espaco moderno (`oklch`, `lab`, `color(display-p3 ...)`), nao so para o `oklab`.
Um medidor que so aceita strings comecadas por `rgb` devolve `null` e o par **nao chega a ser
medido** — silencio que se le como aprovacao. Doutrina do gate: `.claude/reference/gates-runtime.md`.

### ⚠ v4: cascata de camadas e classes que não existem (as duas falham em silêncio)

`tsc`, `eslint` e `npm run build` passam nos quatro casos — o defeito só se vê no CSS servido.

| Armadilha | Sintoma | Regra |
|---|---|---|
| Utilitário próprio escrito em `@layer utilities { .snap-row {…} }` | vem depois das utilities geradas e ganha-lhes: `md:flex-wrap` não o sobrepõe (lido como «não aceita variantes»; 2026-08-21) | utilitário que tem de aceitar variantes → **`@utility snap-row { … }`**, nunca regra em `@layer utilities` |
| Regra de elemento no ficheiro de entrada **fora de `@layer`** (`:focus-visible { outline … }`) | vence **todos** os utilitários; nenhum componente consegue mudar o anel de foco e acaba em `style` inline (2026-09-01) | qualquer regra de elemento vai **dentro de `@layer base`** |
| Token no namespace errado ou removido do `@theme` (`--z-nav`, `p-page` depois de apagar `--spacing-page`) | a classe não é gerada; o elemento fica com o valor por omissão | nomes dentro dos namespaces do §1; verificar a classe no CSS servido |
| Token do projecto com o **mesmo nome** de um namespace do Tailwind, mapeado em `@theme inline` (`--color-primary: var(--color-primary)`) | auto-referência → resolve para nada | prefixar os tokens do projecto (`--ds-*`) e mapear: `--color-primary: var(--ds-primary)` (ver `reference/design-system-tokens.md`) |

**Verificar:** `grep` à **classe** (não à variável) no CSS que o browser recebe — `curl -s <url-do-css> | grep -c '\.z-nav'`; e a
cascata pelo CSSOM (`[...document.styleSheets]` → regra e camada), **não** injectando elementos por `innerHTML`: as classes
geram-se no build, e uma classe nova injectada nunca existe.

---

## 7. Recipes

```tsx
// Centered constrained container
<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">

// Sticky header
<header className="sticky top-0 z-40 border-b border-muted/20 bg-bg/80 backdrop-blur">

// Auto-fit card grid (no breakpoints)
<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">

// Visually-hidden (a11y label)
<span className="sr-only">Close</span>

// Truncate / line-clamp
<p className="line-clamp-2">…</p>
```

z-index as scale (align to design tokens), never ad-hoc magic numbers: `z-0 z-10 z-20 z-30 z-40 z-50`.

---

## Checklist

- [ ] `@theme` (TW4) or token-mapped config — no orphan hardcoded values
- [ ] `cn()` (clsx + tailwind-merge) for all conditional/override classes
- [ ] Variants via `cva`, not boolean props
- [ ] Dark mode via semantic token flip, not scattered `dark:` hexes
- [ ] Mobile-first; container queries for component-level responsive
- [ ] Arbitrary values are rare and justified
- [ ] Class strings static/complete (purge-safe)
- [ ] `focus-visible:ring` on interactives; `gap` over `space-*`

---

## Related skills

- `frontend` — director; invokes this for the styling layer
- `design-system` — token source of truth → feeds `@theme`; variant/state contract that `cva` implements
- `react-composition` — component shape being styled
- `mobile` — deeper responsive/touch patterns
