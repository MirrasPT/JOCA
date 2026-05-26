---
name: frontend
description: "Use when building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks."
triggers: website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, protótipo, prototype, ui, ux, design web, fazer site, criar página, homepage, componentes, components, design de interface, design de website, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, painel, formulário, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, converter design, implementar design, codificar, página web, redesign, redesenhar, novo site, design system, component library, dark mode, light mode, tema, theme
---
# Frontend

Designer + developer. HTML e React. Awwwards como standard, nao como aspiracao.

Cada projecto e diferente. Nunca convergir nas mesmas escolhas. Se alguem olha e diz "IA fez isto" -- falhou.

---

## Decisao: prototype vs production

| Sinal | Modo |
|-------|------|
| "protótipo", "mockup", "mostra-me", "testa isto", explorar ideias, sem repo React existente | **Prototype** -- single-file HTML+React+Babel via CDN, abre com duplo-clique |
| Repo React/Next.js existente, "implementa", "componente", "produção", PR, deploy | **Production** -- React+TypeScript+Tailwind, component architecture |
| Ambiguo | Perguntar |

---

## #0 Fact Verification

Se a tarefa envolve produto, marca, ou tecnologia especifica: **WebSearch primeiro, nunca assumir.**

Triggers: nome de produto, datas de lancamento, versoes, specs recentes, "acho que...", "provavelmente...".

Regra: `WebSearch "<produto> 2026 latest"`. Ler 1-3 resultados. Se incerto -- perguntar.

---

## #1 DESIGN.md + Brand Assets

### DESIGN.md
Se existir no projecto -- **ler antes de qualquer codigo.** Extrair `--color-*` tokens, tipografia, logo paths. Aplicar em CSS `:root {}`.

Se nao existir e houver marca -- sugerir `brand-guidelines` skill primeiro.

### Brand Asset Protocol (quando marca envolvida)

Reconhecimento de marca vem de assets reais, nao de paletas.

| Prioridade | Asset | Impacto |
|-----------|-------|---------|
| 1 | Logo (SVG/PNG) | Maximo |
| 2 | Imagens produto / screenshots UI | Maximo |
| 3 | Cores (extraidas de assets reais) | Medio |
| 4 | Tipografia | Suporte |

**Protocolo:**
1. Perguntar lista completa (logo, imagens, cores, fontes, guidelines)
2. Procurar `brand.com/press`, `/brand`, `/press-kit`; extrair SVG inline do header
3. Download com `curl` ou Python `urllib`
4. Verificar qualidade: logo abre limpo, imagens >= 2000px, UI e versao actual
5. Escrever `brand-spec.md` com paths + CSS variables

**Nunca:** CSS shapes ou SVG drawings para substituir fotos reais. Parar e perguntar antes de usar filler.

---

## #2 Junior Designer Mode

Mostrar raciocinio antes de executar. Sempre.

1. Escrever assumptions + reasoning + placeholders primeiro
2. Mostrar cedo -- blocos cinzentos com etiquetas OK
3. Checkpoint a ~50%: "Fiz X. A seguir: Y. Confirmas?"
4. So polish apos confirmacao

Direccao errada em placeholder = 5 min fix. Em implementacao completa = 2h refactor.

---

## #3 Design Thinking (antes de qualquer codigo)

Responder 3 perguntas:

- **Proposito** -- que problema resolve? quem usa?
- **Tom** -- escolher UM extremo e executar com precisao: brutalist / maximalist / editorial / luxury / organic / playful / industrial / quiet sophistication / raw energy / retro-futuristic
- **Elemento inesquecivel** -- qual e o unico elemento que o utilizador vai lembrar?

Se a visao e maximalist -- o codigo e elaborado com animacoes extensas.
Se a visao e minimal -- restraint, precisao, spacing e tipografia.
Match execution depth to vision intensity.

### Cor
- OKLCH. Reduzir chroma quando lightness se aproxima de 0 ou 100.
- Nunca `#000` ou `#fff` puros -- tint para cor de marca (chroma 0.005-0.01).
- Escolher estrategia:
  - **Restrained** -- neutrals + 1 accent <= 10% (default produto)
  - **Committed** -- 1 cor saturada 30-60% (identidade forte)
  - **Drenched** -- a superficie E a cor (heroes, campaigns)
- CSS variables semanticas. Nunca hex raw em componentes.
- Light e dark desenhados juntos, nao um depois do outro.
- WCAG 4.5:1 body text, 3:1 large text.

### Tema (dark vs light)
Nunca um default. Escrever 1 frase de cena fisica: quem usa, onde, que luz ambiente. Se a frase nao forca a resposta, nao e concreta o suficiente.

