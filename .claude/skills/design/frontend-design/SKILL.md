---
name: frontend-design
description: HTML/CSS/JavaScript website prototype designer. Junior mode, brand assets, anti-slop, ui-ux-pro-max UX rules. Builds hi-fi prototypes, landing pages, app mockups, component libraries. Integrates GSAP and Lottie animations on request. Outputs components.md + components.html on demand. Framework: ios-app-advanced, starter-components. For production React/Vue → frontend-dev skill. For slides → slides skill. For print → graphic-design skill. For video export → video skill.
triggers: website, landing page, página web, protótipo, prototype, ui mockup, html design, app mockup, frontend design, interface, página, site, componentes, components, design web, fazer site, criar página, protótipo html, wireframe, homepage, design de interface, design de website, mockup html, criar site, interface web, ui design, ux design, design de app, mobile mockup, fazer interface
---

# Frontend Design

Designer que usa HTML/CSS/JS como ferramenta. Cada projecto é diferente. Nunca convergir nas mesmas escolhas.

**Não é esta skill:**
- Produção React/Vue → `frontend-dev`
- Apresentações/slides → `slides`
- Print/print materials → `graphic-design`
- Animações standalone → `anima`

---

## #0 Fact Verification (máxima prioridade)

Se a tarefa envolve produto, marca, ou tecnologia específica: **WebSearch primeiro, nunca assumir.**

Triggers:
- Nome de produto específico (DJI Pocket 4, qualquer SDK recente)
- Datas de lançamento, versões, specs de 2024+
- "Acho que...", "deve ser...", "provavelmente..."

Regra: `WebSearch "<produto> 2026 latest"`. Ler 1-3 resultados. Escrever factos em `product-facts.md`. Se incerto → perguntar.

---

## #1 DESIGN.md Integration

Se existir `DESIGN.md` no projecto → **ler antes de qualquer código**.

```
Read("DESIGN.md")
```

Extrair: `--color-*` tokens, tipografia, logo paths, anti-references. Aplicar directamente no CSS `:root {}`.

Se não existir DESIGN.md e houver marca definida → sugerir correr `brand-guidelines` skill primeiro, ou pedir assets ao utilizador.

---

## #1b Visual Reference Disambiguation (🔴 antes de qualquer HTML)

Quando o utilizador dá uma referência visual ("faz como X", "copia o design de Y"):

**Nunca assumir** que "copia X" = replicar tudo. Quase sempre é um elemento. Perguntar primeiro:

```
Antes de começar — confirmar (máx. 2 perguntas agrupadas):
□ Qual elemento copiar? (tudo / hero / layout / cores / tipografia / secção específica)
□ Hero: full-bleed foto / split-screen / centrado minimal / outro?
□ Fundo: branco / creme/parchment / escuro / gradiente?
□ Grid de produtos (se aplicável): quantas colunas? (2/3/4)
□ CTAs: vídeo de fundo ou imagem estática?
```

Caso real (2026-05-06): "copia o Soalheiro" → 3 iterações completas porque Claude implementou tudo em vez de só o hero full-bleed pedido.

---

## #2 Brand Asset Protocol (quando marca envolvida)

Reconhecimento de marca vem de assets — não de paletas de cor.

| Asset | Reconhecimento | Quando obrigatório |
|-------|----------------|-------------------|
| **Logo** (SVG/PNG) | Máximo | Qualquer marca |
| **Imagens produto** | Máximo (produto físico) | Hardware, consumer goods |
| **Screenshots UI** | Máximo (produto digital) | Apps, SaaS |
| Cores | Médio | Suporte |
| Tipografia | Baixo | Suporte |

**Protocolo 5 passos:**
1. **Perguntar** — lista completa (logo, imagens produto, UI screenshots, cores, fontes, guidelines)
2. **Procurar** — `brand.com/press`, `/brand`, `/press-kit`; extrair SVG inline do header
3. **Download** — `curl` para logo/imagens; Python `urllib` para Wikimedia (curl falha no TLS)
4. **Verificar** — logo abre limpo; imagens ≥2000px; UI screenshots são versão actual
5. **Spec** — escrever `brand-spec.md` com todos os paths + CSS variables em `:root {}`

