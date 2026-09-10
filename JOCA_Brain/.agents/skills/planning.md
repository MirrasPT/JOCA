---
name: planning
description: "Planning project architecture, creating tech specs, breaking down tasks, or documenting decisions. MUST be invoked when the user says: planning, plan the project, project planning, how to start, project documentation. SHOULD also invoke when: before starting, before coding, project setup, start project, kick off."
triggers: planning, plan the project, project planning, how to start, project documentation, before starting, before coding, project setup, start project, kick off
---
# Planning -- Router

First layer of the stack. Everything before touching code or design.

---

## Skills

| Skill | Output | When |
|-------|--------|------|
| `plan` | Execution plan per session | Complex multi-step task, architecture decision |
| `prd` | PRD.md -- living requirements | Project start, new feature, scope change |
| `tech-spec` | TECH_SPEC.md -- technical design | After PRD approved, before coding |
| `adr` | docs/adr/NNNN-*.md -- decisions | Architectural tradeoff, technology choice |
| `c4-diagram` | docs/architecture/*.md -- Mermaid diagrams | Visualize system, communicate architecture |
| `task-breakdown` | TASKS.md -- epics/stories/tasks | Break project into atomic work |
| `rfc` | docs/rfcs/RFC-*.md -- proposals | Cross-cutting change, breaking change |
| `html-review` | docs/review/*.html -- visual review | Human review, stakeholder sharing |

---

## Routing

### Direct signals

| User says | Activate |
|-----------|----------|
| "plan it", "how would we do it", "implement X and Y and Z" | `plan` |
| "PRD", "requirements", "specification", "what are we going to build" | `prd` |
| "tech spec", "how to implement", "data model", "API design", "technical architecture" | `tech-spec` |
| "ADR", "decision", "why did we choose X", "record this decision" | `adr` |
| "diagram", "C4", "visual architecture", "how the system is structured" | `c4-diagram` |
| "tasks", "breakdown", "epics", "stories", "estimate", "how long" | `task-breakdown` |
| "RFC", "change proposal", "migrate from X to Y", "breaking change" | `rfc` |
| "generate html", "html review", "view document", "preview", "export" | `html-review` |

### Full pipeline (new project)

```
prd → prd-reviewer → tech-spec → c4-diagram → task-breakdown → plan (per session) → html-review → code
```

Lateral (invoked when relevant, not sequentially):
- `adr` -- auto-suggest when `tech-spec` or `plan` detect a tradeoff
- `rfc` -- when change spans multiple modules/teams

### Existing project

| Situation | Activate |
|-----------|----------|
| New feature without spec | `prd` (lean) → `tech-spec` → `task-breakdown` |
| Architectural decision to record | `adr` |
| Need system overview | `c4-diagram` (mode: document-code) |
| Estimate remaining work | `task-breakdown` |
| Large change (auth, DB, public API) | `rfc` → `tech-spec` → `adr` |

### No clear match

If request is generic ("plan this project"), ask:

```
What do you need now?
1. Define WHAT to build → PRD
2. Define HOW to build it → Tech Spec
3. Break into tasks → Task Breakdown
4. Document a decision → ADR
5. Everything from the start → Full pipeline
```

---

## Activating sub-skills

```
Read(".claude/skills/plan.md")            # execution plan per session
Read(".claude/skills/prd.md")             # PRD.md — requirements
Read(".claude/skills/tech-spec.md")       # TECH_SPEC.md — technical design
Read(".claude/skills/adr.md")             # decisions
Read(".claude/skills/c4-diagram.md")      # Mermaid architecture diagrams
Read(".claude/skills/task-breakdown.md")  # TASKS.md — epics/stories
Read(".claude/skills/rfc.md")             # proposals / breaking changes
Read(".claude/skills/html-review.md")     # docs → HTML for stakeholders
```

---

## Quality gate
After planning complete: "Do you want `prd-reviewer`?" (validates PRD if generated)
