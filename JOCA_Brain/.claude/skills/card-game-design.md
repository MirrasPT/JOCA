---
name: card-game-design
description: "Trading/collectible card game (TCG/CCG) design fundamentals for a 1v1 digital duel — card anatomy & data model, the three card types, resource systems (per-turn ramp vs land/mana), leader/general + life/walls win conditions, faction/colour identity as distinct mechanical axes, keyword discipline, ability triggers, rarity, and set/epoch rotation. MUST be read before designing cards, factions, keywords, or win conditions. Triggers: card design, desenhar carta, faction identity, color pie, keyword, win condition, deck archetype, TCG mechanics, general/leader, rarity, set rotation."
triggers: card design, desenhar carta, faction identity, color pie, keyword, win condition, deck archetype, TCG mechanics, leader general, rarity, set rotation, card anatomy, resource system
chain: game-balance
metadata:
  type: skill
  category: game-design
---

# Card Game Design (TCG/CCG)

Design fundamentals for a 1v1 duel card game. Grounded in the conventions of the games players actually adopt (One Piece Card Game, Star Wars Unlimited, Hearthstone, Magic) and tuned for the OmniClash model (General + walls, per-turn Gold, ATK≥DEF combat). Pair with `game-balance` for the numbers and `card-art-pipeline` for the art.

> **Read-first** before designing cards, factions, keywords, or win conditions. Design is a domain, not a code task — model the system before writing any `Cards`/`EffectRegistry` code.

---

## 1. Card anatomy & data model
A card definition is **data**, not code (data-driven — see `unity-gamedev` §2). Stable string `id` (survives reordering; = art filename). Fields:
- `id`, `name`, `faction`, **`type`** (Unit / Equipment / Event), **`cost`** (resource to play).
- Unit only: **`atk`**, **`def`**. Equipment: stat bonuses + granted keyword. Event: one-shot effect.
- `rarity` (availability/complexity tier, **not** power), `epoch`/`set` (rotation + powercreep control), `keywords`, `abilities` (trigger + effect, referenced by id — resolved by the engine, never inlined in data).

## 2. The three card types
- **Unidade (Unit)** — a body with ATK/DEF that persists on the field and attacks. The board's backbone.
- **Equipamento (Equipment)** — attaches to a unit (+ATK/+DEF/keyword); dies with it. Tempo investment that can be 2-for-1'd.
- **Evento (Event)** — single use; resolves and goes to the graveyard. Interaction, reach, swings. Density of events is itself a design lever (a faction can be event-driven).

## 3. Resource system — per-turn ramp, no resource cards
OmniClash uses **Gold per turn** (turn N → N gold, capped), no land/mana cards. This is the modern consensus (One Piece "DON!!", SWU resources, Hearthstone mana): it **eliminates mana screw/flood by design** — the #1 conversion argument in the community (PRD §13). Keep it. Levers that stay interesting without resource cards: a hard cap (OmniClash = 10) that some cards/generals raise; ramp effects (extra gold/turn); cost reduction; gold-positive payoffs (watch these — they are the infinite-loop risk, see `game-balance`).

## 4. Win condition — leader/general + life as a wall track
The **General** is a persistent leader in play from turn 1 with a fixed faction ability and **no ATK/DEF** — only **walls** (life). Combat against the general strips one wall per hit; the final hit past the last wall wins (OmniClash: 5 walls, 6th hit lethal). This is the One Piece model (Leader + life cards). It gives a **visible, climbing clock** (unlike a hidden life total) and makes "rebuild a wall" a real defensive play. Keep generals **1 per deck**, unique; a faction may later have several generals to choose from.

