---
name: frontend
description: "Building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks. MUST be invoked when the user says: website, landing page, site, webapp, web app, frontend, interface, react. SHOULD also invoke when: next.js, nextjs, protótipo, prototype, ui, ux. Also answers to the legacy name 'frontend-design' — the skills are flat in .claude/skills/, there is no skills/design/ tree."
triggers: frontend-design, frontend design, website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, protótipo, prototype, ui, ux, design web, fazer site, criar página, homepage, componentes, components, design de interface, design de website, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, painel, formulário, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, converter design, implementar design, codificar, página web, redesign, redesenhar, novo site, design system, component library, dark mode, light mode, tema, theme, board game, card game, game UI, deckbuilder, tile grid, engineStore, uiStore, game state react, jogo grelha, jogo cartas react
chain: design-review, tester-ui-ux
---
# Frontend — Design Director + Router

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

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
| **Design contract** (tokens, component specs, brand) | `design-system` (tokens + component specs) · brand → `brand-guidelines` | `Read(".claude/skills/design-system.md")` |
| **React perf/correctness** (re-renders, effects, data-fetching, RSC, bundle) | `react-patterns` | `Read(".claude/skills/react-patterns.md")` |
| **Component API shape** (compound, context, slots, React 19 ref, kill boolean soup) | `react-composition` | `Read(".claude/skills/react-composition.md")` |
| **Styling** (Tailwind 4, cva, cn, dark mode, responsive) | `tailwind` | `Read(".claude/skills/tailwind.md")` |
| **shadcn/ui project** (has `components.json`, Radix+Tailwind copy-paste components) | `shadcn` | `Read(".claude/skills/shadcn.md")` |
| **Email templates** (React Email, client-safe HTML) | `transactional-email` | `Read(".claude/skills/transactional-email.md")` |
| **Motion** (GSAP scroll/hero/hover, Lottie icons) | `anima` | `Read(".claude/skills/anima.md")` |
| **CSS nativo moderno** (scroll-driven, container queries, `:has()`, `color-mix`, `content-visibility`) | modern-css reference | `Read(".claude/reference/frontend/modern-css.md")` |
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

## #0b Consigo ver este ecrã? (pré-condição bloqueante)

Redesenho ou correcção de um ecrã que **já existe** → antes da 1.ª linha de UI, abrir o ecrã **a correr** (screenshot + medição). Atrás de login, a 1.ª tarefa é resolver o acesso: o utilizador entra e passa a sessão ao gate (`--estado`/`--login`), ou trabalha-se num sítio sem auth (showcase, mockup servido localmente). O Chrome MCP **não herda** a sessão do browser do utilizador (redirige para `/login`). Sem via nenhuma → pedir uma captura antes de escrever. Um dia de UI feito às cegas atrás de login foi rejeitado três vezes e apagado (22 commits). Detalhe: `.claude/reference/gates-runtime.md` §Pré-condição de UI.

---

## #0c Redesenho — preservar ou refazer (decidir primeiro)

Redesenho de um site/ecrã que existe → **antes de qualquer proposta**, fixar o modo:
- **Preservar** — modernizar sem partir a marca: auditar primeiro (tokens, menu, conteúdo, SEO), evoluir por camadas (tipografia → espaçamento → cor → movimento → recompor blocos).
- **Refazer** — linguagem visual nova sobre o conteúdo e a arquitectura que existem.
- Ambíguo → **uma** pergunta: «preservar a marca actual ou recomeçar do zero no visual?»

**Nunca muda sem pedido explícito** (em nenhum dos dois modos):
- URLs e slugs das rotas (a migração de SEO é o risco nº 1 de um redesenho)
- rótulos do menu principal
- nomes e ordem dos campos de formulário (partem analytics e autofill)
- logótipo / wordmark
- textos legais, de consentimento e de cookies

(Adaptado de Leonxlnx/taste-skill §11, MIT.)

---

## #1 DESIGN.md + Brand Assets