**Nunca:**
- CSS shapes ou SVG drawings para substituir imagens reais de produto
- Saltar o logo
- Usar filler silenciosamente — parar e perguntar

---

## #3 Junior Designer Mode

Mostrar o raciocínio antes de executar. Sempre.

1. Escrever assumptions + reasoning + placeholders no HTML primeiro
2. Mostrar ao utilizador cedo — mesmo que sejam só blocos cinzentos com etiquetas
3. Aguardar confirmação antes de construir componentes
4. Check-in a ~50% antes do polish final

**Checkpoint script:** "Fiz X. A seguir: Y. Confirmas?" — e aguardar realmente.

Por quê: direcção errada na fase de placeholder = 5 min fix. Na implementação completa = 2h de refactor.

---

## #4 Design Thinking

Antes do código, commit a uma direcção estética. Responder a 3 perguntas:

- **Propósito** — que problema resolve? quem o usa?
- **Tom** — escolher um extremo e executar com precisão: brutalist minimal / maximalist / retro-futuristic / editorial / luxury / organic / playful / industrial / quiet sophistication / raw energy
- **Elemento inesquecível** — qual é o único elemento que o utilizador vai lembrar?

**Design laws:**

### Cor
- Usar OKLCH. Reduzir chroma quando lightness se aproxima de 0 ou 100.
- Nunca `#000` ou `#fff` puros — tint para a cor de marca (chroma 0.005–0.01)
- Escolher estratégia antes das cores:
  - **Restrained** — neutrals + 1 accent ≤10% → default produto
  - **Committed** — 1 cor saturada 30-60% → identidade forte
  - **Drenched** — a superfície É a cor → heroes, campaigns

### Tema (dark vs light)
Nunca um default. Escrever 1 frase de cena física: quem usa, onde, que luz ambiente. Se a frase não força a resposta, não é concreta o suficiente.

### Tipografia
- Distinctive display + refined body. Nunca Inter/Arial/Roboto como display.
- Line length: 65-75ch para texto longo
- Hierarquia via scale + weight contrast (ratio ≥1.25 entre steps)

### Layout
- Variar spacing para ritmo. Mesmo padding em todo o lado = monotonia.
- Cards são a resposta preguiçosa. Usar só quando são genuinamente o melhor affordance.
- Assimetria, overlap, diagonal flow, grid-breaking > layouts centrados e simétricos.

### Motion
- Não animar propriedades CSS layout.
- Ease-out com curvas exponenciais (ease-out-quart/expo). Sem bounce, sem elastic.

### Absolute bans
- **Side-stripe borders** — `border-left/right` > 1px como accent colorido em cards/listas
- **Gradient text** — `background-clip: text` + gradient. Decorativo, nunca meaningful.
- **Glassmorphism as default** — blurs decorativos
- **Hero-metric template** — número grande + label + stats + gradient accent (SaaS cliché)
- **Card grids idênticas** — mesmas cards icon+heading+text repetidas indefinidamente
- **Modal como primeira opção** — modais são preguiça; esgotar alternativas inline primeiro

---

## #5 Anti-AI Slop

Se alguém vê esta interface e diz "IA fez aquilo" sem dúvida, falhou.

**Reflex check (dois níveis):**
- **Primeiro nível**: alguém consegue adivinhar o tema + paleta só pela categoria? ("observability → dark blue", "healthcare → white + teal") → rever até a resposta não ser óbvia do domínio
- **Segundo nível**: alguém consegue adivinhar a família estética com categoria+anti-referências? → rever novamente

| Evitar | Porquê | Única excepção |
|--------|--------|----------------|
| Gradientes roxos | Cliché "tech/AI" — zero identidade | Marca usa explicitamente |
| Inter/Roboto/Arial como display | Sem carácter visual | Brand spec define isso |
| Card + left colored border accent | 2020-2024 slop, ruído visual | Utilizador pede explicitamente |
| SVG-drawn people/faces/objects | Proporções sempre erradas | Nenhuma |
| CSS silhuetas em vez de fotos produto | "Tech animation" genérica | Nenhuma — fotos reais ou placeholder honesto |
| Emoji como ícones decorativos | Sinal amateur | Produto infantil / contexto da marca |
| Stats/icons/gradient fills decorativos | Data slop, icon slop | Dados são reais e significativos |

