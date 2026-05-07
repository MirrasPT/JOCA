---
name: gsap
description: GSAP animation reference for HyperFrames. Covers gsap.to(), from(), fromTo(), easing, stagger, defaults, timelines (gsap.timeline(), position parameter, labels, nesting, playback), and performance (transforms, will-change, quickTo). Use when writing GSAP animations in HyperFrames compositions.
---

# GSAP in HyperFrames

For the full GSAP API reference, use the standalone skills — they are the authoritative source:

| Skill | Covers |
|---|---|
| `gsap/gsap-core` | gsap.to/from/fromTo, easing, stagger, matchMedia, transforms, autoAlpha |
| `gsap/gsap-timeline` | gsap.timeline(), position parameter, labels, nesting, playback control |
| `gsap/gsap-performance` | transforms vs layout, will-change, quickTo, batch reads, cleanup |
| `gsap/gsap-plugins` | Flip, Draggable, SplitText, DrawSVG, MorphSVG, MotionPath, physics |
| `gsap/gsap-utils` | clamp, mapRange, snap, random, interpolate, wrap, distribute |
| `gsap/gsap-react` | useGSAP hook, refs, contextSafe, SSR, cleanup |
| `gsap/gsap-scrolltrigger` | scroll-linked animations, pin, scrub, batch, horizontal scroll |

## HyperFrames-specific

- Animations go in the GSAP timeline alongside `data-*` timing attributes
- Always kill tweens when clips go off-screen (HyperFrames handles clip visibility; you handle tween lifecycle)
- Prefer `gsap.timeline({ defaults: { ease: "power2.out" } })` — one timeline per composition
- Use `gsap.matchMedia()` for prefers-reduced-motion compliance

## References (HyperFrames-specific, loaded on demand)

- **[references/effects.md](references/effects.md)** — Drop-in effects: typewriter text, audio visualizer. Read when needing ready-made effect patterns for HyperFrames.
