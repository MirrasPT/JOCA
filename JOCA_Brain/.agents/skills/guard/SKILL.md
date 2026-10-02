---
name: guard
description: "Modo de segurança máxima: liga /careful (avisos de comandos destrutivos) E /freeze (tranca edições a um directório) de uma vez. Usar quando o user disser: guard, modo seguro, segurança máxima, lock it down, proteger tudo, full safety, trancar tudo. Guard-rail composto adaptado do gstack."
triggers: guard, modo seguro, seguranca maxima, segurança máxima, lock it down, proteger tudo, full safety, trancar tudo, maximum safety, guard mode
chain: unfreeze
---
# /guard — Segurança máxima (careful + freeze)

Combina `/careful` (avisos antes de destrutivos no Bash) com `/freeze` (bloqueia edições fora de um directório), numa só activação. Para mexer em prod ou debug de sistemas vivos.

## Mecanismo
Arma os dois estados de uma vez; os hooks `check-careful.js` e `check-freeze.js` (ambos PreToolUse, já registados em `settings.json`) passam a actuar.

## Setup (executar)
1. Perguntar o directório a trancar (input de texto), salvo se já indicado.
2. Armar ambos:
```bash
mkdir -p .joca && echo '{"on":true}' > .joca/careful.flag
node -e "const p=require('path'),fs=require('fs');fs.writeFileSync('.joca/freeze-dir.txt',p.resolve(process.argv[1]));console.log('Guard:',p.resolve(process.argv[1]))" "<DIR>"
```
3. Confirmar ao user:
   - "**Guard mode activo.** 1) Comandos destrutivos (rm -rf, DROP, force-push…) pedem confirmação. 2) Edições trancadas a `<DIR>/` — fora é bloqueado."
   - "`/unfreeze` remove tudo; fim de sessão também."

## Próximo passo (chain)
- Desligar tudo → `/unfreeze`.
