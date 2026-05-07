---
name: gsap-plugins
description: Official GSAP skill for GSAP plugins — registration, ScrollToPlugin, ScrollSmoother, Flip, Draggable, Inertia, Observer, SplitText, ScrambleText, SVG and physics plugins, CustomEase, EasePack, CustomWiggle, CustomBounce, GSDevTools. Use when the user asks about a GSAP plugin, scroll-to, flip animations, draggable, SVG drawing, or plugin registration.
license: MIT
---

# GSAP Plugins

## When to Use This Skill

Apply when using or reviewing code that uses GSAP plugins: registering plugins, scroll-to, flip/FLIP animations, draggable elements, SVG (DrawSVG, MorphSVG, MotionPath), text (SplitText, ScrambleText), physics, easing plugins (CustomEase, EasePack, CustomWiggle, CustomBounce), or GSDevTools. ScrollTrigger has its own skill (gsap-scrolltrigger).

**Related skills:** For core tweens use **gsap-core**; for ScrollTrigger use **gsap-scrolltrigger**; for React use **gsap-react**.

## Licensing & Install (important)

Every GSAP plugin is **free**, including for commercial use. Since Webflow's acquisition of GSAP, Club GSAP is no longer a paid tier and **no plugin requires a membership, license key, or auth token** — this includes formerly Club-only plugins (**SplitText**, **MorphSVG**, etc.).

- ✅ Install everything from the public `gsap` npm package: `npm install gsap`. All plugins are included.
- ❌ Do **not** generate an `.npmrc` with a GreenSock auth token, suggest the private `npm.greensock.com` registry, or tell users to sign up for Club GSAP to access a plugin. Those instructions are outdated.

## Registering Plugins

Register each plugin once so GSAP (and bundlers) know to include it:

```javascript
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(ScrollToPlugin, Flip, Draggable);
```

- ✅ Register before using the plugin in any tween or API call.
- ✅ In React, register at top level (not inside a component that re-renders). useGSAP is a plugin that needs to be registered before use.

## Scroll

### ScrollToPlugin

Animates scroll position (window or a scrollable element). Use for "scroll to element" or "scroll to position" without ScrollTrigger.

```javascript
gsap.registerPlugin(ScrollToPlugin);

gsap.to(window, { duration: 1, scrollTo: { y: 500 } });
gsap.to(window, { duration: 1, scrollTo: { y: "#section", offsetY: 50 } });
gsap.to(scrollContainer, { duration: 1, scrollTo: { x: "max" } });
```

### ScrollSmoother

Smooth scroll wrapper. Requires ScrollTrigger and a specific DOM structure:

```html
<body>
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <!-- ALL YOUR CONTENT HERE -->
    </div>
  </div>
</body>
```

## DOM / UI

### Flip

Capture state with `Flip.getState()`, apply DOM changes, then animate from the previous state to the new state (FLIP: First, Last, Invert, Play).

```javascript
gsap.registerPlugin(Flip);

const state = Flip.getState(".item");
// change DOM (reorder, add/remove, change classes)
Flip.from(state, { duration: 0.5, ease: "power2.inOut" });
```

### Draggable

Makes elements draggable, spinnable, or throwable with mouse/touch.

```javascript
gsap.registerPlugin(Draggable, InertiaPlugin);

Draggable.create(".box", { type: "x,y", bounds: "#container", inertia: true });
Draggable.create(".knob", { type: "rotation" });
```

**Key config:**

| Option | Description |
|--------|-------------|
| `type` | `"x"`, `"y"`, `"x,y"`, `"rotation"`, `"scroll"` |
| `bounds` | Element, selector, or `{ minX, maxX, minY, maxY }` |
| `inertia` | `true` to enable throw/momentum (requires InertiaPlugin) |
| `edgeResistance` | 0–1; resistance when dragging past bounds |

### InertiaPlugin

Works with Draggable for momentum after release, or track and glide any property:

```javascript
gsap.registerPlugin(Draggable, InertiaPlugin);
Draggable.create(".box", { type: "x,y", inertia: true });

// Or track velocity and use "auto" to glide:
InertiaPlugin.track(".box", "x");
gsap.to(obj, { inertia: { x: "auto" } });
```

### Observer

Normalizes pointer and scroll input across devices. Use for swipe, scroll direction, or custom gesture logic.

```javascript
gsap.registerPlugin(Observer);

Observer.create({
  target: "#area",
  onUp: () => {},
  onDown: () => {},
  onLeft: () => {},
  onRight: () => {},
  tolerance: 10
});
```

## Text

### SplitText

Splits element text into characters, words, and/or lines for staggered or per-unit animation.

