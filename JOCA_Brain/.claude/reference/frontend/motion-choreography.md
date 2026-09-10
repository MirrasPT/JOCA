# Motion Choreography — several elements moving at the same time

On-demand reference. Consumed by `skills/anima.md`. Adapted from `LottieFiles/motion-design-skill` (MIT).

An isolated animation almost never fails. What fails is the **whole**: five good things happening
at the same time read as noise. This file is about the whole.

---

## The two 1/3 rules

**Distance:** no movement travels >1/3 of the screen without an intermediate keyframe. Break it with a
change of direction, a change of speed or an arc adjustment.

**Elements:** with 3+ animated elements, at most **1/3 active simultaneously**. Stagger so that
element 1 settles when 3 starts.

---

## Shared direction

All elements enter **from the same direction** or from a shared origin. Mixed directions = chaos.

When several elements react to **one** trigger:
- they all start within **50ms** of each other;
- they may **arrive** at different times (staggered landing);
- same easing family; the movement is born at the trigger point.

---

## Counter-motion (what gives weight)

| Main movement | Counter-motion | Speed ratio |
|---|---|---|
| Enters from the left | background shifts to the right | 20-30% |
| Scales up | shadow scales down | 10-20% |
| Rotates CW | environment drifts CCW | 15-25% |
| Rises (Y up) | shadow widens and softens | 20-30% |

## Depth by speed

| Layer | Displacement | Speed |
|---|---|---|
| Foreground | 1.0x | fastest |
| Midground | 0.5x | medium |
| Background | 0.2x | slowest |

---

## Structure of a sequence

| Phase | Share of the duration | What happens |
|---|---|---|
| Setup | 20-30% | elements enter, the scene establishes itself |
| Action | 30-40% | main movement |
| Resolution | 30-40% | settle, secondary reactions |

Leave **100-200ms of stillness** after the resolution before starting new movement.

---

## Stagger — pattern and budget

| Pattern | Delay between items | Total budget |
|---|---|---|
| Micro cascade | 20-40ms | <200ms |
| Standard | 50-100ms | <400ms |
| Dramatic | 100-200ms | <600ms |
| Wave | 30-60ms | <500ms |

**The stagger total has to stay <500ms.** 20 items × 40ms = 800ms → reduce the step or group them.

Direction: top-to-bottom (lists) · left-to-right (horizontals) · center-outwards (hero) ·
random (organic) · reversed (exits).

- All staggered elements use the **same easing family**.
- Vary only the start time, **never the curve**.
- Optional: the last element takes a slight overshoot, like punctuation.

---

## Directing attention

| Technique | How |
|---|---|
| Leading movement | animate the target before the context |
| Following movement | settle on the focal point |
| Ambient movement | subtle and continuous in the periphery |
| Pointing movement | directional towards the CTA |
