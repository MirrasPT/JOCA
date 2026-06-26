# /retro — Retrospectiva (aprendizagens da janela → acções)

Adaptado do `retro` do gstack. Lê as aprendizagens/decisões recentes do projecto (Brain log), resume ganhos/problemas/padrões e **propõe acções concretas**. Pode correr manualmente OU como **automação cron** (semanal) via o motor de automações do JOCA_OS.

---

## Quando usar
- "retro", "retrospectiva", "o que correu bem/mal", revisão semanal, fim de marco.
- Como automação: "todas as segundas às 9h faz retro do projecto X" → `automation-builder`.

## Passos

1. **Carregar a janela** — aprendizagens + decisões do projecto:
```bash
node .claude/scripts/joca-brain.mjs recall --limit 20
node .claude/scripts/joca-brain.mjs active
```
   Opcional: `git log --since="7 days ago" --oneline` para o trabalho real da janela.

2. **Sintetizar** (3 blocos, terso):
   - **Ganhos** — o que correu bem, padrões a repetir.
   - **Problemas** — bugs recorrentes, fricção, retrabalho.
   - **Padrões** — o que se repete (≥2x) e devia virar regra/skill/automação.

3. **Propor acções** — cada problema/padrão → 1 acção concreta:
   - Lição reutilizável → `node .claude/scripts/joca-brain.mjs learn --text "..." --tags retro`.
   - Padrão que merece skill/regra → sugerir `/create-skill` ou nota em `rules/`.
   - Bug recorrente → sugerir fix ou guard-rail (`/guard`).
   - Melhoria do próprio JOCA → alimentar `/upgrade-joca` (escreve em `memory/feedback/`).

4. **Registar o retro** — opcional: checkpoint `--status done`:
```bash
printf '## Retro <data>\n<síntese>' | node .claude/scripts/joca-checkpoint.mjs save --title retro --status done
```

## Regras
- Terso. Não inventar ganhos/problemas — derivar do log real (Brain + git). Janela vazia → dizê-lo, não fabricar.
- Acções accionáveis, não genéricas ("adicionar índice X em Y", não "melhorar performance").

## Próximo passo (chain)
- Acções de melhoria do JOCA → `/upgrade-joca`. Padrão novo → `/create-skill`. Automatizar o retro → `automation-builder`.
