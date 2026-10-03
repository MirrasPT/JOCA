# /update-joca — 5d-bis. Modelo dos agentes (detalhe)

Tabela vazia → nada a perguntar, segue. Com linhas → mostrar a tabela (agente · actual · sugestão ·
porquê, agrupada por sugestão) e `AskUserQuestion`:

```
question: "Há N agentes sem escolha de modelo. Aplico as sugestões da tabela?"
header: "Modelos"
options:
  - "Sim, aplicar todas"          # → --tabela --json > <scratchpad>/escolhas.json → --aplicar
  - "Alterar alguns"              # → pedir em prosa «agente: herdar|sonnet|opus|haiku · effort»;
                                  #   editar só esses no escolhas.json; aplicar o resto como sugerido
  - "Manter como está"            # → mesmas linhas com "model": "manter" → --aplicar (não muda ficheiros,
                                  #   só regista; não volta a perguntar)
  - "Saltar por agora"            # → nada muda; volta a perguntar no próximo update
```

```
node .claude/scripts/modelos-agentes.mjs --tabela --json > <scratchpad>/escolhas.json
node .claude/scripts/modelos-agentes.mjs --aplicar <scratchpad>/escolhas.json
```

A sugestão vive no próprio agente (`modelo-sugerido`/`effort-sugerido`/`porque-modelo`, campos que o
Claude Code ignora) e nunca se activa sem este sim. Agente sem sugestão sai como «manter o actual»:
«aplicar todas» não lhe muda o `model:` nem o `effort:`. Sugestão de effort abaixo do actual sai
marcada «↓ manter X»: «aplicar todas» mantém o actual; a descida só entra se escolhida para esse agente
(«Alterar alguns»). A escolha fica em
`.claude/modelos-agentes.local.json` — o checkout do update não lhe toca (não está em `$PATHS`).
