---
name: nome-em-kebab-case
description: "Uma frase a dizer o que a skill faz. MUST be invoked when the user says: gatilho 1, gatilho 2, gatilho 3. SHOULD also invoke when: situação 1, situação 2."
triggers: gatilho 1, gatilho 2, gatilho 3, situação 1, situação 2
chain: skill-seguinte, agente-seguinte
metadata:
  category: categoria
  origin: user
---

# Nome da Skill

Uma ou duas frases: que problema resolve e quando vale a pena carregá-la.

## Quando usar

- Situação concreta 1
- Situação concreta 2

Não usar para: <o caso vizinho que pertence a outra skill> → usar `<essa-skill>`.

## Procedimento

1. Passo com o comando/ficheiro exacto.
2. Passo seguinte.
3. Verificação — como se sabe que ficou certo.

## Gotchas

| Sintoma | Causa | Fix |
|---|---|---|
| … | … | … |

## Próximo passo (chain)

- `skill-seguinte` — quando <condição>. Reversível → disparar sem perguntar.
- `agente-seguinte` — quando <condição>. **Irreversível** → 1 linha de confirmação antes.

---

## Notas de formato (apagar ao criar a skill real)

- **Ficheiro flat:** `.claude/skills/<name>.md`. Nunca nested, nunca `SKILL.md` — o glob do
  indexador não é recursivo e uma skill nested nunca é indexada nem activa.
- **`description` é o que activa a skill.** O par RFC 2119 (`MUST be invoked when…` /
  `SHOULD also invoke when…`) é lido pelo `build-skill-index.py` para extrair triggers. Sem ele,
  a skill fica invisível ao match de ≥60%.
- **`triggers:`** é redundante com a description mas útil quando os gatilhos não cabem na frase.
- **`origin: user`** marca skills criadas localmente para o `/update-joca` nunca as sobrescrever.
  Não usar `origin: local` — essa marca também aparece em skills publicadas upstream.
- Depois de criar: `python .claude/scripts/validate-skill.py .claude/skills/<name>.md` e
  `python .claude/scripts/build-skill-index.py` (Windows: `python`; macOS/Linux: `python3`).
