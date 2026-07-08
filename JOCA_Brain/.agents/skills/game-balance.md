---
name: game-balance
description: "Card-game balance methodology — power-budget math (stat points per cost, pricing keywords/abilities), the deckbuilding curve, win-rate & first-player targets, and the degenerate-pattern taxonomy (infinite loops, non-interactive OTK, lock/stall, solitaire, power creep) with detection via deterministic self-play/fuzzing and telemetry. MUST be read before setting costs/stats or screening cards for broken interactions. Triggers: balance, balancear, power budget, stat curve, mana curve, cost a card, price a keyword, win rate, power creep, infinite combo, degenerate, nerf, playtest metrics."
triggers: balance, balancear, power budget, stat curve, mana curve, cost a card, price a keyword, win rate, power creep, infinite combo, degenerate, nerf, playtest metrics, first player advantage
chain: tcg-balance-auditor
metadata:
  type: skill
  category: game-design
---

# Game Balance (TCG)

How to put numbers on cards and keep the game healthy. Pairs with `card-game-design` (the design intent) and the `tcg-balance-auditor` / `tcg-playtester` agents (which apply this to the OmniClash engine). Balance is **measured**, not vibed.

> **Read-first** before assigning costs/stats or judging whether a card is broken.

---

## 1. Power budget — stat points per cost (the vanilla baseline)
Establish a baseline from your **vanilla** units (no keywords, no abilities): plot `(ATK + DEF)` against `cost` and take the median slope. Example shape (tune to your game): a vanilla unit is worth ~`2·cost + 1` total stats (a 2-cost ≈ 2/3 or 3/2, total 5). Then:
- A card **far above** the line is overstatted (the nerf-bait the community spots instantly — see §7).
- A card **far below** with no upside is a dead card (never played).
Every keyword/ability is **paid for** by spending stat points (or gold) off the vanilla line.

## 2. Pricing keywords & abilities
A keyword or ability is a cost, not a freebie. Rough rule: a relevant keyword ≈ **1 stat point** (sometimes more for a swingy one); a strong on-play/on-death effect ≈ 1–2 stat points **or** +1 cost. Examples in the OmniClash frame:
- **Ataque Rápido** (no summoning sickness) on an aggressive body → pay ~1 ATK or DEF.
- **Bloquear** (can block) on a defensive body → pay ~1 ATK.
- **Imortal** (cheat death for a discard) → pay materially (a recurring threat is worth a lot of tempo).
Price the **effect at its ceiling**, not its average — players build decks to hit the ceiling.

## 3. The curve (deckbuilding health)
A deck needs a smooth **cost curve**: enough cheap plays to contest the board early, a strong mid, and a few payoffs. Holes break archetypes (no 1–2 drops = you die to aggro; all top-end = clunky). Echoes the "fill your curve / BREAD" deckbuilding heuristic (Bombs, Removal, Evasion, Aggression, Duds). Check the curve **per faction** against the gold ramp — a ramp faction can sit higher, an aggro faction must be low.

## 4. Targets — win-rate & first-player
- **Archetype win-rates** should sit in roughly **45–55%**. Anything pinned above ~55% across samples is oppressive; below ~45% is unplayable.
- **First-player advantage** is real and measurable in 1v1 (Hearthstone beta: 52.2% before "the coin"; 7 Wonders Duel: ~66.8%). Measure it (same matchup first vs second); if the first player wins materially >~52%, add a **structural** compensation — the player going second draws an extra card, gets bonus gold, or the first player can't attack on turn 1. OmniClash is deterministic → measure exactly with seeded self-play, fix before any public test.
- **Game length** should have a sane median and spread; a fat tail of never-ending games = a stall problem (§5).

## 5. Degenerate-pattern taxonomy (what to hunt for)
The expensive failures, worst first:
1. **Infinite / positive loops** — a repeatable **on-cost (Activated)** ability whose loop is gold-**positive or neutral** (nets ≥ its own cost, or makes a resource ≥ it spends). One such card = the game is broken. The classic Yu-Gi-Oh failure mode; the explicit OmniClash PRD §13 risk. **Design rule: every repeatable cost must be strictly net-negative on resources.**
2. **Non-interactive OTK** — a 2–3 card combo that breaks all walls + lethal in one turn with no opponent answer. Add interaction windows or raise the combo's cost/fragility.
3. **Lock / stall** — repeatable tap/freeze/denial that stops the opponent from ever acting, or board states the game can't resolve → games that never end.
4. **Solitaire** — a deck that ignores the opponent and goes off alone; low interactivity = bad player experience (NPE) even if win-rate is fair.
5. **Power creep** — each new card strictly better than an old one; the ceiling climbs forever. The community's loudest, most universal complaint. Fight with horizontal design + epoch rotation (`card-game-design` §9).

## 6. Detection — measure, don't guess
- **Deterministic self-play / fuzzing** — a seeded engine (OmniClash is POCO + deterministic) is a fuzz target: sweep thousands of matches with simple policies, assert invariants (field ≤ cap, gold ≥ 0, walls ≥ 0), and capture the seed for any anomaly. Professional teams run AI self-play simulators (e.g. **SabberStone**, a C# Hearthstone engine — directly analogous to Tcg.Core) over thousands of games to read archetype win-rates. → `tcg-playtester`.
- **Move-count hard limit = the cheapest loop detector.** Bake a global action cap into the engine from day 1 (research suggests ~**800 actions/game**); any match that exceeds it is flagged as an infinite-loop candidate. This catches loops automatically with zero combo-specific code.
- **Static audit** — enumerate every repeatable/on-cost ability and trace its resource math by hand. → `tcg-balance-auditor`.
- **Telemetry (when live)** — per-card **play-rate** and **win-rate-when-played**, archetype win-rates, average game length, first-player split. A card with very high play-rate + high win-rate is the next nerf.

## 7. Levers & philosophy
- **Cost vs stats vs errata** — prefer adjusting **cost** or **stats** (small, legible) over rewriting an ability. Buff dead cards as readily as you nerf oppressive ones.
- **Staples, not win-conditions** — because you control the whole catalogue, make power **replaceable** (multiple staples fill a role) rather than deck-defining singletons. This blunts power creep *and* scalping (the twin community complaints). 
- **Patch cadence** — the nerf treadmill itself is a complaint ("will be nerfed to 1/2 in 2 weeks" — r/hearthstone, 537 upvotes). Aim to ship closer to balanced and patch surgically, not constantly.

## Anti-patterns
| Wrong | Right |
|---|---|
| Costs assigned by gut | priced off a measured vanilla stat baseline |
| Keyword/ability for free | paid in stat points or +cost, priced at its ceiling |
| Repeatable cost that nets resources | strictly net-negative loops only |
| "Looks fine" balance | seeded self-play + invariant asserts + win-rate samples |
| Ignoring first-player advantage | measure it; compensate the second player |
| Vertical "but stronger" reprints | horizontal options + rotation |
| Deck-defining singleton legends | replaceable staples per role |
| Constant sweeping nerfs | ship near-balanced, patch surgically |

## Further reading
Cited research backing this skill (vanilla test, BREAD, degenerate taxonomy, self-play, telemetry — with sources): `memory/knowledge/tcg-design-balance-research.md`.

## Próximo passo (chain)
Apply this to the live engine → `tcg-balance-auditor` (static power-budget + loop hunt) and `tcg-playtester` (seeded self-play, win-rate/stall metrics). Numbers that change card data → re-run `dotnet test` + `tester-code`. Design questions that surface → back to `card-game-design`.
