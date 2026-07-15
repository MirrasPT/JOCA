# JOCA

Joint Orchestrator of Cognitive Agents — toolkit centralizado para Claude Code.

## Estrutura

```
JOCA/
├── install.md           <- bootstrap de instalacao (maquina nova)
├── JOCA_Brain/          <- Motor: skills, agents, commands, memory
│   ├── .claude/         <- agents, commands, hooks, scripts, settings
│   ├── memory/          <- INDEX, SKILL_INDEX, soul, tools, projects
│   └── CLAUDE.md        <- configuracao base
├── JOCA_OS/             <- Interface: chat Master + terminais multi-sessao
│   ├── backend/         <- Node.js + Express + WebSocket + node-pty
│   └── frontend/        <- React + Vite + xterm.js
└── README.md
```

## Navegação de Código + Conhecimento

**Mapa de CONHECIMENTO** (skills · agentes · comandos · projectos + como se ligam) → `/map-joca`:
- `node JOCA_Brain/.claude/scripts/joca-graph.mjs` → `python -m graphify cluster-only JOCA_Brain/graphify-out/joca-knowledge`
- Output interactivo: `JOCA_Brain/graphify-out/joca-knowledge/graphify-out/graph.html` (click/filtra/pesquisa).
- Extractor JOCA-aware: lê `chain:`/`triggers:`/frontmatter — o que o graphify não vê sozinho.

**Mapa de CÓDIGO** (app/scripts):
1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"` + `python JOCA_Brain/.claude/scripts/graphify-deps.py .` (pastas + links markdown)
   (Windows: usar `python` — o `python3` é o stub vazio da Microsoft Store, sem graphify. macOS/Linux: `python3`.)
   graphify v0.8.5+ mapeia código **+ docs/PDF/imagens/vídeo**; `graphify query/explain/path` para interrogar o grafo.

## Quick Start

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```
