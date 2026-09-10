---
name: design-shotgun
description: "Explore several design variants in parallel before coding — generates N distinct mockups, compares them side by side, collects structured feedback and iterates. Adapted from gstack's design-shotgun. MUST be invoked when the user says: explore variants, design options, design shotgun, show me some ideas, visual brainstorm, I don't like this look, several versions. SHOULD also invoke when: the user describes new UI but has not yet seen what it could look like."
triggers: explore variants, design variants, design options, design shotgun, show me ideas, show options, visual brainstorm, several versions, I don't like this look, alternative design, alternative mockups, explore designs
chain: design-review, design-html, frontend
---
# /design-shotgun — Exploring design variants

Instead of a single proposal, generate **N distinct variants in parallel**, compare them, and iterate from the chosen one. It multiplies design speed and stops you fixating on the 1st idea. Adapted from gstack's `design-shotgun`.

Difference from `img-gen` (1 image) and `frontend` (implements): this is **controlled divergence before converging**.

## When to use it
- "show me options", "explore variants", "I don't like this look", new UI with no settled visual direction.
- Proactively: the user describes a UI feature but has not yet seen what it could look like.

## Workflow

### 1. Foundation (sequential, before the fan-out)
- Read the design system if it exists: `DESIGN.md`, tokens, `brand-guidelines`. Variants respect the system (they do not invent palettes out of nothing, unless the brief is "explore the identity").
- Define the **common brief**: what the page/component is, the objective, the audience, 1 hard constraint (e.g. "it has to fit above the fold").
- **Ask for 2-3 concrete references BEFORE the fan-out** (URLs or images the user likes) and state in 1 line what you are keeping from each. Without references, abstract axes do not convey what the user has in their head: two full rounds (6+6 agents) were thrown away because the sentence that solved everything — "elegant, refined but modern, one more minimalist, one bolder" + 3 URLs — only arrived after he saw the wrong result.
- **A visual benchmark without images is not a benchmark, it is a description.** If the reference is a product you only know through textual research, ask for captures — or say explicitly that the result is an interpretation, not an adaptation. Textual research describes features, not visual anatomy.
- **Read the bank of axes**: `Read(".claude/reference/design-dataset.md")` — verified OKLCH palettes, font pairings and named styles. Each variant = 1 style + 1 palette + 1 font pairing, DISTINCT combinations; record the combination in the output (`[V2: brutalist-editorial + Ember + Fraunces/Inter]`). Anti-convergence: exclude the axes used in the previous 2-3 projects of the same type (`memory/projects/`).
- Define **3-6 axes of divergence** (each variant explores one). The axes have to be **structural**, not merely aesthetic: order and number of sections, type of navigation, density, grid (symmetric vs broken), what occupies the first viewport, photo-driven vs typographic. Swapping only the `<style>` over the same markup produces skins of the same variant, not variants.
- **Register/intent** is the 4th axis, and it is mandatory: quiet · welcoming · imposing · documentary · cinematic. Three agents once converged on the same register (cold archive, blue accent, tabular numerals) with three different named styles — the style/palette/font axes separate visual grammar, not intent. Competing variants have to differ here.

### 2. Fan-out of the variants (parallel)
- Dispatch **3-5 agents** in parallel (`img-gen-openai`/`img-gen-google` for images; or static HTML/JSX generation for a navigable mockup). Cap 3-5 (context cost).
- **Each agent's brief** carries: the common brief + ITS axis + the design system + anti-fabrication (no inventing copy/data — use marked placeholders) + Step 0 (Read `brand-guidelines`/`design-tokens` if relevant).
- Each agent writes its output to disk (`scratchpad/shotgun/<n>/`) and returns only a summary + path (the "agents write to disk" pattern — `rules/orchestration-patterns.md`).

