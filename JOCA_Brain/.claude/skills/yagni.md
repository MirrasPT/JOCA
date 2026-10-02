---
name: yagni
description: "Decision ladder de 6 degraus para minimizar codigo e dependencias antes de escrever qualquer coisa. Formaliza os principios de simplicidade do soul.md/CLAUDE.md numa skill activavel. MUST be invoked when the user says: yagni, mais simples, minimo codigo, evitar dependencia, precisas mesmo disto, over-engineering, nao complicar, menos abstraccao. SHOULD also invoke when: adicionar dependencia nova, criar abstraccao, util/helper generico, scaffolding antecipado, feature especulativa."
triggers: disciplina de codigo, alteracao cirurgica, coding discipline, avoid overengineering, LLM coding mistakes, yagni, you arent gonna need it, mais simples, simplificar, minimo codigo, menos codigo, evitar dependencia, nova dependencia, npm install, composer require, precisas mesmo, over-engineering, sobre-engenharia, nao complicar, menos abstraccao, abstraccao prematura, helper generico, criar abstraccao, feature especulativa, scaffolding antecipado
---
# YAGNI — código mínimo

Norma completa (escada de 7 degraus, guard-rails, anti-padrões, checklist):
`Read(".claude/reference/codigo-minimo.md")` — ler antes de escrever código.
Esta skill serve só os gatilhos explícitos; o texto vive na referência.

Resumo de 1 linha: **já existe no código > stdlib > nativo da framework > dep já instalada > one-liner > código novo mínimo**, depois de perceber o fluxo real.
Guard-rails nunca se cortam: segurança, validação de input, perda de dados, acessibilidade, pedido explícito.

## Interação com outras skills
- Reforça o `CLAUDE.md` §Code (Simplicity + Surgical) e o `caveman` (tom).
- Invocar antes de `laravel-specialist`/`frontend` quando o instinto é acrescentar dependência ou abstração.
- `react-composition` resolve o degrau 7 do lado da API de componentes (composição > config).
