# /autoplan — Plano completo, auto-revisto (NL → plano aprovado)

Adaptado do `autoplan` do gstack. Pega num objectivo em linguagem natural e produz um **plano completo já revisto** correndo a pipeline `autoplan` (`rules/pipelines.md`) **a fundo e sozinho** — auto-decidindo as escolhas reversíveis e levantando só "taste"/ambiguidade no **gate final**.

Diferença para `/plan`: o `/plan` produz UM plano; o `/autoplan` corre a cadeia de revisões (produto → design → engenharia) automaticamente, como uma equipa, sem parar a cada passo.

---

## Quando usar
- "planeia isto a sério", "plano completo", "autoplan", "quero um plano revisto", feature grande antes de construir.
- Para tarefas pequenas/1-ficheiro → `/plan` chega (autoplan é overkill).

## Pipeline (auto-runner, a fundo)

1. **Interrogar + orientar** — `Read(".claude/skills/plan.md")`. 7 fases: OODA orient, surfacing de assunções, ambiguidade, pre-mortem. Produz o plano-base.
2. **Revisão de produto** (CEO-style) — desafia o problema: estamos a resolver o certo? scope a expandir/reduzir? Decide o scope.
3. **Revisão de design** — `Read(".claude/skills/design-review.md")` em **plan-mode**: pontua as dimensões de UX/UI 0-10 e diz o que faltaria para 10. (Só se a tarefa tem superfície de UI.)
4. **Revisão de engenharia** — arquitectura, fluxo de dados, edge cases, cobertura de testes, performance. Tranca o plano de execução.
5. **Gate final** — levantar de uma vez as decisões de **taste** / ambíguas / irreversíveis acumuladas (não a meio). O user aprova/ajusta.

## Auto-decisão (passos 2-4, reversíveis)
Por `rules/pipelines.md`: decisão activa do Brain (`joca-brain active`) → convenção do projecto → default da skill → menor superfície (YAGNI). Não parar a perguntar em escolhas reversíveis — só acumular as de taste para o gate final.

## Saída
- Plano final aprovado (inline ou ficheiro, conforme o projecto).
- Decisões de arquitectura não-óbvias → registar no Brain: `node .claude/scripts/joca-brain.mjs decide --text "..." --source user`.

## Próximo passo (chain)
- Plano aprovado → implementar: `frontend` / `laravel-specialist` / domínio (encadeia para `tester-*`). Cross-stack → `/goal` corre a pipeline de build.
