---
name: plan-waves
description: "Organizes the open issues into work waves, with validation gates, parallelism analysis and grouping by session. Use after opening the backlog, or when the plan has stopped reflecting reality. MUST be invoked when the user says: plan waves, work waves, /plan-waves, organize the backlog, put the issues in order. SHOULD also invoke when: milestones, where do I start, which issues first, work plan, WAVES.md, replan."
triggers: plan waves, work waves, plan-waves, organize the backlog, put the issues in order, milestones, where do I start, which issues first, work plan, WAVES.md, replan
chain: new-issue
---
# Plan waves

You organize the backlog into **waves**. You implement nothing.

## What a wave is

**A wave is everything that moves forward without needing a new decision from the user.** It ends at a
validation gate.

It is not a sprint. A sprint is a time box — two weeks, whatever happens. A wave is
an *autonomy* box: it ends when the work needs someone's eyes again. In a project
with a single approver, the useful boundary is the person, not the calendar.

Practical consequence: a wave can last two days or two weeks. What defines it is the gate.

## Read first

```bash
gh issue list --state open --limit 100 \
  --json number,title,state,labels,body,milestone,blockedBy,blocking
```

Always include `blockedBy` and `blocking` — if you replan without reading them, you go blind to the
dependencies that already exist and you propose again what is already linked.

Plus `docs/PRODUCT.md` (flows and entities), `docs/ARCHITECTURE.md` if it exists, and `docs/DESIGN.md`.

## How to order — three criteria, in this order

### 1. Cost of reversal

**What is expensive to undo goes first.** The data model, the public URL scheme, the
authentication and permissions model.

A schema mistake found in wave 3 forces you to redo everything that sits on it. The same mistake
found in wave 1 costs one migration. This criterion beats the other two whenever there is a conflict.

### 2. Technical dependency

What has to exist first. It is expressed in the issue dependencies API:

```bash
ID=$(gh api repos/{owner}/{repo}/issues/<m> --jq .id)
gh api -X POST repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by -F issue_id=$ID
```

⚠ **There is no `gh issue edit --add-blocked-by` flag** in `gh` 2.89.0
(`gh issue edit --help | grep -c add-blocked-by` → `0`). Using it gives no useful error and, chained with
`&&`, it silently makes everything that comes after fail. If one day it shows up, only use it after
`--help` lists it.

**Watch the direction:** the `dependencies/blocked_by` endpoint of `<n>` reads "`<n>` is blocked by
`<m>`" — that is, **`<m>` comes first**. The inverse is `dependencies/blocking`. Swapping the two produces
a backwards wave graph, with no visible error anywhere.

⚠ The API uses the issue's **internal id** (`.id`), not the number. Passing the number gives a 404.

Limit: 50 issues per relation type. If an issue is blocked by three others, it is probably
badly sized — or it is an epic in disguise.

### 3. Validation moment

**Group in the same wave what needs the same eyes.** If five screens need visual review,
reviewing them at once costs the user one ten-minute session; spread over five waves, it costs
five interruptions and five recontextualizations.

This is the criterion that saves the most time for whoever approves, and the one most people ignore.

## Parallelism

**Two issues only run in parallel if the file sets are disjoint.**

Every issue has a **"Likely files"** section — this is what it exists for. If it is missing from an
issue, open the code to fill it in before deciding, or sequence out of caution. If there is an
intersection, sequence. No exceptions — two agents in the same file give a merge conflict in the
best case, and incompatible architectural decisions in the worst.

> **If the issues have no "Likely files"**, the backlog was created with an old version of
> `new-issue`. Flag it and suggest fixing the issues — do not guess the files from the
> title.

It holds: one agent per issue, one issue per branch, at most two branches in flight per person.

> **Parallelism is almost always false economy in a solo project.** The bottleneck is not machine
> time — it is the review capacity of whoever approves. Parallel work accelerates nothing; it only creates a
> bigger queue waiting for the same person. Parallelize only when the pieces genuinely do not need to
> be seen together.
>
> ⚠ **This is about issues READY and waiting for approval — not about creating issues nor about agents.**
> Three distinct things, and only the last one is what this warning brakes:
> 1. **Creating issues** — many and small, always. It is planning: it costs neither tokens nor review, and it is
>    what makes parallelism possible (a large issue without "Likely files" cannot be parallelized).
> 2. **Solving** — agents in parallel, including on different issues, as long as they do not touch the
>    same files. The limit there is file collision and tokens (see `rules/task-intake.md`), not
>    the number of issues.
> 3. **Delivering for approval** — this is where the queue forms, because whoever approves is a single person.
>    Dispatching a lot is good; dumping everything ready at the same time is what accelerates nothing.
>
> Neither of the two files revokes the other.

