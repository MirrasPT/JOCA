---
name: tech-spec
description: "Generates TECH_SPEC.md — bridge between PRD (what/why) and code (how) — and change proposals (ex-RFC: alternatives considered, rollout plan). MUST be invoked when the user says: RFC, proposta de mudanca, breaking change, tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown. SHOULD also invoke when: sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design."
triggers: RFC, request for comments, proposta de mudanca, change proposal, migrar de X para Y, breaking change, mudanca grande, mudar API, tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown, sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design, spec.md, how to build, como construir
chain: c4-diagram, novo-issue, planear-ondas
---

# Tech Spec

Bridge between PRD (what/why) and code (how). Produces `TECH_SPEC.md` at project root.

**Activate** after PRD is approved and `prd-reviewer` passes. Before any code. Cross-cutting change → see «Change proposal (ex-RFC)».

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

> Significant decisions also get an entry in `docs/DECISIONS.md` — format in `.claude/reference/adr-formato.md`.

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

## Change proposal (ex-RFC)

Use when the change is **cross-cutting**: spans several modules, breaks a public API/contract, introduces a new codebase
pattern, is a technology migration, or costs > 1 week. Normal feature → PRD + spec · single choice → decision entry · bug fix → neither.

Write it as a lean spec (or `docs/rfcs/RFC-YYYY-MM-DD-<slug>.md` if the project already keeps RFCs) with these extra sections:

```markdown
## Problema
[Problema actual com evidencia — metricas, incidentes. Sem solucao aqui.]

## Problemas que isto NAO resolve
[Scope explicito — evita scope creep.]

## Alternativas consideradas
### [Alternativa A]
- **Pros:** [...] · **Cons:** [...]
- **Rejeitada porque:** [razao concreta]

## Plano de rollout
### Fase 1: [descricao]
- [passos]
- **Rollback:** [como reverter se correr mal]
### Fase 2: [...]
### Deprecation
- [o que e deprecado] · [prazo de remocao] · [como avisar os consumidores]

## Riscos
| Risco | Probabilidade | Impacto | Mitigacao |
```

Ask only: core problem? alternatives already considered? hard deadline? Each rollout phase becomes an issue (`novo-issue`);
each significant choice made along the way becomes a decision entry. Rejected proposal → keep the file, state why.

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
-> **during**: decision entries for sec. 8 (`.claude/reference/adr-formato.md`)
-> **after**: `c4-diagram` (visualize components from sec. 4) -> `novo-issue` (one issue per unit of work) -> `planear-ondas` (order, dependencies, estimates)

Notify on completion: `-> proximo: c4-diagram`
