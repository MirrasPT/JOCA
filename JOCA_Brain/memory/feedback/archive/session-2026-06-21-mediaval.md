---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-21
project: mediaval-chess
---
processed: true
processed_date: 2026-06-23

**Categoria:** `doc-gap` | **Severidade:** low | **Descrição:** O `/save` não tem lógica para actualizar o bloco "Conceito" do CLAUDE.md do projecto quando as regras do jogo mudam (campo 9×10 → 7×9, cartas novas). Isso ficou manual nesta sessão. | **Componente afectado:** `/save` command | **Fix sugerido:** Adicionar na Fase 2 do /save um check: se detectar `CLAUDE.md` com secção `### Conceito`, comparar com `memory/projects/<nome>.md` e sugerir actualização cirúrgica.

**Categoria:** `workflow-gap` | **Severidade:** medium | **Descrição:** Quando a sessão começa com "o MVP já está criado", o workflow habitual (init → plan → scaffold) não se aplica. Não há um ponto de entrada claro para "retomar projecto existente com pedido de design review + bug fix". O user teve de descrever tudo manualmente. | **Componente afectado:** task-intake, `/resume` | **Fix sugerido:** `/resume` devia detectar existência de código + PRD e propor fluxo de iteração (review/fix/feature) em vez de apenas carregar contexto passivamente.

**Categoria:** `skill-improvement` | **Severidade:** low | **Descrição:** A skill `frontend` não tem padrão específico para jogos (canvas/DOM game loop, game store Zustand, engine puro TS). Activou-se mas não trouxe heurísticas de jogos. | **Componente afectado:** `.claude/skills/frontend.md` | **Fix sugerido:** Criar sub-skill `game-frontend` ou adicionar secção "Game UI" à skill frontend com padrões: Zustand game store, pure engine/UI separation, DOM grid vs Canvas tradeoffs.
