---
name: tech-spec
description: "Generates TECH_SPEC.md — bridge between PRD (what/why) and code (how). MUST be invoked when the user says: tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown. SHOULD also invoke when: sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design."
triggers: tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown, sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design, spec.md, how to build, como construir
---

# Tech Spec

Bridge between PRD (what/why) and code (how). Produces `TECH_SPEC.md` at project root.

**Activate** after PRD is approved and `prd-reviewer` passes. Before any code.

---

## TECH_SPEC.md Structure

```markdown
# Tech Spec — [Nome do Projecto/Feature]

**Versao:** 0.1
**Estado:** Draft | Em review | Aprovado
**PRD:** [link para PRD.md]
**Ultima actualizacao:** [data]

---

## 1. Overview

[1 paragraph: what will be built and the chosen technical approach]

---

## 2. Data Model

### Entidades

| Entidade | Descricao | Campos chave |
|----------|-----------|-------------|
| [Nome] | [responsabilidade] | [campos principais + tipos] |

### ERD

\```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER_ITEM }o--|| PRODUCT : references
\```

### Schema decisions

- [decisao 1 — ex: "soft deletes em orders para audit trail"]
- [decisao 2 — ex: "JSONB para metadata flexivel em products"]

---

## 3. API Surface

### Endpoints

| Method | Path | Descricao | Auth | Request | Response |
|--------|------|-----------|------|---------|----------|
| POST | /api/v1/orders | Criar order | Bearer | CreateOrderRequest | OrderResource |
| GET | /api/v1/orders/{id} | Detalhe order | Bearer | — | OrderResource |

### Events (if event-driven)

| Evento | Payload | Publicado por | Consumido por |
|--------|---------|--------------|---------------|
| OrderCreated | {order_id, user_id, total} | OrderService | NotificationService, InventoryService |

### Error responses

Follow RFC 9457 (Problem Details). See skill `rest-api` for full patterns.

---

## 4. Component Breakdown

| Componente | Responsabilidade | Tecnologia | Depende de |
|-----------|-----------------|------------|-----------|
| [nome] | [o que faz] | [stack] | [componentes] |

### Component diagram

\```mermaid
graph TD
    A[Frontend SPA] -->|JSON/HTTPS| B[API Laravel]
    B --> C[(MySQL)]
    B --> D[(Redis)]
    B -->|SMTP| E[Postmark]
\```

---

## 5. Sequence Diagrams — Critical Flows

### [Flow name — ex: Checkout]

\```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant A as API
    participant DB as Database
    participant P as Payment Gateway

    U->>F: Click "Pay"
    F->>A: POST /api/orders
    A->>DB: BEGIN TRANSACTION
    A->>P: Create payment intent
    P-->>A: intent_id
    A->>DB: INSERT order (pending)
    A->>DB: COMMIT
    A-->>F: {order_id, client_secret}
    F->>P: Confirm payment (client-side)
    P-->>A: Webhook: payment_succeeded
    A->>DB: UPDATE order (paid)
\```

---

## 6. Integration Points

| Sistema externo | Tipo | Auth | Rate limit | Fallback |
|----------------|------|------|-----------|----------|
| [nome] | REST/Webhook/SDK | [tipo] | [limite] | [o que fazer se falhar] |

---

## 7. Testing Strategy

| Tipo | Scope | Framework | Cobertura alvo |
|------|-------|-----------|---------------|
| Unit | Models, Services, Actions | Pest | 80%+ |
| Feature | Endpoints, fluxos | Pest + RefreshDatabase | Happy path + edge cases |
| Browser | Fluxos criticos UI | Playwright | Checkout, auth, onboarding |

### Mock vs. real

| Componente | Mock | Real | Razao |
|-----------|------|------|-------|
| Database | Nunca | Sempre | Mock/prod divergence causes bugs |
| Payment gateway | Sim (sandbox) | Em staging | Rate limits + costs |
| Email | Sim (Mail::fake) | Em staging | No spam in tests |
| Redis | Nunca | Sempre | Real cache behaviour needed |

---

## 8. Technical Decisions

| Decisao | Alternativas | Razao |
|---------|-------------|-------|
| [decisao] | [A, B] | [porque esta] |

> Significant decisions should also have an ADR in `docs/adr/`. See skill `adr`.

---

## 9. Definition of Done

- [ ] All endpoints from sec. 3 implemented and tested
- [ ] Data model migrated and seeded
- [ ] Sequence diagrams reflect actual implementation
- [ ] Edge cases covered in tests (sec. 7)
- [ ] External integrations configured in staging
- [ ] Code review passed
- [ ] Performance: p95 < [Xms] (from NFR in PRD)

---

## 10. Open Questions

| # | Questao | Owner | Prazo |
|---|---------|-------|-------|
| Q1 | [questao tecnica] | [quem] | [data] |
```

---

## Generation

### Required input

1. **PRD.md** — read first (mandatory)
2. **Existing codebase** — if project has code, read structure and patterns
3. **CLAUDE.md** of project — stack, constraints

### Process

1. Read PRD.md — extract P0 features, NFRs, constraints
2. Minimal questions (only what PRD doesn't answer):
   - "Which database?" (if undefined)
   - "External APIs to integrate?"
   - "Scale estimate? (users, requests/min)"
3. Generate TECH_SPEC.md with structure above
4. Present to user for review
5. Iterate until approved

### Lean format (small features)

For features that don't justify a full spec, use only:
- Overview (1 paragraph)
- Data model changes (diff from existing)
- API endpoints (table)
- Sequence diagram (1 critical flow)
- Definition of Done

---

## Updates

Update TECH_SPEC.md when:
- Feature added/removed from PRD
- Technical decision changes during implementation
- New integration discovered
- Schema evolves significantly

Process: edit surgically, increment version, add line to history if it exists.

---

## Workflow

Pipeline position in JOCA sequence:

-> **before**: `prd` + `prd-reviewer` (validated requirements)
-> **during**: `adr` (capture significant decisions from sec. 8)
-> **after**: `c4-diagram` (visualize components from sec. 4) -> `task-breakdown` (break into atomic work)

Notify on completion: `-> proximo: c4-diagram`
