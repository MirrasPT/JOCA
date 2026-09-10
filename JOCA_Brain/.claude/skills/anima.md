---
name: anima
description: "Adding motion to websites, animating UI elements, creating scroll-based animations, or building Lottie/GSAP animations. MUST be invoked when the user says: animation, gsap, lottie, scroll animation, page transition, hover animation, icon animation. SHOULD also invoke when: illustration animation, scroll trigger, motion, animate, transition, entrance effect."
triggers: animation, gsap, lottie, scroll animation, page transition, hover animation, icon animation, illustration animation, scroll trigger, motion, animate, transition, entrance effect, microinteraction, scroll effect, parallax, reveal, fade in, slide in, stagger, timeline, animated sequence, loading animation, skeleton, shimmer, morphing, SVG animation
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

| Context | Use |
|----------|------|
| Animating HTML/CSS elements (text, cards, sections, navbar) | **GSAP** |
| Scroll-triggered animations (entering the viewport) | **GSAP ScrollTrigger** |
| Page transitions, route animations | **GSAP** |
| Complex sequences with precise timing | **GSAP Timeline** |
| Animating SVG paths, morphing | **GSAP MorphSVG** |
| Animated icons (hover, click, loop) | **Lottie** |
| Animated illustrations (mascots, loading, success/error) | **Lottie** |
| Splash screens, onboarding animations | **Lottie** |
| Exporting an animation as MP4/GIF | **HTML -> export pipeline** |
| Animation with audio/SFX | **Skill `video` (HTML Animation -> Video Export — BGM + SFX pipeline)** |

Ambiguous -> ask. Never assume.

---

## Animation Principles (Anti-slop)

### Animation with a purpose

Every animation answers one of 3 questions:
1. **Orients** — does it indicate direction, hierarchy, or a change of state?
2. **Confirms** — does it give feedback on a user action?
3. **Narrates** — does it tell a story or lead the attention?

None -> do not animate.

### Motion archetype (choose BEFORE animating)

The archetype fixes duration, easing and overshoot for the whole project. Without it, each animation
has a different personality and the set reads like a template.

| Archetype | Duration | Easing | Overshoot | When |
|---|---|---|---|---|
| Playful | 150-300ms | ease-out-back | 10-20% | playful, childlike, game |
| Premium | 350-600ms | cubic-bezier(0.4,0,0.2,1) | 0% | luxury, editorial, wine, hotel |
| **Corporate** *(default UI)* | 200-400ms | cubic-bezier(0.2,0,0,1) | 0-3% | SaaS, dashboard, institutional |
| Energetic | 100-250ms | ease-out-expo | 15-30% | sport, launch, music |

Defaults: **Corporate** for UI, **Playful** for illustration. Full tables (duration palette,
entrance patterns, stagger by personality) → `Read(".claude/reference/frontend/motion-personality.md")`.

### Timing rules

| Type | Duration | Easing |
|------|---------|--------|
| Micro-interaction (hover, click) | 100-200ms | ease-out-quart |
| State transition (modal, dropdown) | 200-300ms | ease-out-quart |
| Page entrance / hero animation | 400-600ms | ease-out-expo |
| Scroll reveal (per element) | 300-500ms | ease-out-quart |
| Exit animations | 60-70% of the enter | ease-in-quart |
| Stagger between list items | 30-50ms per item | ease-out-quart |

**Default easing:**
```js
// ease-out-quart (smooth, natural)
"power4.out"  // GSAP
cubic-bezier(0.16, 1, 0.3, 1)  // CSS

// ease-out-expo (dramatic entrance)
"expo.out"  // GSAP
cubic-bezier(0.19, 1, 0.22, 1)  // CSS
```

**Never use:** linear for UI transitions, `ease-in` for entrances.
**bounce/elastic:** forbidden in Premium and Corporate; allowed in Playful and Energetic, within the
archetype's overshoot. Outside those two archetypes, a bounce is slop.

