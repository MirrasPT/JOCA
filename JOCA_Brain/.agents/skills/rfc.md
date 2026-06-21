---
name: rfc
description: "Writing Request for Comments documents, proposing system changes, or documenting technical proposals. MUST be invoked when the user says: RFC, request for comments, proposta de mudanca, change proposal, migrar de X para Y, migrate from, breaking change, mudanca grande. SHOULD also invoke when: big change, afecta multiplos modulos, cross-cutting, nova abordagem, new approach, reestruturar."
triggers: RFC, request for comments, proposta de mudanca, change proposal, migrar de X para Y, migrate from, breaking change, mudanca grande, big change, afecta multiplos modulos, cross-cutting, nova abordagem, new approach, reestruturar, restructure, mudar API, change API, decisao que afecta tudo
---
# RFC -- Request for Comments

Structured proposals for cross-cutting changes. Files in `docs/rfcs/`.

**Activate** when the change:
- Affects multiple modules/services
- Breaks public API or existing contracts
- Introduces a new pattern in the codebase
- Requires significant investment (> 1 week)
- Sets precedent for future features

**Skip** for: normal features (use PRD), one-off decisions (use ADR), bug fixes.

---

## RFC Format

```markdown
# RFC: [Titulo descritivo]

**Data:** YYYY-MM-DD
**Autor:** [quem propoe]
**Estado:** draft | em review | aceite | rejeitado | implementado
**ADRs relacionados:** [links se existirem]

---

## Sumario

[2-3 frases: o que se propoe e porque]

---

## Problema

[Descricao clara do problema actual. Evidencia: metricas, incidentes, pain points concretos. Sem solucao aqui — so o problema.]

---

## Problemas que isto NAO resolve

[Scope explicito: o que fica de fora desta proposta. Evita scope creep e expectativas falsas.]

---

## Estado actual

[Como funciona hoje. Codigo, arquitectura, fluxos relevantes. Suficiente para alguem sem contexto perceber o ponto de partida.]

---

## Solucao proposta

[Descricao tecnica da mudanca. Detalhada o suficiente para implementar, mas sem ser codigo final.]

### Data model changes
[Novas tabelas, campos, relacoes]

### API changes
[Novos endpoints, mudancas a existentes, deprecations]

### Component changes
[Que modulos mudam, como interagem pos-mudanca]

---

## Alternativas consideradas

### [Alternativa A]
- **Descricao:** [como funcionaria]
- **Pros:** [beneficios]
- **Cons:** [desvantagens]
- **Rejeitada porque:** [razao concreta]

### [Alternativa B]
- **Descricao:** [como funcionaria]
- **Pros:** [beneficios]
- **Cons:** [desvantagens]
- **Rejeitada porque:** [razao concreta]

---

## Plano de migracao

### Fase 1: [descricao]
- [passo 1]
- [passo 2]
- **Rollback:** [como reverter se correr mal]

### Fase 2: [descricao]
- [passo 1]
- **Rollback:** [como reverter]

### Deprecation plan
- [o que e deprecado]
- [timeline de remocao]
- [como comunicar aos consumidores]

---

## Timeline

| Fase | Duracao estimada | Dependencias |
|------|-----------------|-------------|
| Fase 1 | [X dias/semanas] | [de que depende] |
| Fase 2 | [X dias/semanas] | [Fase 1 concluida] |

---

## Dependencias

| Dependencia | Tipo | Owner | Estado |
|------------|------|-------|--------|
| [servico/equipa/recurso] | [hard/soft] | [quem] | [disponivel/pendente] |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|-------------|---------|-----------|
| [risco 1] | [alta/media/baixa] | [alto/medio/baixo] | [como mitigar] |

---

## Open Questions

| # | Questao | Owner | Prazo |
|---|---------|-------|-------|
| Q1 | [questao] | [quem] | [data] |

---

## Revisores

| Nome | Area | Estado |
|------|------|--------|
| [nome] | [backend/frontend/infra/product] | [pendente/aprovado/preocupacoes] |
```

---

## Directory

```
docs/
└── rfcs/
    ├── README.md                          ← indice
    └── RFC-2026-05-25-migrate-auth.md     ← RFC individual
```

### README.md (indice)

```markdown
# RFCs

| RFC | Titulo | Estado | Data |
|-----|--------|--------|------|
| [2026-05-25](RFC-2026-05-25-migrate-auth.md) | Migrate auth to Laravel Sanctum | aceite | 2026-05-25 |
```

---

## Process

1. **Identify need** -- cross-cutting change detected
2. **Draft** -- generate RFC using the template above
3. **Minimal questions** to the user:
   - "What is the core problem?"
   - "What alternatives were considered?"
   - "Flexible timeline or hard deadline?"
4. **Present draft** for review
5. **Iterate** until approved
6. **Write** to `docs/rfcs/` + update README.md
7. **Derive work** -- `tech-spec` for detailed design -- `adr` for decisions -- `task-breakdown` for execution

---

## When RFC vs. ADR vs. PRD

| Situation | Use |
|-----------|-----|
| New feature with product requirements | PRD |
| Choice between two options (1 decision) | ADR |
| Large technical change across multiple areas | **RFC** |
| Technology migration | **RFC** |
| New codebase pattern | **RFC** |
| Breaking API change | **RFC** |

An RFC can spawn multiple ADRs (one per significant decision during implementation).

---

## Workflow

Lateral skill -- not part of the sequential pipeline. Invoked situationally.

-- **after accepted RFC**: `tech-spec` (detailed design) -- `adr` (decisions) -- `task-breakdown` (work)
-- **if RFC rejected**: document reason in state, keep file for history

Notify on accepted RFC: `-- next: tech-spec`
