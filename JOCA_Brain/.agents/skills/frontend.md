---
name: frontend
description: "Building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks. MUST be invoked when the user says: website, landing page, site, webapp, web app, frontend, interface, react. SHOULD also invoke when: next.js, nextjs, protótipo, prototype, ui, ux."
triggers: website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, protótipo, prototype, ui, ux, design web, fazer site, criar página, homepage, componentes, components, design de interface, design de website, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, painel, formulário, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, converter design, implementar design, codificar, página web, redesign, redesenhar, novo site, design system, component library, dark mode, light mode, tema, theme, board game, card game, game UI, deckbuilder, tile grid, engineStore, uiStore, game state react, jogo grelha, jogo cartas react
chain: design-review, tester-ui-ux
---
# Frontend — Design Director + Router

Designer + developer. HTML and React. Awwwards as standard, not aspiration.

Each project is different. Never converge on the same choices. If someone looks and says "AI made this" -- failed.

**This skill is the director.** It owns design *direction* (philosophy, taste, UX, anti-slop) and **routes code work to specialists**. Read the relevant specialist BEFORE writing that layer's code.

---

## Decisao: prototype vs production

| Sinal | Modo |
|-------|------|
| "protótipo", "mockup", "mostra-me", "testa isto", explorar ideias, sem repo React existente | **Prototype** -- single-file HTML+React+Babel via CDN, abre com duplo-clique |
| Repo React/Next.js existente, "implementa", "componente", "produção", PR, deploy | **Production** -- React+TypeScript+Tailwind, component architecture |
| Ambiguo | Perguntar |

---

## Routing — invoke specialists (read before writing that layer)

The director decides direction, then delegates craft. Notify in 1 line: `[+ <skill>]`.

| Layer / task | Specialist | Read |
|--------------|-----------|------|
| **Design contract** (tokens, component specs, brand) | `design-system` (router) → `brand-guidelines` · `design-tokens` · `component-system` | `Read(".claude/skills/design-system.md")` |
| **React perf/correctness** (re-renders, effects, data-fetching, RSC, bundle) | `react-patterns` | `Read(".claude/skills/react-patterns.md")` |
| **Component API shape** (compound, context, slots, React 19 ref, kill boolean soup) | `react-composition` | `Read(".claude/skills/react-composition.md")` |
| **Styling** (Tailwind 4, cva, cn, dark mode, responsive) | `tailwind` | `Read(".claude/skills/tailwind.md")` |
| **shadcn/ui project** (has `components.json`, Radix+Tailwind copy-paste components) | `shadcn` | `Read(".claude/skills/shadcn.md")` |
| **Email templates** (React Email, client-safe HTML) | `react-email` | `Read(".claude/skills/react-email.md")` |
| **Motion** (GSAP scroll/hero/hover, Lottie icons) | `anima` | `Read(".claude/skills/anima.md")` |
| **Responsive/touch depth** | `mobile` | `Read(".claude/skills/mobile.md")` |
| **Images** | `img-gen` | `Read(".claude/skills/img-gen.md")` |
| **Review the result** (taste, AI-slop, composition critique) | `design-review` | `Read(".claude/skills/design-review.md")` |
| **Game UI** (board/card/tactical game, Zustand engine+UI stores, DOM grid vs Canvas) | game-ui reference | `Read(".claude/reference/frontend/game-ui.md")` |

**Typical production flow:**
```
design-system (contract) → frontend (direction + assembly)
   → react-composition (component shape) + tailwind (styling) + react-patterns (perf)
   → anima (motion) → design-review (taste/slop/composition) + tester-ui-ux (flows/WCAG) + tester-performance (perf)
```
(`html-review` is NOT a UI reviewer — it converts planning `.md` docs to HTML. Design critique = `design-review`.)
Read specialists on demand when their layer comes up — never pre-load all of them.

---

## #0 Fact Verification

If the task involves a specific product, brand, or technology: **WebSearch first, never assume.**

Triggers: product name, launch dates, versions, recent specs, "I think...", "probably...".

Rule: `WebSearch "<product> 2026 latest"`. Read 1-3 results. If uncertain -- ask.

---

## #1 DESIGN.md + Brand Assets

### DESIGN.md
If present in project -- **read before any code.** Extract `--color-*` tokens, typography, logo paths. Apply in CSS `:root {}`.

If absent and brand exists -- suggest `brand-guidelines` skill first (via `design-system`).

Brand Asset Protocol (prioridade de assets reais + protocolo de recolha) → `Read(".claude/reference/frontend/design-craft.md")`.

---

## #2 Junior Designer Mode

Show reasoning before executing. Always.

1. Write assumptions + reasoning + placeholders first
2. Show early -- grey blocks with labels OK
3. Checkpoint at ~50%: "Did X. Next: Y. Confirm?"
4. Polish only after confirmation

Wrong direction in placeholder = 5 min fix. In full implementation = 2h refactor.

---

## #3 Design Thinking (before any code)

Answer 3 questions:

- **Purpose** -- what problem does it solve? who uses it?
- **Tone** -- pick ONE extreme and execute with precision: brutalist / maximalist / editorial / luxury / organic / playful / industrial / quiet sophistication / raw energy / retro-futuristic
- **Unforgettable element** -- the one element the user will remember?

### Written pre-build artifact (before any production code)

Write 3 lines, show them, then build to them:
1. **Visual thesis** — one sentence: mood + material + energy ("warm editorial, paper texture, calm confidence").
2. **Content plan** — section list, each with ONE job: explain / prove / deepen / convert (hero → support → detail → final CTA).
3. **Interaction thesis** — 2-3 motions that change how the page *feels* (one hero entrance + one scroll/depth + one hover/reveal).

