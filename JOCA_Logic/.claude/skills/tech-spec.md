---
name: tech-spec
description: "Generates TECH_SPEC.md — the bridge between PRD (what/why) and code (how). MUST be invoked when the user says: tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown. SHOULD also invoke when: sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design."
triggers: tech spec, technical specification, especificacao tecnica, como implementar, data model, modelo de dados, API design, component breakdown, sequence diagram, diagrama de sequencia, arquitectura tecnica, technical architecture, design tecnico, technical design, spec.md, how to build, como construir
---

# Tech Spec

Documento ponte entre PRD (o que/porque) e codigo (como). Produz `TECH_SPEC.md` na raiz do projecto.

**Activar** apos PRD aprovado e `prd-reviewer` passar. Antes de qualquer codigo.

---

## Estrutura do TECH_SPEC.md

```markdown
# Tech Spec — [Nome do Projecto/Feature]

**Versao:** 0.1
**Estado:** Draft | Em review | Aprovado
**PRD:** [link para PRD.md]
**Ultima actualizacao:** [data]

---

## 1. Overview

[1 paragrafo: o que vai ser construido e a abordagem tecnica escolhida]

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

### Decisoes de schema

- [decisao 1 — ex: "soft deletes em orders para audit trail"]
- [decisao 2 — ex: "JSONB para metadata flexivel em products"]

---

## 3. API Surface

### Endpoints

| Method | Path | Descricao | Auth | Request | Response |
|--------|------|-----------|------|---------|----------|
| POST | /api/v1/orders | Criar order | Bearer | CreateOrderRequest | OrderResource |
| GET | /api/v1/orders/{id} | Detalhe order | Bearer | — | OrderResource |

### Events (se event-driven)

| Evento | Payload | Publicado por | Consumido por |
|--------|---------|--------------|---------------|
| OrderCreated | {order_id, user_id, total} | OrderService | NotificationService, InventoryService |

### Error responses

Seguir RFC 9457 (Problem Details). Ver skill `rest-api` para patterns completos.

---

## 4. Component Breakdown

| Componente | Responsabilidade | Tecnologia | Depende de |
|-----------|-----------------|------------|-----------|
| [nome] | [o que faz] | [stack] | [componentes] |

### Diagrama de componentes

\```mermaid
graph TD
    A[Frontend SPA] -->|JSON/HTTPS| B[API Laravel]
    B --> C[(MySQL)]
    B --> D[(Redis)]
    B -->|SMTP| E[Postmark]
\```

---

## 5. Sequence Diagrams — Fluxos Criticos

### [Nome do fluxo — ex: Checkout]

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

### O que mockar vs. testar real

| Componente | Mock | Real | Razao |
|-----------|------|------|-------|
| Database | Nunca | Sempre | Divergencia mock/prod causa bugs |
| Payment gateway | Sim (sandbox) | Em staging | Rate limits + custos |
| Email | Sim (Mail::fake) | Em staging | Sem spam em testes |
| Redis | Nunca | Sempre | Comportamento cache real |

---

## 8. Technical Decisions

| Decisao | Alternativas | Razao |
|---------|-------------|-------|
| [decisao] | [A, B] | [porque esta] |

> Decisoes significativas devem tambem ter um ADR em `docs/adr/`. Ver skill `adr`.

---

## 9. Definition of Done

- [ ] Todos os endpoints da sec. 3 implementados e testados
- [ ] Data model migrado e seeded
- [ ] Sequence diagrams reflectem implementacao real
- [ ] Edge cases cobertos em testes (sec. 7)
- [ ] Integracoes externas configuradas em staging
- [ ] Code review passado
- [ ] Performance: p95 < [Xms] (do NFR no PRD)

---

## 10. Open Questions

| # | Questao | Owner | Prazo |
|---|---------|-------|-------|
| Q1 | [questao tecnica] | [quem] | [data] |
```

---

## Geracao

### Input necessario

1. **PRD.md** — ler primeiro (obrigatorio)
2. **Codebase existente** — se projecto ja tem codigo, ler estrutura e patterns
3. **CLAUDE.md** do projecto — stack, constraints

### Processo

1. Ler PRD.md — extrair features P0, NFRs, constraints
2. Perguntas minimas (so o que o PRD nao responde):
   - "Qual a base de dados?" (se nao definido)
   - "APIs externas a integrar?"
   - "Estimativa de escala? (utilizadores, requests/min)"
3. Gerar TECH_SPEC.md com a estrutura acima
4. Apresentar ao utilizador para review
5. Iterar ate aprovacao

### Formato Lean (features pequenas)

Para features que nao justificam spec completo, usar apenas:
- Overview (1 paragrafo)
- Data model changes (diff do existente)
- API endpoints (tabela)
- Sequence diagram (1 fluxo critico)
- Definition of Done

---

## Actualizacao

Actualizar TECH_SPEC.md quando:
- Feature adicionada/removida do PRD
- Decisao tecnica muda durante implementacao
- Integracao nova descoberta
- Schema evolui significativamente

Processo: editar cirurgicamente, incrementar versao, adicionar linha ao historico se existir.

---

## Workflow

Pipeline desta skill na sequencia JOCA:

→ **antes**: `prd` + `prd-reviewer` (requisitos validados)
→ **durante**: `adr` (capturar decisoes significativas da sec. 8)
→ **apos**: `c4-diagram` (visualizar componentes da sec. 4) → `task-breakdown` (quebrar em trabalho atomico)

Notificar ao concluir: `→ proximo: c4-diagram`