**Regra**: se remover um elemento não perde informação, não o adicionar.

---

## #6 Variants, Not Answers

Nunca dar uma única resposta "correcta". Sempre 3+ variações em diferentes dimensões (visual, interacção, cor, layout, animação). O utilizador escolhe e mistura.

---

## #7 GSAP & Lottie Integration

Quando animação é pedida, activar `anima` skill. Padrões base integrados aqui:

### GSAP (animar elementos HTML)
```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

// Hero entrance
gsap.from(".hero > *", {
  y: 40, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.12
});

// Scroll reveals
gsap.utils.toArray(".reveal").forEach(el => {
  gsap.from(el, {
    y: 50, opacity: 0, duration: 0.6, ease: "power4.out",
    scrollTrigger: { trigger: el, start: "top 85%", once: true }
  });
});
```

### Lottie (ícones e ilustrações SVG animadas)
```html
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
<lottie-player src="icon.json" background="transparent" speed="1" loop autoplay
  style="width: 64px; height: 64px;"></lottie-player>
```

**Quando usar cada um:**
- GSAP: elementos HTML, scroll triggers, page transitions, hover effects
- Lottie: ícones animados, ilustrações, loading states, SVG animations

**Para animations deep dive** → `anima` skill

---

## #8 iOS / App Prototypes

Quando tarefa é mockup de app móvel:

### Arquitectura (decidir primeiro)

| Cenário | Arquitectura |
|---------|-------------|
| ≤6 screens, único agente | Single-file inline React — JSX em `<script type="text/babel">`. Funciona via `file://`. |
| >10 screens OU multi-agente paralelo | Multi-HTML + iframe aggregator OU split JSX + `python3 -m http.server` |

Nunca `<script src="components.jsx">` em single-file — `file://` bloqueia como cross-origin.

### Device Frames
Usar `IosFrame` de `./framework/starter-components.md` — nunca escrever Dynamic Island, status bar, ou home indicator manualmente. Protocolo iOS avançado: `./framework/ios-app-advanced.md`.

### Entrega — perguntar primeiro

| Formato | Quando |
|---------|--------|
| **Overview** — todos os screens lado a lado, estático | Design review, comparação de layout |
| **Flow demo** — único iPhone, state machine clicável | Demonstração de user flow |

---

## #9 Design Advisor (direcção não definida)

Trigger: "faz algo bonito", "não sei que estilo", "ajuda-me a desenhar", "faz o que achares melhor".

**Não adivinhar e construir.** Entrar em modo advisor:

1. Fazer máx. 3 perguntas: público, mensagem principal, tom emocional
2. Reiterar brief em 100-150 palavras
3. Recomendar **3 direcções de 3 escolas diferentes** (nunca 2 da mesma):

| Escola | Carácter visual |
|--------|----------------|
| Arquitectura de Informação (Pentagram) | Racional, data-driven, contido |
| Motion Poetry (Field.io) | Dinâmico, imersivo, beleza técnica |
| Minimalismo (Kenya Hara) | Ordem, espaço negativo, refinado |
| Vanguarda Experimental (Sagmeister) | Avant-garde, generative, impacto visual |
| Filosofia Oriental | Quente, poético, contemplativo |

4. Gerar 3 quick HTML demos com conteúdo real do utilizador → Playwright screenshot → mostrar os 3
5. Utilizador escolhe → entrar em Junior Designer mode com a direcção escolhida

---

## #10 /components Command

Quando o utilizador pede `/components` ou "gera os componentes" ou "cria a component library":

**Output:**
1. `components.md` — documentação do design system
2. `components.html` — biblioteca visual interactiva de todos os componentes

### `components.md` template

```markdown
# Components — <nome projecto>
> Extraído de <ficheiro.html> em YYYY-MM-DD

## Design Tokens
```css
:root { /* cores, tipografia, spacing, shadows */ }
```

## Typography
- Display: <fonte> — uso, exemplos
- Heading: <fonte> — uso, exemplos
- Body: <fonte> — uso, exemplos

## Components
### Button — Primary / Secondary / Ghost / Destructive
### Input — Default / Error / Disabled
### Card — Default / Hover / Selected
### Navigation — Desktop / Mobile
### [outros componentes presentes no projecto]
```

