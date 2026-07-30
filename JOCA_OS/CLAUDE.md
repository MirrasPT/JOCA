# JOCA_OS

**Nome:** JOCA_OS
**Stack:** React + Vite + TypeScript · Node.js + Express + WebSocket (`ws`) · xterm.js · node-pty
**Objectivo:** Browser UI para Claude Code — terminal emulado com sidebar multi-sessão
**Directório:** `JOCA_OS/`
**PRD:** [PRD.md](PRD.md)

## Arquitectura

```
JOCA_OS/
├── frontend/          ← React + Vite + TypeScript
│   └── src/
│       ├── components/
│       │   ├── Sidebar.tsx     ← lista de sessões
│       │   └── Terminal.tsx    ← xterm.js wrapper
│       └── App.tsx
└── backend/           ← Node.js + Express + ws + node-pty
    └── src/
        └── server.ts  ← WebSocket server + PTY manager
```

## Arranque

```bash
# Primeira vez (compila node-pty nativo para o Node.js instalado)
cd JOCA_OS
npm run setup

# Dev (backend :7381 + frontend :7382)
bash start.sh        # macOS/Linux
# start.bat          # Windows

# Aceder em: http://localhost:7382
```

**Nota:** Se `posix_spawnp failed` aparecer, correr:
```bash
cd backend/node_modules/node-pty && npx node-gyp rebuild
```

## Skills activas

- `nodejs` — backend Node.js
- `frontend-design` — UI React

## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` se existir
2. Ler ficheiros raw quando necessário para editar
3. Actualizar: `python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"`

## Decisões chave

- `node-pty` para PTY real (suporte ANSI, resize)
- WebSocket raw (`ws`) — avaliar Socket.io se reconexão necessária
- Estado em ficheiros JSON/JSONL em `data/` (sem DB); runs em `data/runs.jsonl`
- Local-first: bind default em `127.0.0.1` sem auth. Modo remoto (VPS) é opt-in:
  `JOCA_HOST=0.0.0.0` só arranca com auth configurada (`JOCA_PASSWORD` ou password
  definida na UI) — password scrypt + tokens em cookie httpOnly/Bearer
- Multi-CLI: sessões/tarefas/automações podem correr `claude` (default), `codex`,
  `agy` ou `opencode` — perfis em `src/cli-profiles.ts`, override em `data/cli-profiles.json`
- Notificações persistem na inbox (`data/notifications.json`) antes do broadcast WS
- Heartbeat (proactividade) em `src/heartbeat/` — config em `data/heartbeat.json`
- **Gestor de projecto** (`src/manager/`): um agente conversacional por projecto. NÃO é um terminal
  — é in-process (SDK), por isso responde já e não ocupa nenhuma das 30 sessões. Corre com
  `tools: []` (sem Bash/Write/Edit) + ferramentas MCP próprias: despachar workers por área, ler/
  responder-lhes, gerir o quadro, e VERIFICAR o resultado (`ver_ficheiro`/`ver_imagem`/
  `listar_pasta`/`ver_pagina` — leitura apenas: olhos, não mãos). Continuidade via `options.resume`.
- **Ponte de agentes** (`cli/joca.mjs` + `src/agent-bridge.ts`): cada PTY nasce com `JOCA_CLI`,
  `JOCA_API_URL`, `JOCA_SESSION_ID` e (com auth) `JOCA_API_TOKEN`. O agente dentro do terminal opera
  o JOCA_OS **em execução** pela mesma API HTTP que o browser usa — cria tarefas, abre terminais,
  fala com outros. Uma implementação por acção, sem reinícios.

## Testes

```bash
cd backend && npm test   # vitest — unidades puras (schedule math, heartbeat, cli-profiles)
```
