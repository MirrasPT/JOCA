---
description: Ciclo de marketing de uma marca — retoma o estado e conduz análise, proposta, artes e implementação, com revisão independente e gates de aprovação
argument-hint: "<marca> [analise|proposta|artes|implementacao]"
---
# /marketeer — ciclo de marketing de uma marca

Invoca a skill **marketeer**: `Read` do primeiro que existir: `.claude/skills/marketeer.md` (JOCA) ou
`~/.claude/skills/marketeer/SKILL.md` (instalação autónoma), e segue-a com `$ARGUMENTS`.

- `$ARGUMENTS` = `<marca>` e, opcionalmente, a fase: `analise`, `proposta`, `artes` ou `implementacao`.
- Sem marca → a skill pergunta. A fase em falta decide-a o `estado.json` da marca (retoma).
- Os resultados reveem-se depois com `/marketeer-review <marca>`.
