# /debug — Triage de Erros

Recolher contexto:
- Erro exacto (mensagem, stack trace)
- Stack do projecto (detectar por ficheiros ou perguntar)
- Últimas alterações antes do erro

Formular hipóteses ordenadas por probabilidade (máx 3).

Activar skill relevante ao stack:
- Laravel / PHP / PostgreSQL → `php-stack`
- WordPress → skill WP relevante
- Frontend/UI/JS → `ui`
- Web app / Playwright → `web-tester`
- DevOps/infra/CI → `platform`
- API / testes → `quality`
- Flutter → agente `flutter-expert`

Propor passos de diagnóstico concretos e verificáveis antes de qualquer fix.