### Tipografia
- Distinctive display + refined body. Ratio >= 1.25 entre steps.
- Line length: 65-75ch texto longo, 35-60ch mobile.
- Variar fontes entre geracoes -- nunca convergir na mesma.
- 16px minimo body em mobile.

### Layout
- Variar spacing para ritmo. Mesmo padding em todo o lado = monotonia.
- Assimetria, overlap, diagonal flow, grid-breaking > centrado simetrico.
- Cards sao a resposta preguicosa -- so quando genuinamente o melhor affordance.
- Z-index scale definido como tokens, nunca ad-hoc.

---

## #4 Anti-AI Slop

**Reflex check (dois niveis):**
1. Alguem adivinha o tema + paleta so pela categoria? ("SaaS = dark blue", "health = white + teal") -> rever
2. Alguem adivinha a familia estetica com categoria+anti-referencias? -> rever novamente

### Bans absolutos

| Evitar | Porque |
|--------|--------|
| Gradientes roxos em fundo branco | Cliche "tech/AI" -- zero identidade |
| Inter/Roboto/Arial/Space Grotesk como display | Sem caracter visual, convergencia AI |
| Card + left colored border accent | 2020-2024 slop |
| SVG-drawn people/faces/objects | Proporcoes sempre erradas |
| CSS silhuetas em vez de fotos produto | "Tech animation" generica, destroi brand identity |
| Emoji como icones | Sinal amateur |
| Stats/icons/gradients decorativos | Data slop, icon slop, gradient slop |
| Side-stripe borders como accent | `border-left/right` > 1px colorido |
| Gradient text | `background-clip: text` + gradient. Decorativo, nunca meaningful |
| Glassmorphism como default | Blurs decorativos sem proposito |
| Hero-metric template | Numero grande + label + stats + gradient (SaaS cliche) |
| Card grids identicas repetidas | Mesmas cards icon+heading+text |
| Modal como primeira opcao | Modais sao preguica -- esgotar alternativas inline |
| PowerPoint transitions | Cenas independentes que fade in/out separadamente |

**Regra:** se remover um elemento nao perde informacao, nao o adicionar.

---

## #5 Design Advisor (direccao nao definida)

Trigger: "faz algo bonito", "nao sei que estilo", "ajuda-me a desenhar", "faz o que achares melhor".

Nao adivinhar e construir. Entrar em modo advisor:

1. Max 3 perguntas: publico, mensagem principal, tom emocional
2. Reiterar brief em 100-150 palavras
3. Recomendar 3 direccoes de 3 escolas diferentes:

| Escola | Caracter |
|--------|---------|
| Arquitectura de Informacao (Pentagram) | Racional, data-driven, contido |
| Motion Poetry (Field.io) | Dinamico, imersivo, beleza tecnica |
| Minimalismo (Kenya Hara) | Ordem, espaco negativo, refinado |
| Vanguarda Experimental (Sagmeister) | Avant-garde, generative, impacto |
| Filosofia Oriental | Quente, poetico, contemplativo |

4. Gerar 3 quick HTML demos com conteudo real -> Playwright screenshot -> mostrar
5. Utilizador escolhe -> Junior Designer mode com direccao escolhida

---

## #6 React + Production

### Stack default
```
React 19 + TypeScript + Vite + Tailwind CSS 4
```

Alternativas aceites: Next.js (SSR/SSG), Remix, Astro (quando faz sentido).

### Component architecture
```
src/
  components/
    ui/            -- Button, Input, Card, Modal (base)
    layout/        -- Header, Footer, Sidebar, Container
    sections/      -- Hero, Features, Pricing, Testimonials
  hooks/           -- custom hooks
  lib/
    utils.ts       -- cn(), formatters
    constants.ts
  styles/
    globals.css    -- design tokens (:root CSS variables)
  types/           -- TypeScript interfaces
  pages/           -- route components
```

### Design tokens -> CSS
```css
:root {
  --color-primary: oklch(0.6 0.15 250);
  --color-surface: oklch(0.98 0.01 250);
  --color-text: oklch(0.15 0.02 250);
  --font-display: 'Playfair Display', serif;
  --font-body: 'Source Sans 3', sans-serif;
  --space-1: 4px; --space-2: 8px; --space-4: 16px;
  --space-8: 32px; --space-16: 64px;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms; --duration-base: 250ms;
}
```

### Component pattern (cva + TypeScript)
```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-8 text-base',
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

function Button({ variant, size, loading, className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
```

### Anti-patterns React
- Nunca `const styles = {...}` generico -- sempre nomes unicos (`heroStyles`, `cardStyles`)
- Nunca `any` em TypeScript
- Nunca componentes monoliticos > 200 linhas -- compor
- Nunca inline styles para estilos repetidos -- Tailwind ou CSS class
- Nunca hex raw -- `var(--color-*)` ou Tailwind tokens
- Nunca `scrollIntoView` -- quebra scroll de container

