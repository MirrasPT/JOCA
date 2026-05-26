# JOCA_UI

**Nome:** JOCA_UI
**Stack:** React + Vite + TypeScript · Node.js + Express + WebSocket (`ws`) · xterm.js · node-pty
**Objectivo:** Browser UI para Claude Code — terminal emulado com sidebar multi-sessão
**Directório:** `JOCA_UI/`
**PRD:** [PRD.md](PRD.md)

## Arquitectura

```
JOCA_UI/
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
cd JOCA_UI
npm run setup

# Dev (backend :7371 + frontend :7372)
bash start.sh        # macOS/Linux
# start.bat          # Windows

# Aceder em: http://localhost:7372
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
- Estado em memória no servidor (sem DB)
- Local only — sem auth, bind apenas em localhost
