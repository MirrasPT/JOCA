# /one-shot — Desenvolvimento Autónomo End-to-End

Ponto de entrada único para produção autónoma. Lê documentação de planeamento, o **main loop adopta o playbook `master-orchestrator`** e executa até conclusão sem interrupções.

## Pré-requisitos

O projecto DEVE ter pelo menos um destes ficheiros:
- `PRD.md` — requisitos de produto
- `TECH_SPEC.md` — especificação técnica
- `TASKS.md` — decomposição de tarefas

Se nenhum existir: sugerir `/init-project` ou `/plan` primeiro. Não prosseguir sem documentação.

## Fluxo

### 1. Carregar Contexto (Lazy)

```
Ler: CLAUDE.md (constraints do projecto)
Ler: memory/SKILL_INDEX.json (índice de skills disponíveis)
Ler: PRD.md → scope e requisitos
Ler: TECH_SPEC.md → stack decisions (se existir)
Ler: TASKS.md → tarefas decompostas (se existir)
```

### 2. Validar Prontidão

Verificar:
- [ ] Stack definida (Laravel? React? Flutter?)
- [ ] Pelo menos 1 feature descrita com acceptance criteria
- [ ] Nenhuma decisão bloqueante em aberto (Open Questions no PRD sem owner)

Se faltar algo crítico → reportar e parar. Não inventar requisitos.

### 3. Orquestrar (o main loop adopta o playbook)

O **main loop lê `.claude/agents/master-orchestrator.md` e age como orquestrador ELE PRÓPRIO** — **não** se faz `Agent(subagent_type="master-orchestrator")` (um subagente não despacha workers; regra de 1-nível em `rules/orchestration-patterns.md`). Seguindo o playbook, o main loop decompõe o PRD/TASKS em work-streams e dispara os *workers* via `Agent()`, cada um com o brief canónico obrigatório (8 cláusulas), sob:

- **Objectivo:** implementar as features do PRD/TASKS de forma autónoma.
- **Documentação:** PRD (resumo 3 linhas), stack detectada, constraints do `CLAUDE.md`, ficheiros `PRD.md`/`TECH_SPEC.md`/`TASKS.md`.
- **Regras:** zero confirmações (excepto acção irreversível → gate); auto-trigger dos testers após cada stream; relatório final estruturado.

### 4. Pós-Execução

Após o orchestrator completar:
1. Apresentar relatório ao utilizador
2. Listar ficheiros criados/modificados
3. Sugerir próximos passos (deploy? PR? review manual?)

## Argumentos Opcionais

- `/one-shot --scope "feature X"` — limita a uma feature específica do PRD
- `/one-shot --dry-run` — planeia mas não executa (mostra work streams sem dispatch)
- `/one-shot --no-tests` — skip validation agents (faster, less safe)

## Exemplo de Uso

```
/one-shot
```

Resultado: Lê PRD, decompõe em streams (DB → API → Frontend), dispatcha agentes em paralelo, corre testes, reporta.

## Quando NÃO Usar

- Projecto sem documentação (usar `/plan` ou `/init-project` primeiro)
- Bug fix simples (usar `/debug`)
- Tarefa de 1 ficheiro (fazer directamente)
- Refactor sem spec (usar `/plan` para definir scope primeiro)
