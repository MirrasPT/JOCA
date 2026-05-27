---
name: adr
description: "Recording architecture decisions, creating ADR documents, or documenting technical choices with context/consequences. MUST be invoked when the user says: ADR, architecture decision, decisao arquitectural, porque escolhemos, why did we choose, decidimos, we decided, regista esta decisao. SHOULD also invoke when: record this decision, decisao tecnica, technical decision, alternativas, alternatives considered, tradeoff."
triggers: ADR, architecture decision, decisao arquitectural, porque escolhemos, why did we choose, decidimos, we decided, regista esta decisao, record this decision, decisao tecnica, technical decision, alternativas, alternatives considered, tradeoff, trade-off
---
# ADR — Architecture Decision Records

Persistent architecture decisions in numbered files. Michael Nygard format.

**Activate** when:
- User chooses between significant alternatives (framework, DB, pattern, API design)
- `plan` Phase 3 (approaches and tradeoffs) completes with decision taken
- `tech-spec` sec. 8 (Technical Decisions) has significant entry
- Explicit request: "ADR isto", "regista esta decisao", "porque escolhemos X"

---

## ADR Format

```markdown
# ADR-NNNN: [Titulo da Decisao]

**Data:** YYYY-MM-DD
**Estado:** proposed | accepted | deprecated | superseded by ADR-NNNN
**Decidido por:** [quem participou]

## Contexto

[2-5 frases: qual o problema/constraint que motivou esta decisao]

## Decisao

[1-3 frases: o que foi decidido — claro e directo]

## Alternativas Consideradas

### [Nome da alternativa A]
- **Pros:** [beneficios]
- **Cons:** [desvantagens]
- **Rejeitada porque:** [razao especifica]

### [Nome da alternativa B]
- **Pros:** [beneficios]
- **Cons:** [desvantagens]
- **Rejeitada porque:** [razao especifica]

## Consequencias

### Positivas
- [beneficio 1]
- [beneficio 2]

### Negativas
- [tradeoff 1]
- [tradeoff 2]

### Riscos
- [risco e mitigacao]
```

---

## Directory

```
docs/
└── adr/
    ├── README.md              ← indice de todos os ADRs
    ├── template.md            ← template vazio para uso manual
    ├── 0001-titulo.md
    ├── 0002-titulo.md
    └── ...
```

### README.md (index)

```markdown
# Architecture Decision Records

| ADR | Titulo | Estado | Data |
|-----|--------|--------|------|
| [0001](0001-use-laravel.md) | Use Laravel as backend framework | accepted | 2026-01-15 |
| [0002](0002-mysql-over-postgres.md) | MySQL over PostgreSQL | accepted | 2026-01-20 |
```

---

## Workflow

### New ADR

1. **Init** (first time) — if `docs/adr/` missing, confirm before creating dir + README.md + template.md
2. **Identify** the architectural choice
3. **Document context** — what problem motivated this
4. **Record alternatives** — what else was considered, why rejected
5. **Consequences** — honest tradeoffs
6. **Number** — scan `docs/adr/`, increment
7. **Confirm** — show draft, write only after approval
8. **Update index** — append to README.md

### Lookup existing ADR

When someone asks "why did we choose X":

1. Check if `docs/adr/` exists
2. Scan README.md for relevant ADRs
3. Read and present Context + Decision
4. If not found: "No ADR for that decision. Want to record one now?"

---

## What deserves an ADR

| Categoria | Exemplos |
|-----------|---------|
| Tecnologia | Framework, linguagem, database, cloud provider |
| Arquitectura | Monolito vs microservicos, event-driven, CQRS |
| API | REST vs GraphQL, versioning, auth mechanism |
| Data | Schema design, normalizacao, estrategia de cache |
| Infraestrutura | Deploy model, CI/CD, monitoring stack |
| Seguranca | Auth strategy, encryption, secret management |
| Testing | Framework, coverage targets, E2E vs integration |

### What does NOT need an ADR

- Naming conventions, formatting (goes in CLAUDE.md)
- Trivial choices with no real alternative
- Already-reverted forgotten decisions

---

## Decision detection (signals)

### Explicit
- "Vamos usar X"
- "Escolhemos X em vez de Y"
- "O tradeoff vale a pena porque..."
- "ADR isto", "regista esta decisao"

### Implicit (suggest ADR, don't auto-create)
- Comparing two frameworks and reaching a conclusion
- Schema choice with explicit reasoning
- Auth/authz decision
- Deploy infrastructure choice

---

## Lifecycle

```
proposed → accepted → [deprecated | superseded by ADR-NNNN]
```

- **proposed** — under discussion, not committed
- **accepted** — in effect
- **deprecated** — irrelevant (feature removed)
- **superseded** — replaced by newer ADR (always link the replacement)

---

## Best practices

### Do
- Be specific — "Use Pest for tests" not "use a test framework"
- Record the WHY — reason > choice
- Include rejected alternatives — future-you needs to know what was considered
- Honest consequences — every decision has tradeoffs
- Keep short — readable in 2 minutes
- Present tense — "We use X" not "We will use X"

### Don't
- Trivial decisions (naming, formatting)
- Long text — if context exceeds 10 lines, it's too much
- Omit alternatives — "we chose without more" is not a valid reason
- Backfill without marking — if recording a past decision, note the original date
- Leave stale — superseded decisions must link the replacement

---

## JOCA integration

- `plan` Phase 3 → on completion with decision taken, suggest: "Record ADR?"
- `tech-spec` sec. 8 → significant decisions should have a corresponding ADR
- PRD Decision Log → ADR is the expanded format; append summary line to the PRD Decision Log
- `/save` → if new ADRs were created this session, notify in summary

---

## Quality gate
After session with decisions: "Did you record ADRs for today's decisions?"