### DESIGN.md
If present in project -- **read before any code.** Extract `--color-*` tokens, typography, logo paths. Apply in CSS `:root {}`.

If absent and brand exists -- suggest `brand-guidelines` skill first (via `design-system`).

Brand Asset Protocol (prioridade de assets reais + protocolo de recolha) → `Read(".claude/reference/frontend/design-craft.md")`.

**Logótipo/ícone fornecido: medir a luminância contra o fundo onde vai, antes de o colocar.** Um PNG
transparente branco puro (255/255) ficou invisível sobre o fundo claro da própria marca — 3 agentes
tropeçaram nele sem nenhum brief o pedir (2026-09-03). Pillow: média de luminância dos píxeis com
alfa > 0 vs luminância do token de fundo; contraste < 3:1 → variante escura do logo ou outro fundo.

**Logótipo não se recompõe — nunca.** Sem o ficheiro oficial (SVG/PNG do dono da marca), não se aproxima
um logótipo com tipografia + CSS a partir de uma imagem de referência, nem se recorta uma versão existente
(horizontal com `overflow-hidden`) para fabricar outra (símbolo, vertical) — aconteceu a 2026-09-17, passou
`tsc` e as sondas, e o ficheiro oficial estava na pasta de marca do cliente. A forma, o espaçamento e o
desenho das letras não sobrevivem à aproximação, e o resultado passa em revisão porque «parece».
Asset de marca em falta → procurar a fonte oficial (pasta de marca do cliente, `DESIGN.md` §Assets); não
aparecendo, escrever `TODO: asset oficial em falta` e **pedir o ficheiro** — parar e reportar, nunca aproximar.
Mesma regra dos design tokens: sem token medido ou documentado não se inventa um valor plausível.

---

## #2 Junior Designer Mode

Show reasoning before executing. Always.

1. Write assumptions + reasoning + placeholders first
2. Show early -- grey blocks with labels OK
3. Checkpoint at ~50%: "Did X. Next: Y. Confirm?"
4. Polish only after confirmation

Wrong direction in placeholder = 5 min fix. In full implementation = 2h refactor.

**Queixa de design → uma variável de cada vez.** «Os textos estão grandes» nomeia **um** sintoma: mexe-se em **uma** variável (densidade · tamanho · contraste · raio · saturação), mostra-se o resultado, e só depois a seguinte. Antes de mexer, confirmar que o que ele vê não é estado dele (barra colapsada por escolha) nem dados de demonstração. Regra completa: `design-review` §Queixa de design.

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

**Ban nomeado — barra de acento à esquerda, em qualquer forma.** Barra colorida de 2-4px à esquerda de um card / callout / bolha de mensagem = tell de AI slop. Usar **fundo tingido** (a mesma cor a baixa opacidade) em vez da barra. Regra global, já reincidente em vários projectos (cards, bolhas de chat) — aplicar na escrita, não esperar pelo review. **As formas disfarçadas contam como a mesma barra:** `box-shadow: inset Npx 0 0 <cor>` (voltou assim num painel de administração, 2026-09-05), `::before`/`::after` fino colado à esquerda, `border-l-*` do Tailwind. Verificar por estilo computado (`gate-runtime.mjs --medir barra`), ou pelo menos `grep -nE 'border-l-(\[|[0-9])|border-left|inset [0-9.]+px 0 0'` — o padrão `border-l` sozinho dá falso positivo em tokens como `border-line`.

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


## #5b Formulário com honeypot anti-spam

Campo anti-spam escondido com nome que o **preenchimento automático do browser** reconhece (`website`, `url`,
`email2`, `phone2`, `company`) é preenchido por ele — e a submissão de uma pessoa real é descartada em
silêncio, com resposta de sucesso (2026-09-18: um contacto real perdido assim).

