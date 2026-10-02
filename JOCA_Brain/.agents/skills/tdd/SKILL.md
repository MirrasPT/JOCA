---
name: tdd
description: "Activa o modo test-first (TDD guard) na sessão — editar código de produção sem teste novo/alterado primeiro dispara confirmação (ask, nunca deny) via hook check-tdd. Usar quando o user disser: tdd, test first, testes primeiro, modo tdd, tdd guard, red green, força testes."
triggers: tdd, test first, test-first, testes primeiro, modo tdd, tdd guard, red green, red-green, força testes, forca testes, escreve testes primeiro
chain: unfreeze
---
# /tdd — Guard-rail test-first

Impõe a disciplina red→green: com o modo armado, qualquer Edit/Write de **código de produção** sem um teste tocado na janela recente (30 min) dispara **confirmação** — o hook `check-tdd.js` (PreToolUse) pergunta em vez de bloquear. Escrever/alterar testes é sempre livre e rearma a janela.

Complementa (não substitui) o auto-test existente: o PostToolUse continua a recomendar testers DEPOIS do código; este guard actua ANTES.

## Mecanismo
- Hook `check-tdd.js` corre em cada Edit/Write e lê `.joca/tdd.flag` no cwd.
- Sem flag → no-op. Fail-open (bug no hook nunca bloqueia trabalho).
- Ficheiro de teste (`tests/`, `.test.`, `.spec.`, `_test.`, `*Test.php`, `*Tests.cs`) → permite e regista timestamp em `.joca/tdd-last-test.txt`.
- Código de produção (php/ts/tsx/js/py/cs/vue/go/rb, fora de config) sem teste na janela → `permissionDecision: "ask"` com a razão.

## Setup (executar)
```bash
mkdir -p .joca && touch .joca/tdd.flag && echo "TDD guard armado."
```
Confirmar ao user: "Modo test-first activo. Código de produção sem teste recente pede confirmação. `/unfreeze` desliga."

## Notas
- **Ask, não deny** — heurística código→teste tem falsos positivos legítimos (glue code, hotfix); a decisão final é do user.
- Aplica-se a Edit/Write; `sed` via Bash não é interceptado (mesma limitação do /freeze — combinar com /careful se necessário).
- Combinável com /freeze e /careful (hooks independentes, todos flag-file).

## Próximo passo (chain)
- Para desligar → `/unfreeze` (remove também freeze/careful).
