---
name: motion
description: Lottie animations (SVG to JSON) and slide deck design (HTML). Use when animating logos/icons/SVGs, creating Lottie JSON files, motion graphics, entrance/loop/loading animations, path drawing, character animation, morphing — or when creating presentations, pitch decks, and slide decks. Triggers: animate logo, create lottie, svg animation, motion graphics, wiggle, bounce, rotate, pulse, walk cycle, morphing, trim path, loading animation, presentation, slides, deck, pitch, PPT, PowerPoint.
allowed-tools: Read, Write, Bash, Glob, Grep
---

## Lottie Animator

Generates professional Lottie JSON from SVGs. Replaces After Effects for motion graphics.

CRITICAL: Always read SVG path structure before animating. Never animate blind.

LOTTIE JSON STRUCTURE: `v` (version) · `fr` (framerate, 60fps default) · `ip`/`op` (in/out point) · `w`/`h` (dimensions) · `layers` array

LAYER TYPES: shape (`ty:4`) · image (`ty:2`) · null/controller (`ty:3`) · precomp (`ty:0`)

ANIMATION PROPERTIES: `ks.p` position · `ks.s` scale · `ks.r` rotation · `ks.o` opacity · `ks.a` anchor
Keyframe format: `{t: frame, s: [value], e: [endValue], i: {x,y}, o: {x,y}}`

EASING: ease-in `{x:[0.55],y:[0.055]}` · ease-out `{x:[0.215],y:[0.61]}` · ease-in-out `{x:[0.645],y:[0.045]}`

SHAPE MODIFIERS: trim path (reveal animation) · repeater (pattern) · merge paths · pucker/bloat

ENFORCE: read SVG structure first · 60fps for smooth animation · bezier easing (never linear for organic motion) · test in LottieFiles previewer

REF (load on demand): `references/svg-path-mastery.md` · `references/lottie-format.md` · `references/easing-library.md` · `references/character-rigging.md`

## Slides

HTML decks that run in any browser, export to PDF/PPTX, look nothing like generic AI slides.

ARCHITECTURE (decide before writing):
- ≤10 slides / pitch / shared state → **Single-file** (`deck_stage.js` web component)
- ≥10 slides / course / multi-agent build → **Multi-file** (each slide = own HTML)

Single-file rules: `<script>` tag AFTER `</deck-stage>` · section `display:flex` only on `.active`
Multi-file rules: each slide fully self-contained · rename `deck_index.html` → `index.html` · edit MANIFEST

OUTPUT: HTML first always. PDF (`Ctrl+P` → Save as PDF). PPTX via python-pptx on request.

ENFORCE: announce architecture choice + wait for confirmation · design-first (typography/layout/color before content) · Speaker Notes via `<aside>` or `data-notes`
NEVER: generic blue gradient + white text · bullet-list-heavy slides · build all slides before showing first
