# JOCA

Joint Orchestrator of Cognitive Agents — toolkit centralizado para Claude Code.

## Estrutura

```
JOCA/
├── install.md           <- bootstrap de instalacao (maquina nova)
├── JOCA_Logic/          <- Motor: skills, agents, commands, memory
│   ├── .claude/         <- agents, commands, hooks, scripts, settings
│   ├── memory/          <- INDEX, SKILL_INDEX, soul, tools, projects
│   └── CLAUDE.md        <- configuracao base
├── JOCA_UI/             <- Interface: browser UI, terminal multi-sessao
│   ├── backend/         <- Node.js + Express + WebSocket + node-pty
│   └── frontend/        <- React + Vite + xterm.js
└── README.md
```

## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"`

## Quick Start

```bash
# macOS / Linux
bash JOCA_UI/start.sh

# Windows
JOCA_UI\start.bat
```