### Scale and choreography

**Multiplier by distance** (over the archetype's base duration):
50px ×0.8 · 100px ×1.0 · 200px ×1.3 · 300px ×1.5 · 400px ×1.6 · full screen ×1.8-2.0

**Element weight:** Heavy (modals) 300-500ms overshoot 0% · Medium (cards) 200-350ms 3-5% ·
Light (tooltips, badges) 80-200ms 5-15%

**Latency ceiling** — time until the feedback *starts*, not the duration:

| Response to input | Ceiling |
|---|---|
| Hover | <100ms |
| Press/tap | <150ms |
| Drag start | <50ms |
| Release/settle | 200-300ms |
| Error shake | 300-400ms |
| Long press | 500-800ms |

**Two hard choreography ceilings:**
- **Total** stagger < 500ms (20 items × 40ms = 800ms → reduce the step or group them)
- With 3+ animated elements, at most **1/3** moving at the same time

Counter-motion, layers by speed and budgets per pattern → `Read(".claude/reference/frontend/motion-choreography.md")`.

### Performance rules (mandatory)

```
✅ ALWAYS animate: transform (translate, scale, rotate), opacity
✅ Animate with care: filter (blur, brightness) — GPU-accelerated but heavy
❌ Never animate: width, height, top, left, margin, padding — they cause reflow
```

**`autoAlpha` instead of `opacity`** in any fade-out. `autoAlpha` sets `visibility:hidden` at 0 and
returns `inherit` at non-zero — without it you get invisible elements eating clicks.

**Technology choice by performance budget** (declared in the project):
- particle count < 100 and no complex physics → vanilla JS + Canvas 2D
- count ≥ 100 or complex interaction → Pixi.js or Three.js Points
- weak-device fallback: `navigator.hardwareConcurrency <= 2` → static/fade variant

```js
// ✅ Correct — transform only
gsap.to(".card", { x: 100, opacity: 0, duration: 0.3 });

// ❌ Wrong — reflow
gsap.to(".card", { left: 100, width: 200, duration: 0.3 });
```

**`filter` starting from `none` = black.** GSAP reads `filter: none` as `brightness(0)`, not `brightness(1)` — a `gsap.to(el, { filter: "brightness(1.2)" })` on an element with no initial `filter` makes the element go BLACK and then brighten (inverted animation). Always use `fromTo` with the explicit initial state:
```js
// ❌ starts at brightness(0) → the card goes black
gsap.to(".card", { filter: "brightness(1.2)" });

// ✅ explicit initial state
gsap.fromTo(".card", { filter: "brightness(1)" }, { filter: "brightness(1.2)" });
```

**will-change:** use it only on elements that are going to animate (not globally):
```css
.will-animate { will-change: transform, opacity; }
/* Remove after the animation: element.style.willChange = 'auto' */
```

**prefers-reduced-motion — REPLACES the motion, it does not delete it.**

An `if (!prefersReducedMotion)` wrapping the animation leaves whoever has the preference on with no
transition at all: the states appear at once and the orientation the animation gave is lost. The
correct replacement is **remove the spatial displacement, keep the opacity, cut the duration ≥50%**.

```js
const mm = gsap.matchMedia();
mm.add({
  isDesktop: "(min-width: 1024px)",
  isMobile: "(max-width: 1023px)",
  reduceMotion: "(prefers-reduced-motion: reduce)"
}, (ctx) => {
  const { isDesktop, reduceMotion } = ctx.conditions;
  gsap.from(".hero-title", {
    y: reduceMotion ? 0 : (isDesktop ? 40 : 24),   // displacement out, opacity stays
    autoAlpha: 0,
    duration: reduceMotion ? 0.2 : 0.6
  });
  // auto-revert: whatever is created here is reverted when the condition stops matching
}, scopeRef);   // 3rd argument = scope
```

❌ **Never nest `gsap.context()` inside `gsap.matchMedia()`** — matchMedia is already a context.

⚠ **The width conditions have to be EXHAUSTIVE.** If none matches, the callback **never runs** — and
since `.from()` starts from `autoAlpha: 0`, the elements stay invisible forever. Blank page, **with no
console error**, only in one width range. It happened 2x on the same day: one variant lost everything
below the hero at 390px. Always cover the spectrum (`(min-width: 1024px)` + `(max-width: 1023px)`, or
an `all: "(min-width: 0px)"` branch) and **test the narrowest width** before delivering.

⚠ **In the reduced-motion branch, `from()` with `autoAlpha: 0` leaves the element invisible.** `from()`
resolves the FINAL value from the current state; if the animation does not move, the final ends up 0.
In that branch use an explicit `fromTo()`, with the final state declared:
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

**Club GSAP is over.** Since the Webflow acquisition, **no plugin** requires membership, a license
key or an auth token — SplitText and MorphSVG included. It all comes in `npm install gsap`.
❌ Never generate an `.npmrc` with a GreenSock token, point at `npm.greensock.com`, or suggest subscribing to the Club.

### Essential patterns

#### Page entrance (hero)

```js
// Staggered hero — elements enter in a cascade
gsap.from(".hero-title, .hero-subtitle, .hero-cta", {
  y: 40,
  opacity: 0,
  duration: 0.7,
  ease: "expo.out",
  stagger: 0.12,
  delay: 0.1
});
```

#### Scroll reveal (sections)

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
      once: true     // only once — do not repeat on scroll up
    }
  });
});
```

#### Navbar on scroll

```js
ScrollTrigger.create({
  start: "top -80",
  end: 99999,
  toggleClass: { targets: "nav", className: "nav--scrolled" }
});
```

#### Timeline (precise sequence)

```js
const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