```javascript
gsap.registerPlugin(SplitText);

const split = SplitText.create(".heading", { type: "words, chars" });
gsap.from(split.chars, { opacity: 0, y: 20, stagger: 0.03, duration: 0.4 });
// later: split.revert() or let gsap.context() cleanup revert
```

With **onSplit()** (v3.13.0+) for auto-responsive re-splitting:

```javascript
SplitText.create(".split", {
  type: "lines",
  autoSplit: true,
  onSplit(self) {
    return gsap.from(self.lines, { y: 100, opacity: 0, stagger: 0.05, duration: 0.5 });
  }
});
```

**Key SplitText config:**

| Option | Description |
|--------|-------------|
| **type** | `"chars"`, `"words"`, `"lines"` (comma-separated) |
| **autoSplit** | Re-splits when fonts load or width changes; use with **onSplit()** |
| **mask** | `"lines"`, `"words"`, or `"chars"` — wraps in overflow:clip for reveal effects |
| **aria** | `"auto"` (default), `"hidden"`, `"none"` — accessibility handling |

### ScrambleText

Animates text with a scramble/glitch effect.

```javascript
gsap.registerPlugin(ScrambleTextPlugin);

gsap.to(".text", {
  duration: 1,
  scrambleText: { text: "New message", chars: "01", revealDelay: 0.5 }
});
```

## SVG

### DrawSVG (DrawSVGPlugin)

Reveals or hides the stroke of SVG elements by animating `stroke-dashoffset`/`stroke-dasharray`. Works on `<path>`, `<line>`, `<polyline>`, `<polygon>`, `<rect>`, `<ellipse>`.

```javascript
gsap.registerPlugin(DrawSVGPlugin);

gsap.from("#path", { duration: 1, drawSVG: 0 });
gsap.fromTo("#path", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1 });
gsap.to("#path", { duration: 1, drawSVG: "20% 80%" }); // segment only
```

**Required:** The element must have a visible stroke (`stroke` and `stroke-width` in CSS or attributes).

### MorphSVG (MorphSVGPlugin)

Morphs one SVG shape into another by animating the `d` attribute. Start and end shapes don't need the same number of points.

```javascript
gsap.registerPlugin(MorphSVGPlugin);

MorphSVGPlugin.convertToPath("circle, rect, ellipse, line");

gsap.to("#diamond", { duration: 1, morphSVG: "#lightning", ease: "power2.inOut" });
// object form:
gsap.to("#diamond", {
  duration: 1,
  morphSVG: { shape: "#lightning", type: "rotational", shapeIndex: 2 }
});
```

### MotionPath (MotionPathPlugin)

Animates an element along an SVG path.

```javascript
gsap.registerPlugin(MotionPathPlugin);

gsap.to(".dot", {
  duration: 2,
  motionPath: { path: "#path", align: "#path", alignOrigin: [0.5, 0.5] }
});
```

## Easing

### CustomEase

Custom easing curves (cubic-bezier or SVG path):

```javascript
gsap.registerPlugin(CustomEase);
const ease = CustomEase.create("name", ".17,.67,.83,.67");
gsap.to(".el", { x: 100, ease: ease, duration: 1 });
```

### EasePack

Adds more named eases (SlowMo, RoughEase, ExpoScaleEase). Register and use ease names in tweens.

### CustomWiggle / CustomBounce

CustomWiggle: wiggle/shake easing. CustomBounce: bounce-style easing with configurable strength.

## Physics

### Physics2D (Physics2DPlugin)

2D physics (velocity, angle, gravity):

```javascript
gsap.registerPlugin(Physics2DPlugin);

gsap.to(".ball", {
  duration: 2,
  physics2D: { velocity: 250, angle: 80, gravity: 500 }
});
```

### PhysicsProps (PhysicsPropsPlugin)

Physics-driven property animation:

```javascript
gsap.registerPlugin(PhysicsPropsPlugin);

gsap.to(".obj", {
  duration: 2,
  physicsProps: {
    x: { velocity: 100, end: 300 },
    y: { velocity: -50, acceleration: 200 }
  }
});
```

## Development

### GSDevTools

UI for scrubbing timelines and debugging. **Development only; do not ship.**

```javascript
gsap.registerPlugin(GSDevTools);
GSDevTools.create({ animation: tl });
```

## Best practices

- ✅ Register every plugin used with **gsap.registerPlugin()** before first use.
- ✅ Use **Flip.getState()** → DOM change → **Flip.from()** for layout transitions.
- ✅ Revert plugin instances (e.g. `SplitTextInstance.revert()`) when components unmount.

## Do Not

- ❌ Use a plugin in a tween or API without registering it first.
- ❌ Ship GSDevTools or development-only plugins to production.

### Learn More

https://gsap.com/docs/v3/Plugins/
