# /one-shot — Desenvolvimento Autónomo End-to-End

Ponto de entrada único para produção autónoma. Lê documentação de planeamento, invoca o `master-orchestrator-agent`, e executa até conclusão sem interrupções.

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

### 3. Invocar Master Orchestrator

```
Agent(subagent_type="master-orchestrator", prompt="""
Objectivo: Implementar [features do PRD/TASKS] de forma autónoma.

Documentação:
- PRD: [resumo 3 linhas]
- Stack: [stack detectada]
- Constraints: [do CLAUDE.md]

Ficheiros de planeamento no projecto:
- PRD.md
- TECH_SPEC.md (se existe)
- TASKS.md (se existe)

Regras:
- Zero confirmações — executar até conclusão
- Auto-trigger testes após cada stream
- Reportar resultado final estruturado
""")
```

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
