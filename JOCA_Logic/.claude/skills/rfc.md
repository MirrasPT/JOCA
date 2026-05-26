---
name: rfc
description: "Writing Request for Comments documents, proposing system changes, or documenting technical proposals. MUST be invoked when the user says: RFC, request for comments, proposta de mudanca, change proposal, migrar de X para Y, migrate from, breaking change, mudanca grande. SHOULD also invoke when: big change, afecta multiplos modulos, cross-cutting, nova abordagem, new approach, reestruturar."
triggers: RFC, request for comments, proposta de mudanca, change proposal, migrar de X para Y, migrate from, breaking change, mudanca grande, big change, afecta multiplos modulos, cross-cutting, nova abordagem, new approach, reestruturar, restructure, mudar API, change API, decisao que afecta tudo
---
# RFC — Request for Comments

Propostas estruturadas para mudancas cross-cutting. Ficheiros em `docs/rfcs/`.

**Activar** quando a mudanca:
- Afecta multiplos modulos/servicos
- Quebra API publica ou contratos existentes
- Introduz pattern novo no codebase
- Requer investimento significativo (> 1 semana)
- Define precedente que futuras features vao seguir

**NAO usar** para: features normais (usar PRD), decisoes pontuais (usar ADR), bug fixes.

---

## Formato RFC

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

## Directorio

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

## Processo

1. **Identificar necessidade** — sinais de mudanca cross-cutting
2. **Draft** — gerar RFC usando template acima
3. **Perguntas minimas** ao utilizador:
   - "Qual o problema principal?"
   - "Que alternativas ja foram consideradas?"
   - "Timeline e flexivel ou hard deadline?"
4. **Apresentar draft** para review
5. **Iterar** ate aprovacao
6. **Escrever** em `docs/rfcs/` + actualizar README.md
7. **Derivar trabalho** → `tech-spec` para design detalhado → `adr` para decisoes → `task-breakdown` para execucao

---

## Quando RFC vs. ADR vs. PRD

| Situacao | Usar |
|----------|------|
| Feature nova com requisitos de produto | PRD |
| Escolha entre duas opcoes (1 decisao) | ADR |
| Mudanca tecnica grande que afecta multiplas areas | **RFC** |
| Migracao de tecnologia | **RFC** |
| Novo pattern no codebase | **RFC** |
| Breaking change em API | **RFC** |

RFC pode gerar multiplos ADRs (um por decisao significativa tomada durante a implementacao).

---

## Workflow

Skill lateral — nao faz parte da pipeline sequencial. Invocada situacionalmente.

→ **apos RFC aceite**: `tech-spec` (design detalhado) → `adr` (decisoes) → `task-breakdown` (trabalho)
→ **se RFC rejeitado**: documentar razao no estado, manter ficheiro para historico

Notificar ao concluir RFC aceite: `→ proximo: tech-spec`
