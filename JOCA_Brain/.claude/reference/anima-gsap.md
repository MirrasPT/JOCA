# Anima — GSAP (referência do `anima`)

> Movido de `skills/anima.md` §GSAP. Princípios, timing, performance e `prefers-reduced-motion` ficam no núcleo da skill.

## Índice
- [Setup](#setup)
- [Patterns essenciais](#patterns-essenciais) — hero, scroll reveal, navbar, timeline, hover, parallax
- [GSAP: armadilhas de callback e de refresh](#gsap-armadilhas-de-callback-e-de-refresh)
- [Validar um scrub](#validar-um-scrub-playwright--browser)
- [Deep dives → `.claude/reference/gsap/`](#deep-dives--claudereferencegsap-on-demand-mitgreensock)

### Setup

```html
<!-- CDN (prototype) -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/ScrollTrigger.min.js"></script>

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

#### GSAP: armadilhas de callback e de refresh

Cinco agentes independentes tropecaram nestas no mesmo projecto (projecto interno, 2026-09-11). Nenhuma da
erro de build; varias so rebentam com a pagina aberta a meio do scroll.

| Armadilha | O que acontece | Fix |
|---|---|---|
| `onUpdate` de **tween** a usar `self` | so o callback do **ScrollTrigger** recebe `self` como argumento; o do tween nao recebe argumento (o tween e o `this`, e so numa `function`, nunca numa arrow) | ler `tween.progress()` por referencia (contentor abaixo), ou pôr o callback no `scrollTrigger: {}` |
| callback que fecha sobre a `const` da **mesma expressao** (`const st = ScrollTrigger.create({ onUpdate: () => st.progress })`) | pagina carregada **para la do `end`** → o ScrollTrigger dispara o callback durante a criacao, antes da atribuicao → `ReferenceError` (TDZ) | usar o `self` do callback, ou o **contentor `const`** abaixo |
| `ScrollTrigger.refreshAll()` com um trigger `pin` criado **depois** de outros mais abaixo | o refresh percorre por **ordem de criacao**; os anteriores medem a pagina **sem o `pin-spacer`** e ficam deslocados | criar os triggers pela ordem do documento (de cima para baixo), ou `refreshPriority` nos que tem de medir depois |
| CSS `translate` num elemento que o GSAP anima (`x`/`y`/`transform`) | ao escrever `transform`, o GSAP apaga a propriedade `translate` — o deslocamento do CSS desaparece | posicao base via `x`/`y` do proprio GSAP (`gsap.set`), nunca misturar `translate` de CSS com transform do GSAP |
| dois `quickSetter`/`quickTo` de transform no **mesmo elemento** (em componentes diferentes) | pisam-se: cada um reescreve o `transform` inteiro e o ultimo ganha | **um so escritor de transform por elemento**; o segundo efeito vai para um wrapper |

**Padrao do contentor `const`** — a referencia existe antes de qualquer callback correr:
```js
const ref = { st: null };
ref.st = ScrollTrigger.create({
  trigger: ".secao",
  onUpdate: (self) => { /* usar self; fora do callback, ref.st */ },
});
// nunca: const st = ScrollTrigger.create({ onUpdate: () => st.progress })
```

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
