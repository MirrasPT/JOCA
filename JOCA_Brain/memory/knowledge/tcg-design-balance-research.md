# TCG/CCG Design and Balance Best Practices
### A Research Report for AI-Assisted Card Game Design

**Research date:** 2026-06-28  
**Scope:** 1v1 digital collectible card games — design principles applicable to OmniClash and comparable games  
**Mode:** Deep (6 phases, 20+ primary sources)

---

## Executive Summary

This report synthesises design and balance knowledge from Magic: The Gathering, Hearthstone, One Piece Card Game, Star Wars: Unlimited, Yu-Gi-Oh!, Pokemon TCG, and peer-reviewed game-design research into seven evidence-backed sections. Core findings: (1) every card needs a typed, versioned data record separating identity fields from runtime-state fields; (2) each faction must own a distinct mechanical axis — overlap is the root cause of dominant colour-pair hierarchies; (3) auto-ramp resource systems (Hearthstone, OmniClash Gold) eliminate mana-screw variance but require stricter cost discipline because every player reliably reaches high-cost cards; (4) the Vanilla Test (attack + health = cost × 2 + 1) is the zero-ability baseline — each keyword subtracts proportional stats, not adds them on top; (5) degenerate patterns — infinite loops, lock states, solitaire combos, power creep — share a common root: repeatable effects with no per-activation cost floor or hard turn limit; (6) professional digital teams target 45–55% win rates per archetype measured over thousands of AI self-play games using deterministic simulators (SabberStone, MetaStone), catching first-player advantage (measured at 52.2% in Hearthstone beta) before launch; (7) a clean separation between a stateless, UI-independent rules engine and a presentation layer is the non-negotiable architectural prerequisite for deterministic replay, server-side authority, and automated balance testing.

---

## 1. Card Anatomy and Data Model

### 1.1 The Canonical Card Record

A card in a digital TCG is two distinct things: an **immutable definition** (what the card is) and a **mutable runtime instance** (where the card is and what has happened to it). Conflating these two is the most common early architecture mistake.

The Liquid Fire's multi-part CCG tutorial models cards as a polymorphic hierarchy with a base `Card` class holding all shared identity fields, and typed subclasses (`Hero`, `Minion`, `Spell`, `Weapon`) holding type-specific stats [1]. Capabilities that cut across types — being armed, being a combatant, being destructible — are modelled as interfaces (`IArmored`, `ICombatant`, `IDestructable`) rather than parent classes, so a Hero and a Minion can both engage in combat without sharing an inheritance chain [1].

The full set of fields a modern digital card needs is:

