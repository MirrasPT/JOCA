---
name: new-issue
description: "Turns an idea or a problem into a structured GitHub issue, with verifiable acceptance criteria and the list of files the work will touch. Use before writing code for something new. MUST be invoked when the user says: new issue, create issue, open issue, /new-issue, GitHub issue. SHOULD also invoke when: turn this into a task, acceptance criteria, add to the backlog, record this idea, I want to implement X."
triggers: new issue, create issue, open issue, new-issue, GitHub issue, turn this into a task, acceptance criteria, add to the backlog, record this idea, I want to implement
chain: plan-waves, prepare-design
---
# New issue — ready to implement

Creates a GitHub issue ready to implement. **Do not implement anything in this skill.**

## Steps

1. **Ask until you understand.** One question at a time, with `AskUserQuestion` when the answers
   are closed choices. You need to know:
   - What problem it solves, and for whom — not what feature is going to be built
   - How you objectively know it is done
   - What is deliberately left out

   If the answer is vague, press. Read `docs/PRODUCT.md` for framing.

2. **Check the size.** More than a day of work → propose splitting it before moving on.

3. **Check for duplication:**

```bash
gh issue list --search "<keywords>" --state all --limit 20
```

4. **Check whether it needs design.** If it involves an interface that does not exist yet, the issue depends
   on a mockup — flag that and suggest `/prepare-design` first.

5. **Present the draft** and wait for confirmation.

6. **Create the issue.**

```bash
gh issue create --title "<title>" --label "<type>" --body "<body>"
```

If there are already planned waves (`docs/WAVES.md` and milestones in the repository), pass everything **in the
same command** — it saves having to find out the issue number afterwards (`create` only prints the URL):

```bash
gh issue create --title "<title>" --label "<type>" --body "<body>" \
  --milestone "Wave 2: <name>" \
  --blocked-by <m>
```

`--blocked-by <m>` reads "this issue is blocked by `<m>`" — `<m>` comes first. The inverse is
`--blocking`.

> **`gh` version.** `--blocked-by`/`--blocking` require **`gh` v2.94.0 or later** (confirmed in that
> release's notes). `--milestone` works on any recent version. Check with
> `gh --version`; if it is older, see the API fallback in `plan-waves`. **Do not record the
> dependency as text in the issue body** — it stops being machine-readable and `plan-waves`
> goes blind to it.

If it is not obvious which wave it belongs to, **ask** instead of guessing — putting work in the wrong
wave undoes the validation grouping, which is the reason waves exist.

### Body

```markdown
## Problem
<the concrete pain, in user language — not the solution>

## What is going to be done
<the desired behavior>

## Done when
- [ ] <verifiable criterion>
- [ ] <verifiable criterion>

## Out of scope
<what this issue explicitly does not do>

## Design
<link to docs/mockups/<screen>.html, or "not applicable">

## Technical context
<entities involved, decisions already made>

## Likely files
<list of the files/folders this work will touch>

## Depends on
<#N, or "nothing">
```

**The "Likely files" section is not decorative.** It is what lets you decide whether two issues can
run in parallel — they only can if the sets are disjoint. An issue without it forces you to open the
code to find out, or to sequence out of caution. `plan-waves` depends on it directly.

## Rules

- **Maximum 5 acceptance criteria.** More than that means the issue should have been split.
- Each criterion verifiable by someone who was not in the conversation. "The experience must be smooth" does
  not count; "the listing loads in under 2s with 1000 records" does.
- Write "Out of scope" even when it seems obvious — it is what stops the scope from growing during
  implementation. In your own product, where there is no client closing the scope, this matters more, not
  less.
- **If you cannot write verifiable criteria, the issue is not ready.** Say so instead of
  creating it.

## Note

The acceptance criteria are the source the tests will be written from
(`write-tests`). Vague criteria produce tests that verify nothing.

## Next step (chain)

- Issue involves a new screen → `prepare-design` before implementing.
- There are 3+ open issues with no plan → `plan-waves` to organize them into waves.
- Issue ready and implementation done → `write-tests <n>`, in a **separate session**.
