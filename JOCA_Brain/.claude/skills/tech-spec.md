---
name: tech-spec
description: "Generates TECH_SPEC.md — bridge between PRD (what/why) and code (how). MUST be invoked when the user says: tech spec, technical specification, how to implement, data model, API design, component breakdown. SHOULD also invoke when: sequence diagram, technical architecture, technical design."
triggers: tech spec, technical specification, how to implement, data model, API design, component breakdown, sequence diagram, technical architecture, technical design, spec.md, how to build
chain: c4-diagram, task-breakdown
---

# Tech Spec

Bridge between PRD (what/why) and code (how). Produces `TECH_SPEC.md` at project root.

**Activate** after PRD is approved and `prd-reviewer` passes. Before any code.

---

## TECH_SPEC.md Structure

```markdown
# Tech Spec — [Project/Feature Name]

**Version:** 0.1
**Status:** Draft | In review | Approved
**PRD:** [link to PRD.md]
**Last updated:** [date]

---

## 1. Overview

[1 paragraph: what will be built and the chosen technical approach]

---

## 2. Data Model

### Entities

| Entity | Description | Key fields |
|----------|-----------|-------------|
| [Name] | [responsibility] | [main fields + types] |

### ERD

\```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER_ITEM }o--|| PRODUCT : references
\```

### Schema decisions

- [decision 1 — e.g.: "soft deletes on orders for audit trail"]
- [decision 2 — e.g.: "JSONB for flexible metadata on products"]

---

## 3. API Surface

### Endpoints

| Method | Path | Description | Auth | Request | Response |
|--------|------|-----------|------|---------|----------|
| POST | /api/v1/orders | Create order | Bearer | CreateOrderRequest | OrderResource |
| GET | /api/v1/orders/{id} | Order detail | Bearer | — | OrderResource |

### Events (if event-driven)

| Event | Payload | Published by | Consumed by |
|--------|---------|--------------|---------------|
| OrderCreated | {order_id, user_id, total} | OrderService | NotificationService, InventoryService |

### Error responses

Follow RFC 9457 (Problem Details). See skill `rest-api` for full patterns.

---

## 4. Component Breakdown

| Component | Responsibility | Technology | Depends on |
|-----------|-----------------|------------|-----------|
| [name] | [what it does] | [stack] | [components] |

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

### [Flow name — e.g.: Checkout]

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

| External system | Type | Auth | Rate limit | Fallback |
|----------------|------|------|-----------|----------|
| [name] | REST/Webhook/SDK | [type] | [limit] | [what to do if it fails] |

---

## 7. Testing Strategy

| Type | Scope | Framework | Target coverage |
|------|-------|-----------|---------------|
| Unit | Models, Services, Actions | Pest | 80%+ |
| Feature | Endpoints, flows | Pest + RefreshDatabase | Happy path + edge cases |
| Browser | Critical UI flows | Playwright | Checkout, auth, onboarding |

### Mock vs. real

| Component | Mock | Real | Reason |
|-----------|------|------|-------|
| Database | Never | Always | Mock/prod divergence causes bugs |
| Payment gateway | Yes (sandbox) | In staging | Rate limits + costs |
| Email | Yes (Mail::fake) | In staging | No spam in tests |
| Redis | Never | Always | Real cache behavior needed |

---

## 8. Technical Decisions

| Decision | Alternatives | Reason |
|---------|-------------|-------|
| [decision] | [A, B] | [why this one] |

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

| # | Question | Owner | Deadline |
|---|---------|-------|-------|
| Q1 | [technical question] | [who] | [date] |
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

Notify on completion: `-> next: c4-diagram`
