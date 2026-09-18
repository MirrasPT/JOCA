# JOCA_OS

**Name:** JOCA_OS
**Stack:** React + Vite + TypeScript · Node.js + Express + WebSocket (`ws`) · xterm.js · node-pty
**Objective:** Browser UI for Claude Code — emulated terminal with multi-session sidebar
**Directory:** `JOCA_OS/`

## Architecture

```
JOCA_OS/
├── frontend/          ← React + Vite + TypeScript
│   └── src/
│       ├── components/
│       │   ├── Sidebar.tsx     ← session list
│       │   └── Terminal.tsx    ← xterm.js wrapper
│       └── App.tsx
└── backend/           ← Node.js + Express + ws + node-pty
    └── src/
        └── server.ts  ← WebSocket server + PTY manager
```

## Startup

```bash
# First time (compiles native node-pty for the installed Node.js)
cd JOCA_OS
npm run setup

# Dev (backend :7491 + frontend :7492)
bash start.sh        # macOS/Linux
# start.bat          # Windows

# Access at: http://localhost:7492
```

**Note:** If `posix_spawnp failed` shows up, run:
```bash
cd backend/node_modules/node-pty && npx node-gyp rebuild
```

## Active skills

- `nodejs` — Node.js backend
- `frontend-design` — React UI

## Code Navigation

Read raw files when needed to edit.

## Key decisions

- `node-pty` for a real PTY (ANSI support, resize)
- Raw WebSocket (`ws`) — evaluate Socket.io if reconnection is needed
- State in JSON files in `data/` (no DB)
- Local-first: default bind on `127.0.0.1` with no auth. Remote mode (VPS) is opt-in:
  `JOCA_HOST=0.0.0.0` only starts with auth configured (`JOCA_PASSWORD` or a password
  set in the UI) — scrypt password + tokens in an httpOnly cookie/Bearer
- Multi-CLI: sessions can run `claude` (default), `codex`,
  `agy` or `opencode` — profiles in `src/cli-profiles.ts`, override in `data/cli-profiles.json`
- Notifications persist in the inbox (`data/notifications.json`) before the WS broadcast
- **Nothing writes into a terminal by itself.** Only what the owner types goes in — including the resume, which is
  **manual**, via the button on the chat bar (`session-manager.ts`: "No `/resume` is injected"; the
  shape of the command comes from the CLI profile's `resumeCmd`). Removed: the heartbeat (proactivity), the automatic
  reports, the stalled-session sweep, the project-manager / global Joca /
  "The Room" subsystem, the Tasks system and the Automations system (with the execution history).
- **A project opens EMPTY.** No terminal is born by itself — not at backend startup, not when
  creating the project, not when opening the panel. The owner is the one who opens terminals, at the project's "+".
- **Agent bridge** (`cli/joca.mjs` + `src/agent-bridge.ts`): every PTY is born with `JOCA_CLI`,
  `JOCA_API_URL`, `JOCA_SESSION_ID` and (with auth) `JOCA_API_TOKEN`. The agent inside the terminal operates
  JOCA_OS **while it runs** through the same HTTP API the browser uses — it opens terminals,
  talks to others. One implementation per action, with no restarts.

## Tests

```bash
cd backend && npm test   # vitest — pure units (chunkText, cli-profiles, folderPickerCommand, PATH_SAFE) + route contracts, notifications, sessions, host
```
