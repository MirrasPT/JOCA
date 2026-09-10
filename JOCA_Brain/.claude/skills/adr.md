---
name: adr
description: "Recording architecture decisions, creating ADR documents, or documenting technical choices with context/consequences. MUST be invoked when the user says: ADR, architecture decision, why did we choose, we decided. SHOULD also invoke when: record this decision, technical decision, alternatives, alternatives considered, tradeoff."
triggers: ADR, architecture decision, why did we choose, we decided, record this decision, technical decision, alternatives, alternatives considered, tradeoff, trade-off
---
# ADR — Architecture Decision Records

Persistent architecture decisions in numbered files. Michael Nygard format.

**Activate** when:
- User chooses between significant alternatives (framework, DB, pattern, API design)
- `plan` Phase 3 (approaches and tradeoffs) completes with decision taken
- `tech-spec` sec. 8 (Technical Decisions) has significant entry
- Explicit request: "ADR this", "record this decision", "why did we choose X"

---

## ADR Format

```markdown
# ADR-NNNN: [Decision Title]

**Date:** YYYY-MM-DD
**Status:** proposed | accepted | deprecated | superseded by ADR-NNNN
**Decided by:** [who took part]

## Context

[2-5 sentences: what problem/constraint motivated this decision]

## Decision

[1-3 sentences: what was decided — clear and direct]

## Alternatives Considered

### [Name of alternative A]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Rejected because:** [specific reason]

### [Name of alternative B]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Rejected because:** [specific reason]

## Consequences

### Positive
- [benefit 1]
- [benefit 2]

### Negative
- [tradeoff 1]
- [tradeoff 2]

### Risks
- [risk and mitigation]
```

---

## Directory

```
docs/
└── adr/
    ├── README.md              ← index of all ADRs
    ├── template.md            ← empty template for manual use
    ├── 0001-title.md
    ├── 0002-title.md
    └── ...
```

### README.md (index)

```markdown
# Architecture Decision Records

| ADR | Title | Status | Date |
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

| Category | Examples |
|-----------|---------|
| Technology | Framework, language, database, cloud provider |
| Architecture | Monolith vs microservices, event-driven, CQRS |
| API | REST vs GraphQL, versioning, auth mechanism |
| Data | Schema design, normalization, cache strategy |
| Infrastructure | Deploy model, CI/CD, monitoring stack |
| Security | Auth strategy, encryption, secret management |
| Testing | Framework, coverage targets, E2E vs integration |

### What does NOT need an ADR

- Naming conventions, formatting (goes in CLAUDE.md)
- Trivial choices with no real alternative
- Already-reverted forgotten decisions

---

## Decision detection (signals)

### Explicit
- "We're going to use X"
- "We chose X instead of Y"
- "The tradeoff is worth it because..."
- "ADR this", "record this decision"

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
