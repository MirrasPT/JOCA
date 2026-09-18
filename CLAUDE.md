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

## Code Navigation

Read raw files only when needed to edit.

## Quick Start

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```
