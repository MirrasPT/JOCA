# REPURPOSE.md — JOCA_UI → JOCA_OS

Guia mecânico de repurpose. Passos exactos, reversíveis. Windows-first.

JOCA_OS hoje = cópia crua do JOCA_UI. Package names ainda `joca-ui*`, portas
`7371/7372`. Objectivo deste doc: dar identidade própria ao JOCA_OS e arrancá-lo
**lado-a-lado** com o JOCA_UI sem colisão de portas. NÃO mexer no JOCA_UI.

> Âmbito: SÓ repurpose técnico (nomes + portas + identidade). NADA do Master
> (provider/orchestrator/memória) entra aqui — isso é Fase MVP, posterior.

---

## 0. Estado verificado (fonte real, não assumido)

Antes dos passos, o que o código **realmente** tem (verificado nos ficheiros):

| Item | Valor real | Ficheiro:linha |
|---|---|---|
| name root | `joca-ui` | `package.json:2` |
| name backend | `joca-ui-backend` | `backend/package.json:2` |
| name frontend | `joca-ui-frontend` | `frontend/package.json:2` |
| Porta backend | `7371` (via env `PORT` no arranque) | `start.bat:5`, `start.sh:4`, `stop.*` |
| Porta frontend | `7372` (via `--port`) | `start.bat:6`, `start.sh:5`, `stop.*` |
| PORT default no server | `3001` (sobreposto pelo `PORT` do launcher) | `server.ts:926`, `server.ts:1694` |
| Listen | `127.0.0.1` (loopback — manter) | `server.ts:1695` |
| LOG_DIR | `%TEMP%\joca-ui` | `start.bat:8` |
| Banner consola | `JOCA_UI → http://...` | `server.ts:1697` |
| Vite ports | env `JOCA_FRONTEND_PORT`/`JOCA_BACKEND_PORT`, default `7372`/`7371` | `vite.config.ts:4-5` |
| WS do frontend | `window.location.host` + proxy `/ws` | `App.tsx:35` |

**Correcções à espec (verificadas no código — NÃO seguir cegamente o plano):**

1. **Não há `.env`.** As portas vivem nos launchers (`start.bat`/`start.sh`) e
   nos defaults do `vite.config.ts`. Não criar `.env` salvo se quiseres
   centralizar — opcional, ver §7.
2. **`App.tsx` NÃO tem porta hardcoded.** O WS usa `window.location.host`
   (a porta do vite) e passa pelo proxy `/ws` do vite para o backend. Logo
   **não se toca no App.tsx** — basta o backend-port certo no `vite.config.ts`.
3. **`RL_CACHE_DIR` (`server.ts:940`, `%TEMP%\joca-ui`) NÃO se renomeia.**
   É interface PARTILHADA: os statusline scripts do JOCA_Brain ESCREVEM aí
   (`.claude/scripts/statusline-command.js:8`,
   `.claude/scripts/agy-statusline.js:24`). Se o JOCA_OS ler `joca-os`, o
   dashboard de rate-limits fica vazio (os dados são produzidos em `joca-ui`).
   Renomear só o **LOG_DIR** (privado, seguro). Ver §5.
4. PORT default no server é **3001**, não 7371. O 7371 vem do launcher. Se
   queres que o JOCA_OS responda em 7381 mesmo sem launcher, mudar o default
   nos 2 sítios (`server.ts:926` e `:1694`) — ver §5.

---

## 1. Pré-flight (reversibilidade)

Tudo abaixo é texto em ficheiros versionados → reversível por `git`.

```bash
# a partir de JOCA_FINAL/JOCA_OS
git status                 # arvore limpa antes de comecar
git switch -c repurpose-joca-os   # ramo dedicado (revert facil)
```

Snapshot do ponto de partida (grep deve mostrar os mesmos hits do §0):

```bash
grep -rnE "joca-ui|7371|7372" . --include="*.json" --include="*.ts" \
  --include="*.bat" --include="*.sh" -l | grep -v node_modules
```

---

## 2. package.json — nomes (3 ficheiros)

