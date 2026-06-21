---
origin: local
---

# /build-plan — Construção Supervisionada por Fases

Ponte entre `/plan` (planeamento) e `/one-shot` (execução autónoma). Persiste o plano como artefacto em `docs/`, decompõe em tarefas por fase, e executa um loop de implementação com gate de testes + checkpoint humano entre fases.

**Quando usar:**
- Projecto com risco suficiente para não confiar numa execução autónoma completa
- Queres revisão humana entre fases antes de prosseguir
- Output de `/plan` ou PRD existe e é preciso transformar em implementação controlada

**Diferença de /one-shot:** `/one-shot` executa até ao fim sem interrupções. `/build-plan` para em cada gate de fase — humano valida antes de avançar.
**Diferença de /plan:** `/plan` produz o documento e para. `/build-plan` consome esse documento e executa.

---

## PRÉ-REQUISITOS

O projecto DEVE ter pelo menos um destes:
- Output de `/plan` (conversa activa com plano aprovado)
- `PRD.md` ou `TECH_SPEC.md` com fases ou features definidas
- `docs/plan.md` de uma sessão anterior

Se nenhum existir: correr `/plan` primeiro. Não inventar scope.

---

## FASE 0 — Carregar e Validar Contexto

```
Ler: CLAUDE.md (constraints do projecto)
Ler: memory/SKILL_INDEX.json (skills disponíveis)
Ler: PRD.md / TECH_SPEC.md / output de /plan (whichever exists)
```

Verificar:
- [ ] Stack definida
- [ ] Fases ou features com acceptance criteria clara
- [ ] Nenhuma decisão bloqueante em aberto sem owner

Se faltar algo crítico → reportar exactamente o que falta e parar. Não prosseguir.

---

## FASE 1 — Persistir Plano

Escrever `docs/plan.md` com:

```markdown
# Plano — <nome-projecto>
_Gerado: <YYYY-MM-DD>_

## Scope
<objectivo em 2-3 linhas>

## Stack
<stack detectada>

## Fases
| # | Nome | Descrição | Dependências | Parallelizável |
|---|------|-----------|--------------|----------------|
| 1 | ... | ... | — | não |
| 2 | ... | ... | Fase 1 | sim |

## Decisões de Arquitectura
<decisões chave com rationale 1 linha cada>

## Fora de Scope
<o que foi explicitamente excluído>

## Open Questions
<questões sem resposta — BLOQUEIA implementação se crítico>
```

Se `docs/plan.md` já existir com conteúdo relevante → ler, confirmar com utilizador se deve sobrescrever ou fazer merge.

**Confirmar com utilizador:** "Plano persistido em docs/plan.md. Prosseguir para decomposição de tarefas?"

---

## FASE 2 — Decompor em Tarefas

Escrever `docs/tasks.md` com tarefas agrupadas por fase:

```markdown
# Tasks — <nome-projecto>
_Gerado: <YYYY-MM-DD> | Status: em-progresso_

## Fase 1 — <nome>
Status: pendente

- [ ] [1.1] <tarefa> — `caminho/ficheiro.ext` — depende: — [P]
- [ ] [1.2] <tarefa> — `caminho/ficheiro.ext` — depende: 1.1
- [ ] [1.3] <tarefa> — `caminho/ficheiro.ext` — depende: 1.1 — [P]

**Gate:** <critério de teste concreto para concluir esta fase>

## Fase 2 — <nome>
Status: bloqueado (aguarda Fase 1)
...
```

Convenções:
- `[P]` — tarefa paralelizável (sem dependências de escrita partilhada)
- Cada tarefa com ficheiro(s) exacto(s) afectado(s)
- Dependências explícitas entre tarefas (não fases inteiras se evitável)
- Gate de fase = critério executável (ex: "testes X passam", "endpoint Y responde 200")

**Confirmar com utilizador:** "Tasks decompostas em docs/tasks.md — N fases, N tarefas. Iniciar Fase 1?"

---

## FASE 3..N — Loop de Implementação por Fase

