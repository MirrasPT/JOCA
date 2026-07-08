# /help-joca — Referência rápida do JOCA

Apresenta todos os comandos, agentes e skills do JOCA com descrição curta.

## Passos

1. Ler `memory/INDEX.md` para obter a lista actualizada de commands e agentes.
2. Ler `memory/SKILL_INDEX.json` para obter a lista actualizada de skills (name + description).
3. Apresentar o output abaixo — substituindo as secções de Agentes e Skills com o conteúdo real (INDEX.md para agentes, SKILL_INDEX.json para skills), resumido a ~10 palavras por item.

---

## Output a apresentar

```
JOCA — Referência rápida
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SESSÃO
/resume              Carrega contexto e knowledge graph do projecto
/save                Guarda estado da sessão e actualiza memory
/init-project        Inicializa entrada de projecto novo em memory
/install             Setup ou reconfiguração do JOCA
/migrate             Migração v1-legacy → v2.0

WORKFLOW
/plan                Activa Plan Mode para arquitectura e decisões
/autoplan            Plano completo auto-revisto (produto → design → eng)
/goal                Auto-orquestração de tarefa NL → master-orchestrator loop
/one-shot            Desenvolvimento autónomo end-to-end a partir de PRD
/build-plan          Construção supervisionada por fases com gate de testes
/debug               Triage de erros com skill do stack detectado
/review-code         Code review via tester-code + Codex adversarial opcional
/review-design       Review UI/UX e acessibilidade em paralelo
/ship                Levar código a PR: sync → testes → gate → push → PR
/create-skill [desc] Cria nova skill via pipeline self-improving
/create-skill --upgrade [nome]  Melhora skill existente

CONHECIMENTO
/know                Ingere conteúdo na Knowledge Base (markitdown → nota wiki)
/learn               Memória institucional do Brain (decisões + aprendizagens)
/retro               Retrospectiva: aprendizagens da janela → acções
/map-joca            Mapa de conhecimento interactivo (graph.html via graphify)

FEEDBACK & MANUTENÇÃO
(feedback do projecto + JOCA é auto-capturado pelo /save)
/upgrade-joca        Lê feedback acumulado → implementa melhorias ao JOCA
/update-joca         Verifica e aplica updates do repositório oficial GitHub
/sync-questionnaires Realinha questionários/contadores com o inventário real
/status              Mostra rate limits, modelo e contexto actual

WORDPRESS
/wp-perf             Quick triage WordPress — issues críticos (rápido)
/wp-perf-review      Code review WP completo: Critical / Warning / Info

/help-joca           Esta página

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENTES
[ler do memory/INDEX.md — secção ## Agents — e apresentar agrupado por categoria]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SKILLS
[ler de memory/SKILL_INDEX.json — apresentar agrupado por domínio]
Nota: Skills Shopify e WordPress só activas nos projectos respectivos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Regras de formatação

- Descrições: máximo ~10 palavras, sem artigos quando possível
- Agentes agrupados por categoria tal como no INDEX.md; skills agrupadas por domínio
- Sem markdown pesado — texto plano com `━` como separador
- Famílias grandes de skills (GSAP, ComfyUI, WordPress, hyperframes): agrupar como bloco "GSAP (8)" etc. com nota "(ver SKILL_INDEX.json para lista completa)"
- Se o utilizador passar argumento (ex: `/help-joca design`): filtrar e mostrar só essa categoria
