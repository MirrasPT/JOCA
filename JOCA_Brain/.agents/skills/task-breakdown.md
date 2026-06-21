---
name: task-breakdown
description: "Decompose large features into implementable tasks with dependencies and estimates. MUST be invoked when the user says: tasks, task breakdown, breakdown, epics, stories, estimativa, estimation, quanto tempo. SHOULD also invoke when: how long, sizing, sprint, sprint planning, backlog, quebrar em tarefas."
triggers: tasks, task breakdown, breakdown, epics, stories, estimativa, estimation, quanto tempo, how long, sizing, sprint, sprint planning, backlog, quebrar em tarefas, break into tasks, TASKS.md, work breakdown, WBS, priorizar, prioritize, RICE
---
# Task Breakdown

Generates `TASKS.md` — persistent ledger of epics/stories/tasks that survives across sessions.

**Activate** after `tech-spec` + `c4-diagram`, or when someone requests estimates or work breakdown.

---

## TASKS.md Structure

```markdown
# TASKS — [Nome do Projecto/Feature]

**PRD:** [link]
**Tech Spec:** [link]
**Ultima actualizacao:** [data]

---

## Prioridades (RICE)

| ID | Story | Reach | Impact | Confidence | Effort | Score | Prioridade |
|----|-------|-------|--------|-----------|--------|-------|-----------|
| S1 | [nome] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P0 |
| S2 | [nome] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P1 |

*RICE Score = (Reach x Impact x Confidence) / Effort*
*Effort: S=1, M=2, L=4, XL=8*

---

## [Epic 1: Nome]

### S1: [Story name]
**Como** [persona], **quero** [accao] **para** [beneficio].
**Size:** M (1-2 dias) | **Prioridade:** P0 | **Estado:** TODO

- [ ] `T1.1` Setup migration [ficheiro] — S
- [ ] `T1.2` Create model + relationships [ficheiro] — S
- [ ] `T1.3` Implement controller + form request [ficheiro] — M
- [ ] `T1.4` Write feature tests [ficheiro] — S
  - **Depende de:** T1.1, T1.2, T1.3

### S2: [Story name]
**Como** [persona], **quero** [accao] **para** [beneficio].
**Size:** L (3-5 dias) | **Prioridade:** P0 | **Estado:** TODO
**Bloqueia:** S5 (precisa deste endpoint)

- [ ] `T2.1` [descricao] [ficheiro] — S
- [ ] `T2.2` [descricao] [ficheiro] — M
- [ ] `T2.3` [descricao] [ficheiro] — S

---

## [Epic 2: Nome]

### S3: [Story name]
...

---

## Legenda

| Simbolo | Significado |
|---------|------------|
| S | Small: <= 4h |
| M | Medium: 1-2 dias |
| L | Large: 3-5 dias |
| XL | Extra Large: > 1 semana (subdividir) |
| `[ ]` | TODO |
| `[x]` | DONE |
| `[-]` | IN_PROGRESS |
| `[!]` | BLOCKED |
| **Depende de:** | Task so pode comecar apos estas |
| **Bloqueia:** | Estas stories/tasks dependem desta |
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

| Regra | Descricao |
|-------|-----------|
| Atomico | Each task completable in <= 4h |
| Verificavel | Clear, observable "done when" |
| Ficheiros explicitos | Each task lists files it touches |
| XL = subdividir | If > 1 week, split into smaller stories |
| Dependencias explicitas | Never assume order — declare with "Depende de" |
| 1 responsabilidade | 1 task = 1 thing. "Create model and controller and tests" = 3 tasks |

### T-shirt sizing

| Size | Tempo | Exemplos tipicos |
|------|-------|-----------------|
| S | <= 4h | Migration, simple model, config, seed |
| M | 1-2 dias | Controller + form request + tests, simple integration |
| L | 3-5 dias | Full feature with UI + API + tests, complex integration |
| XL | > 1 semana | Must be subdivided |

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

- [ ] `T1` [descricao] [ficheiro] — S
- [ ] `T2` [descricao] [ficheiro] — M
  - **Depende de:** T1
- [ ] `T3` [descricao] [ficheiro] — S
```

---

## Workflow

Pipeline position in JOCA sequence:

-> **before**: `tech-spec` + `c4-diagram` (technical design as input)
-> **after**: `plan` (per-session execution plan based on chosen tasks)

Notify on completion: `-> proximo: plan (para iniciar execucao)`
