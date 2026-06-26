# /map-joca — Mapa de conhecimento do JOCA (skills · agentes · projectos · conexões)

Gera um grafo navegável de **todo o conhecimento do JOCA** — não só código: skills, agentes, comandos, rules, projectos, e **como se ligam** (chains reais do frontmatter). Renderiza um `graph.html` interactivo + report via graphify.

Extractor JOCA-aware (`joca-graph.mjs`) → graphify (motor de viz/cluster). Porquê custom: o graphify mapeia código/docs por imports e links markdown; o conhecimento do JOCA conecta-se por `chain:`/`triggers:`/tipo, que o graphify não vê sozinho.

## Correr
```bash
node .claude/scripts/joca-graph.mjs
python -m graphify cluster-only graphify-out/joca-knowledge
```
Outputs em `graphify-out/joca-knowledge/graphify-out/`:
- `graph.html` — **interactivo** (click nós, filtra, pesquisa). Abrir: `Start-Process graphify-out/joca-knowledge/graphify-out/graph.html` (Windows).
- `GRAPH_REPORT.md` — comunidades, conceitos-chave, conexões surpreendentes.
- `graph.json` — o grafo (queryável: `graphify query "..." --graph <path>`).

## O que mapeia
- **Nós** por tipo (hubs): Skills · Agentes · Comandos · Rules · Projectos. Cada item é um nó com a sua descrição.
- **Edges:** `contains` (hub→item, agrupamento por tipo) + `chains-to` (a conexão REAL: skill/agente → próximo passo declarado em `chain:`).
- Quanto mais skills tiverem `chain:` no frontmatter, mais rica fica a teia de conexões (ver `rules/chaining.md`).

## Mapa de CÓDIGO (complementar)
Para o grafo do código (a app JOCA_OS, scripts) — o graphify normal:
```bash
python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
python .claude/scripts/graphify-deps.py .   # + pastas + links markdown
python -m graphify cluster-only . --no-viz  # >5000 nós → sem viz; query via graphify
```
- Windows: `python`, não `python3` (stub da Store).

## Quando correr
- Depois de adicionar/mudar skills/agentes/chains → re-correr para o mapa reflectir o estado.
- Onboarding / "como é que isto se liga?" → abrir o `graph.html`.

## Próximo passo (chain)
- Explorar um nó: `python -m graphify explain "<nome>" --graph graphify-out/joca-knowledge/graphify-out/graph.json`.
- Caminho entre dois: `python -m graphify path "A" "B" --graph <...>`.
