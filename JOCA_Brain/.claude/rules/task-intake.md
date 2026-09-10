# Task Intake — Auto-Orchestration

Decision tree run BEFORE the Decision Filter. It classifies ANY task received into 4 routes.
Loaded in every session. Deterministic by thresholds — "deciding on your own" is not vibes.

## The question that comes first: does this split?

**Before choosing the route, count the independent parts of the request.** Two parts that do not depend
on each other are two things that could run at the same time; doing them in series is time thrown
away, not prudence. **≥2 independent parts → dispatch in parallel.**

> **Default: workflow.** The normal mode is a **workflow with agents in parallel**, not the main chat
> writing. The main loop orchestrates — decides the route, dispatches, verifies the artifact, reports; **the code
> is written by the agents**.
>
> When in doubt, dispatch. And in doubt **between 1 agent (C) and fan-out (D) → choose D**: a single agent
> is the rare case (genuinely indivisible work), not the comfortable middle ground. **Work that touches ≥2
> files or goes beyond a trivial edit goes to agents**, even when it is "just one thing" —
> it is split by file/area and dispatched in parallel in the same turn.
>
> "When NOT to escalate" (below) is the **CLOSED** list of exceptions, not an invitation to weigh it up every
> time. The user does not have to ask: the `prompt-triage.js` hook already delivers the signal (parts,
> domains, scale) before you answer.
>
> ⚠ **Axis: agents in EXECUTION.** It does not collide with `plan-waves`, which is about **issues in progress**.
> The two steps and their brakes:
> 1. **Splitting the work** — many small issues, always. It is planning, it costs neither tokens nor
>    review; it is big issues that prevent parallelism (without "Likely files" there is no way to know
>    what collides).
> 2. **Resolving** — agents in parallel, **including on different issues**, as long as they do not touch the
>    same files. The brake here is file collision and tokens, not the number of issues.
>
> What `plan-waves` brakes is something else: how many issues end up **READY at the same time** waiting
> for review — because whoever approves is one single person. Dispatching a lot is good; it is delivering
> everything at once for approval that creates a queue. See `.claude/skills/plan-waves.md`.

