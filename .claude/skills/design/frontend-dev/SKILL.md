---
name: frontend-dev
description: Production-ready frontend implementation. Takes HTML prototypes from frontend-design and implements them in React, Vue, Svelte, or Next.js with Tailwind CSS, Bootstrap, or CSS Modules. Focus on scalability, accessibility, performance, and clean component architecture. Use after frontend-design prototype is approved. Commands: /init [stack], /extract [html], /component [name], /audit.
triggers: react, vue, svelte, next.js, nextjs, produção, production, component library, frontend dev, implementar, implementação, tailwind, bootstrap, shadcn, radix, componentes react, frontend escalável, design system react, converter protótipo, passar para react, app react, projeto react, implementar design, typescript frontend, vite, create react app, codificar protótipo
---

# Frontend Dev

Pegas num protótipo HTML (ou DESIGN.md) e implementas em produção. Código limpo, escalável, acessível, e performante.

**Input esperado:**
- `DESIGN.md` (obrigatório — se não existir, correr `brand-guidelines` skill)
- HTML prototype de `frontend-design` (opcional mas recomendado)
- Stack preference (React/Vue/Svelte/Next.js)

**Não é esta skill:**
- Prototipagem visual → `frontend-design`
- Backend, APIs, bases de dados → `laravel-specialist`, `api-designer`
- Animações complexas standalone → `anima`

---

## /init [stack] — Setup do projecto

Criar projecto base com stack escolhida:

### React + Vite
```bash
npm create vite@latest my-project -- --template react-ts
cd my-project && npm install
npm install -D tailwindcss @tailwindcss/vite
npm install @radix-ui/themes lucide-react clsx
```

### Next.js (SSR/SSG)
```bash
npx create-next-app@latest my-project --typescript --tailwind --app
cd my-project
npm install @radix-ui/themes lucide-react clsx
```

### Vue + Vite
```bash
npm create vite@latest my-project -- --template vue-ts
cd my-project && npm install
npm install -D tailwindcss @tailwindcss/vite
npm install @headlessui/vue lucide-vue-next
```

### Svelte + Vite
```bash
npm create svelte@latest my-project
cd my-project && npm install
npm install -D tailwindcss
```

### Component Libraries (opcionais)

| Library | Stack | Quando usar |
|---------|-------|-------------|
| **shadcn/ui** | React/Next.js | Componentes altamente customizáveis, design system próprio |
| **Radix UI** | React | Primitivos acessíveis, headless |
| **Headless UI** | React/Vue | Headless, acessível, sem estilos |
| **Mantine** | React | UI pronto, personalizável |
| **DaisyUI** | Tailwind | Tailwind components rápidos |
| **Bootstrap 5** | Qualquer | Quando cliente já usa ou pede Bootstrap |

---

## /extract [html-file] — Extrair design tokens do prototype

Ler o HTML/CSS prototype do `frontend-design` e extrair:

1. **CSS variables** → Tailwind config ou `globals.css`
2. **Componentes identificados** → lista para implementar
3. **Breakpoints** → Tailwind breakpoint config
4. **Fontes** → `next/font` ou import directo

```bash
# Extrair CSS custom properties do HTML
grep -oE '--[a-z-]+:\s*[^;]+' prototype.html | sort | uniq
```

**Output de `/extract`:**
```typescript
// tailwind.config.ts — tokens extraídos
export default {
  theme: {
    extend: {
      colors: {
        primary: 'oklch(0.6 0.15 250)',
        // ... outras cores do DESIGN.md
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      spacing: {
        // escala de 4px do DESIGN.md
      }
    }
  }
}
```

---

## /component [name] — Criar componente

Workflow para cada componente:

### 1. Identificar props e estados

