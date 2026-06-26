---
name: design-review
description: "Opinionated UI/design critique — judges taste, composition, and AI-slop on real code/live UI, or reviews a design plan BEFORE code. MUST be invoked when the user says: design review, review design, is this good, critique UI, score this UI, AI slop, does this look AI-generated, review my page, design feedback. SHOULD also invoke when: plan design review, review the plan UX, frontend review, before merge UI, design QA."
triggers: design review, review design, is this good, critique UI, score this UI, AI slop, looks AI-generated, review my page, design feedback, plan design review, review the plan UX, frontend review, before merge UI, design QA, evaluate UI, rate this design, design critique, redesign feedback
chain: a11y-fixer, tester-ui-ux
---
# Design Review — Opinionated UI Critique

The taste/composition/AI-slop layer the rest of the cluster lacks. `tester-ui-ux` (agent) owns QA flows + deep WCAG; `design-system-audit` (agent) owns token drift; **this skill owns aesthetic judgment** — is it good, does it look AI-generated, does the composition work.

Routed by `frontend` (#Quality Gate) and `/review-design`. Not a generator — it judges. Default to skeptical: **"guilty until proven innocent" — assume every element is visual noise until it earns its place.**

---

## Mode select

| Target | Mode |
|--------|------|
| Live URL, `.tsx`/`.html`/component, deployed page | **Live/Code Review** (§1) |
| Design plan, PRD, spec, `.md` describing UI not yet built | **Plan Review** (§2) — shift-left |

First, **classify the surface** (rules differ — don't misapply):

| Surface | Rule set |
|---------|----------|
| Marketing / landing | Hero impact, brand-first, narrative, conversion. Cardless. |
| App / product UI | Density, task-completion, action hierarchy, scannability. No hero unless asked. |
| Hybrid | Landing rules on hero sections, app rules on functional sections. |

---

## §1 Live / Code Review

### Three-pillar rubric (traffic-light)

Output a table. 🟢 good · 🟡 needs work · ⬛ blocking.

| Pillar | Status | Notes |
|--------|--------|-------|
| **Frictionless insight→action** | | Task in ≤3 interactions · 1 clear primary action per view · no buried/competing actions · no dead ends |
| **Quality is craft** | | Spacing rhythm · alignment · typography pairing · intentional motion · responsive · pixel detail |
| **Trustworthy** | | Errors actionable (say the fix) · loading/empty/error states real · AI-generated content disclosed · no dark patterns |

Red flags per pillar:
- **Frictionless:** excessive clicks, 2+ competing primary buttons, buried CTA, dead-end screens.
- **Craft:** uniform padding everywhere, misalignment, default fonts, motion that fights hierarchy, broken at 375px.
- **Trustworthy:** "Something went wrong" with no next step, fake/empty states unhandled, undisclosed AI content.

### AI-slop reject checklist (instant flags)

Reuse `frontend` #4 ban table + these named tells (Garry Tan / OpenAI GPT-5.4 list):

```
⬛ purple/indigo gradients (esp. on white)        ⬛ 3-col icon-in-circle feature grid (THE AI tell)
⬛ icons in colored circles                       ⬛ centered-everything layout
⬛ uniform bubbly border-radius                   ⬛ decorative blobs / wavy SVG dividers
⬛ emoji as design elements                       ⬛ colored left-border accent on cards
⬛ generic hero copy ("Unlock the power of…")     ⬛ cookie-cutter rhythm (hero→3 features→testimonials→pricing→CTA)
⬛ system-ui / Inter / Roboto / Arial / Space Grotesk as PRIMARY display font
```

### Anti-slop hard-rules (auditoria) — adoptado de taste-skill (MIT)

Checklist binário. Cada item = ⬛ blocking se violado. Scan code/live UI, emite `path:line — regra`. (Origem: Leonxlnx/taste-skill, MIT — atribuir.)

- **Em-dash ban** — zero `—` (em-dash) e zero `–` (en-dash) em copy visível. É o tell #1 de texto gerado por LLM. Usar vírgula, parêntesis, ou dois pontos. Detectar literal `—`/`–` em strings/JSX/markdown de UI.
- **Serif / Inter discipline** — `Inter` (e `system-ui`/`Roboto`/`Arial`/`Space Grotesk`) PROIBIDO como display/heading. Permitido só como body fallback. Display precisa de carácter — serif editorial, grotesque distintivo, ou face com personalidade. `font-family` de heading com Inter como primeiro nome → ⬛.
- **Anti AI-purple/lila** — qualquer roxo/índigo/violeta como accent ou em gradiente é reject. Banir hue range ~`250–290` em HSL/OKLCH para accent/CTA/gradiente. Inclui `#6366f1` (indigo-500), `#7c3aed` (violet-600), `#8b5cf6` (violet-500), `#a855f7` (purple-500), `#818cf8`. Gradiente roxo→rosa em fundo branco = tell clássico.
- **Paleta premium beige+brass banida** — a "luxury default" gerada por LLM (bege quente + dourado/latão) é tão slop como o roxo. Banir como par dominante: bege `#f5f0e8` / `#ede4d3` / `#e8dcc4` + brass/gold `#b8860b` / `#c9a227` / `#bfa46f` / `#d4af37`. Um pode existir como neutro; o PAR como identidade = ⬛. Forçar divergência de paleta deliberada.
- **Color/shape consistency lock** — uma única decisão de cor e uma única linguagem de forma em toda a peça. Flag se: >1 accent compete; border-radius inconsistente entre componentes do mesmo nível (cards a `4px` e botões a `16px` sem razão); mistura de estilos de sombra/borda ad-hoc. A peça tem de parecer um sistema, não um sampler.
- **Anti-center-hero** — hero com tudo centrado (texto + CTA + imagem no eixo vertical) é layout default de LLM. Exigir tensão: assimetria, alinhamento à esquerda, overlap, grid-break. Center-everything no primeiro viewport → ⬛ (excepto se a marca pedir explicitamente simetria formal).
- **Italic descender clearance** — texto em itálico precisa de folga para os descenders (`g`, `j`, `p`, `q`, `y`) e para a inclinação do glifo final. Flag itálico com `overflow: hidden`, `line-height` apertado que corta descenders, ou itálico colado à margem direita/borda do container (a inclinação corta). Dar `padding-right`/`line-height` suficiente.

### 7 hard-rejection patterns (instant fail)

1. Generic SaaS card-grid as first impression
2. Beautiful image + weak/invisible brand
3. Strong headline + no action
4. Busy imagery behind text (unreadable)
5. Sections repeating the same mood statement
6. Carousel with no narrative purpose
7. App UI made of stacked cards instead of a real layout

### 7 litmus YES/NO gate

1. Brand unmistakable in the first screen?
2. One strong visual anchor?
3. Scannable by headlines/labels alone?
4. Each section has exactly one job?
5. Are the cards actually necessary? (remove → still works?)
6. Does the motion improve hierarchy (not decorate)?
7. Still feels premium with all decorative shadows removed?

Any NO → name it + fix.

### Production lint (file:line flags — Vercel Web Interface Guidelines)

Scan code for, emit `path:line — issue`:
- **Compositor-only motion:** animate only `transform`/`opacity`; never `transition: all`; honor `prefers-reduced-motion`; interruptible; SVG transforms on a `<g>` with `transform-box: fill-box`.
- **Hydration:** controlled inputs need `value`+`onChange`; guard server/client date mismatches; `suppressHydrationWarning` only where intentional.
- **i18n:** `Intl.DateTimeFormat`/`NumberFormat` over hardcoded; detect via `Accept-Language`/`navigator.languages` not IP; `translate="no"` on brand/code tokens.
- **URL-as-state:** filters/tabs/pagination/expanded panels in query params (deep-linkable); `useState` for shareable state → consider URL sync.
- **A11y baseline:** icon-only buttons need `aria-label`; decorative icons `aria-hidden`; semantic `<button>`/`<a>` not `<div onClick>`; `:focus-visible` ring, never `outline:none` bare.
- **CLS/perf:** `<img>` explicit width/height; lazy below-fold, `priority`/`fetchpriority` above; virtualize lists >50; no layout reads (`getBoundingClientRect`) during render.
- **Typography literals:** `…` not `...`; curly quotes; `tabular-nums` for number columns; `text-wrap: balance` on headings; `min-w-0` on truncating flex children.
- **Destructive actions:** confirm modal OR undo window, never immediate.
- **Forms:** never block paste; submit stays enabled until request; inline errors + focus first error.
- **Dark mode:** `color-scheme: dark` on `<html>`; `<meta theme-color>` matches bg; native `<select>` explicit bg+color.
- **Copy lint:** active voice; Title Case headings/buttons; numerals for counts; specific button labels ("Save API Key" not "Continue"); errors include the fix.
- **Adblock-safe naming:** flag any file/component/id/class/`data-*` containing `banner`/`cookie`/`consent`/`ad`/`ads`/`sponsor`/`popup`/`analytics`/`track` — uBlock blocks the request (`ERR_BLOCKED_BY_CLIENT`) or hides the node; on the root or a layout-wide module → **white page**. Worse when on `<html>` or a component imported by the layout. Build/`tsc` miss it; verify with uBlock ON. Rename neutral (`BottomNotice`, `data-bottom-bar`).

(Deep WCAG/screen-reader/keyboard testing → hand to `tester-ui-ux` agent. Token drift → `design-system-audit` agent.)

### Scoring loop (make taste debuggable)

Per dimension, **0–10 → state why not a 10 → "a 10 would have X" → fix → re-rate.** Repeat until 10 or user says "good enough." Log initial→final delta.

### Atomic-fix loop (com prova visual — adoptado do `design-review` do gstack)

Quando o brief pede para **corrigir** (não só pontuar) numa UI viva/renderizável:
1. **Issue** — identificar 1 problema visual concreto (file:line).
2. **Screenshot ANTES** — capturar o estado actual (Playwright MCP, ou `Start-Process <url>` + pedir captura ao user se MCP ausente — ver `rules/workflows-and-tooling.md`).
3. **Fix** — editar o CSS/markup (cirúrgico, via tokens do design system — nunca hardcode inventado).
4. **Screenshot DEPOIS** — re-capturar.
5. **Comparar** — confirmar que o issue desapareceu e não partiu o layout à volta. Se piorou → reverter.
6. **Repetir** por severidade. 1 issue = 1 fix coeso (commit atómico se em repo).
Sem capacidade de render (sem Playwright/sem URL) → NÃO inventar que "está corrigido": aplicar o fix, dizer que a prova visual ficou por confirmar, e pedir confirmação ao user.

### Verdict

- **Pass** — all 🟢 or minor 🟡 only.
- **Needs work** — multiple 🟡 or one critical workflow issue.
- **Reach out to design** — any ⬛ / hard-rejection / blocking.

### Output format

```
## Design Review — <target> · surface: <marketing|app|hybrid>

[pillar table]

### AI-slop / hard-rejection: <none | list with file:line>

### Litmus: X/7 pass — <failed items>

### Lint findings (file:line)
src/Hero.tsx:42 — transition:all → list transform,opacity
…

### Findings
- ⬛ Blocking — <issue> [pillar/slop/lint]
- 🟡 Major — <issue>
- 🔵 Minor — <issue>

### Score: <n>/10  ·  Verdict: <Pass | Needs work | Reach out to design>
### Quick wins (top 3, <5 min each)
```

---

## §2 Plan Review (shift-left, before code)

Critique the design described in a PLAN/PRD/spec **before implementation** — catch gaps and write fixes back INTO the plan. Output is a better plan, not a document about the plan.

### Required artifacts (build these from the plan; flag if the plan omits them)

**Interaction-state matrix** — every feature × state, describe what the USER SEES:

| Feature | Loading | Empty | Error | Success | Partial |
|---------|---------|-------|-------|---------|---------|
| … | | | | | |

"Empty states are features" — require warmth + a primary action + context, not "No items found."

**User-journey storyboard:**

| Step | User does | User feels | Plan specifies? |
|------|-----------|-----------|-----------------|

**Unresolved-decisions table** (makes cost of ambiguity explicit):

| Decision needed | If deferred, what happens |
|-----------------|---------------------------|

### Plan-review passes (rate 0–10 each, fix-to-10)

1. Information architecture — trunk test (hide nav: still know what site / page / sections?)
2. Interaction-state coverage (matrix above complete?)
3. User journey & emotional arc (5-sec visceral / 5-min behavioral / 5-year reflective)
4. AI-slop risk (does the described design hit the blacklist?)
5. Design-system alignment (uses existing tokens/components? `design-system`)
6. Responsive & accessibility (mobile-first, 44px targets, contrast, ≥16px body)
7. Unresolved design decisions (table above — anything that'll get a lazy default?)

### Write back

Emit fixes as plan edits + P1/P2/P3 tasks (P1 blocks ship · P2 same branch · P3 follow-up), each with *surfaced-by · files · verify*. Surface blocking design decisions via `AskUserQuestion` — **one issue per question, never batch, ELI10, recommend one option.**

---

## Anti-convergence

Before approving fonts/accent/aesthetic: check `memory/projects/` for the last project's choices and confirm this one **deliberately diverges**. Prevents "every page looks the same."

## Voice (review output)

Builder to builder, not consultant. Lead with the point. Cite `file:line`/numbers. Ban filler ("delve", "robust", "comprehensive", "leverage", "seamless"). Concrete > vague.

---

## Related skills

- `frontend` — director; routes here for the Quality Gate
- `tester-ui-ux` (agent) — QA flows + deep WCAG/screen-reader/keyboard (hand off a11y depth)
- `design-system-audit` (agent) — token/component drift (hand off token checks)
- `tester-performance` (agent) — Lighthouse/load
- `anima` — motion principles referenced by the lint
- Command `/review-design` — dispatches this + the agents by target type

## Próximo passo (chain)
Após a crítica (reversível → encadear sem perguntar, `[chain → x]`):
- Se há violações de acessibilidade → `a11y-fixer` (aplica os fixes WCAG).
- Para QA de flows/WCAG completo → `tester-ui-ux` (agente).
Ver `rules/chaining.md`.
