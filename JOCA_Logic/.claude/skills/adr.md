---
name: adr
description: "Use when recording architecture decisions, creating ADR documents, or documenting technical choices with context/consequences."
triggers: ADR, architecture decision, decisao arquitectural, porque escolhemos, why did we choose, decidimos, we decided, regista esta decisao, record this decision, decisao tecnica, technical decision, alternativas, alternatives considered, tradeoff, trade-off
---
# ADR — Architecture Decision Records

Decisoes arquitecturais persistentes em ficheiros numerados. Formato Michael Nygard.

**Activar** quando:
- Utilizador escolhe entre alternativas significativas (framework, DB, pattern, API design)
- `plan` Fase 3 (abordagens e tradeoffs) completa com decisao tomada
- `tech-spec` sec. 8 (Technical Decisions) tem entrada significativa
- Pedido explicito: "ADR isto", "regista esta decisao", "porque escolhemos X"

---

## Formato ADR

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

## Directorio

```
docs/
└── adr/
    ├── README.md              ← indice de todos os ADRs
    ├── template.md            ← template vazio para uso manual
    ├── 0001-titulo.md
    ├── 0002-titulo.md
    └── ...
```

### README.md (indice)

```markdown
# Architecture Decision Records

| ADR | Titulo | Estado | Data |
|-----|--------|--------|------|
| [0001](0001-use-laravel.md) | Use Laravel as backend framework | accepted | 2026-01-15 |
| [0002](0002-mysql-over-postgres.md) | MySQL over PostgreSQL | accepted | 2026-01-20 |
```

---

## Workflow

### Capturar novo ADR

1. **Inicializar** (primeira vez) — se `docs/adr/` nao existe, pedir confirmacao antes de criar directorio + README.md + template.md
2. **Identificar decisao** — extrair a escolha arquitectural
3. **Documentar contexto** — que problema motivou isto
4. **Registar alternativas** — que mais foi considerado e porque foi rejeitado
5. **Consequencias** — tradeoffs honestos
6. **Numerar** — scan `docs/adr/` e incrementar
7. **Confirmar** — mostrar draft, so escrever apos aprovacao
8. **Actualizar indice** — append no README.md

### Consultar ADR existente

Quando alguem pergunta "porque escolhemos X":

1. Verificar se `docs/adr/` existe
2. Scan README.md por ADRs relevantes
3. Ler e apresentar Context + Decision
4. Se nao encontrar: "Nenhum ADR para essa decisao. Queres registar um agora?"

---

## Que decisoes merecem ADR

| Categoria | Exemplos |
|-----------|---------|
| Tecnologia | Framework, linguagem, database, cloud provider |
| Arquitectura | Monolito vs microservicos, event-driven, CQRS |
| API | REST vs GraphQL, versioning, auth mechanism |
| Data | Schema design, normalizacao, estrategia de cache |
| Infraestrutura | Deploy model, CI/CD, monitoring stack |
| Seguranca | Auth strategy, encryption, secret management |
| Testing | Framework, coverage targets, E2E vs integration |

### O que NAO precisa de ADR

- Naming conventions, formatting (vai no CLAUDE.md)
- Escolhas triviais sem alternativa real
- Decisoes ja revertidas e esquecidas

---

## Deteccao de decisoes (sinais)

### Explicitos
- "Vamos usar X"
- "Escolhemos X em vez de Y"
- "O tradeoff vale a pena porque..."
- "ADR isto", "regista esta decisao"

### Implicitos (sugerir ADR, nao criar automaticamente)
- Comparar dois frameworks e chegar a conclusao
- Escolha de schema com razao explicitada
- Decisao de auth/authz
- Escolha de infraestrutura de deploy

---

## Lifecycle

```
proposed → accepted → [deprecated | superseded by ADR-NNNN]
```

- **proposed** — em discussao, nao commitado
- **accepted** — em vigor
- **deprecated** — irrelevante (feature removida)
- **superseded** — substituido por ADR mais recente (sempre linkar o substituto)

---

## Boas praticas

### Fazer
- Ser especifico — "Usar Pest para testes" nao "usar um framework de testes"
- Registar o PORQUE — razao > escolha
- Incluir alternativas rejeitadas — futuro-eu precisa de saber o que foi considerado
- Consequencias honestas — toda decisao tem tradeoffs
- Curto — legivel em 2 minutos
- Presente do indicativo — "Usamos X" nao "Vamos usar X"

### Nao fazer
- Decisoes triviais (naming, formatting)
- Textos longos — se o contexto excede 10 linhas, e demais
- Omitir alternativas — "escolhemos sem mais" nao e razao valida
- Backfill sem marcar — se registar decisao passada, notar a data original
- Deixar stale — decisoes substituidas devem linkar o substituto

---

## Integracao com JOCA

- `plan` Fase 3 → ao concluir com decisao tomada, sugerir: "Queres registar ADR?"
- `tech-spec` sec. 8 → decisoes significativas devem ter ADR correspondente
- PRD Decision Log → ADR e o formato expandido; append summary line ao Decision Log do PRD
- `/save` → se ADRs novos foram criados na sessao, notificar no resumo

---

## Quality gate
Apos sessao com decisoes: "Registaste ADRs para as decisoes de hoje?"
