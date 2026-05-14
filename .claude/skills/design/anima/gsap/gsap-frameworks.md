---
name: gsap-frameworks
description: Official GSAP skill for Vue, Nuxt, Svelte, and SvelteKit integration — lifecycle hooks, gsap.context(), cleanup. Use when the user wants GSAP animation in Vue, Nuxt, Svelte, or SvelteKit, or asks about framework lifecycle and cleanup patterns. For React specifically, use gsap-react.
license: MIT
---

# GSAP with Vue, Svelte, and Other Frameworks

## When to Use This Skill

Apply when writing or reviewing GSAP code in Vue (or Nuxt), Svelte (or SvelteKit), or other component frameworks that use a lifecycle (mounted/unmounted). For **React** specifically, use **gsap-react** (useGSAP hook, gsap.context()).

**Related skills:** For tweens and timelines use **gsap-core** and **gsap-timeline**; for scroll-based animation use **gsap-scrolltrigger**; for React use **gsap-react**.

## Principles (All Frameworks)

- **Create** tweens and ScrollTriggers **after** the component's DOM is available (e.g. onMounted, onMount).
- **Kill or revert** them in the **unmount** (or equivalent) cleanup.
- **Scope selectors** to the component root.

## Vue 3 (Composition API)

```javascript
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger); // once per app, e.g. in main.js

export default {
  setup() {
    const container = ref(null);
    let ctx;

    onMounted(() => {
      if (!container.value) return;
      ctx = gsap.context(() => {
        gsap.to(".box", { x: 100, duration: 0.6 });
        gsap.from(".item", { autoAlpha: 0, y: 20, stagger: 0.1 });
      }, container.value);
    });

    onUnmounted(() => {
      ctx?.revert();
    });

    return { container };
  },
};
```

## Vue 3 (script setup)

```html
<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";

const container = ref(null);
let ctx;

onMounted(() => {
  if (!container.value) return;
  ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
    gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
  }, container.value);
});

onUnmounted(() => {
  ctx?.revert();
});
</script>

<template>
  <div ref="container">
    <div class="box">Box</div>
    <div class="item">Item</div>
  </div>
</template>
```

## Nuxt 4

Use a **reusable composable** to register plugins and lazy load:

```typescript
// composables/useGSAP.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const pluginMap = {
  CustomEase: () => import("gsap/CustomEase"),
  Draggable: () => import("gsap/Draggable"),
  Flip: () => import("gsap/Flip"),
  MotionPathPlugin: () => import("gsap/MotionPathPlugin"),
  Observer: () => import("gsap/Observer"),
  ScrollToPlugin: () => import("gsap/ScrollToPlugin"),
  ScrollTrigger: () => import("gsap/ScrollTrigger"),
  SplitText: () => import("gsap/SplitText"),
  // ... others
} as const;

type Plugins = keyof typeof pluginMap;
type PluginModule<K extends Plugins> = Awaited<ReturnType<typeof pluginMap[K]>>;
type PluginExport<K extends Plugins> = PluginModule<K>[K & keyof PluginModule<K>];

export default function () {
  gsap.registerPlugin(ScrollTrigger);

  async function lazyLoadPlugin<K extends Plugins>(plugin: K): Promise<PluginExport<K>> {
    const loader = pluginMap[plugin];
    const m = await loader();
    const p = (m as any)[plugin];
    gsap.registerPlugin(p);
    return p;
  }

  return { gsap, ScrollTrigger, lazyLoadPlugin };
}
```

Access in components via `useGSAP()`. Use **gsap.context(scope)** and **onUnmounted → ctx.revert()** in components, same as Vue 3.

## Svelte

Use **onMount** to run GSAP after the DOM is ready. Return the cleanup function.

```html
<script>
  import { onMount } from "svelte";
  import { gsap } from "gsap";

  let container;

  onMount(() => {
    if (!container) return;
    const ctx = gsap.context(() => {
      gsap.to(".box", { x: 100 });
      gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
    }, container);
    return () => ctx.revert();
  });
</script>

<div bind:this={container}>
  <div class="box">Box</div>
  <div class="item">Item</div>
</div>
```

## Scoping Selectors

Always pass the **scope** (container element or ref) as the second argument to **gsap.context(callback, scope)** so selectors are limited to that subtree.

- ✅ **gsap.context(() => { gsap.to(".box", ...) }, containerRef)** — `.box` only searched inside `containerRef`.
- ❌ Running **gsap.to(".box", ...)** without a context scope can affect other components.

## When to Create vs Kill

| Lifecycle | Action |
|-----------|--------|
| **Mounted** | Create tweens and ScrollTriggers inside **gsap.context(scope)**. |
| **Unmount / Destroy** | Call **ctx.revert()** so all animations and ScrollTriggers are killed and inline styles reverted. |

## Do Not

- ❌ Create tweens or ScrollTriggers before the component is mounted; DOM nodes may not exist yet.
- ❌ Use selector strings without a **scope**; always pass the container to gsap.context().
- ❌ Skip cleanup; always call **ctx.revert()** in onUnmounted / onMount's return.
- ❌ Register plugins inside a component body that runs every render; register once at app level.

### Learn More

- **gsap-react** skill for React-specific patterns (useGSAP, contextSafe).
