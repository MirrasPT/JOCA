# JOCA

Joint Orchestrator of Cognitive Agents — centralized toolkit for Claude Code.

## Structure

```
JOCA/
├── install.md           <- install bootstrap (new machine)
├── JOCA_Brain/          <- Engine: skills, agents, commands, memory
│   ├── .claude/         <- agents, commands, hooks, scripts, settings
│   ├── memory/          <- INDEX, SKILL_INDEX, soul, tools, projects
│   └── CLAUDE.md        <- base configuration
├── JOCA_OS/             <- Interface: multi-session terminals
│   ├── backend/         <- Node.js + Express + WebSocket + node-pty
│   └── frontend/        <- React + Vite + xterm.js
└── README.md
```

## Code + Knowledge Navigation

**KNOWLEDGE map** (skills · agents · commands · projects + how they connect) → `/map-joca`:
- `node JOCA_Brain/.claude/scripts/joca-graph.mjs` → `python -m graphify cluster-only JOCA_Brain/graphify-out/joca-knowledge`
- Interactive output: `JOCA_Brain/graphify-out/joca-knowledge/graphify-out/graph.html` (click/filter/search).
- JOCA-aware extractor: reads `chain:`/`triggers:`/frontmatter — what graphify does not see on its own.

**CODE map** (app/scripts):
1. Check `graphify-out/GRAPH_REPORT.md` — god nodes, communities, suggested questions
2. Check `graphify-out/graph.json` for detailed structure and dependencies
3. Read raw files only when needed to edit, or when the graph has no answer
4. Update: `python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"` + `python JOCA_Brain/.claude/scripts/graphify-deps.py .` (folders + markdown links)
   (Windows: use `python` — `python3` is the empty Microsoft Store stub, without graphify. macOS/Linux: `python3`.)
   graphify v0.8.5+ maps code **+ docs/PDF/images/video**; `graphify query/explain/path` to interrogate the graph.

## Quick Start

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```
