# /debug — Triage de Erros

Recolher contexto:
- Erro exacto (mensagem, stack trace)
- Stack do projecto (detectar por ficheiros ou perguntar)
- Últimas alterações antes do erro

Formular hipóteses ordenadas por probabilidade (máx 3).

Activar skill relevante ao stack:
- Laravel → `laravel-specialist`
- PHP → `laravel-specialist`
- WordPress → skill WP relevante
- Frontend/JS → `webapp-testing` ou `frontend`
- PostgreSQL/MySQL → `mysql`
- Deploy/infra → `deploy-ploi` / `deploy-docker`
- Flutter → `flutter-expert`

Propor passos de diagnóstico concretos e verificáveis antes de qualquer fix.
