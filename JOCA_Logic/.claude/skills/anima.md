---
name: anima
description: "Adding motion to websites, animating UI elements, creating scroll-based animations, or building Lottie/GSAP animations. MUST be invoked when the user says: animação, animation, gsap, lottie, scroll animation, page transition, hover animation, animação de ícone. SHOULD also invoke when: animação de ilustração, scroll trigger, motion, animate, transição, efeito de entrada."
triggers: animação, animation, gsap, lottie, scroll animation, page transition, hover animation, animação de ícone, animação de ilustração, scroll trigger, motion, animate, transição, efeito de entrada, animar, micro-interação, microinteraction, efeito scroll, parallax, reveal, fade in, slide in, stagger, timeline, sequência animada, loading animation, skeleton, shimmer, morphing, SVG animation
---
# Anima — Animation Specialist

Especialista em animação web. Dois domínios:

- **GSAP** — animação de sites, scroll-triggered, page transitions, hover effects
- **Lottie** — animação de ícones, ilustrações, SVGs, loops interactivos

Sempre produz código funcional. Sempre justifica cada escolha de timing.

---

## Router — GSAP vs Lottie

Decidir antes de qualquer código:

| Contexto | Usar |
|----------|------|
| Animar elementos HTML/CSS (texto, cards, secções, navbar) | **GSAP** |
| Scroll-triggered animations (entrada quando entra no viewport) | **GSAP ScrollTrigger** |
| Page transitions, route animations | **GSAP** |
| Sequências complexas com timing preciso | **GSAP Timeline** |
| Animar SVG paths, morphing | **GSAP MorphSVG** |
| Ícones animados (hover, click, loop) | **Lottie** |
| Ilustrações animadas (mascotes, loading, success/error) | **Lottie** |
| Splash screens, onboarding animations | **Lottie** |
| Exportar animação como MP4/GIF | **HTML → ver pipeline de exportação** |
| Animação com audio/SFX | **Ver skill `video` (HTML Animation → Video Export — BGM + SFX pipeline)** |

Ambíguo → perguntar. Nunca assumir.

---

## Princípios de Animação (Anti-slop)

### O que é animação com propósito

Toda a animação deve responder a uma de 3 perguntas:
1. **Orienta** — indica direcção, hierarquia, ou mudança de estado?
2. **Confirma** — dá feedback de uma acção do utilizador?
3. **Narra** — conta uma história ou conduz a atenção?

Se a resposta for "nenhuma das anteriores" → não animar.

### Regras de timing (de ui-ux-pro-max)

| Tipo | Duração | Easing |
|------|---------|--------|
| Micro-interação (hover, click) | 150–200ms | ease-out-quart |
| Transição de estado (modal, dropdown) | 200–300ms | ease-out-quart |
| Entrada de página / hero animation | 400–600ms | ease-out-expo |
| Scroll reveal (por elemento) | 300–500ms | ease-out-quart |
| Exit animations | 60–70% do enter | ease-in-quart |
| Stagger entre itens de lista | 30–50ms por item | ease-out-quart |

**Easing padrão:**
```js
// ease-out-quart (suave, natural)
"power4.out"  // GSAP
cubic-bezier(0.16, 1, 0.3, 1)  // CSS

// ease-out-expo (entrada dramática)
"expo.out"  // GSAP
cubic-bezier(0.19, 1, 0.22, 1)  // CSS
```

**Nunca usar:** bounce, elastic, linear para UI transitions, `ease-in` para entradas.

### Performance rules (obrigatórias)

```
✅ Animar SEMPRE: transform (translate, scale, rotate), opacity
✅ Animar com cuidado: filter (blur, brightness) — GPU-acelerado mas pesado
❌ Nunca animar: width, height, top, left, margin, padding — causam reflow
```

```js
// ✅ Correcto — só transform
gsap.to(".card", { x: 100, opacity: 0, duration: 0.3 });

// ❌ Errado — reflow
gsap.to(".card", { left: 100, width: 200, duration: 0.3 });
```

**will-change:** usar só em elementos que VÃO animar (não globalmente):
```css
.will-animate { will-change: transform, opacity; }
/* Remover após animação: element.style.willChange = 'auto' */
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

#### Entrada de página (hero)

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

#### Scroll reveal (secções)

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
      once: true     // só uma vez — não repetir no scroll up
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

#### Timeline (sequência precisa)

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
// quickTo — mais rápido que gsap.to em eventos repetidos
const xTo = gsap.quickTo(".cursor", "x", { duration: 0.3, ease: "power3.out" });
const yTo = gsap.quickTo(".cursor", "y", { duration: 0.3, ease: "power3.out" });

document.addEventListener("mousemove", (e) => {
  xTo(e.clientX);
  yTo(e.clientY);
});
```

#### Parallax simples

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

### Deep dives → `./gsap/` (referências API internas)

Para documentação completa da API — ler o ficheiro relevante dentro de `anima/gsap/`:
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

### Quando usar Lottie

- Ícones com animação de estado (hamburger → close, play → pause, like, checkmark)
- Ilustrações animadas (loading, success, error, empty states, mascotes)
- Loops de fundo (partículas, ondas, padrões subtis)
- Animações que precisam de interactividade por segmento (hover play, click trigger)

### Setup

```html
<!-- CDN -->
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>

<!-- Web Component (mais fácil) -->
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
// Controlo programático
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
anim.playSegments([0, 60], true);   // frames 0 → 60
```

### Estrutura do JSON Lottie

Elementos chave para editar manualmente:
```json
{
  "nm": "nome da animação",
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
// oklch(0.6 0.2 30) → RGB(0.85, 0.4, 0.2) ≈ [0.85, 0.4, 0.2, 1]
```

### Padrões de ícones Lottie

```js
// Ícone que anima no hover e volta ao estado inicial
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

### Deep dives → `./lottie-animator/` (sub-skill interna)

Ler `./lottie-animator/SKILL.md` para casos avançados:
- Criação de JSON Lottie de raiz (SVG path mastery)
- Bezier easing avançado → `./lottie-animator/references/bezier-easing.md`
- Técnicas profissionais (morphing, walk cycles, frame-by-frame) → `./lottie-animator/references/professional-techniques.md`
- SVG → Lottie conversion pipeline → `./lottie-animator/references/svg-to-lottie.md`
- Estrutura JSON completa → `./lottie-animator/references/lottie-structure.md`

---

## Integracao com frontend skill

Invocada autonomamente pela skill `frontend` durante o desenvolvimento. Nao precisa de confirmacao do utilizador -- a skill principal decide quando activar.

### Ler design tokens
1. Ler DESIGN.md -> `--duration-*` e `--ease-*` tokens
2. Aplicar nos GSAP defaults
3. GSAP para elementos HTML; Lottie para icones e ilustracoes SVG

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

### Exportar como MP4/GIF
Usar skill `video` (HTML Animation -> Video Export).

---

## Checklist antes de entregar

- [ ] `prefers-reduced-motion` respeitado
- [ ] Só transform+opacity animados (sem width/height/top/left)
- [ ] `will-change` apenas em elementos que vão animar
- [ ] `once: true` no ScrollTrigger para reveals (não repete no scroll up)
- [ ] Durations dentro do range: micro 150-200ms, transitions 200-300ms, reveals 300-500ms
- [ ] Easing: sempre ease-out para entradas, ease-in para saídas
- [ ] Sem bounce/elastic em UI
- [ ] GSAP limpo (sem event listeners duplicados, gsap.context() em React)
