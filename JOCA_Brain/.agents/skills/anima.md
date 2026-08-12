---
name: anima
description: "Adding motion to websites, animating UI elements, creating scroll-based animations, or building Lottie/GSAP animations. MUST be invoked when the user says: animacao, animation, gsap, lottie, scroll animation, page transition, hover animation, animacao de icone. SHOULD also invoke when: animacao de ilustracao, scroll trigger, motion, animate, transicao, efeito de entrada."
triggers: animacao, animation, gsap, lottie, scroll animation, page transition, hover animation, animacao de icone, animacao de ilustracao, scroll trigger, motion, animate, transicao, efeito de entrada, animar, micro-interacao, microinteraction, efeito scroll, parallax, reveal, fade in, slide in, stagger, timeline, sequencia animada, loading animation, skeleton, shimmer, morphing, SVG animation
chain: design-review, tester-performance
---
# Anima — Animation Specialist

Two domains:

- **GSAP** — site animation, scroll-triggered, page transitions, hover effects
- **Lottie** — icon/illustration/SVG animation, interactive loops

Produces working code. Justifies every timing choice.

---

## Router — GSAP vs Lottie

Decide before writing code:

| Contexto | Usar |
|----------|------|
| Animar elementos HTML/CSS (texto, cards, secoes, navbar) | **GSAP** |
| Scroll-triggered animations (entrada no viewport) | **GSAP ScrollTrigger** |
| Page transitions, route animations | **GSAP** |
| Sequencias complexas com timing preciso | **GSAP Timeline** |
| Animar SVG paths, morphing | **GSAP MorphSVG** |
| Icones animados (hover, click, loop) | **Lottie** |
| Ilustracoes animadas (mascotes, loading, success/error) | **Lottie** |
| Splash screens, onboarding animations | **Lottie** |
| Exportar animacao como MP4/GIF | **HTML -> pipeline de exportacao** |
| Animacao com audio/SFX | **Skill `video` (HTML Animation -> Video Export — BGM + SFX pipeline)** |

Ambiguo -> perguntar. Nunca assumir.

---

## Principios de Animacao (Anti-slop)

### Animacao com proposito

Toda animacao responde a uma de 3 perguntas:
1. **Orienta** — indica direccao, hierarquia, ou mudanca de estado?
2. **Confirma** — da feedback de uma accao do utilizador?
3. **Narra** — conta uma historia ou conduz a atencao?

Nenhuma -> nao animar.

### Arquetipo de movimento (escolher ANTES de animar)

O arquetipo fixa duracao, easing e overshoot para o projecto inteiro. Sem ele, cada animacao tem uma
personalidade diferente e o conjunto le-se como template.

| Arquetipo | Duracao | Easing | Overshoot | Quando |
|---|---|---|---|---|
| Playful | 150-300ms | ease-out-back | 10-20% | brincalhao, infantil, jogo |
| Premium | 350-600ms | cubic-bezier(0.4,0,0.2,1) | 0% | luxo, editorial, vinho, hotel |
| **Corporate** *(default UI)* | 200-400ms | cubic-bezier(0.2,0,0,1) | 0-3% | SaaS, dashboard, institucional |
| Energetic | 100-250ms | ease-out-expo | 15-30% | desporto, lancamento, musica |

Defaults: **Corporate** para UI, **Playful** para ilustracao. Tabelas completas (duration palette,
entrance patterns, stagger por personalidade) → `Read(".claude/reference/frontend/motion-personality.md")`.

### Regras de timing

| Tipo | Duracao | Easing |
|------|---------|--------|
| Micro-interaccao (hover, click) | 100-200ms | ease-out-quart |
| Transicao de estado (modal, dropdown) | 200-300ms | ease-out-quart |
| Entrada de pagina / hero animation | 400-600ms | ease-out-expo |
| Scroll reveal (por elemento) | 300-500ms | ease-out-quart |
| Exit animations | 60-70% do enter | ease-in-quart |
| Stagger entre itens de lista | 30-50ms por item | ease-out-quart |