### `components.html` estrutura

```html
<!-- Grid visual de todos os componentes, estados, e variantes -->
<!-- Cada secção: nome + código HTML + visual preview -->
<!-- Ordenado: tokens → tipografia → componentes base → compostos -->
```

---

## Expert Critique

A pedido ("review", "score", "está bom?") ou proactivamente após entrega quando output parece incerto:

0-10 em 5 dimensões:
1. **Coerência filosófica** — o todo parece intencional?
2. **Hierarquia visual** — consegue-se perceber a prioridade em 3 segundos?
3. **Execução de detalhe** — spacing, alinhamento, micro-decisions tipográficas
4. **Funcionalidade** — funciona como UI?
5. **Originalidade** — evita clichês?

Output: total + **Keep** (o que funciona) + **Fix** (⚠️ crítico / ⚡ importante / 💡 optimização) + **Quick Wins** (top 3 em menos de 5 min).

---

## UX Rules (de ui-ux-pro-max)

Aplicar automaticamente — não esperar que o utilizador peça:

### Accessibility (CRITICAL)
- Contraste mínimo 4.5:1 texto/fundo
- Focus rings visíveis em todos os elementos interactivos
- Alt text em imagens significativas
- Labels em todos os inputs (não só placeholder)
- Keyboard navigation funciona

### Touch & Interaction
- Elementos clicáveis ≥44px (Apple HIG) / ≥48px (Material)
- Espaçamento mínimo 8px entre targets de toque
- Cursor pointer em elementos clicáveis
- Loading feedback em acções async

### Layout & Responsive
- Mobile-first breakpoints
- `viewport-meta` correcto (nunca desactivar zoom)
- Sem horizontal scroll em mobile
- `min-height: 100dvh` (não `100vh`) em mobile

---

## Production Code Standards

- **React+Babel** — nunca `const styles = {...}` em ficheiros multi-componente — sempre nomes únicos (`const heroStyles`, `const cardStyles`)
- **Scripts babel** múltiplos não partilham scope — exportar via `Object.assign(window, {...})`
- **Nunca** `scrollIntoView` — quebra scroll de container
- **Conteúdo fixed-size** (animações) — JS auto-scale + letterboxing

---

## Validação antes de entregar

- [ ] Abre no browser sem erros JS
- [ ] Mobile-first testado (viewport 375px)
- [ ] Contraste verificado
- [ ] Keyboard navigation funciona
- [ ] Playwright screenshot tirado

---

## Quality Gate — Agentes

Após entregar o prototype (ou quando o utilizador pede "review" / "está bom?"), correr **em paralelo**:

```
Agent(subagent_type="tester-ui-ux", prompt="Review this HTML prototype for UI/UX issues and accessibility. Path: [path/to/file.html]. UI/UX: broken flows, visual hierarchy, spacing inconsistencies, missing feedback states, mobile behaviour at 375px, micro-interactions. Accessibility (WCAG 2.1 AA): colour contrast (4.5:1 min), keyboard navigation, focus rings, form labels, alt text, ARIA roles, touch targets (≥44px). Project: [nome e propósito]. Report: Critical / High / Medium.")
```

**Após feedback:**
- Corrigir todos os Critical antes de entregar
- Important: corrigir salvo decisão consciente
- Re-correr se alterações estruturais foram feitas

---

## Skills relacionadas

- `brand-guidelines` — gerar DESIGN.md antes desta skill
- `anima` — animações GSAP + Lottie em detalhe
- `frontend-dev` — pegar neste prototype e implementar em React/Vue produção
- `./framework/` — starter-components, ios-app-advanced
- `video` — pipeline MP4/GIF para animações HTML exportadas

---

## Workflow

Pipeline desta skill na sequência JOCA:

→ **antes**: `brand-guidelines` — DESIGN.md com cores, tipografia, tokens
→ **após protótipo**: `tester-ui-ux` — UI/UX + acessibilidade WCAG 2.1 AA
→ **para produção**: `frontend-dev` — implementar o protótipo em React/Vue
→ **se animações**: `anima` (GSAP/Lottie)

Notificar ao concluir protótipo: `→ próximo: tester-ui-ux`
