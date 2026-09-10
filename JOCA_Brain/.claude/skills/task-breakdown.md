---
name: task-breakdown
description: "Decompose large features into implementable tasks with dependencies and estimates. MUST be invoked when the user says: tasks, task breakdown, breakdown, epics, stories, estimation. SHOULD also invoke when: how long, sizing, sprint, sprint planning, backlog, break into tasks."
triggers: tasks, task breakdown, breakdown, epics, stories, estimation, how long, sizing, sprint, sprint planning, backlog, break into tasks, TASKS.md, work breakdown, WBS, prioritize, RICE
---
# Task Breakdown

Generates `TASKS.md` — persistent ledger of epics/stories/tasks that survives across sessions.

**Activate** after `tech-spec` + `c4-diagram`, or when someone requests estimates or work breakdown.

---

## TASKS.md Structure

```markdown
# TASKS — [Project/Feature Name]

**PRD:** [link]
**Tech Spec:** [link]
**Last updated:** [date]

---

## Priorities (RICE)

| ID | Story | Reach | Impact | Confidence | Effort | Score | Priority |
|----|-------|-------|--------|-----------|--------|-------|-----------|
| S1 | [name] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P0 |
| S2 | [name] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P1 |

*RICE Score = (Reach x Impact x Confidence) / Effort*
*Effort: S=1, M=2, L=4, XL=8*

---

## [Epic 1: Name]

### S1: [Story name]
**As** [persona], **I want** [action] **so that** [benefit].
**Size:** M (1-2 days) | **Priority:** P0 | **Status:** TODO

- [ ] `T1.1` Setup migration [file] — S
- [ ] `T1.2` Create model + relationships [file] — S
- [ ] `T1.3` Implement controller + form request [file] — M
- [ ] `T1.4` Write feature tests [file] — S
  - **Depends on:** T1.1, T1.2, T1.3

### S2: [Story name]
**As** [persona], **I want** [action] **so that** [benefit].
**Size:** L (3-5 days) | **Priority:** P0 | **Status:** TODO
**Blocks:** S5 (needs this endpoint)

- [ ] `T2.1` [description] [file] — S
- [ ] `T2.2` [description] [file] — M
- [ ] `T2.3` [description] [file] — S

---

## [Epic 2: Name]

### S3: [Story name]
...

---

## Legend

| Symbol | Meaning |
|---------|------------|
| S | Small: <= 4h |
| M | Medium: 1-2 days |
| L | Large: 3-5 days |
| XL | Extra Large: > 1 week (subdivide) |
| `[ ]` | TODO |
| `[x]` | DONE |
| `[-]` | IN_PROGRESS |
| `[!]` | BLOCKED |
| **Depends on:** | Task can only start after these |
| **Blocks:** | These stories/tasks depend on this one |
```

---

## Generation

### Required input

1. **PRD.md** — features P0/P1, user stories, AC
2. **TECH_SPEC.md** — components, data model, endpoints
3. If neither exists: gather directly from user

### Process

1. Read PRD + Tech Spec
2. Extract user stories from PRD (sec. 5)
3. Map stories to Tech Spec components (sec. 4)
4. Break each story into atomic tasks (<= 4h)
5. Identify inter-task dependencies
6. Apply T-shirt sizing
7. Calculate RICE scores
8. Sort by priority
9. Present TASKS.md to user
10. Iterate until approved

### Decomposition rules

| Rule | Description |
|-------|-----------|
| Atomic | Each task completable in <= 4h |
| Verifiable | Clear, observable "done when" |
| Explicit files | Each task lists files it touches |
| XL = subdivide | If > 1 week, split into smaller stories |
| Explicit dependencies | Never assume order — declare with "Depends on" |
| 1 responsibility | 1 task = 1 thing. "Create model and controller and tests" = 3 tasks |

### T-shirt sizing

| Size | Time | Typical examples |
|------|-------|-----------------|
| S | <= 4h | Migration, simple model, config, seed |
| M | 1-2 days | Controller + form request + tests, simple integration |
| L | 3-5 days | Full feature with UI + API + tests, complex integration |
| XL | > 1 week | Must be subdivided |

### RICE scoring

- **Reach** (1-10): users/sessions affected per week
- **Impact** (1-3): 1=minor, 2=medium, 3=massive
- **Confidence** (0.5-1.0): 0.5=speculation, 0.8=indirect data, 1.0=direct data
- **Effort** (T-shirt to number): S=1, M=2, L=4, XL=8
- **Score** = (Reach x Impact x Confidence) / Effort

No data for Reach: use informed estimate, set Confidence=0.5.

---

## Updates

### When to update

- Task done → `[x]` + date
- Task blocked → `[!]` + reason
- New scope discovered → add stories/tasks
- Re-prioritization → recalculate RICE
- `/save` → check TASKS.md, suggest update if progress occurred

### Integration with `plan`

`plan` is per-session — defines steps for THIS session.
`TASKS.md` is per-project — defines ALL work.

Flow:
1. Open session: `/resume` reads TASKS.md
2. Pick stories for this session
3. `plan` creates execution plan for chosen stories
4. Execute
5. `/save` updates TASKS.md with progress

---

## Lean format (single feature)

For small features that don't justify epics:

```markdown
# TASKS — [Feature]

**PRD:** [link]

- [ ] `T1` [description] [file] — S
- [ ] `T2` [description] [file] — M
  - **Depends on:** T1
- [ ] `T3` [description] [file] — S
```

---

## Workflow

Pipeline position in JOCA sequence:

-> **before**: `tech-spec` + `c4-diagram` (technical design as input)
-> **after**: `plan` (per-session execution plan based on chosen tasks)

Notify on completion: `-> next: plan (to start execution)`
