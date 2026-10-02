---
name: anima
description: "Adding motion to websites and UI (GSAP: scroll, page transitions, hover) or creating Lottie animations, including generating Lottie JSON from a static SVG/logo without After Effects. MUST be invoked when the user says: animacao, animation, gsap, lottie, animate logo, create lottie, motion graphics, scroll animation, page transition, hover animation. SHOULD also invoke when: svg animation, trim path, loading animation, morphing, parallax, transicao, efeito de entrada."
triggers: animate logo, create lottie, motion graphics, svg to lottie, trim path, animacao, animation, gsap, lottie, animar, scroll animation, page transition, hover animation, animacao de icone, animacao de ilustracao, scroll trigger, motion, animate, transicao, efeito de entrada, micro-interacao, parallax, loading animation, morphing, SVG animation
chain: design-review, tester-performance
---
# Anima — Animation Specialist

Two domains:

- **GSAP** — site animation, scroll-triggered, page transitions, hover effects
- **Lottie** — icon/illustration/SVG animation, interactive loops, and generating Lottie JSON from a static SVG/logo (replaces After Effects)

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
| Animar logo/icone SVG estatico e exportar Lottie JSON (sem After Effects) | **Lottie — gerar o JSON** |
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
| Micro-interaccao (hover, click) | 100-200ms (hover: entra <100ms, sai 150-200ms) | ease-out-quart |
| Transicao de estado (dropdown, popover) | 200-300ms | ease-out-quart |
| Modal / dialog | 300-400ms | ease-out-quart |
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
**Excepcao:** rotacao continua e progresso a velocidade constante (spinner, barra) = `linear` — com
ease-out, o spinner acelera e trava a cada volta. Ciclos que repetem = curva suave (`sine.inOut`).
**bounce/elastic:** proibidos em Premium e Corporate; permitidos em Playful e Energetic, dentro do
overshoot do arquetipo. Fora desses dois arquetipos, um bounce e slop.

### Escala e coreografia

**Multiplicador por distancia** (sobre a duracao base do arquetipo):
50px ×0.8 · 100px ×1.0 · 200px ×1.3 · 300px ×1.5 · 400px ×1.6 · ecra inteiro ×1.8-2.0

**Peso do elemento:** Heavy (modais) 300-400ms overshoot 0% · Medium (cards) 200-350ms 3-5% ·
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

Receitas de estado (clique, hover entra <100ms / sai 150-200ms, abanar de erro, spinner, skeleton,
sucesso, erro de formulario, disabled), propriedade por objectivo e overshoot por contexto → ler quando
o pedido e feedback de UI: `Read(".claude/reference/frontend/motion-patterns.md")`.

### Molas (motion physics) — sem dependencias, via `linear()`

Uma mola define-se por **rigidez** (`stiffness`, k) e **travagem** (`damping`, c), massa 1. Nao se
afina por tentativa: `ζ = c / (2·√k)` e o **overshoot** e fechado — `OS = exp(-ζπ/√(1-ζ²))`.
Ao contrario: `ζ = -ln(OS) / √(π² + ln²(OS))`, logo `c = 2·ζ·√k`. Ex.: k=170 com 5 % de overshoot → ζ 0,690 → c 18.
`ζ ≥ 1` nao tem overshoot → e um `cubic-bezier`, nao uma mola.

**Conversao para CSS `linear()`** (amostrar a resposta ao degrau; testado 2026-09-15 em node: overshoot
amostrado = formula, 0,0234 para k=170 c=20):
```js
function springLinear({ stiffness = 170, damping = 20, steps = 40, eps = 0.001 } = {}) {
  const w0 = Math.sqrt(stiffness), z = damping / (2 * w0);
  if (z >= 1) throw new Error('zeta>=1: sem overshoot, usar cubic-bezier');
  const wd = w0 * Math.sqrt(1 - z * z);
  const x = t => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const T = -Math.log(eps) / (z * w0);                       // assenta a ±eps
  const pts = Array.from({ length: steps + 1 }, (_, i) => +x(T * i / steps).toFixed(4));
  pts[steps] = 1;
  return { css: `linear(${pts.join(', ')})`, duracaoMs: Math.round(T * 1000) };
}
// transition: transform <duracaoMs>ms <css>
```

**Espacial vs efeito:** mola (e overshoot) so em propriedades **espaciais** — `transform`, posicao,
escala. **Cor e opacidade nunca fazem overshoot** (passar de 1 em opacidade nao existe; em cor e um
flash errado) → essas levam `ease-out` com a mesma duracao. O overshoot respeita o tecto do arquetipo e
do peso do elemento acima.

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
**sem erro de consola**, so num intervalo de larguras. Aconteceu em **2 de 12** variantes construidas
por agentes que tinham lido esta skill: uma perdeu tudo abaixo do heroi a 390px. O exemplo estava
correcto; o que faltava era o modo de falha escrito ao lado dele. Cobrir sempre o espectro
(`(min-width: 1024px)` + `(max-width: 1023px)`, ou um ramo `all: "(min-width: 0px)"`) e **testar a
largura mais estreita** antes de entregar — carregar a pagina a 390px e confirmar que ha conteudo
visivel, nao so que o build passa.

> **Regra geral desta skill: `.from()`/`fromTo()` parte de um estado inicial DESTRUTIVO.** `autoAlpha: 0`,
> `opacity: 0` ou `visibility: hidden` aplicados a espera de uma animacao que os desfaca significam que
> **qualquer caminho em que a animacao nao corra deixa a pagina invisivel, sem erro nenhum**: condicao de
> media query que nao casa, ScrollTrigger num tween filho (ver §GSAP), plugin nao registado, JS que falha
> antes, `prefers-reduced-motion` mal ramificado. Sempre que um exemplo daqui for aplicado, perguntar "e
> se este codigo nunca correr?" — se a resposta for "ecra em branco", declarar o estado visivel por
> defeito no CSS e deixar a animacao *retirar* dele, ou garantir por teste que todos os ramos correm.
> Gates estaticos (`tsc`, `build`) nunca apanham isto.

⚠ **No ramo reduced-motion, `from()` com `autoAlpha: 0` deixa o elemento invisivel.** O `from()` resolve
o valor FINAL a partir do estado actual; se a animacao nao mexer, o final fica 0. Nesse ramo usar
`fromTo()` explicito, com o estado final declarado:
```js
tl.fromTo(el, { autoAlpha: 0, y: reduceMotion ? 0 : 40 }, { autoAlpha: 1, y: 0, duration: reduceMotion ? 0.2 : 0.6 });
```

---

## GSAP

Setup, patterns essenciais (hero, scroll reveal, navbar, timeline, hover, parallax), falhas silenciosas do ScrollTrigger, armadilhas de callback/refresh, validar um scrub e deep dives `gsap/` → `Read(".claude/reference/anima-gsap.md")`.

---

## Lottie

Embed na web (`lottie-player` / `lottie-web`, segmentos, ícones no hover) **e** gerar o JSON a partir de SVG (comandos de path → vértices, filosofia de movimento, trim path, morphing, frame-by-frame, parenting, receitas, erros, performance, checklist) → `Read(".claude/reference/anima-lottie.md")`. O antigo `lottie-animator` vive lá.

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
- [ ] Nenhum estado inicial destrutivo pendurado: pagina carregada na largura mais estreita (e com reduced-motion ligado) mostra conteudo

Auditoria a fundo (rubrica binaria, tiers de severidade, diagnostico sintoma→causa, adaptacao por
plataforma) → `Read(".claude/reference/frontend/motion-quality.md")`.
- [ ] GSAP limpo (sem event listeners duplicados, gsap.context() em React)