```
package.json            : "joca-ui"          -> "joca-os"
backend/package.json    : "joca-ui-backend"  -> "joca-os-backend"
frontend/package.json   : "joca-ui-frontend" -> "joca-os-frontend"
```

Só o campo `name`. NÃO tocar em scripts/deps. Sem deps de provider aqui (Fase MVP).

---

## 3. Portas — backend `7371→7381`, frontend `7372→7382`

### 3a. start.bat
```
linha 5:  set "BACKEND_PORT=7371"   -> 7381
linha 6:  set "FRONTEND_PORT=7372"  -> 7382
```

### 3b. start.sh
```
linha 4:  BACKEND_PORT=7371   -> 7381
linha 5:  FRONTEND_PORT=7372  -> 7382
```

### 3c. stop.bat
```
linha 4:  set "BACKEND_PORT=7371"   -> 7381
linha 5:  set "FRONTEND_PORT=7372"  -> 7382
```

### 3d. stop.sh
```
linha 4:  BACKEND_PORT=7371   -> 7381
linha 5:  FRONTEND_PORT=7372  -> 7382
```

### 3e. frontend/vite.config.ts (defaults de fallback)
```
linha 4:  ... ?? 7372)  -> ?? 7382)
linha 5:  ... ?? '7371' -> ?? '7381'
```

> Nota: o vite dev recebe a porta por `--port 7382` do launcher; o default só
> conta se correres `vite` à mão. O `BACKEND_PORT` do vite.config alimenta o
> **proxy `/ws`** → tem de apontar para `7381` para o WS ligar. Daí o §3e.

### 3f. "JOCA UI.command" / "JOCA UI.vbs" (launchers macOS/Windows-dbl-click)
```
JOCA UI.command : linha 7 BACKEND_PORT=7371 -> 7381 ; linha 8 FRONTEND_PORT=7372 -> 7382
JOCA UI.vbs     : sem portas hardcoded (so chama o start) — confirmar; renomear ficheiro opcional (§4)
```

> **NÃO mexer no App.tsx** (ver §0 ponto 2 — WS via proxy, sem porta literal).

---

## 4. Refs internas `joca-ui → joca-os` / `JOCA UI → JOCA OS`

### 4a. start.bat — LOG_DIR + banners
```
linha 8:  %TEMP%\joca-ui   -> %TEMP%\joca-os
linha 27: JOCA UI already running   -> JOCA OS already running
linha 33: Starting JOCA UI...       -> Starting JOCA OS...
linha 63: JOCA UI running at        -> JOCA OS running at
```

### 4b. start.sh — banners + pidfile
```
linha 19: JOCA UI já está a correr  -> JOCA OS já está a correr
linha 36: JOCA UI a arrancar...     -> JOCA OS a arrancar...
linha 60: /tmp/joca-ui-v2.pids      -> /tmp/joca-os-v2.pids
```

### 4c. stop.sh / stop.bat — banners + pidfile
```
stop.sh  linha 2:  Stopping JOCA UI...  -> Stopping JOCA OS...
stop.sh  pidfile:  /tmp/joca-ui-v2.pids -> /tmp/joca-os-v2.pids  (linhas 20-22)
stop.bat linha 7:  Stopping JOCA UI...  -> Stopping JOCA OS...
stop.bat linha 19: JOCA UI stopped.     -> JOCA OS stopped.
```

### 4d. server.ts — banner de consola
```
linha 1697: console.log(`JOCA_UI → ...`) -> `JOCA_OS → ...`
```

### 4e. server.ts — LOG_DIR/cache: o que MUDA vs o que FICA

| Ref | Linha | Acção |
|---|---|---|
| `RL_CACHE_DIR = ...'joca-ui'` | 940 | **MANTER** `'joca-ui'` (cache partilhada — §0 pt.3) |
| `JOCA_UI_TOOLKIT_START/END` sentinel | 515-525 | **MANTER** (marcador de bloco no CLAUDE.md; renomear quebraria o replace idempotente — só renomear se mudares os 4 usos em conjunto, sem ganho funcional) |

