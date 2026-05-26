---
name: task-breakdown
description: "Use when decomposing large features into implementable tasks with dependencies and estimates."
triggers: tasks, task breakdown, breakdown, epics, stories, estimativa, estimation, quanto tempo, how long, sizing, sprint, sprint planning, backlog, quebrar em tarefas, break into tasks, TASKS.md, work breakdown, WBS, priorizar, prioritize, RICE
---
# Task Breakdown

Gera `TASKS.md` — ledger persistente de epics/stories/tasks que sobrevive entre sessoes.

**Activar** apos `tech-spec` + `c4-diagram`, ou quando alguem pede estimativa ou breakdown de trabalho.

---

## Estrutura do TASKS.md

```markdown
# TASKS — [Nome do Projecto/Feature]

**PRD:** [link]
**Tech Spec:** [link]
**Ultima actualizacao:** [data]

---

## Prioridades (RICE)

| ID | Story | Reach | Impact | Confidence | Effort | Score | Prioridade |
|----|-------|-------|--------|-----------|--------|-------|-----------|
| S1 | [nome] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P0 |
| S2 | [nome] | [1-10] | [1-3] | [0.5-1] | [T-shirt] | [calc] | P1 |

*RICE Score = (Reach x Impact x Confidence) / Effort*
*Effort: S=1, M=2, L=4, XL=8*

---

## [Epic 1: Nome]

### S1: [Story name]
**Como** [persona], **quero** [accao] **para** [beneficio].
**Size:** M (1-2 dias) | **Prioridade:** P0 | **Estado:** TODO

- [ ] `T1.1` Setup migration [ficheiro] — S
- [ ] `T1.2` Create model + relationships [ficheiro] — S
- [ ] `T1.3` Implement controller + form request [ficheiro] — M
- [ ] `T1.4` Write feature tests [ficheiro] — S
  - **Depende de:** T1.1, T1.2, T1.3

### S2: [Story name]
**Como** [persona], **quero** [accao] **para** [beneficio].
**Size:** L (3-5 dias) | **Prioridade:** P0 | **Estado:** TODO
**Bloqueia:** S5 (precisa deste endpoint)

- [ ] `T2.1` [descricao] [ficheiro] — S
- [ ] `T2.2` [descricao] [ficheiro] — M
- [ ] `T2.3` [descricao] [ficheiro] — S

---

## [Epic 2: Nome]

### S3: [Story name]
...

---

## Legenda

| Simbolo | Significado |
|---------|------------|
| S | Small: <= 4h |
| M | Medium: 1-2 dias |
| L | Large: 3-5 dias |
| XL | Extra Large: > 1 semana (subdividir) |
| `[ ]` | TODO |
| `[x]` | DONE |
| `[-]` | IN_PROGRESS |
| `[!]` | BLOCKED |
| **Depende de:** | Task so pode comecar apos estas |
| **Bloqueia:** | Estas stories/tasks dependem desta |
```

---

## Geracao

### Input necessario

1. **PRD.md** — features P0/P1, user stories, AC
2. **TECH_SPEC.md** — componentes, data model, endpoints
3. Se nenhum existir: recolher directamente do utilizador

### Processo

1. Ler PRD + Tech Spec
2. Extrair user stories do PRD (sec. 5)
3. Mapear stories a componentes do Tech Spec (sec. 4)
4. Quebrar cada story em tasks atomicas (<= 4h)
5. Identificar dependencias entre tasks
6. Aplicar T-shirt sizing
7. Calcular RICE scores
8. Ordenar por prioridade
9. Apresentar TASKS.md ao utilizador
10. Iterar ate aprovacao

### Regras de decomposicao

| Regra | Descricao |
|-------|-----------|
| Atomico | Cada task completavel em <= 4h |
| Verificavel | "Done quando" claro e observavel |
| Ficheiros explicitos | Cada task lista os ficheiros que toca |
| XL = subdividir | Se > 1 semana, partir em stories menores |
| Dependencias explicitas | Nunca assumir ordem — declarar com "Depende de" |
| 1 responsabilidade | 1 task = 1 coisa. "Criar model e controller e testes" sao 3 tasks |

### T-shirt sizing guidelines

| Size | Tempo | Exemplos tipicos |
|------|-------|-----------------|
| S | <= 4h | Migration, model simples, config, seed |
| M | 1-2 dias | Controller + form request + testes, integracao simples |
| L | 3-5 dias | Feature completa com UI + API + testes, integracao complexa |
| XL | > 1 semana | Subdividir obrigatoriamente |

### RICE scoring

- **Reach** (1-10): quantos utilizadores/sessoes afecta por semana
- **Impact** (1-3): 1=minor, 2=medium, 3=massive
- **Confidence** (0.5-1.0): 0.5=especulacao, 0.8=dados indirectos, 1.0=dados directos
- **Effort** (T-shirt → numero): S=1, M=2, L=4, XL=8
- **Score** = (Reach x Impact x Confidence) / Effort

Quando nao ha dados para Reach: usar estimativa informada e marcar Confidence=0.5.

---

## Actualizacao

### Quando actualizar

- Task concluida → `[x]` + data
- Task bloqueada → `[!]` + razao
- Novo scope descoberto → adicionar stories/tasks
- Re-priorizacao → recalcular RICE
- `/save` → verificar TASKS.md e sugerir actualizacao se houve progresso

### Integracao com `plan`

O `plan` e por sessao — define os passos para ESTA sessao.
O `TASKS.md` e por projecto — define TODO o trabalho.

Fluxo:
1. Abrir sessao: `/resume` le TASKS.md
2. Escolher stories para esta sessao
3. `plan` cria plano de execucao para as stories escolhidas
4. Executar
5. `/save` actualiza TASKS.md com progresso

---

## Formato Lean (feature unica)

Para features pequenas que nao justificam epics:

```markdown
# TASKS — [Feature]

**PRD:** [link]

- [ ] `T1` [descricao] [ficheiro] — S
- [ ] `T2` [descricao] [ficheiro] — M
  - **Depende de:** T1
- [ ] `T3` [descricao] [ficheiro] — S
```

---

## Workflow

Pipeline desta skill na sequencia JOCA:

→ **antes**: `tech-spec` + `c4-diagram` (design tecnico como input)
→ **apos**: `plan` (plano de execucao por sessao baseado nas tasks escolhidas)

Notificar ao concluir: `→ proximo: plan (para iniciar execucao)`
