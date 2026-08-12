# Visual Effects — vocabulario de observacao

Referencia on-demand. Serve para **nomear** o que se ve numa referencia visual, com precisao, em vez
de escrever "tem uns efeitos fixes". Consumida por `skills/design-review.md`, `skills/design-shotgun.md`
e `skills/gauntlet-loop.md` ao caracterizar um alvo.

Vocabulario extraido de `zanwei/design-dna`.

⚠ **Isto e taxonomia de observacao, nao guia de construcao.** A coluna de tecnica e uma pista de uma
linha — chega para decidir se e viavel e quanto custa, nao para implementar. Implementar → `anima.md`,
`modern-css.md`, ou a documentacao da biblioteca.

⚠ **Nomear nao e aprovar.** O `anti-slop-bans.md` bane varios destes por default (glassmorphism,
cursores custom). Este ficheiro deixa dizer **o que** se bane em vez de so o nome.

---

## Fundos

| Tipo | Tecnica provavel |
|---|---|
| `gradient-animation` | `@keyframes` sobre linear/conic-gradient |
| `noise-field` | Canvas 2D com ruido Perlin/simplex |
| `mesh-gradient` | SVG `<mesh>` ou interpolacao em canvas |
| `video-bg` | `<video autoplay muted loop>` com poster de fallback |
| `generative-art` | Canvas 2D ou WebGL |

## Particulas

Tipos: `floating-dots` · `confetti` · `snow` · `fireflies` · `connected-nodes` · custom
Interaccao: `mouse-repel` · `mouse-attract` · `click-burst` · nenhuma

Escolha de tecnologia e fallback de dispositivo fraco → `anima.md`, seccao de performance.

## Texto

| Tipo | Tecnica provavel |
|---|---|
| `split-letter-animate` | dividir em `<span>` por char/palavra + stagger |
| `typewriter` | `steps()` em CSS ou intervalo em JS |
| `glitch` | clip-path em camadas + desvio de cor |
| `gradient-fill` | `background-clip: text` com gradiente animado |
| `3d-extrude` | pilha de `text-shadow` ou geometria WebGL |

Estrategia de divisao: `by-char` · `by-word` · `by-line`.

## Scroll

- **Parallax** — `translateY()` × velocidade da camada; registar **nº de camadas** (>2 e gatilho vestibular)
- **Scroll-triggered** — `fade-up` · `scale-in` · `clip-reveal` · `counter` · `draw-SVG`
- **Comportamento** — `scrubbed` (progresso = scroll) vs `triggered` (corre uma vez a entrar)

## Cursor

`custom-cursor` · `magnetic-buttons` (transform por proximidade no hover) · `spotlight` · `trail`

## Imagem

Tipo: `hover-distortion` · `reveal-clip` · `parallax-tilt` · `rgb-shift`
Distorcao: `barrel` · `wave` · `liquid` · `glitch`

## SVG

`path-draw` (animar `stroke-dashoffset` do comprimento do path ate 0) · `morph-shapes` ·
`logo-reveal` · `decorative-loop`

## Shaders

Tipo: `noise-distortion` · `wave` · `morph` · `color-shift` · `custom-GLSL`
Ruido: `perlin` · `simplex` · `worley` · `fbm`

## 3D

Tipo: `hero-model` · `product-viewer` · `scene-bg` · `text-extrusion` · `abstract-geometry`
Pos-processamento: `bloom` · `FXAA` · `depth-of-field` · `chromatic-aberration`

## Superficie

`glass` · `neumorphic-light` · `neumorphic-dark` · `frosted-layers`

---

## Dois eixos para caracterizar o conjunto

**Intensidade:** nenhuma · acento subtil · moderada · imersiva
**Tecnologia primaria:** so CSS · Canvas 2D · WebGL/Three.js · GSAP · Lottie · SVG SMIL · Pixi.js

Uma referencia descreve-se em uma linha com estes dois eixos mais os efeitos presentes. Ex.:
*"acento subtil, so CSS: `gradient-animation` no hero + `fade-up` scroll-triggered"*.