> Se mais tarde quiseres cache própria do JOCA_OS para rate-limits, é preciso
> também ensinar os statusline scripts a escrever em `joca-os` — fora do âmbito
> deste repurpose. Por agora partilhar `joca-ui` é o correcto (dados reais).

### 4f. server.ts — PORT default (opcional, recomendado p/ robustez)
Para o JOCA_OS responder em 7381 mesmo sem o launcher (corre `npm start` à mão):
```
linha 926:  Number(process.env.PORT || 3001)  -> || 7381
linha 1694: Number(process.env.PORT || 3001)  -> || 7381
```
> Não obrigatório: o launcher já injecta `PORT=7381`. Mudar evita cair em 3001
> num arranque manual e colidir com outro serviço.

---

## 5. Docs internos (coerência, sem impacto runtime)

`CLAUDE.md` e `PRD.md` do JOCA_OS ainda dizem "JOCA_UI" / `7371`/`7372`.
Actualizar para JOCA_OS / `7381`/`7382` (linhas em `CLAUDE.md`: 1,3,6,12,28,31,35).
Sem efeito em runtime — só clareza.

**Discrepância do CLAUDE.md raiz (`JOCA_FINAL/CLAUDE.md` e `~/CLAUDE.md`):**
a doc do utilizador refere "UI em localhost:7382" para o JOCA_OS. Decisão:
adoptar `7382` como frontend do JOCA_OS (este guia fá-lo). Confirmar que a doc
raiz e este repurpose ficam consistentes: **JOCA_UI = 7371/7372, JOCA_OS = 7381/7382.**

---

## 6. Renomear ficheiros launcher (opcional, cosmético)

`JOCA UI.command`, `JOCA UI.vbs` → `JOCA OS.command`, `JOCA OS.vbs`.
Usar `git mv` (preserva história). Os `start.bat`/`start.sh` mantêm o nome.

```bash
git mv "JOCA UI.command" "JOCA OS.command"
git mv "JOCA UI.vbs" "JOCA OS.vbs"
```

> NÃO renomear a pasta-raiz `JOCA_OS` (já tem o nome certo). E nunca renomear
> pastas-raiz de dentro de um Claude/servidor a correr — cwd lock (regra
> `workflows-and-tooling.md`).

---

## 7. (Opcional) centralizar portas num `.env`

Hoje não há `.env`. Se quiseres uma fonte única em vez de espalhar `7381/7382`:

```
# backend/.env  (ou JOCA_OS/.env)
PORT=7381
JOCA_BACKEND_PORT=7381
JOCA_FRONTEND_PORT=7382
```
Os launchers teriam de carregar o `.env` (hoje NÃO carregam — passam `PORT`/`--port`
directos). Sem isso, o `.env` é ignorado. **Recomendação MVP: não criar `.env`**;
manter as portas nos launchers + vite.config (menos peças móveis). Listado só para
não fabricar a existência de um `.env` que o plano assumia.

---

## 8. Evitar colisão com o JOCA_UI a correr

JOCA_UI existe como pasta irmã (`JOCA_FINAL/JOCA_UI`) e usa `7371/7372`.
JOCA_OS passa a `7381/7382` → portas disjuntas, podem correr em simultâneo.

Pontos de contacto partilhados (não-porta) a ter em conta:
- **Cache `%TEMP%/joca-ui`** — partilhada de propósito (rate-limits). OK.
- **LOG_DIR** — agora `%TEMP%/joca-os` (privado). Sem colisão de logs.
- **pidfiles** — agora `/tmp/joca-os-v2.pids` (macOS). Sem colisão.
- **`JOCA_LOGIC_PATH`** — ambos apontam ao mesmo `JOCA_Brain` (intencional;
  read-only do ponto de vista de identidade). OK.

Antes de arrancar, garantir que nada já segura 7381/7382:
```powershell
netstat -ano | findstr ":7381 "    # deve vir vazio
netstat -ano | findstr ":7382 "    # deve vir vazio
```

Matar resíduo por porta (children do vite/esbuild seguram a porta → `/T`):
```powershell
# Windows: descobrir PID e matar a arvore
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":7381 " ^| findstr LISTENING') do taskkill /F /T /PID %a
```

---

## 9. Checklist de verificação pós-repurpose