```typescript
// Sempre começar com TypeScript interface
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### 2. Implementar com acessibilidade

```tsx
// Button com todos os estados
function Button({ variant, size, disabled, loading, onClick, children }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }))}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Spinner className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
```

### 3. Variantes com `cva` (class-variance-authority)

```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  // base classes
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
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
```

---

## /audit — Auditoria de qualidade

Correr antes de entregar. Verificar:

### Acessibilidade (WCAG 2.1 AA)
```bash
# Via axe-playwright
npm install --save-dev @axe-core/playwright
# Ou via CLI
npx axe http://localhost:5173 --reporter cli
```

Verificar manualmente:
- [ ] Contraste texto/fundo ≥4.5:1 (normal) / ≥3:1 (large text)
- [ ] Focus visible em todos os elementos interactivos
- [ ] Alt text em imagens significativas
- [ ] Aria-labels em ícones sem texto
- [ ] Form labels (não só placeholder)
- [ ] Keyboard navigation sem ratos
- [ ] prefers-reduced-motion respeitado

### Performance (Core Web Vitals)
```bash
npx lighthouse http://localhost:5173 --view
```

Regras:
- [ ] Imagens: WebP/AVIF, `loading="lazy"` abaixo do fold, `width`/`height` definidos
- [ ] Fonts: `font-display: swap`, preload apenas críticas
- [ ] Code splitting: lazy load rotas com `React.lazy()` / dynamic imports
- [ ] Bundle size: verificar com `npm run build -- --report` ou `vite-bundle-visualizer`

### Responsive
- [ ] Mobile 375px funciona
- [ ] Tablet 768px funciona
- [ ] Desktop 1280px funciona
- [ ] Sem horizontal scroll
- [ ] Touch targets ≥44px

---

## Arquitectura de ficheiros

### React + Vite (padrão)
```
src/
├── components/
│   ├── ui/               ← Componentes base (Button, Input, Card, ...)
│   ├── layout/           ← Layout components (Header, Footer, Sidebar)
│   └── sections/         ← Page sections (Hero, Features, Pricing)
├── hooks/                ← Custom hooks
├── lib/
│   ├── utils.ts          ← cn(), formatters, helpers
│   └── constants.ts
├── styles/
│   └── globals.css       ← CSS variables (design tokens do DESIGN.md)
├── types/                ← TypeScript interfaces
└── pages/                ← Page components (Vite) ou app/ (Next.js)
```

### Design tokens → CSS globals

```css
/* globals.css — extraído do DESIGN.md */
:root {
  --color-primary: oklch(0.6 0.15 250);
  --color-secondary: oklch(0.7 0.08 250);
  --color-surface: oklch(0.98 0.01 250);
  --color-text: oklch(0.15 0.02 250);
  --color-text-muted: oklch(0.5 0.02 250);

  --font-display: 'Playfair Display', serif;
  --font-body: 'Inter', sans-serif;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms; --duration-base: 250ms;
}
```

---

## Integração GSAP/Lottie em React

### GSAP com useGSAP (sem memory leaks)
```tsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function Hero() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(".hero-title", {
      y: 40, opacity: 0, duration: 0.7, ease: "expo.out"
    });
    gsap.from(".hero-body", {
      y: 30, opacity: 0, duration: 0.5, ease: "expo.out", delay: 0.2
    });
  }, { scope: container });

  return (
    <div ref={container}>
      <h1 className="hero-title">...</h1>
      <p className="hero-body">...</p>
    </div>
  );
}
```

### Lottie em React
```tsx
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

function SuccessIcon() {
  return (
    <DotLottieReact
      src="/animations/success.lottie"
      autoplay
      loop={false}
      style={{ width: 80, height: 80 }}
    />
  );
}
```

---

## Tailwind vs Bootstrap — quando usar

### Tailwind CSS
```bash
npm install -D tailwindcss @tailwindcss/vite
```
**Usar quando:**
- Projecto novo sem constraints de estilo
- Design customizado (não standard Bootstrap look)
- Team confortável com utility classes
- Design system próprio

### Bootstrap 5
```bash
npm install bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';
```
**Usar quando:**
- Cliente pede explicitamente Bootstrap
- Projecto existente já usa Bootstrap
- Necessidade de componentes prontos rápidos (admin panels, dashboards internos)
- Team mais confortável com classes semânticas (`.btn`, `.card`, etc.)

---

## Anti-patterns (nunca fazer)

```tsx
// ❌ Styles inline para estilos repetidos
<div style={{ color: 'red', fontSize: '16px' }} />

// ✅ Tailwind ou CSS class
<div className="text-red-500 text-base" />

// ❌ CSS variables em hardcode
const color = '#FF0000';

// ✅ Design tokens
const color = 'var(--color-primary)';

// ❌ Componentes monolíticos
function Page() { /* 500 linhas */ }

// ✅ Composição
function Page() {
  return <Layout><Hero /><Features /><Pricing /></Layout>;
}

// ❌ any em TypeScript
function Button({ onClick }: { onClick: any }) {}

// ✅ Type correcto
function Button({ onClick }: { onClick: () => void }) {}
```

---

## Checklist de entrega

- [ ] TypeScript sem erros (`npm run type-check`)
- [ ] Build sem erros (`npm run build`)
- [ ] Lighthouse score ≥90 performance, ≥90 accessibility
- [ ] Mobile 375px testado
- [ ] Todos os componentes têm props tipadas
- [ ] CSS variables do DESIGN.md aplicadas
- [ ] Sem `any` em TypeScript (excepto casos justificados)
- [ ] `alt` em todas as imagens
- [ ] Focus visible em todos os interactivos

---

## Quality Gate — Agentes

Após implementação completa, correr **em paralelo** antes de considerar a feature done:

```
Agent(subagent_type="tester-ui-ux", prompt="Test this production frontend for UI/UX regressions and accessibility. URL: [local dev URL or path]. UI/UX: component behaviour, responsive breakpoints (375/768/1280px), interactive states (hover/focus/loading/error/empty), navigation flows. Accessibility (WCAG 2.1 AA): contrast ratios, keyboard-only navigation, screen reader semantics (headings, landmarks, ARIA), form validation announcements, focus management on modals/drawers. Report: Critical / High / Medium.")

Agent(subagent_type="tester-performance", prompt="Run Lighthouse performance audit. URL: [local dev URL]. Target: ≥90 performance score, LCP < 2.5s, CLS < 0.1, INP < 200ms. Also check bundle size for JS files > 100kb. Report: Critical/Warning/Good with specific fixes.")
```

**Após feedback:**
- Performance < 90 ou CLS > 0.1: corrigir antes de PR
- Accessibility Critical: bloqueia entrega
- UI/UX Critical: resolver com utilizador (pode ser scope creep vs. bug)
- Correr `tester-performance` separadamente se só performance mudou
