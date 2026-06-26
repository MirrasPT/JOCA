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

## Grafo-de-grafos: projectos ligam ao grafo PRÓPRIO de cada projecto
Cada projecto (`memory/projects/*.md`) tem o caminho real no frontmatter (`directorio:`/`path:`/`repo:`). O extractor:
- Resolve o caminho, e se o projecto já tem `<path>/graphify-out/graph.json` → adiciona um nó `grafo: <projecto>` (drill-down) ligado ao projecto por edge `has-graph`. O `source_file` do nó aponta para o `graph.html` do projecto → abrir esse para ver o grafo do projecto.
- Imprime a tabela "Projecto → grafo próprio" (quais já têm grafo, quais faltam, pastas ausentes).

**Gerar os grafos em falta** (best-effort, só código, sem LLM):
```bash
node .claude/scripts/joca-graph.mjs --build-projects
```
⚠ Corre `graphify` em cada pasta de projecto que exista no disco. **Cuidado com projectos enormes** (ex.: ComfyUI = gigabytes de modelos) — preferir gerar o grafo desses manualmente na própria pasta. Projectos remotos (VPS) ou ausentes nesta máquina são saltados.

Abrir o grafo de um projecto específico: `Start-Process "<path-do-projecto>/graphify-out/graph.html"`.

## Graph GIGANTE (tudo fundido num só) — `--merge`
Para **um único graph com tudo** (JOCA + o código real de cada projecto, ligado):
```bash
node .claude/scripts/joca-graph.mjs --merge          # funde o graph.json de cada projecto
python -m graphify cluster-only graphify-out/joca-knowledge-merged --no-viz
```
- Funde os subgrafos dos projectos, **namespaced** (`<projecto>::<nó>`, sem colisões) + **bridge** `project:X --project-code--> <god-node do projecto>` (liga o nó do projecto ao seu código). Tudo num só componente conectado.
- **Filtra ruído de bibliotecas** (node_modules/vendor/dist/.venv/site-packages…) — só o código REAL.
- Escreve para `graphify-out/joca-knowledge-merged/` (SEPARADO do mapa limpo, que fica intacto).
- ⚠ **É enorme** (dezenas de milhar de nós) → **sem `graph.html` estático** (limite viz 5000). Explorar por:
  - `python -m graphify serve` (servidor interactivo para grafos grandes), OU
  - `python -m graphify query "<pergunta>" --graph graphify-out/joca-knowledge-merged/graphify-out/graph.json` (atravessa JOCA + todos os projectos).
- Combinar com `--build-projects` para incluir projectos sem grafo (⚠ saltar ComfyUI).
- **Nota:** um projecto com grafo inchado (ex.: livro-de-elogios trazia 61k mesmo após filtro) → rebuild limpo do grafo PRÓPRIO desse projecto (graphify na pasta dele com exclusões) antes de fundir.

**Dois mapas, dois usos:** mapa limpo (`joca-knowledge`, 217 nós, **visual/navegável**, drill-down) · graph gigante (`joca-knowledge-merged`, dezenas de milhar, **query cross-projecto**).

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
