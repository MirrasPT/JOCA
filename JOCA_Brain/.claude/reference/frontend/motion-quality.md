# Motion Quality — motion audit rubric

On-demand reference. Consumed by `skills/design-review.md` (when the review includes motion) and by
the checklist in `skills/anima.md`. Adapted from `LottieFiles/motion-design-skill` (MIT).

Every item is binary: it passes or it does not. "Could be better" is not a verdict.

---

## Rubric

**Visual**
- [ ] Elements >40px for movement, >100px for detail
- [ ] Legible at real speed, without slow-motion
- [ ] 1/3 of distance: no continuous movement >1/3 of the container
- [ ] 1/3 of density: at most 1/3 of the elements active at the same time
- [ ] Natural arcs, unless mechanical is intentional

**Technical**
- [ ] No linear easing on spatial movement
- [ ] Duration proportional to distance and to element type
- [ ] Ease-out on entrances, ease-in on exits
- [ ] Entrance duration ≥ exit duration
- [ ] Important state changes are not opacity alone
- [ ] Total stagger <500ms
- [ ] Follow-through: child elements offset by 50-150ms

**Emotional**
- [ ] Archetype defined before choosing properties (see `motion-personality.md`)
- [ ] Structure setup → action → resolution
- [ ] Intensity proportional to the importance of the interaction
- [ ] Same interaction = same animation, always
- [ ] Still acceptable the hundredth time it is seen

**Performance**
- [ ] Main movement on transform + opacity
- [ ] <20 animated elements per viewport
- [ ] No property that triggers layout
- [ ] 60fps (30fps acceptable for ambient)

**Accessibility**
- [ ] `prefers-reduced-motion` alternative that **replaces**, does not erase
- [ ] No vestibular triggers without an alternative
- [ ] Critical information never by movement alone
- [ ] Animations >5s are pausable

---

## Severity

| Tier | Failures |
|---|---|
| **CRITICAL** | linear easing on spatial movement · opacity-only on important states · exceeds the 1/3-of-screen rule · stagger >500ms · animation of a layout property causing jank |
| **HIGH** | duration misaligned with the element type · wrong directional easing · inconsistent personality · no follow-through · **no reduced-motion alternative** |
| **MEDIUM** | misaligned overshoot · arcs could be better · no counter-motion |

---

## Diagnosis: symptom → cause

| Problem | Likely cause | Fix |
|---|---|---|
| Looks robotic | linear easing or no arcs | easing curves + arced trajectories |
| Looks too slow | long duration for the element type | check the duration table, use ease-out |
| Looks flat/cheap | only the primary layer exists | see "three layers" below |
| Too distracting | too many elements moving | apply the 1/3 rule, reduce amplitude |
| No personality | generic easing everywhere | apply the archetype consistently |

### The three layers (diagnostic tool, not a rule)

| Layer | Role | Amplitude |
|---|---|---|
| Primary | the action the eye follows | 100% |
| Secondary | supporting richness (shadows, linked elements) | 30-50%, offset by 50-100ms, different easing |
| Ambient | background life | 10-20%, continuous, never asks for attention |

⚠ **Use it only to diagnose "looks flat".** The source insists on always having the three layers; we
do not. That collides with the rule in `anima.md` (if it does not orient, confirm or narrate, **do not
animate**) and with `yagni`. At most 2-3 active elements.

---

## Adapting to context

| Platform | Duration modifier | Complexity |
|---|---|---|
| Desktop | 1.0x (base) | full |
| Tablet | 0.9x | standard |
| Mobile | 0.8x | reduced (1-2 properties) |
| TV / Kiosk | 1.3x | full |

**Mobile:** prefer opacity + transform · touch feedback <100ms · **stagger budget −30%** ·
avoid parallax.
**Desktop:** hover, cursor tracking, multi-column stagger, spatial choreography.

**Displacement by container width:**

| Width | Max displacement | Duration |
|---|---|---|
| <400px | 20% of the width | 0.8x |
| 400-800px | 25% of the width | 1.0x |
| 800-1200px | 20% of the width | 1.0x |
| >1200px | 15% of the width | 1.1x |

**Dark mode:** reduce intensity 10-20% (light on dark has more impact); avoid pure white flashes.

**Budget per property:**

| Tier | Properties | Max elements |
|---|---|---|
| Optimal | transform, opacity | unlimited (GPU) |
| Good | + color, clip-path | 10-15 |
| Acceptable | + width, height, margin | 5-8 |
| Avoid | box-shadow, border-radius, filter | 1-3 |

**Reduced-motion replacements:**

| Original movement | Alternative |
|---|---|
| Slide entrance | opacity fade only |
| Bounce / spring | instant or simple ease-out |
| Parallax | static position |
| Auto-play | paused, started by the user |
| Complex choreography | a single fade |
