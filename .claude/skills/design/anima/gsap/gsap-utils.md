---
name: gsap-utils
description: Official GSAP skill for gsap.utils — clamp, mapRange, normalize, interpolate, random, snap, toArray, wrap, pipe. Use when the user asks about gsap.utils, clamp, mapRange, random, snap, toArray, wrap, or helper utilities in GSAP.
license: MIT
---

# GSAP Utils

## When to Use This Skill

Apply when writing or reviewing code that uses **gsap.utils** for math, array/collection handling, unit parsing, or value mapping in animations (e.g. mapping scroll to a value, randomizing, snapping to a grid, or normalizing inputs).

**Related skills:** Use with **gsap-core**, **gsap-timeline**, and **gsap-scrolltrigger** when building animations; CustomEase and other easing utilities are in **gsap-plugins**.

## Overview

**gsap.utils** provides pure helpers; no need to register. All are on **gsap.utils** (e.g. `gsap.utils.clamp()`).

**Function form pattern:** Many utils accept the value to transform as the **last** argument. If you omit that argument, the util returns a **reusable function**. **Exception: random()** — pass **true** as the last argument to get a reusable function.

```javascript
// With value: returns the result
gsap.utils.clamp(0, 100, 150); // 100

// Without value: returns a function
let c = gsap.utils.clamp(0, 100);
c(150);  // 100
c(-10);  // 0
```

## Clamping and Ranges

### clamp(min, max, value?)

```javascript
gsap.utils.clamp(0, 100, 150); // 100
let clampFn = gsap.utils.clamp(0, 100);
clampFn(150); // 100
```

### mapRange(inMin, inMax, outMin, outMax, value?)

Maps a value from one range to another.

```javascript
gsap.utils.mapRange(0, 100, 0, 500, 50);  // 250
gsap.utils.mapRange(0, 1, 0, 360, 0.5);   // 180 (progress to degrees)
let mapFn = gsap.utils.mapRange(0, 100, 0, 500);
mapFn(50);  // 250
```

### normalize(min, max, value?)

Returns a value normalized to 0–1.

```javascript
gsap.utils.normalize(0, 100, 50);   // 0.5
let normFn = gsap.utils.normalize(0, 100);
normFn(50); // 0.5
```

### interpolate(start, end, progress?)

Interpolates between two values at a given progress (0–1). Handles numbers, colors, and objects.

```javascript
gsap.utils.interpolate(0, 100, 0.5);       // 50
gsap.utils.interpolate("#ff0000", "#0000ff", 0.5); // mid color
gsap.utils.interpolate({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5); // { x: 50, y: 25 }
let lerp = gsap.utils.interpolate(0, 100);
lerp(0.5); // 50
```

## Random and Snap

### random(minimum, maximum[, snapIncrement, returnFunction]) / random(array[, returnFunction])

Returns a random number in range, or a random element from an array. Pass **true** as last argument for a reusable function.

```javascript
gsap.utils.random(-100, 100);        // e.g. 42.7
gsap.utils.random(0, 500, 5);        // 0–500, snapped to nearest 5

// Reusable function:
let randomFn = gsap.utils.random(-200, 500, 10, true);
randomFn();  // random value in range, snapped to 10

// Array:
gsap.utils.random(["red", "blue", "green"]);  // one at random

// String form in tween vars (evaluated per target):
gsap.to(".box", { x: "random(-100, 100, 5)", duration: 1 });
gsap.to(".item", { backgroundColor: "random([red, blue, green])" });
```

### snap(snapTo, value?)

Snaps to nearest multiple or array value.

```javascript
gsap.utils.snap(10, 23);     // 20
gsap.utils.snap([0, 100, 200], 150); // 100 or 200 (nearest in array)
let snapFn = gsap.utils.snap(10);
snapFn(23); // 20
```

### shuffle(array)

Returns a new array with elements in random order.

```javascript
gsap.utils.shuffle([1, 2, 3, 4]); // e.g. [3, 1, 4, 2]
```

### distribute(config)

Returns a function that assigns a value to each target based on position in the array or grid. Used for advanced staggers.

```javascript
gsap.to(".class", {
  scale: gsap.utils.distribute({
    base: 0.5,
    amount: 2.5,
    from: "center"
  })
});
```

**Config:** `base` (start value), `amount` (total distributed) or `each` (step per target), `from` (`"start"` | `"center"` | `"edges"` | `"random"` | `"end"` | index), `grid` (`[rows, cols]` or `"auto"`), `axis` (`"x"` or `"y"`), `ease`.

## Units and Parsing

### getUnit(value)

```javascript
gsap.utils.getUnit("100px");   // "px"
gsap.utils.getUnit("50%");     // "%"
gsap.utils.getUnit(42);        // ""
```

### unitize(value, unit)

```javascript
gsap.utils.unitize(100, "px");  // "100px"
```

### splitColor(color, returnHSL?)

Converts color string to `[r, g, b]` or `[r, g, b, a]`. Pass `true` for HSL.

```javascript
gsap.utils.splitColor("red");                    // [255, 0, 0]
gsap.utils.splitColor("#6fb936");                // [111, 185, 54]
gsap.utils.splitColor("rgba(204, 153, 51, 0.5)"); // [204, 153, 51, 0.5]
gsap.utils.splitColor("#6fb936", true);          // [94, 55, 47] (HSL)
```

## Arrays and Collections

### selector(scope)

Returns a scoped selector function. Use in components so selectors only match descendants of that component.

```javascript
const q = gsap.utils.selector(containerRef);
q(".box");        // array of .box elements inside container
gsap.to(q(".circle"), { x: 100 });
```

### toArray(value, scope?)

Converts selector, NodeList, or element to a true array.

```javascript
gsap.utils.toArray(".item");           // array of elements
gsap.utils.toArray(".item", container); // scoped to container
```

### pipe(...functions)

Composes functions left-to-right.

```javascript
const fn = gsap.utils.pipe(
  (v) => gsap.utils.normalize(0, 100, v),
  (v) => gsap.utils.snap(0.1, v)
);
fn(50); // normalized then snapped
```

### wrap(min, max, value?) / wrapYoyo(min, max, value?)

**wrap**: cycles value within range. **wrapYoyo**: bounces at ends.

```javascript
gsap.utils.wrap(0, 360, 370);  // 10
gsap.utils.wrap(0, 360, -10);   // 350

gsap.utils.wrapYoyo(0, 100, 150); // 50 (bounces back)
```

## Best practices

- ✅ Omit the value argument to get a reusable function when used many times (e.g. scroll handler, tween callback).
- ✅ Use **snap** for grid-aligned or step-based values; use **toArray** when GSAP needs a real array.
- ✅ Use **gsap.utils.selector(scope)** in components so selectors are scoped to a container.

## Do Not

- ❌ Assume **mapRange** / **normalize** handle units; they work on numbers only.
- ❌ Use `random()` with an omitted last argument expecting a function — pass `true` explicitly.

### Learn More

https://gsap.com/docs/v3/HelperFunctions
