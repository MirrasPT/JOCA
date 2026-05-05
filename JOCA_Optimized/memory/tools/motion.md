# Motion (Framer Motion)

Biblioteca de animação moderna para React e JavaScript. Usar em projectos web quando precisas de animações declarativas, gestos, layout animations ou scroll effects.

**Instalar:** `npm install motion`

## Imports

```js
// React
import { motion, AnimatePresence } from "motion/react"

// Vanilla JS / DOM
import { animate, scroll, inView } from "motion"

// Mini bundle (sem layout animations)
import { motion } from "motion/mini"
```

## Padrões base

```jsx
// Elemento animado
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
/>

// Ao entrar no viewport
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
/>

// Hover / tap
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
/>

// Entrada/saída com AnimatePresence
<AnimatePresence>
  {isVisible && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>
```

## Scroll

```js
import { scroll, animate } from "motion"

// Parallax
scroll(animate(".hero", { y: [0, -100] }))

// Progress bar
scroll(animate(".progress", { scaleX: [0, 1] }), {
  offset: ["start start", "end end"]
})
```

## Layout animations (FLIP)

```jsx
// Animar mudanças de layout automaticamente
<motion.div layout />
<motion.div layoutId="modal" /> // shared layout entre componentes
```

## Variants (animações coordenadas)

```jsx
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

<motion.ul variants={container} initial="hidden" animate="show">
  <motion.li variants={item} />
  <motion.li variants={item} />
</motion.ul>
```

## Hooks úteis

```js
useMotionValue(0)        // valor animável imperativo
useSpring(value)         // spring physics sobre qualquer valor
useScroll()              // scrollY, scrollYProgress
useTransform(v, [0,1], [0, 100])  // mapear valores
useAnimate()             // API imperativa com ref
```

## Vanilla JS

```js
import { animate, scroll, inView } from "motion"

animate(".box", { opacity: [0, 1], y: [20, 0] }, { duration: 0.5 })
inView(".section", ({ target }) => animate(target, { opacity: 1 }))
```

## Quando usar vs CSS

- Gestos complexos (drag, pan) → Motion
- Animações dependentes de estado React → Motion
- Layout animations / shared element transitions → Motion
- Animações simples hover/transition → CSS é suficiente

## Repo

[motiondivision/motion](https://github.com/motiondivision/motion)
