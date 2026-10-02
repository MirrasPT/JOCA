# Skill Creation Log — email-dashboard

**Created:** 2026-09-03
**Request:** "For every time I use this skill it will check my email, and give-me a resume in a dashboard in html."
**Mode:** new
**Final score:** 9.5/10
**Iterations run:** 1 (parou: PASS threshold atingido à 1ª)
**Best at iteration:** 1

## Version scores
- v1 (rascunho do main loop) — não avaliada
- v2 (`skill-improver`, iteração 1) — **9.5** · PASS
- final = v2 + as 3 correcções do avaliador aplicadas à mão

## Decisões de fundo
- **Flat** em `.claude/skills/email-dashboard.md` — o `create-skill.md` descreve `created-skills/<x>/SKILL.md`,
  que neste repo **nunca é indexado** (o glob do `build-skill-index.py` não é recursivo).
- **Não duplica o `personal-comms`**: essa fica com enviar/responder/calendário; esta é ler + dashboard,
  e encadeia para lá quando é preciso agir.
- **Sem lista de clientes dentro da skill** (correcção 3 do avaliador): o cruzamento email↔projecto lê
  `memory/INDEX.md` §Projects. Assim o ficheiro é idêntico na produção e no Open Source, sem arrastar
  doutrina privada para o repo público.
- Tools Gmail citadas contra os **schemas reais** (`search_threads` pageSize máx 50, `THREAD_VIEW_MINIMAL`,
  `get_thread` em `PLAIN_TEXT`, `label:` por ID, `{}` = zero resultados).

## Correcções aplicadas depois do PASS
1. Passo 3 — caminho de erro duro da API (auth/rate-limit/5xx) distinto de `{}` e de "tool não ligada".
2. Passo 4 — balde "A aguardar" só quando a última mensagem do user **pedia resposta**; reencaminhamento → FYI.
3. Passo 4 — lista de clientes substituída por ponteiro para o inventário canónico.

## Feedback final do avaliador (resumo)
Forças: description com 8+ gatilhos PT/EN e cláusula de desambiguação; instruções todas com valor
concreto (limites, paths, ordem de escrita); guard-rails de read-only, redacção de segredos e
zero-fabricação; 7 gotchas reais do Gmail. Fraquezas corrigidas: erro duro da API, lista de clientes duplicada.