**Easing padrao:**
```js
// ease-out-quart (suave, natural)
"power4.out"  // GSAP
cubic-bezier(0.16, 1, 0.3, 1)  // CSS

// ease-out-expo (entrada dramatica)
"expo.out"  // GSAP
cubic-bezier(0.19, 1, 0.22, 1)  // CSS
```

**Nunca usar:** linear para UI transitions, `ease-in` para entradas.
**bounce/elastic:** proibidos em Premium e Corporate; permitidos em Playful e Energetic, dentro do
overshoot do arquetipo. Fora desses dois arquetipos, um bounce e slop.

### Escala e coreografia

**Multiplicador por distancia** (sobre a duracao base do arquetipo):
50px ×0.8 · 100px ×1.0 · 200px ×1.3 · 300px ×1.5 · 400px ×1.6 · ecra inteiro ×1.8-2.0

**Peso do elemento:** Heavy (modais) 300-500ms overshoot 0% · Medium (cards) 200-350ms 3-5% ·
Light (tooltips, badges) 80-200ms 5-15%

**Tecto de latencia** — tempo ate o feedback *comecar*, nao a duracao:

| Resposta a input | Tecto |
|---|---|
| Hover | <100ms |
| Press/tap | <150ms |
| Drag start | <50ms |
| Release/settle | 200-300ms |
| Error shake | 300-400ms |
| Long press | 500-800ms |

**Dois tectos duros de coreografia:**
- Stagger **total** < 500ms (20 itens × 40ms = 800ms → reduzir o passo ou agrupar)
- Com 3+ elementos animados, no maximo **1/3** a mexer em simultaneo

Counter-motion, camadas por velocidade e budgets por padrao → `Read(".claude/reference/frontend/motion-choreography.md")`.

### Performance rules (obrigatorias)

```
✅ Animar SEMPRE: transform (translate, scale, rotate), opacity
✅ Animar com cuidado: filter (blur, brightness) — GPU-acelerado mas pesado
❌ Nunca animar: width, height, top, left, margin, padding — causam reflow
```

**`autoAlpha` em vez de `opacity`** em qualquer fade-out. O `autoAlpha` poe `visibility:hidden` a 0 e
devolve `inherit` a nao-zero — sem isso ficam elementos invisiveis a comer cliques.

**Escolha de tecnologia por orcamento de performance** (declarado no projecto):
- particulas count < 100 e sem fisica complexa → vanilla JS + Canvas 2D
- count ≥ 100 ou interaccao complexa → Pixi.js ou Three.js Points
- fallback de dispositivo fraco: `navigator.hardwareConcurrency <= 2` → variante estatica/fade

```js
// ✅ Correcto — so transform
gsap.to(".card", { x: 100, opacity: 0, duration: 0.3 });

// ❌ Errado — reflow
gsap.to(".card", { left: 100, width: 200, duration: 0.3 });
```

**`filter` a partir de `none` = preto.** O GSAP le `filter: none` como `brightness(0)`, nao `brightness(1)` — um `gsap.to(el, { filter: "brightness(1.2)" })` sobre um elemento sem `filter` inicial faz o elemento ficar PRETO e clarear (animacao invertida). Usar sempre `fromTo` com o estado inicial explicito:
```js
// ❌ arranca em brightness(0) → cartao fica preto
gsap.to(".card", { filter: "brightness(1.2)" });

// ✅ estado inicial explicito
gsap.fromTo(".card", { filter: "brightness(1)" }, { filter: "brightness(1.2)" });
```

**will-change:** usar so em elementos que vao animar (nao globalmente):
```css
.will-animate { will-change: transform, opacity; }
/* Remover apos animacao: element.style.willChange = 'auto' */
```

**prefers-reduced-motion — SUBSTITUI o movimento, nao o apaga.**

Um `if (!prefersReducedMotion)` a envolver a animacao deixa quem tem a preferencia ligada sem
transicao nenhuma: os estados aparecem de golpe e perde-se a orientacao que a animacao dava. A
substituicao correcta e **remover o deslocamento espacial, manter a opacidade, reduzir a duracao ≥50%**.