Para cada fase (sequencial por dependências, paralelo quando `[P]` permite):

### 3a. Briefing de Fase

Antes de executar, mostrar:
```
━━━ FASE <N> — <nome> ━━━
Tarefas: N items
Gate: <critério>
Ficheiros: <lista>
Depende de: <fases anteriores>
Avançar? [Enter para continuar / 's' para saltar / 'q' para parar]
```

### 3b. Implementação

Activar skill relevante antes de escrever código:
- Verificar trigger map em CLAUDE.md
- Ler skill (`[skill: <nome>]`) se match ≥ 60%
- Executar tarefas da fase — tocar só o necessário

Actualizar status em `docs/tasks.md` à medida que completa:
- `[ ]` → `[x]` por tarefa concluída
- Status da fase: `pendente` → `em-progresso` → `aguarda-gate`

### 3c. Gate de Testes

Após implementação da fase, executar gate:

```bash
# Correr testes relevantes para a fase
# (comandos específicos da stack — não inventar; ler CLAUDE.md do projecto)
```

Se testes passam → marcar fase como `concluída` em `docs/tasks.md`.

Se testes falham:
1. Reportar exactamente quais falharam e porquê
2. Tentar fix cirúrgico (1 tentativa)
3. Se ainda falha → parar e apresentar ao utilizador. Não avançar para próxima fase.

### 3d. Checkpoint Humano

```
━━━ CHECKPOINT — FASE <N> CONCLUÍDA ━━━
Gate: ✓ passou / ✗ falhou
Ficheiros modificados: <lista>
Testes: N passed, N failed

Resumo do que foi feito:
  • <item 1>
  • <item 2>

Avançar para Fase <N+1>? [Enter / 'q' para parar]
```

Se utilizador parar → guardar estado em `docs/tasks.md` (status `pausado`). Corrida seguinte retoma daqui.

---

## RETOMAR SESSÃO INTERROMPIDA

Se `docs/tasks.md` existir com status `pausado` ou `em-progresso`:

```
Sessão anterior detectada:
  Fases completas: N/N
  Última fase: <nome> — <status>
  Retomar? [Enter] / Recomeçar do zero? ['r']
```

Retomar = continuar a partir da primeira fase com status != `concluída`.

---

## ARGUMENTOS OPCIONAIS

- `/build-plan --phase 2` — iniciar directamente na Fase 2 (fases anteriores marcadas como completas)
- `/build-plan --auto` — substituir checkpoints humanos por auto-proceed se gate passar (equivale a `/one-shot` por fases)
- `/build-plan --dry-run` — gerar `docs/plan.md` + `docs/tasks.md` sem executar nenhuma implementação
- `/build-plan --no-tests` — saltar gate de testes (mais rápido, menos seguro)

---

## RELATÓRIO FINAL

```
BUILD-PLAN — <nome-projecto>
══════════════════════════════

Fases: N/N concluídas

  ✓ Fase 1 — <nome> (N tarefas | gate passou)
  ✓ Fase 2 — <nome> (N tarefas | gate passou)
  ✗ Fase 3 — <nome> (pausado — gate falhou)

Artefactos:
  docs/plan.md       ✓ persistido
  docs/tasks.md      ✓ actualizado (N/N tarefas concluídas)

Ficheiros modificados: N
Testes: N passed, N failed

Próximos passos:
  → Resolver gate da Fase 3, retomar com /build-plan
  → /review-code quando todas as fases concluídas
  → /one-shot --scope "fase N" para fases simples sem necessidade de supervisão
```

---

## NOTAS

- Nunca avançar de fase com gate falhado (excepto `--no-tests`).
- `docs/plan.md` e `docs/tasks.md` são o estado de resumo — não re-derivar se existirem.
- Skills activadas por fase via trigger map — não globalmente no início.
- Se stack não tem testes definidos, pedir ao utilizador critério de gate antes de iniciar Fase 1.
- Edicões cirúrgicas — não reescrever ficheiros adjacentes não listados nas tarefas da fase.