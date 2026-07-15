# /debug — Triage de Erros

Recolher contexto:
- Erro exacto (mensagem, stack trace)
- Stack do projecto (detectar por ficheiros ou perguntar)
- Últimas alterações antes do erro

Formular hipóteses ordenadas por probabilidade (máx 3).

Routing (pipeline Debug canónico — `rules/pipelines.md`):
1. **Triagem** — classificar o erro (stack, tipo, superfície).
2. **Skill do stack** — `Read()` a skill via Trigger Map do `CLAUDE.md` (ex.: Laravel/PHP → `laravel-specialist` · frontend/React → `frontend` · WordPress → `wordpress-router` · SQL → `mysql` · deploy/infra → `deploy-*`).
3. **Logs / stack trace presentes** → despachar agente `log-debugger` (Iron Law: causa-raiz primeiro).
4. **Causa é SQL** (query lenta, N+1, EXPLAIN) → chain para `query-debugger`. Notificar `[chain → query-debugger]`.

Propor passos de diagnóstico concretos e verificáveis antes de qualquer fix.
