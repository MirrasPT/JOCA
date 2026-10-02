---
name: careful
description: "Liga avisos antes de comandos Bash destrutivos (rm -rf, DROP/TRUNCATE, git push --force, git reset --hard, taskkill /F, format, dd) — o hook check-careful pede confirmação antes de executar (não bloqueia, podes confirmar). Usar quando o user disser: careful, modo cauteloso, avisa antes de apagar, cuidado com destrutivo, proteger contra enganos. Guard-rail adaptado do gstack."
triggers: careful, modo cauteloso, avisa antes de apagar, cuidado destrutivo, proteger enganos, warn destructive, modo cuidado, safety warnings
chain: unfreeze
---
# /careful — Avisar antes de comandos destrutivos

Activa avisos (`permissionDecision: "ask"`) antes de comandos Bash perigosos. Não bloqueia — pede confirmação e podes prosseguir. Para debug em prod / sistemas vivos.

## Mecanismo
- O hook `check-careful.js` (PreToolUse Bash) corre em cada comando e lê `.joca/careful.flag` no cwd.
- Se o flag existir e o comando casar um padrão destrutivo → `ask` (confirmação). Senão → allow.
- Sem flag → no-op. Fail-open.

## Padrões cobertos
`rm -rf`, `Remove-Item -Recurse -Force`, `rmdir /s`, `del /s`, `git push --force`, `git reset --hard`, `git clean -f`, `git checkout -- .`, `DROP/TRUNCATE TABLE`, `DELETE FROM` sem `WHERE`, `taskkill /F`, `format`/`mkfs`, `dd of=/dev/`, fork bomb.

## Setup (executar)
```bash
mkdir -p .joca && echo '{"on":true}' > .joca/careful.flag
```
Confirmar: "Modo careful activo — comandos destrutivos pedem confirmação antes de correr. `/unfreeze` desliga."

## Próximo passo (chain)
- Para também trancar edições a uma pasta → `/freeze` (ou `/guard` = careful+freeze de uma vez). Desligar → `/unfreeze`.