## Token cost — three rules

**1. Issues from the same module go in the same session, not in parallel sessions.**

Every new session re-reads the project from scratch. Three sessions on the same module pay three times the same
context. It is counter-intuitive: **parallelizing can cost more tokens than sequencing**, even
while saving wall-clock time. Group by proximity in the code, not by similarity of theme.

**2. Validating early is the biggest saving there is.**

Rework is the most expensive spend of all — reimplementing costs more than implementing, because it pays the
context again and still has to undo. A well-placed gate saves more tokens than any
session optimization.

**3. A wave should fit in one work session.**

If it does not fit, it is too big — split it.

## Produce

For each wave:

```markdown
## Wave N: <short name>

**Becomes possible at the end:** <what the product starts doing, in one sentence>

**Issues:** #a, #b, #c

**Order:** #a first (it blocks the others) · then #b and #c in parallel
**Milestone title:** `Wave N: <short name>` — a colon, so the exact match does not fail
**Why parallel:** #b touches `app/Http/Controllers/`, #c touches `resources/views/` — disjoint

**Suggested sessions:** 2
  - Session 1: #a, #b (same module, shared context)
  - Session 2: #c

**Validation gate:**
  What you review: <concrete — "the schema of the 4 tables and the relations">
  How: <"read the migrations and run php artisan migrate:status">
  Time: <~10 min>
  If it is wrong: <what is lost — "one migration" vs "three waves of work">
```

Finish with the risks: which wave is most dependent on an unconfirmed assumption, and what
happens if that assumption falls.

## Save

After the user approves the plan:

**1. Create the milestones** — one per wave:

```bash
gh api repos/{owner}/{repo}/milestones \
  -f title="Wave 1: Data foundation" \
  -f description="<what becomes possible at the end>"
```

`{owner}/{repo}` is substituted by `gh` — write it with braces, literally. It does not need
`-X POST`: passing parameters already implies POST.

**Use a colon in the title, not an em dash.** `gh issue edit --milestone` looks the title up by
exact match; if in one invocation you write `—` and in another `-`, it fails with `not found` and the
cause is invisible.

**2. Assign the issues** — several at once:

```bash
gh issue edit 3 5 7 --milestone "Wave 1: Data foundation"
```

The milestone has to exist first.

**3. Link the dependencies** — via the API, not via a `gh issue edit` flag:

```bash
ID=$(gh api repos/{owner}/{repo}/issues/<m> --jq .id)
gh api -X POST repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by -F issue_id=$ID
```

It requires *triage* permission on the repository. Note that the API uses the issue's **internal id**
(`.id`), not the number — passing the number gives a 404.

**Do not fall back to "record the dependency in the issue body"**: the body produces no graph at all.
And **do not invent flags** — always confirm they exist before using them
(`gh issue edit --help | grep -c add-blocked-by` gives `0` on `gh` 2.89.0). The absence of an error is not
evidence: confirm by effect, in step 5.

**4. Write `docs/WAVES.md`** with the full plan — it is the readable version, which survives changes in
GitHub and explains the *why* of the order, which the milestones do not store.

**5. Verify by effect, not by the report.** After saving:

```bash
# milestones
gh issue list --state open --json number,milestone \
  --jq '.[] | "\(.number) \(.milestone.title // "NO MILESTONE")"'

# dependencies (one call per issue — `gh issue list --json` has NO dependencies field)
gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq 'length'
```

A `gh issue edit` that prints success and a milestone that did not get assigned are indistinguishable
without this read. And a dependency that was never created reads `0` here — never in the output of the command
that should have created it.

## Rules

- **Do not invent issues.** You organize what exists. If obvious work is missing, flag it and suggest
  `/new-issue`.
- **Do not make more than 4 or 5 waves.** More than that is pretend planning: the waves at the end will
  change before you get there.
- **The first wave is the most important and the shortest.** It is the one that validates the expensive assumptions.
- **If an issue does not fit any wave without blocking everything**, the problem is the issue. Split it.

## Next step (chain)

- Obvious work missing from the backlog → `new-issue` to open it.
- Wave 1 has screens still to design → `prepare-design` for each one, before implementing.
- Plan approved and saved → start Wave 1. Its validation gate is the next moment the
  user is needed.
