# JOCA

Joint Orchestrator of Cognitive Agents — toolkit centralizado para Claude Code.

## Estrutura

```
JOCA/
├── JOCA_Logic/          <- Motor: skills, agents, commands, memory
│   ├── .claude/         <- agents, commands, hooks, scripts, settings
│   ├── memory/          <- INDEX, SKILL_INDEX, soul, tools, projects
│   └── CLAUDE.md        <- configuracao base
├── JOCA_UI/             <- Interface: browser UI, terminal multi-sessao
│   ├── backend/         <- Node.js + Express + WebSocket + node-pty
│   └── frontend/        <- React + Vite + xterm.js
└── README.md
```

## Quick Start

```bash
# macOS / Linux
bash JOCA_UI/start.sh

# Windows
JOCA_UI\start.bat
```
