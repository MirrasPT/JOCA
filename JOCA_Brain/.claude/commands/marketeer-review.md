---
description: Review de um ciclo de marketing — verifica o implementado, compara resultados com objetivos e baseline, decide cortar/manter/escalar e abre o ciclo seguinte
argument-hint: "<marca>"
---
# /marketeer-review — review do ciclo de marketing

Invoca a skill **marketeer-review**: `Read(".claude/skills/marketeer-review.md")` (instalado sem o
JOCA: `~/.claude/skills/marketeer-review.md`) e segue-a com `$ARGUMENTS`.

- `$ARGUMENTS` = `<marca>`. Sem marca → a skill pergunta.
- Lê e propõe; as propostas entram no ciclo novo pelo gate da proposta do `/marketeer`. **Única escrita nas
  contas:** pausar de urgência (evento de conversão partido, ou corte com gasto relevante), com ensaio, € por dia à
  vista e confirmação Sim/Não. Grava `05-review.md`/`.html` e o estado; só abre o ciclo seguinte quando não há
  revisões futuras deste ciclo (senão fica review parcial e volta-se na menor data futura).
