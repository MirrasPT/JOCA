---
name: context-pack
description: "Empacota uma árvore de código num único ficheiro AI-readable (repomix-style) para briefs de sub-agentes ou modelos de contexto longo (gemini-brain 1M). Usar quando: preparar brief de agente sobre projecto grande, pack codebase, empacotar repo, contexto para o gemini, repo num ficheiro."
triggers: pack codebase, empacotar repo, pack context, context pack, repo num ficheiro, empacota o projecto, codebase num ficheiro, preparar contexto para agente, repomix
chain: gemini-brain
---
# context-pack — repo → 1 ficheiro de contexto

Um sub-agente com brief "lê estes 40 paths" gasta 40 Reads e perde-se; com "lê este ficheiro único" gasta 1. Este skill empacota a árvore relevante num artefacto único via `pack-context.mjs`.

## Executar
```bash
node "C:/Users/renat/desktop/joca_final/joca_brain/.claude/scripts/pack-context.mjs" <dir-alvo> [--out <file>] [--max-kb 512] [--ext php,ts,tsx] [--exclude tests,fixtures]
```
- Respeita `.gitignore` (via `git ls-files`; fallback walk com exclusões standard: node_modules, vendor, dist, storage…).
- Binários/locks/minified ficam sempre de fora.
- Budget: pequenos primeiro; o que não coube é **listado no cabeçalho** (sem cortes silenciosos).

## Regras
1. **Output SEMPRE fora da árvore do projecto-alvo** (default: %TEMP%). Um pack dentro do projecto é apanhado por content-scanners (gotcha Tailwind v4 — `rules/orchestration-patterns.md` #4).
2. Dimensionar ao consumidor: brief de sub-agente → `--max-kb 256-512`; gemini-brain (1M tokens) → até `--max-kb 2048`.
3. Filtrar antes de aumentar budget: `--ext`/`--exclude` primeiro, `--max-kb` depois. Pack focado > pack gordo.
4. No brief do agente, referencia o path do pack + instrução "lê o pack primeiro; NÃO re-Read os ficheiros originais salvo para editar".

## Quando NÃO usar
- Projecto pequeno (≤5 ficheiros) → paths directos no brief.
- Precisas de estrutura/dependências, não conteúdo → `/map-joca` (graphify).

## Próximo passo (chain)
- Pack para análise de segundo modelo → `gemini-brain` (contexto 1M).
- Pack para brief de worker → despachar o agente com o path.
