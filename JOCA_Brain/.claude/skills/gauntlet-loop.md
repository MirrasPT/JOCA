---
name: gauntlet-loop
description: "Reframes ANY request into a development workflow measured against a real, named reference: fills in Matt Shumer's three-paragraph aim prompt, EXECUTES IT, fans out sub-agents, puts a separate harsh critic to compare blind against the reference, and repeats until the HUMAN pulls the brake. Domain-agnostic (game, app, API, site, deck, brand, refactor). Pure prompt — no harness, no state machine, no helper scripts. MUST be invoked when the user says: gauntlet, gauntlet loop, aim prompt, at the level of, as good as, benchmark against, loop until it's perfect, /gauntlet-loop. SHOULD also invoke when: the user asks for something compared to a real existing product and wants maximum quality instead of speed."
triggers: gauntlet, gauntlet loop, gauntlet-loop, aim prompt, Shumer prompt, at the level of, better than, benchmark against, compared with, loop until it's perfect, AAA quality, top studio quality, build like, as good as
chain: tester-code, design-review, tester-performance
---
# gauntlet-loop — build against a real reference, in a loop

**Meta-skill.** Takes a natural-language request about **any** subject and reframes it into the three-paragraph
aim prompt — then **runs it**. Adapted from
[duolahypercho/gauntlet-loop](https://github.com/duolahypercho/gauntlet-loop), which packages
[Matt Shumer](https://github.com/mshumer/Claude-of-Duty)'s 152-word aim prompt. The upstream is games only; **this
version is domain-agnostic** — what changes per domain is the reference and the comparison method, not the method.

## The ideology (the 5 pieces that make this work)

1. **A real, named reference.** Not "high quality" — *at the level of Linear*, *at the level of Stripe*.
   An abstract target cannot be missed; a concrete one can.
2. **Fan-out.** Each area of the work has its own sub-agent, running in parallel.
3. **A separate, harsh critic.** An agent **different** from whoever wrote it, whose job is to fail it.
   Whoever produces never evaluates themselves.
4. **Blind side-by-side comparison** against the reference: *which of these two is better?* without knowing which is which.
5. **No stopping condition.** The bar is deliberately unreachable. Quality = a function of execution
   time. **The human is the brake.**

If you remove any one of the five, this becomes a normal workflow. Don't remove any.

## On invocation

1. **Infer the domain** from the request (game / web app / API-backend / landing / deck / brand / refactor / content / …).
2. **Fill in the slots** — `THING`, `REFERENCE`, `LOOK`, `TIER`, `AREA_1`, `AREA_2`, `CHECK`, `STACK` — from
   the args, the cwd, the project's `CLAUDE.md` and the conversation. **One question at most**, and only if
   `THING` or `REFERENCE` are missing and cannot be inferred.
3. **Lock the domain's comparison method** (table below). Without a verifiable comparison method,
   step 4 is theater — settle this before starting.
4. **Fill in the skeleton** and keep it as an internal brief. **Do not dump the prompt and wait.**
5. **Execute**: fan-out of `Agent()` in the same turn, separate critic, blind comparison, fix, repeat.
6. **Continue until the human pulls the brake** (or until a declared budget). **Never ask "shall I continue?"**

Status line, once, then work:

```text
Gauntlet: [THING] against [REFERENCE] in [STACK]. Comparison: [CHECK]. You are the brake.
```

Honest line, once:

> It does not end, by its own definition. The blind comparison against [REFERENCE] will keep failing. That is why
> the quality keeps rising. The one who stops is you.

## The prompt (fill in and run — it is the entire procedure)

```text
I want you to build [THING] at the level of [REFERENCE]. It should
be utterly perfect, [LOOK], with every single thing done at
[TIER] quality, from [AREA_1] to [AREA_2] to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the [THING]
is utterly perfect. You should [LOOP_VERB] on each item and have a separate sub-agent check it
[CHECK] to ensure it is [TIER]. That separate sub-agent should
be a really harsh critic, and if it isn't [TIER], it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with
[REFERENCE]. It should literally compare them side by side blind and say which
one looks better. Do this in [STACK]. [LOOP_VERB] until it's utterly perfect.
Fan out sub-agents[CLOSING_TAIL].
```

`LOOP_VERB` = `/loop` · `CLOSING_TAIL` = ` and ultracode` (Claude Code).
In Codex: `LOOP_VERB` = `/goal`, `CLOSING_TAIL` empty — never mix verbs from different harnesses.

Nothing else. No other protocol.

## Choosing the `REFERENCE`

- **Real, named, verifiable.** A product/repo/artifact that exists and that you can get to.
- **Same sport.** Compare a dashboard with Linear, not with "Apple".
- **If the model beats it on day 1 → raise it.** The reference has to hurt.
- If the user already named one, it is that one. If not, propose the best in the category **in the status line** — do not stop to ask.
- If the reference is closed and inaccessible (proprietary backend), use the **verifiable substitute**:
  a top open source repo of the same kind, a public benchmark, or the public spec/documentation.
  **Never invent how the reference works inside** — use what can be observed.

## Domain profiles — what to fill in and **how the critic compares**

The `CHECK` is the piece that the original version solved only for the visual case. By domain:

| Domain | typical `REFERENCE` | `AREA_1` / `AREA_2` | `CHECK` — how the critic compares blind |
|---|---|---|---|
| Game | Call of Duty · Hades · Brotato | textures / physics · combat feel / light | light in-game frame vs real still from the game |
| Web app / product | Linear · Notion · Stripe Dashboard | information density / motion | screenshot of the screen vs screenshot of the real one, same viewport |
| Landing / marketing | Linear · Vercel · Framer | typography / motion | full-page screenshot vs the real page, same viewport |
| API / backend | Stripe API · GitHub API | contracts / errors · performance | read both contracts side by side (endpoint, payload, error, pagination, versioning) + latency numbers |
| Code / refactor | a top repo in the same stack | readability / architecture | side-by-side diff of the same module + metrics (complexity, LOC, coverage, clean Larastan/tsc) |
| Performance | real budget (LCP<2.0s, p95<200ms) | load / perception | measured number vs target number — Lighthouse/k6, not opinion |
| Deck / presentation | a named famous pitch deck | narrative arc / slide craft | read aloud + screenshot of each slide vs the reference's |
| Brand / identity | a named real brand book | system / application | boards side by side + reduction and monochrome test |
| Copy / content | a named published piece | clarity / voice | the two texts blind: which one a reader from the audience prefers and why |

Domain outside the table: pick the **cheapest `CHECK` that is still falsifiable** — an artifact that can be
put side by side with the reference's. If none exists, the gauntlet does not apply: say so and propose the normal route
(`/goal`, the domain's skill).

## Execution in JOCA (just the verbs, not a new machine)

- **Fan-out** = several `Agent()` calls **in the same turn**. Cap 3-5 concurrent
  (`rules/orchestration-patterns.md`). Group by **disjoint file/area**, never by topic — two agents
  in the same file step on each other. Shared components are defined in a **sequential foundation phase** before
  the fan-out; the workers import, they do not recreate.
- **Each worker's brief** (mandatory): objective in 2 sentences · files/paths · project constraints ·
  what NOT to do · Step 0 `Read()` of the domain's skills · anti-fabrication (no credential → `TODO`, never invent).
- **Critic** = a **separate** agent, its own brief, it only evaluates. Never whoever wrote the code. The
  critic's brief carries the domain's `CHECK` and the instruction to fail by default.
- **Loop** = the harness's `loop` skill. `ultracode`/`Workflow` only if the user asks for it — high cost.
- Workers write to disk (`scratchpad/gauntlet/<stream>.md`) and return only a summary + path.
  ⚠ outside the project tree if there is a content-scan (Tailwind v4 and the like).
- **Irreversible is still a gate**: deploy/push/migration/delete/payment/auth → 1 line of confirmation.
  The loop is not a license to publish on its own.

## Asset holes

A defect that is missing material, not code: image gen (`img-gen` → `img-gen-openai`/`img-gen-google`) for
flat pixels — sprites, textures, icons, UI; the `blender` skill / Blender MCP for 3D mesh the camera orbits.
The asset **always** lands in the playable/navigable artifact, and the critic evaluates that artifact — never the
generation grid nor the Blender viewport.

## Do not invent

This is how agents leave the pure prompt and break the loop:

- Helper scripts, capture harnesses, blind-compare tools, report templates, scoreboards
- `GAUNTLET_STATE.md` / round ledgers / architecture contracts **as if they were the work**
- Invented stopping rules ("N flat rounds", "that's enough", "ready for review")
- Softening the critic or lowering the reference mid-flight
- Asking "do you want me to continue?" at the end of a cycle — continue
- Spending the run on tooling instead of on the artifact
- **Faking the comparison**: describing the reference from memory instead of going to fetch it. If you cannot
  observe it, say so and use the verifiable substitute.
- Seizing up the system to feed the critic (headless loops, capture at 100% CPU). If the peek freezes the
  product, the peek is wrong — take a lighter measurement.
- Endless rounds of asset generation that never land in the artifact

## Compose-only

Only if the user says "just give me the prompt" / "compose only": return the three filled-in paragraphs in a
` ```text ` block. Otherwise, **always execute**.

## Filled-in examples

**Game — Call of Duty / ThreeJS** (the original):

```text
I want you to build a first-person shooter at the level of the most recent Call of Duty games. It should be utterly perfect, visually beautiful, with every single thing done at AAA quality—from textures to physics to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the game is utterly perfect. You should /loop on each item and have a separate sub-agent check it visually to ensure it looks triple A. That separate sub-agent should be a really harsh critic, and if it doesn't look triple A, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual Call of Duty game. It should literally compare them side by side blind and say which one looks better. Do this in ThreeJS. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

**API — Stripe / Laravel** (non-visual domain; note the `CHECK`):

```text
I want you to build the billing API at the level of the Stripe API. It should be utterly perfect, a joy to integrate against, with every single thing done at top-tier quality, from resource naming and error contracts to pagination and idempotency to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the API is utterly perfect. You should /loop on each item and have a separate sub-agent check it by reading our endpoint contract side by side with Stripe's published contract for the same operation to ensure it is top-tier. That separate sub-agent should be a really harsh critic, and if it isn't top-tier, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual Stripe API docs. It should literally compare them side by side blind and say which one is better to integrate against. Do this in Laravel. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

**Landing — Linear / Next.js:**

```text
I want you to build a marketing site for my product at the level of Linear's website. It should be utterly perfect, visually beautiful, with every single thing done at top studio quality, from typography to motion to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the site is utterly perfect. You should /loop on each item and have a separate sub-agent screenshot it and check it visually to ensure it looks like a top studio built it. That separate sub-agent should be a really harsh critic, and if it doesn't, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with linear.app. It should literally compare them side by side blind and say which one looks better. Do this in Next.js and Tailwind. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

Credit: aim prompt by [Matt Shumer](https://x.com/mattshumer_) · packaging by
[duolahypercho/gauntlet-loop](https://github.com/duolahypercho/gauntlet-loop) (MIT) · domain generalization: JOCA.