### 9a. Grep limpo (identidade)
```bash
# nos identificadores do JOCA_OS, 'joca-ui' deve sobrar SÓ em RL_CACHE_DIR (940)
# e no sentinel TOOLKIT (515-525) — ambos intencionais (§4e).
grep -rnE "joca-ui" . --include="*.json" --include="*.bat" --include="*.sh" | grep -v node_modules
#   esperado: VAZIO  (.json/.bat/.sh sem 'joca-ui')

grep -rnE "7371|7372" . --include="*.ts" --include="*.bat" --include="*.sh" | grep -v node_modules
#   esperado: VAZIO
```
- [ ] `package.json` (x3) com `name` = `joca-os*`
- [ ] Sem `7371`/`7372` em launchers, stop scripts, vite.config
- [ ] `joca-ui` só em `server.ts:940` (RL_CACHE_DIR) e sentinel 515-525

### 9b. Build sobe
```powershell
cd backend ; npm run build        # tsc sem erros -> dist/server.js
cd ../frontend ; npm run build     # tsc + vite build sem erros
```
- [ ] backend `npm run build` = 0 erros
- [ ] frontend `npm run build` = 0 erros

### 9c. `npm run dev` sobe (raiz)
```powershell
# na raiz JOCA_OS — concurrently: backend(tsx watch) + frontend(vite)
npm run dev
```
- [ ] backend imprime `JOCA_OS → http://localhost:7381` (ou a porta env)
- [ ] frontend vite serve em `7382` (ou env)
- [ ] sem `EADDRINUSE`

> Nota: `npm run dev` (raiz) NÃO injecta `PORT` → o backend usa o default do
> server (3001 hoje; 7381 se aplicaste §4f). Para dev na porta nova, ou aplica
> §4f, ou corre via `start.bat` (que injecta `PORT=7381`).

### 9d. WS liga (o teste que importa)
1. Abrir `http://localhost:7382` (frontend novo).
2. DevTools → Network → WS → confirmar handshake `/ws` `101 Switching Protocols`
   contra o backend (via proxy → 7381).
3. Abrir uma sessão de terminal na UI → ver output do PTY a fluir.
- [ ] WS `/ws` = 101 (sem erro de proxy/porta)
- [ ] PTY responde (terminal escreve/lê)

### 9e. Sem colisão (lado-a-lado)
```powershell
netstat -ano | findstr ":7371 "   # JOCA_UI (se a correr)
netstat -ano | findstr ":7381 "   # JOCA_OS
netstat -ano | findstr ":7372 "   # JOCA_UI
netstat -ano | findstr ":7382 "   # JOCA_OS
```
- [ ] JOCA_UI (se ligado) em 7371/7372, JOCA_OS em 7381/7382, sem sobreposição
- [ ] Ambos respondem no browser em simultâneo

### 9f. Rate-limits dashboard (cache partilhada intacta)
- [ ] Dashboard de rate-limits do JOCA_OS mostra dados reais (lê `%TEMP%/joca-ui`,
      alimentado pelos statusline scripts do JOCA_Brain). Se vier vazio,
      verificaste que NÃO renomeaste `RL_CACHE_DIR` (§0 pt.3 / §4e).

---

## 10. Rollback

```bash
git restore .                     # descarta edicoes nao-commitadas
# ou, se ja commitaste no ramo:
git switch master                 # volta ao JOCA_UI-as-is
git branch -D repurpose-joca-os   # (opcional) apaga o ramo
```
Renomeações de ficheiro (§6) revertem com `git mv` inverso ou `git restore`.

---

## Resumo dos pontos onde a espec estava errada (verificado no código)

1. `.env` não existe — portas nos launchers + vite.config, não num `.env`.
2. `App.tsx` não tem porta backend hardcoded — WS via `window.location.host` +
   proxy `/ws`. Não se edita.
3. `RL_CACHE_DIR` NÃO se renomeia — é cache partilhada escrita pelos statusline
   scripts do JOCA_Brain; renomear esvazia o dashboard de rate-limits.
4. PORT default do server é 3001 (não 7371); o 7371 vem do launcher.