**Counts as an independent part:** requests joined by "and also"/"then"/a list · different
domains **with different actions** (create API + create component + deploy) · the same work in N
places (the most profitable case: one agent per place).
**Does NOT count:** a sentence with vocabulary from several domains that asks for **one** thing ("refactor the
login component in react" = 1 task). The test is the number of actions asked for, not of technical words.

## The 4 routes

| Route | When | Action |
|---|---|---|
| A — Direct | 0 files · question/decision/conversation | Answer inline |
| B — 1 Skill | 1 part · 1 domain · **1 file** · **short edit** · reversible · skill match ≥60% | Read `.claude/skills/<x>.md` → execute inline. Notify `[skill: <x>]` |
| C — 1 Agent | 1 part that is **genuinely indivisible**, isolable and long (review/debug/research/deploy/build) · benefits from its own context. **Rare case** — in doubt between C and D, it is D | `Agent(subagent_type="<x>")` with a mandatory brief |
| D — Fan-out | **≥2 independent parts** · OR **1 part that touches ≥2 files/areas** · OR scale (the same work in N places) · OR a complete cross-stack feature · OR any non-trivial work outside the value gate | Dispatch N agents **in the same turn**. If it matches a **named pipeline** (`rules/pipelines.md`) → the **auto-runner** runs it in depth, **without asking**. |

## Plan before executing (the plan gate)

The plan is not a fifth route — it is what routes C and D **consume**. An agent cannot ask: whatever
is not in the brief, it invents. Delegating more without planning more is delegating worse.

| Signal | Plan |
|---|---|
| Route A/B · 1 file · reversible | **None.** Planning a color change is waste |
| Route C · 1 agent | The **mandatory brief** is already the minimum plan — do not write a second one |
| Route D · fan-out | **Visible plan before the 1st `Agent()`**: objective · file boundary per agent · acceptance criterion per stream. Without this there is no way to know that two agents do not write in the same place |
| Irreversible ★ (migration · delete · deploy · push · payments · auth · destructive git) | `Read(".claude/skills/plan.md")` — 7 phases, explicit gate. It activates on its own |
| ≥3 files · new feature with no precedent · architecture with real tradeoffs | `Read(".claude/skills/plan.md")`. If it crosses product + design + engineering → `/autoplan` |

No signal → **act**. `Prefer action over planning when cost of reversal is low` (soul.md) still
rules: the table is the closed list of exceptions, not a license to plan everything.

**The plan is an artifact, not a document:** 5-15 lines in the chat, with a verifiable success criterion and
a file boundary. A file in `docs/` only if the user asks or the project already uses one.
Implicit approval — "ok" / silence → execute; only the irreversible ★ waits for an answer.

## Execution agents by domain

Every execution skill has a twin agent in `.claude/agents/<skill>-agent.md` (65: frontend,
tailwind, laravel-specialist, copywriting, deploy-vps, wp-*, shopify-*, …). It reads the skill as Step 0 —
**same doctrine**, the difference is where it runs. Inline: cheap, immediate, 1 part. Agent: ~15x tokens,
parallel, main loop free — ≥2 parts or long work.

**Choose deliberately, with the default on the side of dispatching.** Serialising work that could be split in
three is not care; dispatching an agent to change a color is not speed. Outside the exceptions below,
the main loop produces the brief and the verification, not the files.

**Domain outside the `CLAUDE.md` Trigger Map → `grep` `memory/SKILL_INDEX.json` before answering
from memory** — the map is a shortcut made by hand, the index is the generated inventory. Answering generically when a
skill sits on disk is the system's most expensive failure (`soul.md` Hard Limits).

## Thresholds

- Independent parts: 1=A/B/C · **≥2=D**
- Files: 0=A · **1 (short edit)=B** · **≥2=D** — C only when the work is genuinely indivisible
  (the default dropped twice: it was 1-2=B/≥3=D, then ≥2 parallelisable=D, now ≥2=D)
- Domains **with an action of their own**: 0=A · 1=B/C · ≥2=D
- Scale (N places, same work) → D, one agent per place
- Skill match ≥60% → prefer B over A
- **A tie between two routes → always choose the more parallel one.** Serialising parallelisable work
  costs time on EVERY request; delegating too much costs tokens once
- `orchestration_threshold` and `loop_max_iterations` calibrated in `soul.md`

## When NOT to escalate (the value gate)

Fan-out costs ~15x tokens per agent plus coordination. This is the **closed** list — outside it, escalate.
It is not worth it when:
- it is a **question, decision or conversation** — answer;
- it is **one** trivial edit in a single file (change a value, fix a typo, rename);
- the parts **depend on each other** (step 2 needs the output of step 1) → sequential, and
  then it is a pipeline, not fan-out;
- the parts **touch the same files** → two agents writing in the same place step on each other.
  Regroup: one agent per file/area, not per task.

In case of doubt between inline and fan-out: **dispatch**. The cost of serialising parallelisable
work is greater, and it repeats on every request. "I could do this one myself" is not an exception —
the four bullets above are.

## Safety (non-negotiable)

- Reversible → act without asking. Irreversible (auth/payments/migrations/deletes/deploy/push/destructive git) → 1 confirmation, even in D — and **in an `AskUserQuestion` of Yes/No with the "Yes" first**, never an open question in text.
- **Writing over a file that already exists is irreversible.** It holds for any route — skill,
  agent, inline script, geometric construction — and above all for assets the user has already seen and
  approved (images, PDFs, videos, exports). The rule lived only in the `img-gen` skill and was not applied
  because the next generation did not go through it: two approved emblems were overwritten and were only
  recovered by luck, from the codex cache. Cheap check, no gate: `test -f <path>` before
  writing; if it exists, **a versioned sibling name** (`nome-v2.png`). You only overwrite when the
  user has explicitly asked for replacement.
- Steward, not initiator: in a loop, only continue work already in the GOAL. Do not invent scope.
- Anti-loop: a workflow has max N iterations (default 4); 3x "nothing to do" → stop and report.

## Auto-runner (JOCA delegates and chains on its own)

The objective is maximum autonomy: **the user says it, JOCA drives the whole sequence** without asking for the next step.
- Route B/C/D that matches a pipeline → run the pipeline through the **auto-runner** (`rules/pipelines.md`): every step in depth, auto-decision of the reversible intermediates (principles in `pipelines.md`), gate only on irreversible ones, automatic chaining (`rules/chaining.md`).
- Skills/agents that finish fire the next `chain:` automatically (reversible → without asking; notify `[chain → x]`).
- Subagents receive in the brief the **Step 0 (Read of the skills)** + their `chain:` (they return the suggested next step; the caller fires).
- Brake: `loop_max_iterations` (soul.md) + 3x-without-progress → stop.
- **Continuity contract:** route C/D or pipeline → write `.joca/loop.json` (steps, `produtor`,
  `verificador`, `estado`) BEFORE starting and update it at each step. The `Stop` hook
  (`hooks/stop-continue.js`) reads it and gives **one nudge per turn** — it is not a loop: closing the steps is
  yours. Human gate → `"aguarda_utilizador": true` before asking.

## Agents-use-skills model

Whoever dispatches an agent (route C/D) loads into the brief the instruction to **Read the relevant skills** (Step 0).
The `skills:` field in an agent's frontmatter does NOT load the skill — the real guarantee is the Read in the body.

## Anchoring

Referenced from the `CLAUDE.md` Decision Filter (steps 0 and 2). Injected on every prompt by the
`UserPromptSubmit` hook — which is **no longer** a generic nudge: `prompt-triage.js` reads the request,
counts parts/domains/scale and delivers the recommended route with the reason. The hook does not compel; the
model decides. But it decides with the signal in front of it, not from memory.
Detailed orchestration patterns in `rules/orchestration-patterns.md`.
Execution agents generated by `node .claude/scripts/skill-agents.mjs` (source: the skills themselves).
