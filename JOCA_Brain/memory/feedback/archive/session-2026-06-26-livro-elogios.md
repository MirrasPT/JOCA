---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-26
project: livro-de-elogios
processed: true
processed_date: 2026-06-27
---

**Categoria:** `discovery-gap` | **Severidade:** high | **Descrição:** `/resume` reportou "trabalho do Mac nunca committado" sem verificar `git branch -a` ou `git log --oneline --all`. O backoffice (14 páginas + componentes + api + mocks + types) ESTAVA committado em `backup/local-pre-dev`. O JOCA declarou trabalho "perdido" quando só estava numa branch diferente. | **Componente afectado:** `.claude/commands/resume.md` (passo 2 + 2a) | **Fix sugerido:** No `/resume`, após `git log --oneline -5`, correr `git branch -a | head -20` + `git log --oneline --all | head -10` — branches de backup (`backup/*`, `stash/*`, etc.) são frequentes quando há switch de remote. Se detectar branch `backup/*`, alertar "⚠ Existe branch de backup — verificar antes de reconstruir trabalho".

**Categoria:** `skill-improvement` | **Severidade:** medium | **Descrição:** Quando uma sessão diz que código foi "perdido/nunca committado", o JOCA devia como Step 0 correr `git log --oneline --all` para ver TODO o histórico de TODAS as branches antes de propor reconstrução. Na sessão, o utilizador teve de corrigir ("nao eu ja construi e tem de estar aqui") antes de verificarmos outras branches. | **Componente afectado:** `rules/task-intake.md` + `soul.md` | **Fix sugerido:** Adicionar ao princípio "Surface assumptions" (soul.md): quando a tarefa declara código ausente/perdido em contexto git, verificar `git log --all --oneline` ANTES de assumir reconstrução. Custo de verificação: 1 comando; custo de reconstrução evitada: sessões de trabalho.

**Categoria:** `workflow-gap` | **Severidade:** low | **Descrição:** PHP não estava no PATH do Windows (`C:\Users\renat\php84`) — necessário para qualquer operação artisan/composer. O JOCA não detectou nem alertou proactivamente. Acabou por usar Python/sqlite3 directamente para aceder à BD. | **Componente afectado:** `/resume` para projectos Laravel em Windows | **Fix sugerido:** No `/resume` de projectos com `composer.json`, verificar `php -v 2>&1` — se falhar, alertar com o path correcto do ambiente local (`C:\Users\renat\php84\php.exe` para este utilizador) e sugerir add ao PATH ou usar `& C:\Users\renat\php84\php.exe artisan ...`.
