# /upgrade-joca — Upgrade do Workflow Base do JOCA

Lê os ficheiros de feedback-joca acumulados, identifica gaps ainda por resolver no sistema JOCA, e implementa melhorias após confirmação.

Scope: **JOCA interno apenas** — skills, agentes, comandos, CLAUDE.md, memory tools.
Não toca em ficheiros de projectos externos (Branding.md, RS.md, etc.).

## Quando correr

- Após acumulação de sessões de `/feedback-joca`
- Quando o utilizador pede "upgradar o JOCA", "aplicar o feedback", "melhorar o toolkit"
- Periodicamente como manutenção

---

## Fase 1 — Audit

### 1. Ler todos os ficheiros de feedback-joca

Ler todos os ficheiros em `JOCA/memory/feedback/`.
Filtrar: focar apenas nos issues cujo **Ficheiro a actualizar** aponta para dentro do JOCA (`.claude/`, `memory/`).
Ignorar issues sobre ficheiros externos ao JOCA (Branding.md, RS.md, etc.) — esses pertencem ao `/feedback-projeto`.

Ordenar por data (mais antigo primeiro).

### 2. Classificar cada issue

Para cada fix sugerido, verificar o estado actual do ficheiro alvo:

| Estado | Critério |
|--------|----------|
| **FEITO** | Fix já aplicado — ficheiro alvo tem o conteúdo esperado |
| **PARCIAL** | Fix parcialmente aplicado |
| **PENDENTE** | Fix ainda por fazer |

Só os **PENDENTE** e **PARCIAL** avançam para a lista de upgrades.

### 3. Apresentar lista de upgrades

```
UPGRADES PENDENTES — JOCA
─────────────────────────

[1] SKILLS / AGENTES
    <nome-do-ficheiro>: <descrição concisa da alteração>
    Fonte: session-<nome>-<data> > Issue N

[2] COMANDOS
    <nome-do-ficheiro>: <descrição>
    Fonte: ...

[3] MEMORY / TOOLS
    <nome-do-ficheiro>: <descrição>
    Fonte: ...

[4] CLAUDE.md
    <descrição>
    Fonte: ...

─────────────────────────
N upgrades pendentes

Implementar todos? [S/n]
Ou indicar números a excluir:
```

Aguardar confirmação explícita antes de qualquer alteração.

---

## Fase 2 — Implementação

### Apenas após confirmação

Para cada item confirmado, por ordem de prioridade:
1. Regras e restrições globais (evitam erros recorrentes)
2. Briefs de agentes (afectam todas as sessões futuras)
3. Comandos e skills
4. Memory tools e INDEX.md

Para cada item:
1. Editar ou criar o ficheiro alvo dentro do JOCA
2. Se novo skill ou agente: adicionar entrada em `memory/INDEX.md`
3. No ficheiro de feedback de origem, anotar o gap como resolvido:
   ```
   **Resolvido em:** <data> — <ficheiro alterado>
   ```
   Não apagar o gap — é histórico.
4. Confirmar imediatamente: `✓ [N] <descrição> — <ficheiro alterado>`

Upgrades ao mesmo ficheiro são agrupados numa única edição.

Se dois feedbacks tiverem instruções contraditórias para o mesmo ficheiro: apresentar ambas e perguntar qual prevalece antes de implementar.

---

## Fase 3 — Resumo final

```
UPGRADE JOCA COMPLETO
─────────────────────
✓ N upgrades implementados
~ M ignorados

Ficheiros alterados:
- .claude/skills/...
- .claude/commands/...
- memory/...

Próximo: graphify . --update no directório JOCA
```

---

## Regras

- Nunca implementar sem confirmação
- Nunca apagar ficheiros de feedback — apenas anotar como resolvido
- Nunca tocar em ficheiros externos ao JOCA neste comando
- Se o path de um ficheiro alvo não existir: criar com estrutura mínima correcta
- Se um fix for ambíguo, perguntar antes de implementar
