# Visual Effects — observation vocabulary

On-demand reference. It exists to **name** what you see in a visual reference, precisely, instead of
writing "it has some cool effects". Consumed by `skills/design-review.md`, `skills/design-shotgun.md`
and `skills/gauntlet-loop.md` when characterising a target.

Vocabulary extracted from `zanwei/design-dna`.

⚠ **This is an observation taxonomy, not a build guide.** The technique column is a one-line hint —
enough to decide whether it is viable and how much it costs, not to implement it. To implement → `anima.md`,
`modern-css.md`, or the library's documentation.

⚠ **Naming is not approving.** `anti-slop-bans.md` bans several of these by default (glassmorphism,
custom cursors). This file lets you say **what** you are banning instead of only the name.

---

## Backgrounds

| Type | Likely technique |
|---|---|
| `gradient-animation` | `@keyframes` over linear/conic-gradient |
| `noise-field` | Canvas 2D with Perlin/simplex noise |
| `mesh-gradient` | SVG `<mesh>` or interpolation in canvas |
| `video-bg` | `<video autoplay muted loop>` with a fallback poster |
| `generative-art` | Canvas 2D or WebGL |

## Particles

Types: `floating-dots` · `confetti` · `snow` · `fireflies` · `connected-nodes` · custom
Interaction: `mouse-repel` · `mouse-attract` · `click-burst` · none

Technology choice and weak-device fallback → `anima.md`, performance section.

## Text

| Type | Likely technique |
|---|---|
| `split-letter-animate` | split into `<span>` per char/word + stagger |
| `typewriter` | `steps()` in CSS or an interval in JS |
| `glitch` | layered clip-path + color offset |
| `gradient-fill` | `background-clip: text` with an animated gradient |
| `3d-extrude` | stack of `text-shadow` or WebGL geometry |

Split strategy: `by-char` · `by-word` · `by-line`.

## Scroll

- **Parallax** — `translateY()` × layer speed; record the **number of layers** (>2 is a vestibular trigger)
- **Scroll-triggered** — `fade-up` · `scale-in` · `clip-reveal` · `counter` · `draw-SVG`
- **Behavior** — `scrubbed` (progress = scroll) vs `triggered` (runs once on entry)

## Cursor

`custom-cursor` · `magnetic-buttons` (transform by proximity on hover) · `spotlight` · `trail`

## Image

Type: `hover-distortion` · `reveal-clip` · `parallax-tilt` · `rgb-shift`
Distortion: `barrel` · `wave` · `liquid` · `glitch`

## SVG

`path-draw` (animate `stroke-dashoffset` from the path length down to 0) · `morph-shapes` ·
`logo-reveal` · `decorative-loop`

## Shaders

Type: `noise-distortion` · `wave` · `morph` · `color-shift` · `custom-GLSL`
Noise: `perlin` · `simplex` · `worley` · `fbm`

## 3D

Type: `hero-model` · `product-viewer` · `scene-bg` · `text-extrusion` · `abstract-geometry`
Post-processing: `bloom` · `FXAA` · `depth-of-field` · `chromatic-aberration`

## Surface

`glass` · `neumorphic-light` · `neumorphic-dark` · `frosted-layers`

---

## Two axes to characterise the whole

**Intensity:** none · subtle accent · moderate · immersive
**Primary technology:** CSS only · Canvas 2D · WebGL/Three.js · GSAP · Lottie · SVG SMIL · Pixi.js

A reference is described in one line with these two axes plus the effects present. E.g.:
*"subtle accent, CSS only: `gradient-animation` in the hero + `fade-up` scroll-triggered"*.
