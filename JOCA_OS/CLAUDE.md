# JOCA_OS

**Nome:** JOCA_OS
**Stack:** React + Vite + TypeScript · Node.js + Express + WebSocket (`ws`) · xterm.js · node-pty
**Objectivo:** Browser UI para Claude Code — terminal emulado com sidebar multi-sessão
**Directório:** `JOCA_OS/`

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

# Dev (backend :7491 + frontend :7492)
bash start.sh        # macOS/Linux
# start.bat          # Windows

# Aceder em: http://localhost:7492
```

**Nota:** Se `posix_spawnp failed` aparecer, correr:
```bash
cd backend/node_modules/node-pty && npx node-gyp rebuild
```

## Skills activas

- `nodejs` — backend Node.js
- `frontend-design` — UI React

## Decisões chave

- `node-pty` para PTY real (suporte ANSI, resize)
- WebSocket raw (`ws`) — avaliar Socket.io se reconexão necessária
- Estado em ficheiros JSON em `data/` (sem DB)
- Local-first: bind default em `127.0.0.1` sem auth. Modo remoto (VPS) é opt-in:
  `JOCA_HOST=0.0.0.0` só arranca com auth configurada (`JOCA_PASSWORD` ou password
  definida na UI) — password scrypt + tokens em cookie httpOnly/Bearer
- Multi-CLI: as sessões podem correr `claude` (default), `codex`,
  `agy` ou `opencode` — perfis em `src/cli-profiles.ts`, override em `data/cli-profiles.json`
- Notificações persistem na inbox (`data/notifications.json`) antes do broadcast WS
- **Nada escreve sozinho num terminal.** Só entra o que o dono escreve — incluindo o resume, que é
  **manual**, pelo botão da barra do chat (`session-manager.ts`: "Nenhum `/resume` é injectado"; a
  forma do comando vem do `resumeCmd` do perfil do CLI). Removidos: o heartbeat (proactividade), os relatórios
  automáticos, a varredura de encalhados, o subsistema de gestor de projecto / Joca global /
  "A Sala", o sistema de Tarefas e o sistema de Automações (com o histórico de execuções).
- **O JOCA Brain é opcional e encontra-se pela variável `JOCA_BRAIN`** (`src/brain-locator.ts`).
  Ordem: `JOCA_BRAIN` → `JOCA_LOGIC_PATH` (legado) → `env.JOCA_BRAIN` em `~/.claude/settings.json`
  (o instalador global do Brain v2 grava-a lá) → pasta irmã `../JOCA_Brain` (legado) → nenhum. Só
  conta uma pasta com `AGENTS.md` ou `CLAUDE.md` e com `.claude/` ou `skills/`. Sem Brain o JOCA OS
  arranca e funciona: o toolkit global fica vazio, as Definições dizem «Sem JOCA Brain» e nada é
  escrito no Brain. O toolkit lê as duas estruturas (`.claude/skills/*.md` e as skills em pasta
  com `SKILL.md`, incluindo atalhos), sem repetir; abrir/editar um item vale se o caminho REAL
  ficar dentro de `.claude/`, `.agents/` ou `skills/` do Brain (`http/helpers.ts`). Os lançadores
  (`start.sh`, `start.bat`, `JOCA OS.command`) já não exportam a pasta irmã — quem decide é o
  backend, pela ordem acima. Os terminais de um projecto **abrem na pasta do
  projecto** (na pessoal, com aviso, se ela já não existir); os soltos abrem na pasta pessoal,
  nunca no Brain. Cada terminal recebe `JOCA_BRAIN` quando há Brain; com o Brain v2 o resumo da
  pasta (`.joca/resumo.md`) entra sozinho pelo hook, e o botão de resume fica como recurso manual.
- **Um projecto abre VAZIO.** Nenhum terminal nasce sozinho — nem no arranque do backend, nem ao
  criar o projecto, nem ao abrir o painel. Quem abre terminais é o dono, no "+" do projecto.
- **Ponte de agentes** (`cli/joca.mjs` + `src/agent-bridge.ts`): cada PTY nasce com `JOCA_CLI`,
  `JOCA_API_URL`, `JOCA_SESSION_ID` e (com auth) `JOCA_API_TOKEN`. O agente dentro do terminal opera
  o JOCA_OS **em execução** pela mesma API HTTP que o browser usa — abre terminais,
  fala com outros. Uma implementação por acção, sem reinícios.

## Testes

```bash
cd backend && npm test   # vitest — unidades puras (chunkText, cli-profiles, folderPickerCommand, PATH_SAFE) + contratos de rotas, notificações, sessões, host
```