```js
const mm = gsap.matchMedia();
mm.add({
  isDesktop: "(min-width: 1024px)",
  isMobile: "(max-width: 1023px)",
  reduceMotion: "(prefers-reduced-motion: reduce)"
}, (ctx) => {
  const { isDesktop, reduceMotion } = ctx.conditions;
  gsap.from(".hero-title", {
    y: reduceMotion ? 0 : (isDesktop ? 40 : 24),   // deslocamento fora, opacidade fica
    autoAlpha: 0,
    duration: reduceMotion ? 0.2 : 0.6
  });
  // auto-revert: o que for criado aqui e revertido quando a condicao deixa de bater
}, scopeRef);   // 3º argumento = scope
```

❌ **Nunca aninhar `gsap.context()` dentro de `gsap.matchMedia()`** — o matchMedia ja e um context.

⚠ **As condicoes de largura tem de ser EXAUSTIVAS.** Se nenhuma casar, o callback **nunca corre** — e
como o `.from()` parte de `autoAlpha: 0`, os elementos ficam invisiveis para sempre. Pagina em branco,
**sem erro de consola**, so num intervalo de larguras. Aconteceu 2x no mesmo dia: uma variante perdeu
tudo abaixo do heroi a 390px. Cobrir sempre o espectro (`(min-width: 1024px)` + `(max-width: 1023px)`,
ou um ramo `all: "(min-width: 0px)"`) e **testar a largura mais estreita** antes de entregar.

⚠ **No ramo reduced-motion, `from()` com `autoAlpha: 0` deixa o elemento invisivel.** O `from()` resolve
o valor FINAL a partir do estado actual; se a animacao nao mexer, o final fica 0. Nesse ramo usar
`fromTo()` explicito, com o estado final declarado:
```js
tl.fromTo(el, { autoAlpha: 0, y: reduceMotion ? 0 : 40 }, { autoAlpha: 1, y: 0, duration: reduceMotion ? 0.2 : 0.6 });
```

---

## GSAP

### Setup

```html
<!-- CDN (prototype) -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12/dist/ScrollTrigger.min.js"></script>

<!-- npm -->
npm install gsap
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
```

**O Club GSAP acabou.** Desde a aquisicao pela Webflow, **nenhum plugin** exige membership, license
key ou auth token — SplitText e MorphSVG incluidos. Vem tudo em `npm install gsap`.
❌ Nunca gerar `.npmrc` com token GreenSock, apontar a `npm.greensock.com`, nem sugerir subscrever o Club.

### Patterns essenciais

#### Entrada de pagina (hero)

```js
// Staggered hero — elementos entram em cascata
gsap.from(".hero-title, .hero-subtitle, .hero-cta", {
  y: 40,
  opacity: 0,
  duration: 0.7,
  ease: "expo.out",
  stagger: 0.12,
  delay: 0.1
});
```

#### Scroll reveal (seccoes)

```js
gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray(".reveal").forEach((el) => {
  gsap.from(el, {
    y: 50,
    opacity: 0,
    duration: 0.6,
    ease: "power4.out",
    scrollTrigger: {
      trigger: el,
      start: "top 85%",
      once: true     // so uma vez — nao repetir no scroll up
    }
  });
});
```

#### Navbar no scroll

```js
ScrollTrigger.create({
  start: "top -80",
  end: 99999,
  toggleClass: { targets: "nav", className: "nav--scrolled" }
});
```

#### Timeline (sequencia precisa)

```js
const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

tl.from(".logo", { scale: 0.8, opacity: 0, duration: 0.4 })
  .from(".nav-links", { y: -20, opacity: 0, stagger: 0.06, duration: 0.4 }, "-=0.2")
  .from(".hero-title", { y: 60, opacity: 0, duration: 0.7 }, "-=0.1")
  .from(".hero-body", { y: 30, opacity: 0, duration: 0.5 }, "-=0.4")
  .from(".hero-cta", { scale: 0.9, opacity: 0, duration: 0.4 }, "-=0.3");
```

#### Hover effects (quickTo para performance)

