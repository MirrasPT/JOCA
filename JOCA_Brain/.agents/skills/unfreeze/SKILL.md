---
name: unfreeze
description: "Remove os guard-rails activos — apaga o lock de edição (/freeze), o flag de avisos (/careful) e o modo test-first (/tdd), desligando o modo /guard. Usar quando o user disser: unfreeze, destrancar, remover lock, desligar guard, desligar careful, desligar tdd, voltar ao normal."
triggers: unfreeze, destrancar, remover lock, desligar guard, desligar careful, desligar tdd, unlock edits, voltar ao normal, remove guard
---
# /unfreeze — Remover guard-rails

Desliga `/freeze`, `/careful`, `/tdd` e `/guard` removendo o estado em `.joca/`.

## Executar
```bash
rm -f .joca/freeze-dir.txt .joca/careful.flag .joca/tdd.flag .joca/tdd-last-test.txt 2>/dev/null; echo "Guard-rails removidos (freeze + careful + tdd desligados)."
```
Confirmar ao user: "Lock de edição, avisos destrutivos e modo test-first removidos. Edições e comandos voltam ao normal."

## Nota
Os hooks `check-freeze.js`/`check-careful.js`/`check-tdd.js` continuam registados em `settings.json` mas tornam-se no-op sem os ficheiros de estado (é o design: sempre-registados, só-activos-quando-armados).