### 3. Comparison board
- **Pipeline parity before comparing.** Every variant goes through the same steps (upscale, export, resolution). One variant came out without the ESRGAN step (568 KB vs 4.7 MB, ~88 dpi at A3) and the comparison was skewed — sharpness masked the drawing, which was the thing under evaluation. Comparing file sizes is the cheap test that catches this.
- **Mechanical divergence check, before showing anything at all.** Extract the font pairing and the colors from each variant and fail the round if two coincide — you regenerate the duplicate, you do not present it:
  ```bash
  grep -rhoE 'family=[A-Za-z+0-9]+|font-family:[^;]+' scratchpad/shotgun/*/ | sort | uniq -c | sort -rn
  grep -rhoE '#[0-9a-fA-F]{6}|oklch\([^)]*\)' scratchpad/shotgun/*/ | sort -u | head -40
  ```
  It is a `grep`, not an agent. Three parallel agents have already returned the **same font pairing** (Unbounded + Manrope + JetBrains Mono) because they all read the same `design-dataset.md` and none of them could see the others — convergence that is only detectable by comparing the N variants once they are done.
- Present the variants side by side (grid of thumbnails/links).
- For each one: 1 sentence of the concept + the tension it explores.

### 4. Structured feedback + iterate
- Collect feedback per variant (what works / what does not). `AskUserQuestion` if it helps the decision.
- Pick 1 (or merge the best of 2). Record the decision: `node .claude/scripts/joca-brain.mjs decide --text "design chosen: <…>" --source user`.
- Iterate on the chosen one 1-2x if needed.

### 5. Mandatory autopsy at the 3rd rejection
**Three rejected rounds in a row → stop producing.** You do not generate a 4th round: you dispatch **1 autopsy agent** over the rejected ones, with a single question — *what do these proposals have in COMMON?* What varies between them has already been varied; the cause is in what did not vary.

The autopsy report enters the next round's common brief as a hard constraint, and the round only starts after the user confirms the causes.

The real cost of not doing it: **eight rejected proposals** before anyone asked this. The autopsy (1 agent) found the three causes in minutes — photography with a third party's watermark, the same page repainted in all of them, zero commerce on a shop's page — for far less than the ninth blind round cost.

## UX Principles — how users behave (apply to every variant)

Observed principles (Steve Krug, *Don't Make Me Think*), not preferences. Evaluate each variant against them.

**3 laws:**
1. **Don't make me think** — every screen self-evident. If the user stops to think "what do I click?", the design failed.
2. **Clicks don't matter, thinking matters** — 3 obvious clicks > 1 click that requires thought.
3. **Omit, then omit again** — cut half the words, then half of what is left. Happy talk and instructions die.

**How they behave:** users *scan* (they don't read) → visual hierarchy = importance; they *satisfice* (they pick the 1st reasonable option) → make the right choice the most visible one; they *muddle through* (they don't understand how it works, they fumble until it does) → the right path has to be the most obvious one; they *don't read instructions*.

**Billboard design:** use conventions (logo top-left, nav top, magnifier=search — don't innovate in navigation to look clever); visual hierarchy is everything (everything shouting = nothing is heard; noise is guilty until proven innocent); clickable has to look clickable (without relying on hover — mobile has none); clarity > consistency.

**Navigation = wayfinding:** always answer "what site is this? what page? what sections? where am I?". Persistent nav; current section indicated; "trunk test" (cover everything but the nav → do you still know where you are?).

**Reservoir of goodwill:** every bit of friction drains it. It drains faster if you: hide what the user wants (price/contact), punish them for not doing it your way, ask for unnecessary info, put "sizzle" in the way (splash screens/forced tours). It refills if you: make what the user wants to do obvious, say it up front, save steps, make errors easy to recover from.

**Mobile:** same rules, only more so. Touch targets ≥ 44px; visible affordances (no cursor = no hover-to-discover); prioritize ruthlessly.

## Next step (chain)
- Variant chosen → `design-review` (validate taste/slop) → `design-html` (mockup → production HTML) OR `frontend` (implement in React). Reversible → chain it; see `rules/chaining.md`.