tl.from(".logo", { scale: 0.8, opacity: 0, duration: 0.4 })
  .from(".nav-links", { y: -20, opacity: 0, stagger: 0.06, duration: 0.4 }, "-=0.2")
  .from(".hero-title", { y: 60, opacity: 0, duration: 0.7 }, "-=0.1")
  .from(".hero-body", { y: 30, opacity: 0, duration: 0.5 }, "-=0.4")
  .from(".hero-cta", { scale: 0.9, opacity: 0, duration: 0.4 }, "-=0.3");
```

#### Hover effects (quickTo for performance)

```js
// quickTo — faster than gsap.to on repeated events
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

**`scrub: 1` (a number), never `scrub: true`** in scroll-scrub — `true` ties the animation 1:1 to the scroll and the mouse wheel makes it step; a number (0.5–1.5) adds inertia and smooths it.

**Three silent ScrollTrigger failures** (none gives a console error):

❌ `tl.from(el, { scrollTrigger: {...} })` — ScrollTrigger on a **child** tween does not fire.
✅ ScrollTrigger only on the **timeline** or on a **top-level** tween: `gsap.timeline({ scrollTrigger: {...} })`.

`scrub` and `toggleActions` are mutually exclusive on the same trigger — if both exist, **scrub
wins** and `toggleActions` never runs.

Two `from()`/`fromTo()` **on the same property of the same element** → put `immediateRender: false`
on the later one(s), otherwise the first one's final state is overwritten before it runs:
```js
gsap.from(".card", { y: 60, duration: 0.5 });
gsap.from(".card", { y: 20, duration: 0.5, delay: 0.5, immediateRender: false });  // without this, the 1st is never seen
```

Fake horizontal scroll = `containerAnimation` animating `x/xPercent` of a **child** of the pinned one,
with **`ease: "none"` mandatory**; `pin` and `snap` do not work inside `containerAnimation`.

#### Validating a scrub (Playwright / browser)

Measuring `getComputedStyle` right after a `scrollTo` gives wrong values — the scrub has ~1 s of lag.
1. Wait **≥2 s** after the `scrollTo` before measuring.
2. **Confirm the viewport BEFORE measuring** effects that depend on media queries (sticky/stack switch off on mobile; measuring a stack at 390px gives numbers that make no sense).
3. To validate the scrub CURVE, **screenshots at 3 points** are more reliable than reading computed styles.

