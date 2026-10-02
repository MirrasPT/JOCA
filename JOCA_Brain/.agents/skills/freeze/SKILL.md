---
name: freeze
description: "Tranca as edições (Edit/Write) a UM directório durante a sessão — qualquer edição fora dele é BLOQUEADA pelo hook check-freeze. Usar quando o user disser: freeze, trancar edições, lock scope, só editar esta pasta, restringir alterações, não mexer fora de X, scope-lock. Guard-rail de segurança adaptado do gstack."
triggers: freeze, trancar edicoes, trancar edições, lock scope, scope lock, so editar esta pasta, só editar esta pasta, restringir alteracoes, restringir alterações, nao mexer fora, não mexer fora, lock edits, freeze edits
chain: unfreeze
---
# /freeze — Trancar edições a um directório

Limita Edit/Write a um directório durante a sessão. Edições fora são **bloqueadas** (não só avisadas) pelo hook `check-freeze.js` (PreToolUse). Útil em debug (evita "arranjar" código não-relacionado) ou para scope cirúrgico.

## Mecanismo
- O hook `check-freeze.js` corre em cada Edit/Write e lê `.joca/freeze-dir.txt` no cwd.
- Se o ficheiro existir, edições fora do path → `permissionDecision: "deny"`.
- Sem ficheiro → no-op. Fail-open (bug no hook nunca tranca o user fora).

## Setup (executar)
1. Perguntar ao user qual o directório a trancar (input de texto, não escolha múltipla), salvo se já indicado no pedido.
2. Resolver para absoluto e gravar o estado:
```bash
mkdir -p .joca
# <DIR> = caminho dado pelo user, resolvido a absoluto
node -e "const p=require('path'),fs=require('fs');const d=p.resolve(process.argv[1]);fs.writeFileSync('.joca/freeze-dir.txt',d);console.log('Freeze:',d)" "<DIR>"
```
3. Confirmar ao user: "Edições trancadas a `<DIR>/`. Qualquer Edit/Write fora é bloqueado. `/freeze` outra vez muda o scope; `/unfreeze` remove."

## Notas
- Trailing sep evita `/src` casar com `/src-old`.
- Aplica-se a Edit/Write — Read/Bash/Glob/Grep não são afectados (NÃO é fronteira de segurança: `sed` via Bash ainda escreve fora; combinar com `/careful` ou usar `/guard`).
- Desactivar: `/unfreeze` ou fim de sessão.

## Próximo passo (chain)
- Para desligar → `/unfreeze`. Para também avisar de comandos destrutivos no Bash → `/careful` (ou usar `/guard` desde o início, que é freeze+careful).
