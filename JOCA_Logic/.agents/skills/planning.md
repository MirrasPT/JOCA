---
name: planning
description: "Planning project architecture, creating tech specs, breaking down tasks, or documenting decisions. MUST be invoked when the user says: planear, planning, planeia o projecto, project planning, como comecar, how to start, documentacao do projecto, project documentation. SHOULD also invoke when: antes de comecar, before coding, setup do projecto, project setup, iniciar projecto, kick off."
triggers: planear, planning, planeia o projecto, project planning, como comecar, how to start, documentacao do projecto, project documentation, antes de comecar, before coding, setup do projecto, project setup, iniciar projecto, kick off
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
| "planeia", "como fariamos", "implementa X e Y e Z" | `plan` |
| "PRD", "requisitos", "especificacao", "o que vamos construir" | `prd` |
| "tech spec", "como implementar", "data model", "API design", "arquitectura tecnica" | `tech-spec` |
| "ADR", "decisao", "porque escolhemos X", "regista esta decisao" | `adr` |
| "diagrama", "C4", "arquitectura visual", "como o sistema se estrutura" | `c4-diagram` |
| "tasks", "breakdown", "epics", "stories", "estimativa", "quanto tempo" | `task-breakdown` |
| "RFC", "proposta de mudanca", "migrar de X para Y", "breaking change" | `rfc` |
| "gerar html", "html review", "visualizar documento", "preview", "exportar" | `html-review` |

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

If request is generic ("planeia este projecto"), ask:

```
O que precisas agora?
1. Definir O QUE construir → PRD
2. Definir COMO construir → Tech Spec
3. Quebrar em tarefas → Task Breakdown
4. Documentar uma decisao → ADR
5. Tudo do inicio → Pipeline completo
```

---

## Activating sub-skills

```
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
```

---

## Quality gate
After planning complete: "Queres `prd-reviewer`?" (validates PRD if generated)