### Deep dives → `.claude/reference/gsap/` (on-demand, MIT/GreenSock)

`Read()` only the file for the layer in question — they are API references, they are not pre-loaded.

- `gsap-core.md` — to/from/fromTo, easing, defaults, immediateRender, autoAlpha, matchMedia
- `gsap-timeline.md` — position parameter, labels, nesting
- `gsap-scrolltrigger.md` — pin, scrub, batch, containerAnimation (horizontal scroll)
- `gsap-plugins.md` — Flip, Draggable, SplitText (autoSplit/onSplit), MorphSVG
- `gsap-react.md` — useGSAP, contextSafe, revertOnUpdate, cleanup
- `gsap-performance.md` — quickTo, batch reads, will-change
- `gsap-frameworks.md` — Vue, Nuxt, Svelte, SvelteKit
- `gsap-utils.md` — clamp, mapRange, toArray, helpers

---

## Lottie

### When to use

- Icons with a state animation (hamburger -> close, play -> pause, like, checkmark)
- Animated illustrations (loading, success, error, empty states, mascots)
- Background loops (particles, waves, subtle patterns)
- Animations that need per-segment interactivity (hover play, click trigger)

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
// Programmatic control
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

// Segments
anim.playSegments([0, 60], true);   // frames 0 -> 60
```

### Lottie JSON structure

Key fields for manual editing:
```json
{
  "nm": "animation name",
  "fr": 60,         // framerate
  "ip": 0,          // in-point
  "op": 120,        // out-point (=2s a 60fps)
  "w": 500,         // width
  "h": 500,         // height
  "layers": [...]   // layers
}
```

**Editing colors without After Effects:**
```js
// Look for "c": [R,G,B,1] in 0-1 values
// Replace with the new color:
// oklch(0.6 0.2 30) -> RGB(0.85, 0.4, 0.2) ≈ [0.85, 0.4, 0.2, 1]
```

### Lottie icon patterns

```js
// Icon that animates on hover and returns to the initial state
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

  // Handlers created AFTER useGSAP runs do not enter the context → they are not cleaned up.
  const onEnter = contextSafe(() => gsap.to(".card", { scale: 1.05, duration: 0.2 }));

  return <div ref={container}><h1 className="hero-title">...</h1></div>;
}
```

### Smooth scroll (Lenis + ScrollTrigger)

```js
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);          // the reason this block exists
return () => lenis.destroy();         // mandatory cleanup in React
```

Without `lagSmoothing(0)` GSAP compensates for dropped frames and ScrollTrigger **desyncs** from the
smooth scroll — the pins jump. Without `destroy()`, each remount piles up another raf loop.

### Export as MP4/GIF
Use skill `video` (HTML Animation -> Video Export).

---

## Checklist

- [ ] Archetype chosen and applied to the whole project (not one per animation)
- [ ] `prefers-reduced-motion` **replaces** (opacity stays, displacement goes, duration −50%) — not wrapped in an `if`
- [ ] Only transform+opacity animated (no width/height/top/left); `autoAlpha` on fade-outs
- [ ] `will-change` only on elements that are going to animate
- [ ] `once: true` on ScrollTrigger for reveals
- [ ] Durations in range: micro 100-200ms, transitions 200-300ms, reveals 300-500ms
- [ ] Easing: ease-out for entrances, ease-in for exits
- [ ] bounce/elastic only in Playful/Energetic
- [ ] Stagger total < 500ms · at most 1/3 of the elements moving at the same time

In-depth audit (binary rubric, severity tiers, symptom→cause diagnosis, adaptation by platform) →
`Read(".claude/reference/frontend/motion-quality.md")`.
- [ ] GSAP clean (no duplicated event listeners, gsap.context() in React)