```js
// quickTo — mais rapido que gsap.to em eventos repetidos
const xTo = gsap.quickTo(".cursor", "x", { duration: 0.3, ease: "power3.out" });
const yTo = gsap.quickTo(".cursor", "y", { duration: 0.3, ease: "power3.out" });

document.addEventListener("mousemove", (e) => {
  xTo(e.clientX);
  yTo(e.clientY);
});
```

#### Parallax

```js
gsap.to(".hero-bg", {
  yPercent: 30,
  ease: "none",
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    end: "bottom top",
    scrub: 1.5
  }
});
```

**`scrub: 1` (numero), nunca `scrub: true`** em scroll-scrub — `true` liga a animacao 1:1 ao scroll e a roda do rato da degraus; um numero (0.5–1.5) adiciona inercia e suaviza.

**Tres falhas silenciosas do ScrollTrigger** (nenhuma da erro de consola):

❌ `tl.from(el, { scrollTrigger: {...} })` — ScrollTrigger num tween **filho** nao dispara.
✅ ScrollTrigger so na **timeline** ou num tween de **topo**: `gsap.timeline({ scrollTrigger: {...} })`.

`scrub` e `toggleActions` sao mutuamente exclusivos no mesmo trigger — se ambos existirem, **scrub
ganha** e o `toggleActions` nunca corre.

Dois `from()`/`fromTo()` **na mesma propriedade do mesmo elemento** → pôr `immediateRender: false`
no(s) posterior(es), senao o estado final do primeiro e sobrescrito antes de ele correr:
```js
gsap.from(".card", { y: 60, duration: 0.5 });
gsap.from(".card", { y: 20, duration: 0.5, delay: 0.5, immediateRender: false });  // sem isto, o 1º nunca se ve
```

Scroll horizontal falso = `containerAnimation` a animar `x/xPercent` de um **filho** do pinned, com
**`ease: "none"` obrigatorio**; `pin` e `snap` nao funcionam dentro de `containerAnimation`.

#### Validar um scrub (Playwright / browser)

Medir `getComputedStyle` logo a seguir a um `scrollTo` da valores errados — o scrub tem ~1 s de lag.
1. Esperar **≥2 s** apos o `scrollTo` antes de medir.
2. **Confirmar o viewport ANTES de medir** efeitos dependentes de media queries (sticky/stack desligam-se em mobile; medir um stack a 390px da numeros que nao fazem sentido).
3. Para validar a CURVA do scrub, **screenshots em 3 pontos** sao mais fiaveis do que ler computed styles.

### Deep dives → `.claude/reference/gsap/` (on-demand, MIT/GreenSock)

`Read()` só o ficheiro da camada em causa — são API references, não se pré-carregam.

- `gsap-core.md` — to/from/fromTo, easing, defaults, immediateRender, autoAlpha, matchMedia
- `gsap-timeline.md` — position parameter, labels, nesting
- `gsap-scrolltrigger.md` — pin, scrub, batch, containerAnimation (scroll horizontal)
- `gsap-plugins.md` — Flip, Draggable, SplitText (autoSplit/onSplit), MorphSVG
- `gsap-react.md` — useGSAP, contextSafe, revertOnUpdate, cleanup
- `gsap-performance.md` — quickTo, batch reads, will-change
- `gsap-frameworks.md` — Vue, Nuxt, Svelte, SvelteKit
- `gsap-utils.md` — clamp, mapRange, toArray, helpers

---

## Lottie

### Quando usar

- Icones com animacao de estado (hamburger -> close, play -> pause, like, checkmark)
- Ilustracoes animadas (loading, success, error, empty states, mascotes)
- Loops de fundo (particulas, ondas, padroes subtis)
- Animacoes que precisam de interactividade por segmento (hover play, click trigger)

### Setup

```html
<!-- CDN -->
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>

<!-- Web Component -->
<lottie-player
  src="animation.json"
  background="transparent"
  speed="1"
  loop
  autoplay
  style="width: 120px; height: 120px;"
></lottie-player>
```

```js
// Controlo programatico
import lottie from "lottie-web";

const anim = lottie.loadAnimation({
  container: document.querySelector("#lottie-container"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "animation.json"
});

// Trigger on hover
button.addEventListener("mouseenter", () => anim.play());
button.addEventListener("mouseleave", () => anim.stop());

// Segmentos
anim.playSegments([0, 60], true);   // frames 0 -> 60
```

