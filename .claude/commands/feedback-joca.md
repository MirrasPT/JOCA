# /feedback-joca — Feedback de workflow JOCA

Captura o que falhou no sistema JOCA durante a sessão. Não o estado do projecto — isso é `/save`.

Invoca a skill `feedback-joca`.

## Quando correr

- Fim de sessão onde algo falhou, precisou de retrabalho, ou foi descoberta documentação errada
- Quando o utilizador pede "o que podemos melhorar no JOCA"
- Após iterações desnecessárias causadas por gaps no sistema

## O que NÃO capturar

- Estado do projecto, decisões de design, assets criados → `/save`
- Bugs no código do projecto
- Preferências do cliente

## Output

- `JOCA/memory/feedback/session-<projecto>-<data>.md`
- Entrada em `JOCA/memory/INDEX.md`
