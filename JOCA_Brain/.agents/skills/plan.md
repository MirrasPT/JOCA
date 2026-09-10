---
name: plan
description: "Structured planning in 7 phases (OODA, assumption surfacing, pre-mortem) before execution. Invoke on: plan, architecture for, migrate, restructure, multi-file/irreversible task."
chain: design-review, frontend, laravel-specialist
metadata:
  type: skill
  category: base
---

# Skill: plan

## When to auto-activate

Activate **before execution** when the task has >= 2 signals — or **immediately** on a ★ signal:

| Signal | Priority |
|-------|-----------|
| Irreversible operation: migration, data delete, deploy, reset ★ | Maximum — it activates on its own |
| >= 3 files or modules involved | High |
| Steps with dependencies (A fails → B fails) | High |
| Architecture decision with real tradeoffs | High |
| Request with multiple systems or stakeholders | High |
| New feature with no precedent in the codebase | Medium |
| Ambiguous request, or shorter than the complexity it implies | Medium |
| Estimated scope > 5 atomic steps or > 20 min | Medium |

**Verbal signals:** "plan", "architecture for", "how would we do", "implement X and Y and Z", "migrate", "restructure", "refactor everything", "integrate with".

---

## Protocol — 7 Sequential Phases

### Phase 0: Orient (OODA)

*Internal — do not show it to the user.*

Interpret the request before planning:
- What is the real problem (not the literal request)?
- What context from the codebase is relevant but not mentioned?
- What implicit information is relevant to success?
- If 2 radically different forms satisfy the request → ambiguous → Phase 1.

---

### Phase 1: Ambiguity Check

*Only if ambiguity was detected in Phase 0.*

Ask **2-3 specific questions**. Focus on:
- Edge cases: "what should happen when X?"
- Navigation: "which module is responsible for Y?"
- Approach: "do you prefer A or B given the tradeoff [...]?"

Limit: **3 clarification cycles**. Then move on with explicit assumptions.

---

### Phase 2: Explicit Assumptions

**Blocking** — the user confirms before seeing the plan.

```
Assumptions to validate:

[ ] Assumption: [what I am assuming]
    Impact if wrong: [what changes in the plan]
    How to check: [how to confirm — now or during execution]

[ ] Assumption: [...]
    Impact if wrong: [...]
    How to check: [...]
```

Wait for confirmation. Wrong assumption → fix it before moving on.

---

### Phase 3: Approaches and Tradeoffs

*Only for architecture decisions with multiple valid options.*

Present 2-3 approaches with tradeoffs:

```
Approach A: [description]
  + [advantage 1]
  - [disadvantage 1]
  Trade-off: [X vs Y]

Approach B: [description]
  + [advantage 1]
  - [disadvantage 1]
  Trade-off: [X vs Y]

→ I recommend A because [reason in 1 line]
```

---

### Phase 4: Verifiable Plan

Each step in the PAUL format — no verification = incomplete step:

```
Plan: [task name]
Success criterion: [verifiable, not vague]

[ ] 1. [Action]
       Files: [explicit list]
       Check: [how to confirm]
       Done when: [observable criterion]

[ ] 2. [Action]
       Files: [explicit list]
       Check: [how to confirm]
       Done when: [observable criterion]
```

**Boundaries:**
- Always: [what will be done]
- Ask first if: [situations that require confirmation]
- Never touch: [files/areas out of scope]

Atomic tasks completable in <= 15 min. Above that, subdivide.

---

### Phase 5: Minimal Pre-Mortem

Two internal perspectives — the result is added to the plan:

**Saboteur:** "This plan failed. What went wrong?"
→ Most likely failure mode + mitigation.

**Outsider:** "What does this plan assume that someone without context would see?"
→ Most dangerous assumption not listed in Phase 2.

```
Risks identified:
- [risk 1] → Mitigation: [action]
- [risk 2] → Mitigation: [action]
```

---

### Phase 6: Confidence Calibration

At the end of the plan, before presenting it:

```
Maximum uncertainty:
- [area 1]: [why low confidence] — would be reduced with [X]
- [area 2]: [why low confidence] — would be reduced with [Y]
```

It flags where the plan is most fragile without blocking execution.

---

## Presentation to the User

Compact format — a verifiable artifact, not a document:

```
Plan: [name]

Confirmed assumptions: [list or "none — clear request"]
Success criterion: [verifiable]

Steps:
1. [action] | Files: [list] | Done: [criterion]
2. [action] | Files: [list] | Done: [criterion]
...

Boundaries:
  Always: [list]
  Ask: [situations]
  Never touch: [list]

Risks: [list with mitigations]
Uncertainty: [areas with low confidence]
```

**Approval:** "ok" / "go ahead" / silence → execute. Negative feedback → adjust.

---

## During Execution

- Complete each step before the next one
- Notify: `✓ Step 1 — [done] — [criterion checked]`
- Invalidated assumption → **stop, report, ask for confirmation before adapting**
- Tasks > 5 steps: **re-planning checkpoint** at ~50% of the steps

---

## Distinction from /plan

| | `plan` skill | `/plan` command |
|---|---|---|
| Activation | Auto — complexity detection | Manual — the user invokes it |
| Approval | Implicit (ok / silence) | Explicit, mandatory (ExitPlanMode) |
| Persistence | Inline in the conversation | File in `.cursor/plans/` or equivalent |
| Use | Normal dev, features, refactors | Critical architecture, production, irreversible |

Operations on production / data / infrastructure → prefer `/plan`.