**Identity / definition layer (immutable, stored in data asset):**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` / ULID | Globally unique; survives set renames |
| `name` | `string` | Display name |
| `set_code` | `string` | Source set identifier |
| `collector_number` | `int` | Position within set |
| `rarity` | `enum` | Common / Uncommon / Rare / Mythic (or equivalent) |
| `type` | `enum` | Unit / Equipment / Event (card-type taxonomy) |
| `faction` | `enum[]` | Zero or more factions; enables multi-faction cards |
| `cost` | `int` | Base resource cost |
| `atk` | `int` (Units) | Base attack value |
| `def` | `int` (Units) | Base defence / toughness value |
| `power_bonus` | `int` (Equipment) | Stat delta applied to equipped unit |
| `keywords` | `string[]` | Keyword list (`Haste`, `Immortal`, `Siege`, …) |
| `abilities` | `Ability[]` | Structured ability records (see §7) |
| `flavour_text` | `string` | Narrative text; has no gameplay effect |
| `art_id` | `string` | Reference to art asset |
| `legal_formats` | `string[]` | Which formats / epochs this card is legal in |
| `regulation_mark` | `char` | Letter marking format epoch (cf. Pokémon TCG [2]) |
| `version` | `semver` | Card text version for errata tracking |

**Runtime instance layer (mutable, created at game start):**

| Field | Type | Notes |
|---|---|---|
| `instance_id` | `ULID` | Unique to this copy in this game |
| `controller_id` | `int` | Which player currently controls it |
| `zone` | `enum` | Deck / Hand / Field / Graveyard / Exile |
| `order_of_play` | `int` | Sequence number for simultaneous-effect resolution |
| `atk_current` | `int` | After buffs / debuffs |
| `def_current` | `int` | After buffs / debuffs |
| `is_exhausted` | `bool` | Tapped / rested state |
| `attached_to` | `instance_id?` | For Equipment cards |
| `damage_counters` | `int` | Accumulated damage this turn |
| `status_effects` | `StatusEffect[]` | Active temporary modifiers |

The Liquid Fire JSON tutorial confirms that minion-specific fields (`attack`, `hit points`) are absent from Spell card records — each card type carries only the data it needs [3].

### 1.2 Rarity Tiers

A modern Magic: The Gathering set contains approximately 260 cards distributed as 100 commons, 80 uncommons, 60 rares, and 20 mythic rares [4]. The academic literature on collectible objects argues that rarity should encode **specialisation**, not raw power [5]: common cards deliver broadly applicable effects; rare cards deliver situationally powerful or mechanically complex effects that would warp the game if widely available. This principle is especially important in digital games where distribution curves are controlled by drop tables rather than physical print runs.

Pokémon TCG introduced a `regulation_mark` letter printed near the artist credit to govern format legality — cards with older marks rotate out of Standard once per cycle, roughly every 18 months [2]. The One Piece Card Game adopted a `Block Number` system to the same end, with four sets rotating per year starting April 2026 [6].

### 1.3 Set Size, Faction Distribution, and Draft Archetypes

The MTG design target — "each faction has 20 commons, 16 uncommons, 12 rares, 4 mythics" — ensures balanced faction representation within every booster pack [4]. Drafting archetypes (two-colour pairs in a five-faction game = 10 archetypes) are planned from the skeleton stage so that each colour-pair combination has a coherent identity before individual card slots are filled [4]. For a smaller set (60–120 cards), this scales down proportionally.

### 1.4 Format / Rotation ("Epochs")

Rotation solves three problems simultaneously: it limits power creep accumulation, reduces the barrier to entry for new players (who only need ~2 years of sets), and expands design freedom (designers can use a powerful card if it will rotate before it degenerates the eternal pool) [7]. The trade-offs: competitive players feel punished when staples rotate; card prices drop; and players experience "burnout" from the constant pressure to stay current [7].

Practical options for a digital game like OmniClash:
- **Block rotation** (One Piece model): one block expires per year; Standard contains the last two blocks.
- **Seasonal ban list** (Yu-Gi-Oh model): no rotation but cards can be forbidden/limited.
- **Digital nerf/errata** (Hearthstone model): the digital medium permits stat text changes without physical replacement. Hearthstone has used this to reduce the cost or stat line of dominant cards — a lever unavailable in paper TCGs.

### Actionable Rules — Card Anatomy

- Separate the immutable definition record from the mutable instance record at the data-structure level; never write game-state into the definition asset.
- Assign a ULID (not sequential int) to every card instance — prevents enumeration attacks and enables safe distributed logging.
- Include `legal_formats[]` and a `regulation_mark` field from day one even if you launch with a single format.
- Set rarity by mechanical complexity and situational power, not by stat line height.
- Plan faction representation per rarity tier before designing individual cards; filling in a rarity grid prevents accidental colour weighting.
- Reserve digital nerf/buff as a last-resort lever; document every errata as a new `version` on the card record.

---

## 2. Faction / Colour Identity Design

### 2.1 The Colour Pie as the Model

Mark Rosewater, Head Designer of Magic: The Gathering, calls the colour pie one of the "Golden Trifecta" that made the game enduring — it generates constraints, defines flavour, and is the primary balance mechanism between factions [8]. The canonical 2021 Mechanical Color Pie document assigns each colour a set of **unique** mechanics (things only that colour can do), **primary** mechanics (things it does most), and **secondary/tertiary** mechanics (things it does less often or only in certain flavours) [9].

The five-colour distribution per that document [9]:

| Colour | Unique / Primary mechanical axis | Cannot do |
|---|---|---|
| **White** | Mass creature removal; damage prevention; small efficient tokens; life gain without cost | Direct damage to players; free card draw; land destruction |
| **Blue** | Counterspells; free card draw; permanent copying; unblockable creatures | Creature destruction (only bouncing) |
| **Black** | Unconditional creature destruction; self-discard as primary mechanic; graveyard reanimation; life as cost | Direct damage to players in non-life-cost form; free non-life card draw at instant speed |
| **Red** | Direct damage to any target; land destruction; impulsive draw (exile-and-play); temporary theft | Card draw without cost or exile; permanent stealing |
| **Green** | Fight effects; extra land drops; creature tutoring; the largest creatures | Counterspells; direct player damage |

The key design principle extracted from the pie: **every effect is owned by at most one or two colours at "primary" level**. A removal spell that also draws a card is a Black/Blue hybrid — designing it as a monocolor card violates the pie and eventually creates one colour that "does everything" [9].

### 2.2 Archetype Axes

The four major strategic archetypes of TCG play map naturally onto faction design [10]:

- **Aggro**: high unit density, low-cost units, direct damage. Wins by going below the opponent's removal range before they stabilise. In One Piece TCG, Red decks exemplify this: high-power low-cost characters, pressure from turn 1, low life total accepted in exchange for offensive leader ability [11].
- **Control**: removal, card draw, tempo denial. Wins in the late game after depleting opponent resources. In Star Wars: Unlimited, **Vigilance** is the control aspect — expensive powerful units, the `Sentinel` keyword (must be attacked before other units), and `Restore` (heals the base) [12].
- **Midrange**: medium-cost units with above-average efficiency. Neither races nor fully controls; looks to trade efficiently and win in the midgame.
- **Combo**: assembles a specific multi-card interaction for a disproportionate payoff. Requires the most careful balance work (see §5).

### 2.3 Star Wars: Unlimited's Dual-Axis System

Star Wars: Unlimited used a two-axis system — four **play-style aspects** (Vigilance / Command / Aggression / Cunning) plus two **alignment aspects** (Heroism / Villainy) that function as flavour-colour identity without their own mechanical axis [12]. This is an explicit departure from the MTG model: thematic character moments justify which aspect a character appears in, rather than a philosophical/ideological framework [12]. The lesson: faction identity does not have to be built on in-world ideology — narrative context is an equally valid anchor, as long as the mechanical differentiation remains crisp.

### 2.4 Hearthstone Classes

Hearthstone maps faction identity to nine (now eleven) classes, each with a `Hero Power` that costs 2 mana per use and defines the class's default strategy. Warrior = armour gain (defensive attrition); Rogue = +1/+1 dagger (weapon tempo); Mage = 1 damage to any target (removal flex). The Hero Power acts as a mechanical signature that is always available, preventing any class from feeling completely toothless even when draws are bad [13].

The design lesson here: in a game with a persistent leader (like OmniClash's General), that leader's ability should function as the class's Hero Power — always-available, modestly costed, and mechanically unique to that faction/archetype.

### Actionable Rules — Faction Identity

- Assign each faction a 1–2 sentence mechanical thesis before designing any cards; test every new card against that thesis.
- List effects explicitly as UNIQUE (no other faction gets this), PRIMARY (this faction does it most), or SECONDARY (available but not the focus) — never design a monocolor card that is primary in two mechanical axes from different factions.
- Map each faction to an archetype (aggro / control / midrange / combo) and verify that the cost curve of the faction's card pool actually supports that archetype.
- Build at least one keyword that is faction-exclusive, one that is shared between exactly two factions, and one that is universal — this creates a three-tier keyword identity tree.
- The General / leader ability is the faction's permanent signature; it should express the faction's axis even when the rest of the hand is bad.

---

## 3. Resource Systems

### 3.1 Taxonomy of Resource Models

Every TCG needs a mechanism that prevents players from deploying their strongest cards on turn 1. The major models in commercial games are [14][15]:

| Model | Example | Core mechanic | Mana screw risk |
|---|---|---|---|
| Dedicated land/mana cards | MTG | One land per turn from deck; colored mana | High — drawing too few or too many lands loses games regardless of play skill |
| Energy threshold (attached) | Pokemon TCG | Energy cards attach to creatures; lost when creature dies | Medium — deck-search mitigates screw but death spirals hard |
| No resource cards | Yu-Gi-Oh | Hand size and summon limit are the bottleneck | None for spells/traps; narrow (only normal summon) for monsters |
| Auto-ramp crystals | Hearthstone | +1 crystal per turn automatically, resets each turn, cap 10 | None |
| Multimodal / universal lands | Duel Masters, SWU, Lorcana | Any card played face-down as resource | None for raw availability; creates deckbuilding tension |
| Separate resource deck | One Piece (DON!!) | 10 DON!! cards in a separate deck, +1 or +2 per turn | None; predictable progression |

### 3.2 Why Modern Games Moved Away from Dedicated Mana Cards

The remptongames.com analysis identifies mana screw and mana flood as structural problems with the MTG land system — situations where the outcome of a game is determined by draw variance rather than play skill [14]. The Star Wars: Unlimited design team explicitly addressed this: players choose any card from their hand to place as a resource each turn, meaning "there's no situation in Star Wars: Unlimited where you 'just can't draw your resources'" [16]. The tradeoff: less decision space in deck construction (any card can be a resource) and weaker colour identity (no colour scarcity).

Hearthstone's auto-ramp (one crystal per turn, cap 10) was designed for digital accessibility — no physical token management, no resource cards diluting the deck [14]. Its cost: the digital medium is required (physical games cannot self-track mana crystals without hardware), and without colour scarcity there is no mechanical penalty for running cards from any power level — balance must be enforced by strict cost discipline instead.

### 3.3 The One Piece DON!! System

One Piece's DON!! system is a hybrid: a separate deck of 10 DON!! cards grows at a predictable rate (+1 on the first player's turn 1, +2 per turn thereafter), removing luck from resource generation entirely [17]. DON!! cards serve dual purpose: rested to pay costs, or attached to units/leaders to grant +1000 power. This creates a constant tempo decision — develop the board or power up an attack — without introducing random variance [17]. The mechanism is closest to OmniClash's per-turn Gold: it is predictable, eliminates mana screw, and creates meaningful turn-by-turn decisions about resource allocation.

### 3.4 Implications for Auto-Ramp Games

Games without mana screw require stricter cost discipline because:
- Every player reliably reaches the high end of the curve by turn 6–10.
- Expensive cards must be costed assuming they will always be drawn at a point where they are affordable.
- There is no "mana flood" pressure that penalises drawing too many resources late — the cap on auto-ramp systems (10 in Hearthstone, cap in OmniClash) substitutes for this.

The absence of colour scarcity also means the only balance lever for cross-faction interaction is the **card cost**, not the mana type — designers must be extremely precise about cost curves (see §4).

### Actionable Rules — Resource Systems

- Choose your resource model before designing any cards; the choice constrains every cost decision in the game.
- If using auto-ramp (like Gold in OmniClash): establish a hard per-turn cap, define the ramp schedule explicitly, and enforce cost discipline — every card at cost N must be clearly weaker than two cards at cost N/2 combined.
- Provide a published "resource schedule" (turn X = Y gold available) so card designers can sanity-check costs without playing games.
- For any auto-ramp system, the first player advantage must be addressed structurally (see §6.4).
- Avoid designing cards that generate additional resource (cost reduction, extra-gold-generation) without hard limits per turn — these are the fastest route to non-interactive snowball states.

---

## 4. Cost / Stat Curves and Power Budgeting

### 4.1 The Vanilla Test

The most widely cited baseline in digital TCG design is the **Vanilla Test**, originating from Hearthstone design discourse: for a minion with no abilities, `attack + health = cost × 2 + 1` [18]. This means:

| Mana cost | Vanilla stat total | Canonical example |
|---|---|---|
| 1 | 3 | 1/2 or 2/1 |
| 2 | 5 | 2/3 or 3/2 |
| 3 | 7 | 3/4 or 4/3 |
| 4 | 9 | 4/5 — Chillwind Yeti (4/5) was the canonical pass |
| 5 | 11 | 5/6 |
| 6 | 13 | 6/7 |

The "+1" offset accounts for the baseline value of simply having a minion body on the board (board presence, attack target availability) [18]. In a game where combat is deterministic (ATK ≥ DEF destroys, as in OmniClash), this baseline must be recalibrated because trading is more binary — a 3/4 and a 3/3 have very different trade outcomes when DEF thresholds hard-cutoff destruction.

The vanilla test was most reliable during Hearthstone's early sets (2014–2017) and has eroded since due to power creep — modern Hearthstone cards routinely exceed 2X+1 while also carrying abilities [18]. This erosion is the textbook definition of power creep (see §5.4).

### 4.2 Power Budget: Independent vs. Contextual Power

Cloudfall Studios' design guide distinguishes two power dimensions [19]:

- **Independent power**: the card's value assessed in isolation — its stat line, cost, and the face-value of its printed ability.
- **Contextual power**: the card's value in combination with other cards — synergies, enablers, and the current metagame.

A card can be independently underpowered yet contextually broken (e.g., a 1/1 for 1 that generates infinite loops with a specific enabler). Cards should pass a sanity check on both axes: reasonable stat line AND no known degenerate combination at design time [19].

### 4.3 Keyword Pricing

The GDC talk "Board Game Design Day: Balancing Mechanics for Your Card Game's Unique Power Curve" (Dylan Mayo, GDC 2018), which compared Magic, Pokemon, Hearthstone, The Spoils, and Clash Royale, uses the concept of **proportional distance off the curve** [20]: a card's cost efficiency relative to the vanilla baseline. A card with a keyword should cost more than a vanilla card with identical stats, or have reduced stats for the same cost.

The general principle, consistent across sources: **every keyword ability subtracts from the stat budget, not adds to it**. A 2-cost unit that would be 2/3 vanilla might become a 2/2 with Haste (or a 1/3 with Haste in a more keyword-conservative design), not a 2/3 with Haste for free. The failure to price keywords correctly is the most common route to early power creep in new card games.

Keyword price is not flat — a keyword's value scales with context. `Haste` (attack immediately) is worth more in an aggro faction than in a control faction. `Flying` (cannot be blocked except by flyers) is worth more in a game with few flying units. Designers should establish an approximate stat-cost table per keyword in their design documentation, and revisit it after each playtesting batch.

### 4.4 BREAD Heuristic for Draft / Format Design

The BREAD heuristic (Bombs, Removal, Evasion, Aggro, Dregs) was developed for Magic: The Gathering limited formats to guide card pick priority [21][22]:

- **Bombs**: win-the-game cards; no counter available forces loss.
- **Removal**: cards that destroy, exile, or neutralise opponent cards.
- **Evasion**: keywords that prevent blockers (Flying, Unblockable, etc.).
- **Aggro**: curve-fillers — efficient bodies that establish board presence.
- **Dregs**: filler cards played only when better options are unavailable.

BREAD applies directly to constructed format design: a healthy card pool needs cards at all five tiers, and Bombs should be carefully quantity-limited at high rarity (one or two per faction per set). The 2021 update "Keto" (coined by Limited Resources podcast hosts Luis Scott Vargas and Marshal Sutcliffe) extends BREAD for the modern, faster limited environment, deprioritising slow bombs in favour of interaction [21].

### 4.5 Cost Curves Within Decks

A 50-card deck needs a coherent mana curve — the distribution of card costs — to function consistently. For an aggro deck, the mode of the distribution should be 1–3; for a control deck, 3–6. In an auto-ramp game with predictable gold-per-turn, the curve is the primary deckbuilding constraint. Curve analysis in set design: every faction's common cards should cover costs 1 through 6 with enough units at each cost to fill the curve; expensive (6+) cards should be rare/mythic.

### Actionable Rules — Cost/Stat Curves and Power Budget

- Establish the Vanilla Test baseline for your system (ATK + DEF = cost × K + C) before designing any units; tune K and C for your specific combat rules.
- Price every keyword as a stat subtraction, not an addition; document the stat cost of each keyword in a design wiki.
- Never release a card that is contextually broken even if independently weak — pre-test all multi-card combinations involving any repeatable effect at design time.
- Use BREAD tiers explicitly when reviewing a set — count Bombs, confirm they are rare, confirm each faction has adequate Removal, Evasion, and curve-filling Aggro.
- Maintain an internal power-curve spreadsheet mapping each card's cost vs. stat-equivalent efficiency; cards more than 15–20% above curve at any cost slot are red-flag candidates before playtesting.

---

## 5. Degenerate-Pattern Taxonomy

### 5.1 Infinite Loops

An infinite loop occurs when a combination of cards creates a self-perpetuating cycle with no resource cost per iteration. The remptongames.com TCG Design Academy identifies two subtypes [23]:

- **Explicit infinite**: two or more cards trigger each other without termination. The canonical MTG example: Saheeli Rai's -2 ability creates a token copy of a creature; Felidar Guardian's `When Played` ability blinks (temporarily exiles and returns) another permanent, resetting Saheeli's loyalty. Together they produce unlimited hasty tokens in a single turn — what became known as the "Copycat" combo [23]. It took two cards from different sets, and its existence was not detected before the Standard format launched.
- **Engine-based loop**: a card converts one resource into another at better than 1:1 ratio with no per-turn limit. The remptongames.com analysis advises "err on the side of giving players a bit less than they are paying for — because the engine can be used infinitely" [23]. Necropotence (Black, MTG) converted life into card draw with no per-turn cap, creating broken draw engines in the 1990s.

**Prevention:** every repeatable effect must have at least one of: (a) a once-per-turn restriction, (b) a per-use resource cost that cannot be regenerated within the same loop, (c) a clause that makes it impossible to target the same permanent twice in a row. In the OmniClash model, on-cost / activated abilities should explicitly state "once per turn" if they produce resources or draw effects.

### 5.2 Lock / Stall States

A lock prevents the opponent from taking meaningful game actions. The canonical example is the Yata-Lock from Yu-Gi-Oh! (Yata-Garasu, 2002): dealing damage with Yata-Garasu skipped the opponent's next draw phase; combined with hand disruption, the opponent had no hand and no draws until dead [24]. This was so prevalent that Yata-Garasu and all key enabling cards were banned.

Yu-Gi-Oh!'s tournament policy addresses infinite loops deterministically: if a loop is triggered and would not itself produce a victory condition, the game state is advanced one iteration and the initiating card is sent to the Graveyard [24]. This is a rules-level patch to a design-level problem.

**Prevention:** lockdown effects should never be total (no draw AND no play AND no attack). Any "skip opponent's X" effect must be a one-time trigger, not a persistent state. Cards that prevent drawing are especially dangerous because drawing is the only way out.

### 5.3 Solitaire / Non-Interactive Combo Decks

Hearthstone's design team labels decks that win without interacting with the opponent "solitaire decks" and explicitly treats them as design failures [25][26]. Examples: OTK (One Turn Kill) combos that deal 30+ damage from hand with no board presence, Freeze/burn spell chains that kill without allowing counterattack. Ben Brode framed the design goal in 2015: "the game is at its most fun when you're solving an interesting puzzle each turn" using the opponent's board as puzzle pieces [25]. Decks that ignore the opponent's board eliminate the puzzle.

Hearthstone's response to Warsong Commander + Charge combinations (which enabled infinite-power minions) was a text change to Warsong Commander — a direct nerf to a card that was non-interactive in combination [25]. The lesson: "fun and interactive" is a stated design filter; any card that enables a win with zero board presence is suspect.

**Prevention:** win conditions should require at least one unit to have been on the board or in combat. Spell-only kill conditions are possible only with hard damage caps per turn or hand-size limits.

### 5.4 Power Creep

Power creep is the gradual obsolescence of older cards as successive sets print strictly superior variants [27]. Mark Rosewater describes the MTG design team's response as the "Escher Stairwell" — they raise power in one area while lowering it in another, creating an illusion of rising power while keeping the actual average stable [27]. Rotation (Standard format) mitigates accumulation: once old cards rotate out, designers no longer need to price around broken old interactions [7].

In a digital game without rotation, power creep is faster because no cards ever leave the pool. Hearthstone's strategy: buff old cards digitally (stat increases to make them viable) as a complement to nerfing new broken cards — a lever unavailable in paper TCGs [28].

### 5.5 Degenerate Pattern Detection via Simulation

Because the rules engine is deterministic (§7), brute-force search is viable for loop detection:

- A **random-agent simulator** (two players each choosing actions uniformly at random) will detect infinite loops as games that never terminate — they exceed a move-count threshold. This is the simplest form of automated degenerate-pattern detection.
- The SabberStone C# Hearthstone simulator implements this: games terminate at a move-count limit and report the state [29]. Research using MetaStone (also Hearthstone-based) runs 300 simulated matches per deck pair with ~5% standard deviation in win-rate evaluation [30].
- Evolutionary algorithms can be used to deliberately seek degenerate states: fitness functions that reward maximum damage dealt per turn or minimum game length will converge on combo kills faster than human playtesting [31].

The remptongames.com design academy recommends identifying cards whose effects can be iterated without resource decay and marking them as "combo watch" before they enter a set [23].

### Actionable Rules — Degenerate Patterns

- Every repeatable / activated / on-cost ability must have a per-turn cap OR a resource cost that cannot be regenerated within the same turn.
- Mark every card that generates resources, draws cards, or reduces costs as "combo watch"; test it against every other card in those categories before release.
- Implement a move-count hard limit in the engine; games exceeding the limit should be logged as draws and flagged for design review.
- Never design a lock that prevents both drawing AND playing; locks should be temporary (one turn) or partial.
- Win conditions must require board interaction; spell-only kills from a clean board state need damage caps per turn.
- Use evolutionary algorithms with a "max damage this turn" fitness function to stress-test combo potential before every set release.

---

## 6. Playtesting and Telemetry Methodology

### 6.1 Win Rate Targets

The academic consensus on competitive balance is that all archetypes should target win rates in the 45–55% range against the field [32]. The 50% target is "easier to achieve in real-time games with symmetric settings" but harder in turn-based games because of first-player advantage [32]. The goal is an approximately balanced matrix across all archetype matchups — measured as the win rate of each archetype against each other archetype.

Research on 7 Wonders Duel found a 66.8% first-player win rate out of 10,000 self-play games before any compensation mechanisms [32]. Hearthstone's beta showed a first-player win rate of 52.2% (first player received 4 cards; second player received 5 cards); after adding "The Coin" (a zero-cost 1-mana card given to the second player), the gap dropped to 50.4% [33]. OmniClash must similarly measure and compensate for first-player advantage — common mechanisms are bonus cards, initiative tokens, or a resource discount.

### 6.2 Deterministic Self-Play Simulation

The standard architecture for digital balance testing:

1. **Deterministic rules engine** (pure C# / Java / Rust, no UI) — the engine must produce identical outputs given identical inputs including random seeds. This is a prerequisite for reproducible testing.
2. **AI agent library** — at minimum: a random agent (uniform action selection), a greedy agent (highest immediate value), and an MCTS (Monte Carlo Tree Search) agent [34].
3. **Simulation harness** — batches of N games (typical: 300–10,000 per matchup) with statistics aggregated: win rate, game length (turns), action count, resource utilisation.

SabberStone, the open-source C# Hearthstone simulator, implements more than 95% of standard card interactions and ships a built-in MCTS example [29]. Research using evolutionary algorithms against SabberStone generated decks that outperformed human-made decks when tested by the AI agent [31].

### 6.3 Metrics That Matter

The AI Playtesting research framework [35] identifies four metric categories:

- **Balance metrics** (measured with random agents): seat/first-player advantage, strategy diversity (distribution of winning strategies), dead-action rate (% of turns where no meaningful action exists), median game length, elimination timing.
- **Skill gap measurement**: MCTS agents take half the seats, random agents take the other half — the win-rate difference measures how much the game rewards strategic play vs. luck.
- **Card play-rate**: what percentage of games include each card being played from hand. Cards with <10% play rate across thousands of games are effectively dead cards and candidates for buff or removal.
- **Mirror-match detection**: when two copies of the same archetype face each other, the first-player advantage is often exaggerated. Mirror-match win rates should be near 50%; deviations indicate asymmetric openers or first-turn action density.

The metagame autobalancing research (Hernandez et al., IEEE Conference on Games 2020) frames balance not as "all win rates equal" but as matching a **designer-specified target graph**: some archetypes should be slightly favoured against others in a deliberate rock-paper-scissors structure that creates healthy diversity [36].

### 6.4 First-Player Advantage: Measurement and Compensation

Standard compensation mechanisms [33]:

| Mechanism | Used by | Effect |
|---|---|---|
| Extra card for player 2 | Hearthstone, Pokemon TCG | Compensates for tempo deficit; tested in beta to calibrate |
| "The Coin" (bonus 1-resource spell) | Hearthstone | +50.4% measured win rate for player 2 after addition |
| Cannot attack turn 1 | Pokemon TCG, Yu-Gi-Oh | Eliminates early aggro advantage for P1 |
| Initiative token / alternating first action | Star Wars: Unlimited | Dynamic first-action assignment per round |
| P2 draws 2 instead of 1 | Various | Scales advantage for longer games |

For OmniClash (Gold auto-ramp), the simplest and most measurable compensation is awarding player 2 one extra Gold unit on their first turn, or giving player 2 one extra card — both are verifiable by simulating 1,000+ games and measuring the delta.

### 6.5 Archetype Diversity Monitoring

A healthy metagame should have at least three competitive archetypes (aggro, control, midrange/combo) each maintaining 40–60% representation in top-level play over time. When one archetype exceeds 40% of tournament wins, it signals a dominant strategy requiring intervention (nerf or targeted counter-card in next release) [36]. Digital telemetry should track:

- **Deck archetype distribution** (which archetypes are being played)
- **Win rate by archetype vs. field** (not just overall win rate)
- **Game length histogram** (median turns to win; very short medians signal aggro dominance)
- **Card inclusion rate** (% of decks including each card)
- **Play-from-hand rate** (how often each card is cast vs. sitting in hand when game ends)

### Actionable Rules — Playtesting and Telemetry

- Build the deterministic rules engine before any UI — it must be self-testable via unit tests and simulatable via a scripting interface.
- Run random-agent self-play (1,000+ games) after every card addition to catch move-count overflows (infinite loops) and game-length spikes.
- Measure first-player win rate explicitly; compensate before launch; re-measure after compensation.
- Track card play-rate and card win-contribution metrics from day one; cards below 10% play-rate are dead; cards above 30% win-contribution delta are candidates for nerf.
- Target 45–55% win rates per archetype; design at least 3 viable archetypes per faction.
- Use MCTS agents to stress-test combo kills — any combination that produces a win before turn 5 at high MCTS skill level is a candidate for removal.

---

## 7. Digital Card Game Software Architecture

### 7.1 The Rules Engine as a POCO (Plain Old Class Object)

The foundational architectural principle, stated by multiple independent sources: **the rules engine does not know how the game is displayed**. The dev.to card game architecture article frames it directly: "The Game Core, in a software approach, doesn't know how the game will be shown to the player" [37]. The Liquid Fire CCG tutorial confirms: "the core needs to work without any dependency if possible" to support unit testing and multi-platform deployment [1].

The rules engine should be a self-contained library with:
- No UI imports
- No network dependencies
- Pure deterministic functions: given game state S and action A, always produce state S'
- Full serializability of game state (supports replay, undo, server-side authority, and testing)

For OmniClash (Unity C# implementation), this means the engine is a pure C# project (no MonoBehaviour, no UnityEngine imports) that Unity's presentation layer calls into. The "63 tests green" motor described in OmniClash memory represents exactly this: a testable POCO engine separate from Unity's render pipeline.

### 7.2 Layered Architecture

The four-layer model [37]:

```
┌─────────────────────────────────┐
│  Visual Representation (Unity) │  ← MonoBehaviours, Animators, Cameras
├─────────────────────────────────┤
│  Action / Input Queue           │  ← Player choices queued for engine
├─────────────────────────────────┤
│  Game Log / Event Stream        │  ← Append-only record of all events
├─────────────────────────────────┤
│  Game Core (Rules Engine)       │  ← Pure C#, no Unity deps, deterministic
└─────────────────────────────────┘
```

The **Action Queue** buffers player inputs: move requests arrive from UI → are validated by the engine → consequences are applied → state transitions are emitted as events. The **Game Log** is append-only — it records every event that occurs, enabling full replay and post-game analysis.

### 7.3 Data-Driven Card Definitions

The Liquid Fire JSON model stores card definitions as structured JSON where each card is a dictionary with only the fields relevant to its type [3]:

```json
{
  "id": "oc-001",
  "type": "Unit",
  "name": "Roman Legionary",
  "faction": "Romans",
  "cost": 2,
  "atk": 2,
  "def": 3,
  "keywords": ["Shield"],
  "abilities": [
    {
      "trigger": "on_play",
      "action": "DrawAction",
      "amount": 1,
      "targetSelector": { "type": "Self" }
    }
  ]
}
```

The `DeckFactory` class deserialises these at game start: (1) card instantiation via reflection using the `type` string, (2) ability attachment by parsing the `abilities` array, (3) target selector binding through an `ITargetSelector` interface [3]. This means adding a new card type or new ability type requires only a new class registration — no engine code changes.

### 7.4 Ability / Effect Registry

A structured ability system requires three components:

1. **Trigger registry**: maps trigger events (`on_play`, `on_death`, `on_attack`, `on_cost`, `passive`) to handlers. When an event fires in the engine, the registry polls all cards currently in scope and invokes registered handlers.
2. **Action library**: a catalogue of atomic game actions (DamageAction, DrawAction, SummonAction, DestroyAction, AttachAction). Each action is a class implementing an `IAction` interface with `Execute(GameState state)` and `Validate(GameState state) → bool`.
3. **Target selector system**: defines how an ability acquires targets (`RandomTarget`, `AllTargets`, `ManualTarget`, `SelfTarget`, with zone and alliance filters) [3].

SabberStone implements this as a "simple declarative task system" where each card mechanic is expressed as a task object composable with other task objects [29]. This is the same pattern as Unity's component system applied to card abilities.

### 7.5 Event System for Triggers

The trigger types relevant to OmniClash (on-play / on-death / activated / on-cost / passive / judgment) map directly to an event-bus pattern:

```
EventBus.Subscribe(GameEventType.UnitPlayed, handler)
EventBus.Subscribe(GameEventType.UnitDestroyed, handler)
EventBus.Subscribe(GameEventType.AbilityActivated, handler)
```

The engine fires an event → all subscribers receive it → handlers execute in registration order (or priority order if order-of-play matters). The `orderOfPlay` field on the card instance [1] resolves simultaneous-trigger ordering.

A critical design constraint: trigger handlers must be re-entrant-safe. A handler that destroys a unit may itself trigger an `on_death` handler, which may trigger another handler. The engine must maintain a processing stack and handle nested events without stack overflow or state corruption. The standard approach is an **event queue** (not immediate execution): events are enqueued, then processed one at a time from the queue head, with new events enqueued at the tail.

### 7.6 Open-Source Reference Implementations

| Project | Language | Game modelled | Notes |
|---|---|---|---|
| **SabberStone** | C# | Hearthstone | >95% Standard cards; MCTS example included; ships Kettle server for live client testing [29] |
| **Fireplace** | Python 3 | Hearthstone | Uses official CardDefs XML; extensive test suite; created the Kettle protocol [29] |
| **Hearthbreaker** | Python 3 | Hearthstone (up to Blackrock Mountain) | Used by DeepMind team for card generation research [29] |

All three are products of the HearthSim developer community and are open-source. SabberStone is the most architecturally aligned with C#/Unity development.

### Actionable Rules — Software Architecture

- The rules engine is a pure C# POCO library — no Unity imports, no UI, no network calls — testable by NUnit/xUnit in isolation.
- Game state must be fully serialisable to JSON/binary; every game must be replayable deterministically from its initial seed + action log.
- Use a data-driven JSON card definition system: cards are data files, not code files; new cards add JSON entries, not C# classes.
- Implement an event queue (not immediate-dispatch) for trigger resolution; process one event at a time; queue new events from handlers at the tail.
- Register abilities via an interface (`IAbility` with `Trigger`, `Action`, `TargetSelector`) — never hardcode card interactions in the engine core.
- Study SabberStone's declarative task system as a reference for composable effect chains in C#.
- Implement a move-count safeguard (max 500–1000 actions per game) that terminates and logs any game hitting the limit — this catches infinite loops automatically.

---

## Synthesis and Cross-Cutting Insights

Three insights emerge from triangulating across all seven sections:

**1. The deterministic engine is the prerequisite for everything else.** Automated balance testing (§6), degenerate-pattern detection (§5.5), replay, and server-side authority all require a rules engine that produces identical outputs given identical inputs. Building the engine correctly in Phase 1 pays compound returns across the entire development cycle.

**2. Auto-ramp resource systems demand tighter cost discipline.** OmniClash's Gold system eliminates mana-screw variance — a player experience win — but removes the natural brake that mana-screw provides against powerful late-game cards. The compensation is: (a) strictly enforced Vanilla Test baselines, (b) keyword pricing that reduces stats, (c) hard caps on per-turn resource generation from card effects.

**3. Faction identity is the primary long-term balance anchor.** When each faction has an exclusive mechanical axis and only that faction can do its unique things at the primary level, cards cannot be strictly better than other-faction cards — they are different. The colour pie's resilience across 30+ years of MTG is evidence that ideological / mechanical distinctness prevents the "best-of-all-worlds" single-faction dominance that destroys competitive diversity.

---

## Limitations and Caveats

- The Vanilla Test formula (ATK + HP = cost × 2 + 1) applies to Hearthstone's specific combat system where both creatures deal damage simultaneously. OmniClash's deterministic combat (ATK ≥ DEF destroys) requires a recalibrated formula where DEF acts as a hard threshold, not a damage buffer — the designer must empirically derive the correct K and C constants.
- Specific power-budget formulas for keyword pricing (how many stat points each keyword costs) are game-specific and are not published in primary sources — the principle (keywords subtract from stat budget) is confirmed, but the specific numbers must be determined by in-game playtesting.
- The simulation research cited (SabberStone, MetaStone) models Hearthstone specifically; transfer to OmniClash requires building a game-specific simulator.
- First-player advantage data (52.2% Hearthstone, 66.8% 7 Wonders Duel) is game-specific and cannot be directly applied to OmniClash without measurement.
- The GDC 2018 talk "Balancing Mechanics for Your Card Game's Unique Power Curve" (Dylan Mayo) covers proportional distance off the curve in detail, but full content requires GDC Vault membership [20].

---

## Recommendations for OmniClash

1. **Formalise the OmniClash Vanilla Test.** Run 100 hypothetical unit matchups at each cost slot to derive ATK + DEF = f(cost) for the deterministic combat system before finalising the card catalogue.
2. **Audit the five factions for axis overlap.** For each pair of factions, list their primary mechanics; any mechanic appearing as primary in two factions is a design conflict to resolve.
3. **Implement the Gold ramp schedule** in writing: turn 1 = 1 Gold, turn 2 = 2 Gold, …, turn N = N Gold (with cap). Publish this as the cost design constraint document.
4. **First-player measurement.** Build a random-agent simulator now; run 1,000 games; measure P1 win rate; add compensation before any public testing.
5. **Combo watch list.** Flag all activated/on-cost abilities that produce Gold, draw cards, or summon units; run exhaustive two-card combination tests before each set release.
6. **Move-count limit.** Add `if (actionCount > 800) { EndGame(Draw); LogForReview(); }` to the engine immediately.
7. **Card data model freeze.** Before adding the 106th card, finalise the JSON schema with all fields in §1.1; schema changes after this point require migration of all existing card definitions.

---

## Bibliography

[1] The Liquid Fire, "Make a CCG – Data Modeling," 2017-09-04. https://theliquidfire.com/2017/09/04/make-a-ccg-data-modeling/

[2] Pokémon Company International, "2025 Pokémon TCG Standard Format Rotation Announcement." https://www.pokemon.com/us/pokemon-news/2025-pokemon-tcg-standard-format-rotation-announcement

[3] The Liquid Fire, "Make a CCG – JSON," 2018-02-19. https://theliquidfire.com/2018/02/19/make-a-ccg-json/

[4] remptongames.com, "From Concept to Card: How to Design an Epic TCG Set," 2023-09-23. https://remptongames.com/2023/09/23/from-concept-to-card-how-to-design-an-epic-tcg-set/

[5] Ham, B., "Rarity and Power: Balance in Collectible Object Games," *Game Studies*, vol. 10, no. 1, 2010. https://gamestudies.org/1001/articles/ham

[6] TCGplayer, "2026 One Piece Standard Rotation Guide." https://www.tcgplayer.com/content/article/2026-One-Piece-Standard-Rotation-Guide/c9aabe8a-cb1d-48bd-a1b2-ea04a71499a0/

[7] Pojo.com, "Pros and Cons of Set Rotations in TCG's." https://www.pojo.com/pros-and-cons-of-set-rotations-in-tcgs/

[8] Rosewater, M., "Let's Talk Color Pie," *Making Magic*, Magic: The Gathering. https://magic.wizards.com/en/news/making-magic/lets-talk-color-pie

[9] Rosewater, M., "Mechanical Color Pie 2021," *Making Magic*, Magic: The Gathering. https://magic.wizards.com/en/news/making-magic/mechanical-color-pie-2021

[10] remptongames.com, "A Re-Source of Pride: Designing Resource Systems in Collectible Games," 2017-07-20. https://remptongames.com/2017/07/20/a-re-source-of-pride-designing-resource-systems-in-collectible-games/

[11] Shonen TCG, "One Piece TCG Life Cards Explained: Damage & Triggers." https://www.shonentcg.com/blog/one-piece-tcg-life-cards-explained

[12] Star Wars: Unlimited, "Behind Unlimited: On the Color Pie," Fantasy Flight Games. https://starwarsunlimited.com/articles/behind-unlimited-on-the-color-pie

[13] Hearthstone Fandom Wiki, "Design and development of Hearthstone." https://hearthstone.fandom.com/wiki/Design_and_development_of_Hearthstone

[14] remptongames.com, "A Re-Source of Pride: Designing Resource Systems in Collectible Games," 2017-07-20 (as [10]).

[15] Gametrodon, "Card Game Resource Systems." https://gametrodon.com/card-game-resource-systems/

[16] The Fifth Trooper, "Introduction to Star Wars Unlimited TCG." https://thefifthtrooper.com/an-introduction-to-star-wars-unlimited-tcg/

[17] DenDen Drops, "One Piece TCG DON!! System Explained: The Complete Guide to Resource Management." https://dendendrops.com/articles/one-piece-tcg-don-system-explained

[18] HearthPwn Forums, "The Vanilla Test," General Discussion. https://www.hearthpwn.com/forums/hearthstone-general/general-discussion/235548-the-vanilla-test

[19] Cloudfall Studios, "Design Tips: Power Curves," 2018-05-14. https://www.cloudfallstudios.com/blog/2018/5/14/design-tips-power-curves-i

[20] GDC Vault, "Board Game Design Day: Balancing Mechanics for Your Card Game's Unique 'Power Curve'" (Dylan Mayo, 2018). https://gdcvault.com/play/1025533/Board-Game-Design-Day-Balancing

[21] Draftsim, "Everything You Need to Know About BREAD in MTG." https://draftsim.com/bread-mtg/

[22] The Mana Base, "Let's Get This B.R.E.A.D." https://themanabase.com/lets-get-this-b-r-e-a-d/

[23] remptongames.com, "TCG Design Academy 2: How to BREAK a Trading Card Game," 2022-03-30. https://remptongames.com/2022/03/30/tcg-design-academy-2-how-to-break-a-trading-card-game/

[24] Yugipedia, "Infinite loop." https://yugipedia.com/wiki/Infinite_loop

[25] Hearthstone Blizzard, "Hearthstone's Card Balance Philosophy," 2014-01-16. https://hearthstone.blizzard.com/en-gb/news/12383909/hearthstones-card-balance-philosophy-1-16-2014

[26] Hearthstone Top Decks, "Has Hearthstone Entered a Solitaire Meta with United in Stormwind?" https://www.hearthstonetopdecks.com/has-hearthstone-entered-a-solitaire-meta-with-united-in-stormwind/

[27] MTG Wiki, "Power creep." https://mtg.fandom.com/wiki/Power_creep

[28] Hearthstone Wiki, "Power creep." https://hearthstone.fandom.com/wiki/Power_creep

[29] HearthSim, "Hearthstone Simulation and AI — Simulators." https://hearthsim.info/simulators/; GitHub: HearthSim/SabberStone. https://github.com/HearthSim/SabberStone

[30] Takagi, S. et al., "Q-DeckRec: A Fast Deck Recommendation System for Collectible Card Games," arXiv:1806.09771. https://arxiv.org/pdf/1806.09771

[31] García-Sánchez, P. et al., "Automated Playtesting in Collectible Card Games using Evolutionary Algorithms: A Case Study in Hearthstone," *Knowledge-Based Systems*, vol. 153, 2018. https://www.researchgate.net/publication/324767888_Automated_Playtesting_in_Collectible_Card_Games_using_Evolutionary_Algorithms_a_Case_Study_in_HearthStone

[32] Research cited via arxiv: "Learning to Play 7 Wonders Duel Without Human Supervision," arXiv:2406.00741; "Identifying and Clustering Counter Relationships…," arXiv:2408.17180. First-player advantage data: https://arxiv.org/pdf/2406.00741

[33] TV Tropes, "First-Player Advantage Mitigation." https://tvtropes.org/pmwiki/pmwiki.php/Main/FirstPlayerAdvantageMitigation

[34] Cowling, P. et al., "A Monte Carlo Approach to Skill-Based Automated Playtesting," *PMC*, 2018. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6319931/

[35] Cheung, B., "AI Playtesting — When Your Board Game Tests Itself," Benny's Mind Hack. https://bennycheung.github.io/ai-playtesting-when-your-game-tests-itself

[36] Hernandez, D. et al., "Metagame Autobalancing for Competitive Multiplayer Games," *IEEE Conference on Games*, 2020, arXiv:2006.04419. https://arxiv.org/abs/2006.04419

[37] Feliperes, "Card Games Programming 1 — Game Core," DEV.to. https://dev.to/feliperes/card-games-programming-1-game-core-4e8h

---

## Methodology Appendix

**Research mode:** Deep (6 phases)  
**Sources gathered:** 25 primary/secondary sources across game design blogs, academic papers, official design documents, wiki references, and open-source repositories  
**Source types:** Official game design articles (Magic: The Gathering Wizards.com, Star Wars: Unlimited official, Hearthstone Blizzard); game design practitioner blogs (remptongames.com, Cloudfall Studios, The Liquid Fire, GDC Vault); academic papers (arXiv, ResearchGate, PMC, IEEE); community wikis (MTG Wiki/Fandom, Hearthstone Wiki/Fandom, Yugipedia); game-specific resources (HearthSim, DenDen Drops, TCGplayer)  
**Fabrication policy:** No quotes, URLs, or numeric formulas were cited without confirmation from retrieved source content. Specific numbers (vanilla test formula, first-player win rates, set size distributions) are sourced from primary documents. Where exact formulas were not publicly available (keyword cost tables, specific power-budget multipliers), this is stated explicitly in the text.  
**Outline adaptation:** Initial outline was retained unchanged — evidence confirmed all seven planned sections with adequate source density.

---

*Report generated 2026-06-28 for OmniClash (OC) TCG skill development.*
