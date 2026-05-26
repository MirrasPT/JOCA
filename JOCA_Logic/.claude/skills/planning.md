---
name: planning
description: "Planning project architecture, creating tech specs, breaking down tasks, or documenting decisions. MUST be invoked when the user says: planear, planning, planeia o projecto, project planning, como comecar, how to start, documentacao do projecto, project documentation. SHOULD also invoke when: antes de comecar, before coding, setup do projecto, project setup, iniciar projecto, kick off."
triggers: planear, planning, planeia o projecto, project planning, como comecar, how to start, documentacao do projecto, project documentation, antes de comecar, before coding, setup do projecto, project setup, iniciar projecto, kick off
---
# Planning — Router

Primeira camada da stack. Tudo o que acontece antes de tocar em codigo ou design.

---

## Skills disponiveis

| Skill | O que produz | Quando usar |
|-------|-------------|-------------|
| `plan` | Plano de execucao por sessao | Tarefa complexa, multi-step, decisao de arquitectura |
| `prd` | PRD.md — requisitos vivos | Inicio de projecto, nova feature, mudanca de scope |
| `tech-spec` | TECH_SPEC.md — design tecnico | Apos PRD aprovado, antes de codificar |
| `adr` | docs/adr/NNNN-*.md — decisoes | Tradeoff arquitectural, escolha de tecnologia |
| `c4-diagram` | docs/architecture/*.md — diagramas Mermaid | Visualizar sistema, comunicar arquitectura |
| `task-breakdown` | TASKS.md — epics/stories/tasks | Quebrar projecto em trabalho atomico |
| `rfc` | docs/rfcs/RFC-*.md — propostas | Mudanca cross-cutting, breaking change |
| `html-review` | docs/review/*.html — visual review | Revisao humana, partilha com stakeholders |

---

## Routing

### Sinais directos

| O utilizador diz | Activar |
|-------------------|---------|
| "planeia", "como faríamos", "implementa X e Y e Z" | `plan` |
| "PRD", "requisitos", "especificacao", "o que vamos construir" | `prd` |
| "tech spec", "como implementar", "data model", "API design", "arquitectura tecnica" | `tech-spec` |
| "ADR", "decisao", "porque escolhemos X", "regista esta decisao" | `adr` |
| "diagrama", "C4", "arquitectura visual", "como o sistema se estrutura" | `c4-diagram` |
| "tasks", "breakdown", "epics", "stories", "estimativa", "quanto tempo" | `task-breakdown` |
| "RFC", "proposta de mudanca", "migrar de X para Y", "breaking change" | `rfc` |
| "gerar html", "html review", "visualizar documento", "preview", "exportar" | `html-review` |

### Pipeline completo (projecto novo)

```
prd → prd-reviewer → tech-spec → c4-diagram → task-breakdown → plan (por sessao) → html-review → codigo
```

Lateral (invocados quando relevante, nao sequencialmente):
- `adr` — auto-sugerir quando `tech-spec` ou `plan` detectam tradeoff
- `rfc` — quando a mudanca afecta multiplos modulos/equipas

### Projecto ja em andamento

| Situacao | Activar |
|----------|---------|
| Feature nova sem spec | `prd` (lean format) → `tech-spec` → `task-breakdown` |
| Decisao arquitectural a registar | `adr` |
| Precisar de visao geral do sistema | `c4-diagram` (mode: document-code) |
| Estimar trabalho restante | `task-breakdown` |
| Mudanca grande (auth, DB, API publica) | `rfc` → `tech-spec` → `adr` |

### Sem match claro

Se o pedido e generico ("planeia este projecto"), perguntar:

```
O que precisas agora?
1. Definir O QUE construir → PRD
2. Definir COMO construir → Tech Spec
3. Quebrar em tarefas → Task Breakdown
4. Documentar uma decisao → ADR
5. Tudo do inicio → Pipeline completo
```

---

## Como activar sub-skills

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
Apos planning completo: "Queres `prd-reviewer`?" (valida PRD se gerado)
