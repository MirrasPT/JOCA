# Modern CSS — what the platform already does without JS

On-demand reference. Consumed by `skills/frontend.md`, `skills/tailwind.md` and `skills/anima.md`.
Adapted from `tponscr-debug/claude-skill-awwwards` (MIT).

Our whole motion doctrine assumes GSAP. A good part of the scroll and component-responsiveness work
is already native — and native costs 0 KB of bundle. **Check support before using it in
production;** these features are recent and the baseline moves.

---

## Scroll-driven animations (no JS, no ScrollTrigger)

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.scroll-reveal {
  animation: reveal linear both;
  animation-timeline: view();           /* element progress in the viewport */
  animation-range: entry 0% entry 40%;
}
```

Reading progress bar — `scroll(root)` instead of `view()`:
```css
.progress-bar {
  position: fixed; top: 0; left: 0; height: 3px;
  background: var(--accent); transform-origin: left;
  animation: grow-width linear;
  animation-timeline: scroll(root);
}
@keyframes grow-width { from { transform: scaleX(0); } to { transform: scaleX(1); } }
```

⚠ **`view()` has no `once`.** A native CSS reveal **repeats every time the element re-enters the
viewport** — including when scrolling back up. ScrollTrigger's `once: true` has no native equivalent.
If the repetition bothers you, either the movement is small enough not to fight hierarchy (≤16px), or
the reveal goes back to ScrollTrigger. Decide deliberately, do not find out in production.

**When GSAP/ScrollTrigger is still worth it:** `once`, pin, snap, `containerAnimation`, choreography
across several triggers, or when you need to read/write state in JS. Repeatable reveal and progress bar → CSS.

---

## Container queries — responsiveness of the component, not of the page

```css
.card-wrapper { container-type: inline-size; container-name: card; }

@container card (min-width: 400px) { .card { grid-template-columns: 120px 1fr; } }
@container card (min-width: 600px) { .card { grid-template-columns: 200px 1fr auto; } }
```

Container units (`cqi` = container inline):
```css
.card-title { font-size: clamp(1rem, 3cqi, 1.5rem); }
```

A card that adapts to the **space it has** works in the sidebar and in the main grid with no variants.
Media queries are still right for page layout.

---

## `:has()` — style the parent from the child

```css
.card:has(img)                          { grid-template-rows: 200px 1fr; }
.form-group:has(:invalid)               { --border-color: var(--status-negative); }
body:has(.hero) .nav                    { background: transparent; position: absolute; }
body:has(.sidebar[data-open="true"]) .main { margin-left: 280px; }
```

Kills most of the states that today are solved with a class set by JS.

---

## Container + full-bleed (the mechanic)

```css
.container {
  --max-width: 1200px;
  --padding: clamp(20px, 5vw, 80px);
  width: min(var(--max-width), 100% - var(--padding) * 2);
  margin-inline: auto;
}
.full-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
}
```

The `calc(50% - 50vw)` is the piece: it pulls the element out of the container without taking it out of flow.

---

## Performance

```css
/* sections below the fold: don't pay layout/paint until they are needed */
.below-fold-section { content-visibility: auto; contain-intrinsic-size: 0 600px; }

/* isolate a card's paint */
.card { contain: layout style paint; }

/* backdrop-filter without compositing the whole page */
.glass {
  isolation: isolate;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

⚠ `contain-intrinsic-size` needs a credible height estimate — wrong, and the scrollbar jumps.

---

## `color-mix()` — derive states instead of declaring them

```css
.btn        { background: var(--accent); }
.btn:hover  { background: color-mix(in oklch, var(--accent), black 15%); }
```

One token, all states derived. Fewer tokens to keep in sync.

---

## Logical properties

```css
.card {
  margin-inline: auto;
  padding-block: var(--space-md);
  padding-inline: var(--space-lg);
  border-inline-start: 3px solid var(--accent);
}
```

`inline`/`block` instead of `left`/`right`/`top`/`bottom` — works in RTL without rewriting anything.
