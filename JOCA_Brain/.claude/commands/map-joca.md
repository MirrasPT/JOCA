# /map-joca — JOCA knowledge map (skills · agents · projects · connections)

Generates a navigable graph of **all of JOCA's knowledge** — not just code: skills, agents, commands, rules, projects, and **how they connect** (the real chains from the frontmatter). Renders an interactive `graph.html` + report via graphify.

JOCA-aware extractor (`joca-graph.mjs`) → graphify (viz/cluster engine). Why custom: graphify maps code/docs by imports and markdown links; JOCA's knowledge connects by `chain:`/`triggers:`/type, which graphify does not see on its own.

## Run
```bash
node .claude/scripts/joca-graph.mjs
python -m graphify cluster-only graphify-out/joca-knowledge
```
Outputs in `graphify-out/joca-knowledge/graphify-out/`:
- `graph.html` — **interactive** (click nodes, filter, search). Open: `Start-Process graphify-out/joca-knowledge/graphify-out/graph.html` (Windows).
- `GRAPH_REPORT.md` — communities, key concepts, surprising connections.
- `graph.json` — the graph (queryable: `graphify query "..." --graph <path>`).

## What it maps
- **Nodes** by type (hubs): Skills · Agents · Commands · Rules · Projects. Each item is a node with its description.
- **Edges:** `contains` (hub→item, grouping by type) + `chains-to` (the REAL connection: skill/agent → next step declared in `chain:`).
- The more skills carry `chain:` in the frontmatter, the richer the web of connections becomes (see `rules/chaining.md`).

## Graph-of-graphs: projects link to each project's OWN graph
Each project (`memory/projects/*.md`) has the real path in the frontmatter (`directorio:`/`path:`/`repo:`). The extractor:
- Resolves the path, and if the project already has `<path>/graphify-out/graph.json` → it adds a `graph: <project>` node (drill-down) linked to the project by a `has-graph` edge. The node's `source_file` points to the project's `graph.html` → open that one to see the project's graph.
- Prints the "Project → own graph" table (which already have a graph, which are missing, absent folders).

**Generate the missing graphs** (best-effort, code only, no LLM):
```bash
node .claude/scripts/joca-graph.mjs --build-projects
```
⚠ Runs `graphify` in every project folder that exists on disk. **Careful with enormous projects** (e.g.: ComfyUI = gigabytes of models) — prefer generating the graph for those manually in the folder itself. Remote projects (VPS) or ones absent from this machine are skipped.

Open the graph of a specific project: `Start-Process "<project-path>/graphify-out/graph.html"`.

## GIANT graph (everything merged into one) — `--merge`
For **a single graph with everything** (JOCA + the real code of each project, connected):
```bash
node .claude/scripts/joca-graph.mjs --merge          # merges each project's graph.json
python -m graphify cluster-only graphify-out/joca-knowledge-merged --no-viz
```
- Merges the projects' subgraphs, **namespaced** (`<project>::<node>`, no collisions) + a **bridge** `project:X --project-code--> <the project's god-node>` (links the project's node to its code). All in a single connected component.
- **Filters library noise** (node_modules/vendor/dist/.venv/site-packages…) — only the REAL code.
- Writes to `graphify-out/joca-knowledge-merged/` (SEPARATE from the clean map, which stays intact).
- ⚠ **It is enormous** (tens of thousands of nodes) → **no static `graph.html`** (viz limit 5000). Explore via:
  - `python -m graphify serve` (interactive server for large graphs), OR
  - `python -m graphify query "<question>" --graph graphify-out/joca-knowledge-merged/graphify-out/graph.json` (traverses JOCA + every project).
- Combine with `--build-projects` to include projects with no graph (⚠ skip ComfyUI).
- **Note:** a project with a bloated graph (e.g.: one large project brought 61k even after filtering) → clean rebuild of that project's OWN graph (graphify in its folder with exclusions) before merging.

**Two maps, two uses:** clean map (`joca-knowledge`, 217 nodes, **visual/navigable**, drill-down) · giant graph (`joca-knowledge-merged`, tens of thousands, **cross-project query**).

## CODE map (complementary)
For the code graph (the JOCA_OS app, scripts) — plain graphify:
```bash
python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
python .claude/scripts/graphify-deps.py .   # + folders + markdown links
python -m graphify cluster-only . --no-viz  # >5000 nodes → no viz; query via graphify
```
- Windows: `python`, not `python3` (the Store stub).

## When to run
- After adding/changing skills/agents/chains → re-run so the map reflects the state.
- Onboarding / "how does this connect?" → open the `graph.html`.

## Next step (chain)
- Explore a node: `python -m graphify explain "<name>" --graph graphify-out/joca-knowledge/graphify-out/graph.json`.
- Path between two: `python -m graphify path "A" "B" --graph <...>`.