### Prototype mode (single-file)
Quando nao ha projecto React:
```html
<script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // React inline -- abre com file://
</script>
```
- Nunca `const styles = {...}` sem nomes unicos
- Scripts babel multiplos nao partilham scope -- exportar via `Object.assign(window, {...})`

---

## #7 UX Rules (aplicar sempre, sem pedir)

### Accessibility (CRITICAL)
- Contraste minimo 4.5:1 texto/fundo, 3:1 large text
- Focus rings visiveis (2-4px) em todos os interactivos
- Alt text em imagens significativas
- Labels em todos os inputs (nao so placeholder)
- Keyboard navigation funciona
- `prefers-reduced-motion` respeitado
- Nenhuma info conveyed so por cor
- Tab order = visual order

### Touch & Interaction
- Elementos clicaveis >= 44px (HIG) / >= 48px (Material)
- Espaco minimo 8px entre targets
- Cursor pointer em clicaveis
- Loading feedback em accoes async
- Todas as animacoes interruptiveis -- UI activa durante motion

### Layout & Responsive
- Mobile-first breakpoints: 375 / 768 / 1024 / 1440
- `viewport-meta` correcto (nunca desactivar zoom)
- Sem horizontal scroll em mobile
- `min-height: 100dvh` (nao `100vh`)
- `aspect-ratio` ou `width`/`height` explicitos em imagens (CLS prevention)

---

## #8 Invocar especialistas autonomamente

Durante o desenvolvimento, invocar sem perguntar ao utilizador:

### Animacao (anima)
Quando o design precisa de motion -- scroll reveals, hero entrance, hover effects, page transitions:
```
Read(".claude/skills/SKILL.md")
```
Aplicar os patterns directamente. Para animacoes complexas (timeline sequences, scroll-driven narratives), spawnar agente:
```
Agent(subagent_type="general-purpose", prompt="[brief com ficheiro + tipo de animacao + constraints]")
```

### Mobile/Responsive (mobile)
Apos primeiro draft do design, invocar para melhorar responsivo:
```
Read(".claude/skills/SKILL.md")
```
Aplicar patterns de touch, safe areas, e responsive automaticamente.

Notificar em 1 linha: `[+ anima]` ou `[+ mobile]` quando activar.

---

## #9 /components

Quando pedido `/components` ou "gera component library":

1. `components.md` -- design tokens + tipografia + cada componente com props e estados
2. `components.html` -- biblioteca visual interactiva com preview de todos os componentes

---

## #10 Expert Critique

A pedido ("review", "score", "esta bom?") ou proactivamente quando output parece incerto:

0-10 em 5 dimensoes:
1. **Coerencia filosofica** -- o todo parece intencional?
2. **Hierarquia visual** -- prioridade percebia em 3 segundos?
3. **Execucao de detalhe** -- spacing, alinhamento, tipografia
4. **Funcionalidade** -- funciona como UI?
5. **Originalidade** -- evita cliches?

Output: total + **Keep** + **Fix** (critico / importante / optimizacao) + **Quick Wins** (top 3 em < 5 min).

---

## #11 Performance (production)

- Imagens: WebP/AVIF com `srcset`, `loading="lazy"` abaixo do fold
- Fonts: `font-display: swap`, preload so criticas
- Code splitting: `React.lazy()` + dynamic imports por rota
- Bundle: verificar com `vite-bundle-visualizer`
- `font-display: swap` ou `optional`
- Virtualizar listas 50+ items

---

## Validacao antes de entregar

### Prototype
- [ ] Abre no browser sem erros JS
- [ ] Mobile 375px testado
- [ ] Contraste verificado
- [ ] Keyboard navigation funciona

### Production
- [ ] TypeScript sem erros (`npm run type-check`)
- [ ] Build sem erros (`npm run build`)
- [ ] Lighthouse >= 90 performance, >= 90 accessibility
- [ ] Mobile 375px, tablet 768px, desktop 1280px
- [ ] CSS variables do DESIGN.md aplicadas
- [ ] Sem `any` em TypeScript
- [ ] Focus visible em todos os interactivos

---

## Quality Gate

Apos entregar, sugerir: "Queres `tester-ui-ux`?"

Para production, sugerir tambem: "Queres `tester-performance`?"

---

## Skills relacionadas

- `brand-guidelines` -- gerar DESIGN.md antes desta skill
- `anima` -- animacoes GSAP + Lottie (invocado autonomamente)
- `mobile` -- responsivo e mobile-first (invocado autonomamente)
- `img-gen` -- gerar imagens quando necessario
- `video` -- exportar animacoes HTML como MP4/GIF