- **Nome neutro**, sem palavra que o autofill reconheça: `contact_ref`, `xf9`. O nome é a defesa principal.
- **`autocomplete="off"` no campo** — além do nome neutro, não em vez dele.
- **Esconder só por `display:none` não impede o preenchimento automático** (nem do browser, nem dos gestores
  de palavras-passe): juntar `data-1p-ignore data-lpignore="true" data-bwignore`.
- `tabindex="-1"` (fora da ordem de teclado) e `aria-hidden="true"` (não anunciado a leitores de ecrã).

```html
<div style="display:none" aria-hidden="true">
  <input type="text" name="contact_ref" tabindex="-1" autocomplete="off"
         data-1p-ignore data-lpignore="true" data-bwignore>
</div>
```

Verificar: carregar o formulário com o preenchimento automático do browser activo e ler o valor do campo —
tem de ficar vazio. A metade do servidor (validar, descartar e **registar cada descarte**) →
`Read(".claude/skills/laravel-specialist.md")`.

---

## #11 Verificação (antes de dizer "feito")

**Provar antes de editar (fixes de CSS/layout).** Não editar o ficheiro-fonte à primeira: reproduzir a página no viewport do problema (ex.: 390×844), medir com `getBoundingClientRect()` / `getComputedStyle()`, **injectar o fix candidato** (`page.addStyleTag`), re-medir, e só depois escrever no ficheiro. Poupa um ciclo editar→deploy→ver e produz números concretos (`left`/`right` vs largura do viewport, rácio de contraste medido em vez de estimado).

**Gate de paridade de conteúdo** quando a tarefa é "reconstruir / reestilizar preservando o conteúdo": comparar contra o ficheiro-fonte, a cada build, (a) a contagem de palavras visíveis e (b) o conjunto de `src` de imagens. O QA de layout (sangramento, contraste, alvos de toque) dá tudo verde e não vê conteúdo em falta — num caso real desapareceram 9 descrições e 7 imagens sem nenhum alarme.

**Nome acessível de controlos headless mede-se, não se infere.** Radix/shadcn/Headless UI Checkbox, Switch e Radio rendem `<button>`; `<button>` é elemento rotulável (WHATWG «labelable elements», verificado 2026-09-15), logo um `<label for>` cujo `for` casa o `id` **dá-lhe nome**. Falha quando o `id` não chega ao `<button>` (fica num wrapper ou num `<input>` escondido) ou o label está vazio. Verificar pelo **nome acessível computado na árvore de acessibilidade**; "existe um `<label for>` no DOM" não é evidência e `tsc`+`eslint`+`build` passam à mesma. Regra completa + teste: `Read(".claude/skills/shadcn.md")` → "Accessible names on `<button>`-rendering controls".

**Proibido corrigir um componente partilhado a partir da página com seletores arbitrários sobre os filhos dele** (`[&_.classe]`, `[&_button]` e afins no Tailwind). Forçam classes internas de outro componente: passam `tsc` e a medição, mas é acoplamento frágil que parte no próximo refactor do componente — um agente fez isto e só o caller o apanhou ao ler o relatório (projecto de cliente, 2026-09-16). O fix vai **no próprio componente** (prop/variante nova). O verificador corre `grep -n "\[&_" <ficheiros tocados>` e cada hit tem de ser justificado.

**Ligar uma funcionalidade → reler a copy à volta dela.** O texto foi escrito quando a funcionalidade não
existia e pode passar a prometer o que o sistema não faz: um rodapé com «uma mensagem por semana com o
que mudou de preço» virou contrapartida de recolher email ao ligar a subscrição — e nada envia essa
mensagem (2026-09-08). Pergunta de verificação: *«isto que o site promete, alguém cumpre?»*

**Depois de correcções de frontend em lote**, o passo seguinte por omissão é verificação em **browser real** (Playwright headless: screenshot de cada página + consola limpa). `node --check`, HTML bem aninhado e chavetas CSS equilibradas passam a 100% num site que pode estar inerte ao toque. O relatório declara sempre o que **não** foi verificado.

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