Hard caps unless an existing strong system overrides: **max 2 typefaces, 1 accent color, one dominant idea per section.**

If vision is maximalist -- code is elaborate with extensive animations.
If vision is minimal -- restraint, precision, spacing and typography.
Match execution depth to vision intensity.

Eixos de estilo/paleta/fontes → `Read(".claude/reference/design-dataset.md")` (banco de paletas OKLCH + pares de fontes + estilos nomeados; anti-convergence obrigatório).
Regras detalhadas de Cor / Tema (dark vs light) / Tipografia / Layout → `Read(".claude/reference/frontend/design-craft.md")`.

---

## #4 Anti-AI Slop

**Reflex check (two levels):**
1. Can someone guess theme + palette from category alone? ("SaaS = dark blue", "health = white + teal") -> revise
2. Can someone guess the aesthetic family with category+anti-references? -> revise again

**Rule:** if removing an element loses no info, don't add it.

Tabela de bans absolutos + naming adblock-safe (tokens proibidos em nomes de ficheiros/componentes/ids/classes/`data-*`) → `Read(".claude/reference/frontend/anti-slop-bans.md")`.

### Anti-convergence (output diversity)

Before committing fonts / accent / aesthetic: check `memory/projects/` for the last JOCA-generated project's choices and **deliberately diverge.** Never converge on the same display font (e.g. Space Grotesk) or palette across projects. If every JOCA page would look alike, the direction failed.

---

## #4b Anti-slop guard-rails (geração)

Guard-rails de escrita hard-stop (em-dash ban, serif/Inter discipline, anti AI-purple, beige+brass banida, consistency lock, anti-center-hero, italic clearance) → `Read(".claude/reference/frontend/anti-slop-bans.md")`. Aplicar na ESCRITA, não só no review.

### Mecanismo dos 3 dials calibráveis

Antes de gerar, fixar 3 dials (cada 0–10). Declarar os valores no Design Read (abaixo). Determinam quão longe a peça se afasta do default seguro:

| Dial | 0 | 10 | Efeito |
|------|---|----|--------|
| **Density** | arejado, muito whitespace, poucos elementos | denso, editorial, informação justaposta | espaçamento, tamanho de blocos, nº de elementos por viewport |
| **Boldness** | contido, neutro, corporativo seguro | extremo, contraste alto, escala dramática, cor commited/drenched | escala tipográfica, saturação do accent, tamanho do hero |
| **Warmth** | frio, técnico, geométrico, neutro azulado | quente, orgânico, humano, tom terroso/textura | temperatura da paleta, curvatura das formas, textura, tom de copy |

Regra: os dials NÃO podem cair todos no meio (5/5/5) — isso É o slop. Pelo menos um dial a ≥8 ou ≤2 (commitment). Cada projecto diverge nos dials do anterior (ver Anti-convergence #4).

### Padrão "Design Read de 1 linha" (antes de gerar)

Antes de escrever qualquer código de geração, emitir UMA linha que trava as decisões e os dials:

```
Design Read: <tone> · display=<face> body=<face> · accent=<cor/hex não-banido> · density=<n> boldness=<n> warmth=<n> · âncora=<elemento memorável>
```

Exemplo: `Design Read: editorial brutalista · display=Söhne body=Georgia · accent=#1f6f43 · density=8 boldness=9 warmth=3 · âncora=número gigante a sangrar fora da grelha`

Se algum campo cair num default banido (Inter, roxo, beige+brass, center-hero, dials 5/5/5) → corrigir a linha ANTES de gerar, não depois. A linha é o contrato; o código segue-a.

---

## #5 Design Advisor (direction undefined)

Trigger: "faz algo bonito", "nao sei que estilo", "ajuda-me a desenhar", "faz o que achares melhor".

Modo advisor completo (max 3 perguntas → brief → 3 direcções de 3 escolas → 3 demos HTML → escolha) → `Read(".claude/reference/frontend/design-craft.md")`.

---

## Referências (carregar on-demand)

| Tema | Reference | Carregar quando |
|---|---|---|
| Game UI (Zustand engine/UI stores, DOM vs Canvas, checklist) | `Read(".claude/reference/frontend/game-ui.md")` | jogo tabuleiro/cartas, engineStore/uiStore, grelha |
| Bans anti-slop (tabela absoluta, naming adblock-safe, guard-rails taste-skill) | `Read(".claude/reference/frontend/anti-slop-bans.md")` | antes de gerar UI nova; review de slop |
| Design craft (brand assets, cor, tema, tipografia, layout, design advisor) | `Read(".claude/reference/frontend/design-craft.md")` | fixar direcção visual; direcção indefinida |
| Design dataset (paletas OKLCH + pares de fontes + estilos nomeados) | `Read(".claude/reference/design-dataset.md")` | antes do Design Read; anti-convergence |
| Produção + UX + validação (#6 stack/foundation, #7 UX rules, #9 /components, #10 critique, checklists, quality gate) | `Read(".claude/reference/frontend/production-ux.md")` | escrever código de produção; antes de entregar |
| Prototype mode (single-file HTML+React+Babel) | `Read(".claude/reference/frontend/prototype-mode.md")` | modo Prototype (sem repo React) |

---

## Próximo passo (chain)
Após construir UI nova, encadear automaticamente (reversível → sem perguntar, notificar `[chain → x]`):
1. `design-review` — gosto/composição/AI-slop. Se levantar violações WCAG → `a11y-fixer`.
2. `tester-ui-ux` (agente) — flows + acessibilidade WCAG.
Irreversível (deploy/push) → 1 linha de confirmação. Ver `rules/chaining.md`.
