# Motion Personality — movement archetypes

On-demand reference. Consumed by `skills/anima.md` (the summary table lives there; the detail is here).
Adapted from `LottieFiles/motion-design-skill` (MIT).

The archetype is chosen **once per project** and applies to everything. Switching archetype between
components is the fastest way for a product to read like a template thrown together in a hurry.

---

## The 4 archetypes

### Playful
| Parameter | Value |
|---|---|
| Duration | 150-300ms |
| Easing | ease-out-back / springs |
| Overshoot | 10-20% |
| Trajectory | arcs and curves, never straight |
| Squash-stretch | yes, on impacts |

Signature: bounce on settling, squash on press, rotation wobble, varied stagger.
Where: kids' apps, casual games, social, celebrations, onboarding, creative tools.

### Premium / Luxury
| Parameter | Value |
|---|---|
| Duration | 350-600ms |
| Easing | cubic-bezier(0.4, 0, 0.2, 1) |
| Overshoot | 0% |
| Trajectory | smooth curves, subtle parallax |
| Squash-stretch | never |

Signature: slow fades, subtle scale (98%→100%), generous pauses, few properties (opacity + one).
Where: fashion, finance, luxury brands, premium SaaS, portfolios, editorial.

### Corporate / Professional — **UI default**
| Parameter | Value |
|---|---|
| Duration | 200-400ms |
| Easing | cubic-bezier(0.2, 0, 0, 1) |
| Overshoot | 0-3% |
| Trajectory | straight lines, small arcs only for emphasis |
| Squash-stretch | no |

Signature: consistent timing, clear state transitions, functional movement, uniform stagger.
Where: enterprise, dashboards, business tools, admin, health, banking.

### Energetic / Dynamic
| Parameter | Value |
|---|---|
| Duration | 100-250ms |
| Easing | ease-out-expo / elastic |
| Overshoot | 15-30% |
| Trajectory | dramatic arcs, large displacement, diagonal |
| Squash-stretch | yes, exaggerated |

Signature: large scale changes (50-150%), fast color transitions, particle bursts,
accelerating stagger, entrances from the edge.
Where: gaming, sport, music, events, marketing, fitness.

---

## Choosing from the brief

| Words in the brief | Archetype |
|---|---|
| fun, bouncy, cute, friendly | Playful |
| elegant, minimal, luxury, sophisticated | Premium |
| clean, professional, business, dashboard | Corporate |
| dynamic, energetic, bold, exciting | Energetic |
| (not stated) + UI | **Corporate** |
| (not stated) + illustration | **Playful** |

---

## Brand motion identity (3 constants)

**1. Signature easing** — 80% of the animations:
Playful `ease-out-back` · Premium `(0.4,0,0.2,1)` · Corporate `(0.2,0,0,1)` · Energetic `ease-out-expo`

**2. Duration palette**

| Tier | Playful | Premium | Corporate | Energetic |
|---|---|---|---|---|
| Quick | 150ms | 350ms | 200ms | 100ms |
| Standard | 250ms | 500ms | 300ms | 180ms |
| Slow | 400ms | 800ms | 450ms | 300ms |

**3. Entrance pattern**
Playful: bounce from below · Premium: slow fade + scale 98%→100% · Corporate: slide from the right +
opacity · Energetic: snap from the edge + overshoot

---

## Mixing archetypes

- **90% in the primary archetype.** Specific moments may borrow from another.
- The personality change enters by easing, not by cut.
- Legitimate example: a Corporate dashboard that borrows Playful **only** in the success state.

⚠ This is not a license to vary. If more than 10% of the animations escape the archetype, there is no
archetype — there is an absence of decision.