### Estrutura do JSON Lottie

Key fields for manual editing:
```json
{
  "nm": "nome da animacao",
  "fr": 60,         // framerate
  "ip": 0,          // in-point
  "op": 120,        // out-point (=2s a 60fps)
  "w": 500,         // width
  "h": 500,         // height
  "layers": [...]   // camadas
}
```

**Editar cores sem After Effects:**
```js
// Procurar "c": [R,G,B,1] em valores 0-1
// Substituir com nova cor:
// oklch(0.6 0.2 30) -> RGB(0.85, 0.4, 0.2) ≈ [0.85, 0.4, 0.2, 1]
```

### Padroes de icones Lottie

```js
// Icone que anima no hover e volta ao estado inicial
const iconAnim = lottie.loadAnimation({
  container: document.querySelector(".icon"),
  loop: false,
  autoplay: false,
  path: "icon.json"
});

let isAnimating = false;

icon.addEventListener("mouseenter", () => {
  if (!isAnimating) {
    isAnimating = true;
    iconAnim.goToAndPlay(0, true);
  }
});

iconAnim.addEventListener("complete", () => {
  isAnimating = false;
  iconAnim.goToAndStop(0, true);
});
```

### Deep dives

Read(".claude/skills/lottie-animator.md") for advanced cases: JSON Lottie from scratch (SVG path mastery), bezier easing, pro techniques (morphing, walk cycles, frame-by-frame), SVG -> Lottie conversion, full JSON structure.

---

## Frontend skill integration

Invoked autonomously by the `frontend` skill during development. No user confirmation needed.

### Design tokens
1. Read DESIGN.md -> `--duration-*` and `--ease-*` tokens
2. Apply in GSAP defaults
3. GSAP for HTML elements; Lottie for icons and SVG illustrations

### React (useGSAP)
```jsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

function Hero() {
  const container = useRef();
  
  const { contextSafe } = useGSAP(() => {
    gsap.from(".hero-title", { y: 40, autoAlpha: 0, duration: 0.7, ease: "expo.out" });
  }, { scope: container });

  // Handlers criados DEPOIS do useGSAP correr nao entram no context → nao sao limpos.
  const onEnter = contextSafe(() => gsap.to(".card", { scale: 1.05, duration: 0.2 }));

  return <div ref={container}><h1 className="hero-title">...</h1></div>;
}
```

### Smooth scroll (Lenis + ScrollTrigger)

```js
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);          // razao de existir deste bloco
return () => lenis.destroy();         // cleanup obrigatorio em React
```

Sem `lagSmoothing(0)` o GSAP compensa frames perdidos e o ScrollTrigger **dessincroniza** do smooth
scroll — os pins saltam. Sem `destroy()`, cada remount acumula um raf loop.

### Export as MP4/GIF
Use skill `video` (HTML Animation -> Video Export).

---

## Checklist

- [ ] Arquetipo escolhido e aplicado ao projecto inteiro (nao um por animacao)
- [ ] `prefers-reduced-motion` **substitui** (opacidade fica, deslocamento sai, duracao −50%) — nao envolve num `if`
- [ ] So transform+opacity animados (sem width/height/top/left); `autoAlpha` nos fade-outs
- [ ] `will-change` apenas em elementos que vao animar
- [ ] `once: true` no ScrollTrigger para reveals
- [ ] Durations no range: micro 100-200ms, transitions 200-300ms, reveals 300-500ms
- [ ] Easing: ease-out para entradas, ease-in para saidas
- [ ] bounce/elastic so em Playful/Energetic
- [ ] Stagger total < 500ms · no maximo 1/3 dos elementos a mexer ao mesmo tempo

Auditoria a fundo (rubrica binaria, tiers de severidade, diagnostico sintoma→causa, adaptacao por
plataforma) → `Read(".claude/reference/frontend/motion-quality.md")`.
- [ ] GSAP limpo (sem event listeners duplicados, gsap.context() em React)