## 5. Faction identity = one distinct mechanical axis each
The cardinal rule (the MTG colour pie made canonical): **every faction owns a different way to win**, and they must not bleed into each other. Give each an axis on the tempo↔attrition / aggro↔control spectrum plus a signature mechanic:
- **Romans** — slow, defensive, **economy ramp** + formation buffs (late game).
- **Vikings** — fast, fragile **aggro** + graveyard **recursion** (buy time, keep pressure).
- **Astecas** — **sacrifice-offensive** (spend your own bodies for buff/damage/wall-break).
- **Gregos** — **event engine** (the more Events you play/bank, the more the board pumps).
- **Egípcios** — **inevitability/immortality** (Imortal cheat-death + Julgamento graveyard payoffs + resurrection).
"Three death factions" (Vikings/Astecas/Egípcios) stay distinct because their axis differs: time vs sacrifice-buff vs un-killability. **Test:** if you can swap a card between two factions and it feels native to both, the identities are too close.

## 6. Keywords — few, evergreen, intuitive
Keywords compress repeated rules text. Discipline: **keep the count small**, each must be self-evident from its name, and reuse them across the set (evergreen) rather than inventing one-offs. OmniClash evergreen set: **Bloquear** (block), **Ataque Rápido** (quick attack / no summoning sickness), **Imortal** (pay a discard → cheat death). A keyword is also a **balance price** (see `game-balance` — it costs stat points). Don't keyword something that fires once — write it as an ability.

## 7. Ability triggers (the 4 + interceptors)
Model abilities as **trigger + effect**, resolved by the engine's registry (on-play / on-death / activated / passive), never hard-coded per card:
| Trigger | Fires |
|---|---|
| **Ao Jogar** (on-play) | once, when the card enters the field |
| **Em Campo** (passive/aura) | continuously while in play + condition met |
| **Activar (N)** (on-cost) | pay N gold (or other cost) → repeatable |
| **Ao Morrer** (on-death) | once, when the unit is destroyed → graveyard |
Plus **interceptors/listeners** for advanced factions: **Imortal** (intercepts death), **Julgamento** (listens for "a card entered the graveyard"), "whenever an Event is played". On-cost repeatable abilities are the single biggest degenerate-loop risk — design their cost/payoff so a loop is never gold-positive (`game-balance`).

## 8. Rarity ≠ power (avoid pay-to-win)
Rarity (Recruta→Veterano→Campeão→General→Divindade) signals **availability and complexity**, not raw strength. The cautionary tale is power-tied rarity → pay-to-win + power creep (the community's loudest complaint; the nerf-treadmill memes on r/hearthstone). Make staples replaceable commons; legends are *splashy*, not *strictly better*. Control the catalogue so no rarity becomes a mandatory win-condition.

## 9. Set / epoch rotation — the powercreep brake
An `epoch`/season field lets formats rotate so the power ceiling resets instead of climbing forever. You control the whole catalogue, so prefer **horizontal** design (new options) over **vertical** (strictly stronger reprints). Power creep + scalpers is the #1 thing players say kills card games — design against it from day 1.

## Anti-patterns
| Wrong | Right |
|---|---|
| Card stats/abilities hard-coded in engine logic | data-driven definitions + effect registry |
| Two factions that play the same | one distinct mechanical axis each (swap-test) |
| A new keyword for a once-off effect | write it as an ability; keep keywords evergreen+few |
| Rarity = power | rarity = availability/complexity; staples replaceable |
| Hidden life total | visible wall/life-card clock (climbing tension) |
| Resource cards (lands) | per-turn ramp (kills screw/flood) |
| Vertical reprints "but better" | horizontal options + epoch rotation |
| Repeatable on-cost with net-positive resource | non-positive loop (see `game-balance`) |

## Further reading
Cited research backing this skill (colour pie, resource models, leader/life win-cons, rarity≠power, rotation — with sources): `memory/knowledge/tcg-design-balance-research.md`.

## Próximo passo (chain)
After the design is set → `game-balance` to price the cards (stat budget, keyword/ability cost, curve) and screen for degenerate patterns. Implementing it in the engine → `unity-gamedev`; auditing engine vs this design → `card-catalog-sync`. Art → `card-art-pipeline`.
