---
name: anima
description: "Adding motion to websites, animating UI elements, creating scroll-based animations, or building Lottie/GSAP animations. MUST be invoked when the user says: animacao, animation, gsap, lottie, scroll animation, page transition, hover animation, animacao de icone. SHOULD also invoke when: animacao de ilustracao, scroll trigger, motion, animate, transicao, efeito de entrada."
triggers: animacao, animation, gsap, lottie, scroll animation, page transition, hover animation, animacao de icone, animacao de ilustracao, scroll trigger, motion, animate, transicao, efeito de entrada, animar, micro-interacao, microinteraction, efeito scroll, parallax, reveal, fade in, slide in, stagger, timeline, sequencia animada, loading animation, skeleton, shimmer, morphing, SVG animation
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

### Regras de timing

| Tipo | Duracao | Easing |
|------|---------|--------|
| Micro-interaccao (hover, click) | 150-200ms | ease-out-quart |
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

**Nunca usar:** bounce, elastic, linear para UI transitions, `ease-in` para entradas.

### Performance rules (obrigatorias)

```
✅ Animar SEMPRE: transform (translate, scale, rotate), opacity
✅ Animar com cuidado: filter (blur, brightness) — GPU-acelerado mas pesado
❌ Nunca animar: width, height, top, left, margin, padding — causam reflow
```

```js
// ✅ Correcto — so transform
gsap.to(".card", { x: 100, opacity: 0, duration: 0.3 });

// ❌ Errado — reflow
gsap.to(".card", { left: 100, width: 200, duration: 0.3 });
```

**will-change:** usar so em elementos que vao animar (nao globalmente):
```css
.will-animate { will-change: transform, opacity; }
/* Remover apos animacao: element.style.willChange = 'auto' */
```

**prefers-reduced-motion — sempre respeitar:**
```js
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!prefersReducedMotion) {
  gsap.from(".hero-title", { y: 40, opacity: 0, duration: 0.6 });
}
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

### Deep dives -> `./gsap/`

API references inside `anima/gsap/`:
- `./gsap/gsap-core.md` — gsap.to/from/fromTo, easing, defaults
- `./gsap/gsap-timeline.md` — position parameter, labels, nesting
- `./gsap/gsap-scrolltrigger.md` — pin, scrub, batch, horizontal scroll
- `./gsap/gsap-plugins.md` — Flip, Draggable, SplitText, MorphSVG
- `./gsap/gsap-react.md` — useGSAP hook, refs, cleanup
- `./gsap/gsap-performance.md` — quickTo, batch reads, will-change
- `./gsap/gsap-frameworks.md` — Vue, Nuxt, Svelte, SvelteKit
- `./gsap/gsap-utils.md` — clamp, mapRange, toArray, helpers

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

### Deep dives -> `./lottie-animator/`

Read `./lottie-animator/SKILL.md` for advanced cases:
- JSON Lottie from scratch (SVG path mastery)
- Bezier easing -> `./lottie-animator/references/bezier-easing.md`
- Pro techniques (morphing, walk cycles, frame-by-frame) -> `./lottie-animator/references/professional-techniques.md`
- SVG -> Lottie conversion -> `./lottie-animator/references/svg-to-lottie.md`
- Full JSON structure -> `./lottie-animator/references/lottie-structure.md`

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
  
  useGSAP(() => {
    gsap.from(".hero-title", { y: 40, opacity: 0, duration: 0.7, ease: "expo.out" });
  }, { scope: container });
  
  return <div ref={container}><h1 className="hero-title">...</h1></div>;
}
```

### Export as MP4/GIF
Use skill `video` (HTML Animation -> Video Export).

---

## Checklist

- [ ] `prefers-reduced-motion` respeitado
- [ ] So transform+opacity animados (sem width/height/top/left)
- [ ] `will-change` apenas em elementos que vao animar
- [ ] `once: true` no ScrollTrigger para reveals
- [ ] Durations no range: micro 150-200ms, transitions 200-300ms, reveals 300-500ms
- [ ] Easing: ease-out para entradas, ease-in para saidas
- [ ] Sem bounce/elastic em UI
- [ ] GSAP limpo (sem event listeners duplicados, gsap.context() em React)
