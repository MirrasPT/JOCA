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
├── JOCA_OS/             <- Interface: terminais multi-sessao
│   ├── backend/         <- Node.js + Express + WebSocket + node-pty
│   └── frontend/        <- React + Vite + xterm.js
└── README.md
```

## Quick Start

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```
