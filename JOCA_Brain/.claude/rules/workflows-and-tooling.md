# Workflows & Tooling

Gotchas recorrentes em workflows multi-agente e ambiente local. Carregado em todas as sessões. Terso por design.

---

## Briefs de sub-agentes (Agent / Workflow)

Cada brief de worker DEVE carregar explicitamente:
- **Anti-fabricação** — credencial/endpoint/key em falta → no-auth source ou `TODO: credencial em falta` + reportar. Nunca inventar (ver `soul.md`).
- **Verificar parsers contra resposta real** — quem escreve cliente de API externa faz 1 chamada real e valida o parsing antes de finalizar (ver `api-design.md`).
- **Componentes partilhados antes do fan-out** — em builds paralelos por página/feature, definir player/card/layout numa fase de fundação sequencial; agentes de fan-out IMPORTAM, não recriam (ver `frontend.md`).
- **Convenções do JOCA em briefs que mexem no próprio JOCA** — agente que escreve validador/linter/script sobre o JOCA recebe as convenções no brief, não as infere: `name:` do frontmatter é descritivo e ≠ ficheiro de propósito (ex.: `horizon`→`horizon-queues`); o campo `skills:` no frontmatter NÃO carrega skill (garantia = `Read()` no corpo); skills flat depth 1. Fonte: `sync-questionnaires.md` + `CLAUDE.md`. (Lição: um linter escrito sem isto marcou 3 skills válidas como FAIL.)

Sub-agentes **não herdam** `soul.md` automaticamente — só recebem o brief. Por isso estas regras vão no brief, não se assumem.

## Workflow tool

- **`args` não-fiável** — dados passados em `args` podem chegar `undefined` ao script. Embeber dados como literais no script, ou validar `args` no arranque com erro claro antes de usar.
- **Verify adversarial sem falsos positivos** — passar ao verificador o conjunto exacto de ficheiros/linhas DESTA tarefa (ou commitar por fase). Caso contrário o review estático sobre o `git diff` cumulativo marca trabalho anterior aprovado como "scope creep".
- **Git destrutivo ≠ workflow** — sequência determinística não-paralelizável → usar script versionado. Workflow é bom para fan-out (auditoria, research, drafting).
- **Upgrades grandes do próprio JOCA = 2 fases** (padrão validado): Fase 1 = workflow de análise → escreve plano + drafts em staging (`_improvement/`), não toca canónicos. Fase 2 = aplicação: ficheiros independentes (skills/agentes/hooks novos) via workflow paralelo; ficheiros canónicos partilhados (`CLAUDE.md`, `soul.md`, `settings.json`) via main loop sequencial (anti-clobber). Verificar hooks com `node` antes de confiar.

## Ambiente local (Windows-first)

Renato corre **Windows** como ambiente primário. Ao escrever scripts/skills que tocam credenciais, binários ou paths:
- **`python`, não `python3`** — `python3` é o stub vazio da Microsoft Store (`ModuleNotFoundError`). Detectar: `for PY in python python3; do command -v "$PY" && "$PY" -c "import <mod>" && break; done`.
- **Credenciais** — Claude em `~/.claude/.credentials.json` (não Keychain macOS); Codex sem binário `sqlite3` → usar `node:sqlite`.
- **Detecção de processo local** — filtrar `Name='python.exe'` + `CommandLine -like '*main.py*'`. NUNCA incluir o nome único da app no filtro `Win32_Process` — a própria pwsh que corre a query contém essa string (falso positivo "loop de reinício").
- **Matar servidores por porta** — `taskkill /F /T /PID` (o `/T` mata a árvore; vite/esbuild children seguram a porta).
- **`$PID` é read-only no PowerShell** — variável automática reservada. Num loop `taskkill` por porta, usar outro nome (`foreach ($p in $procs) { taskkill /F /T /PID $p }`); `$pid` rebenta com "Cannot overwrite variable PID".
- **`sed -i` do Git Bash strippa CR de ficheiros `.bat`/`.cmd`** (CRLF→LF) — o cmd.exe não lê batch com LF: parte o parsing char-a-char (`setlocal`→`tlocal`, `set`→`et`) e dá erros enganadores (ex.: um `if !errorlevel! neq 0` que não expande → "build failed" FALSO mesmo com build OK; ou `LOG_DIR` herdado do env porque a linha `set` falhou). Sintoma: o `.bat` "quase" corre mas com comandos comidos. Detectar: `od -c x.bat | head` (procurar `\n` sem `\r`). Fix: reconverter SÓ os `.bat`/`.cmd` para CRLF — `sed -i 's/\r*$/\r/' x.bat` (idempotente). NÃO converter `.sh`/`.command` (devem ficar LF para macOS/Linux). Preferir editar `.bat` com Edit (preserva CRLF) a `sed -i`.
- **NUNCA arrancar um servidor numa porta já ocupada — verificar ANTES de iniciar.** Em Windows dois processos node PODEM bind à *mesma* porta por famílias diferentes: o 1º agarra `127.0.0.1` (IPv4), o 2º agarra `::` (IPv6) → os pedidos batem ora num ora noutro → **estado dividido** (UI "marada", chat/projectos inconsistentes). Sintoma: `Get-NetTCPConnection -LocalPort <p> -State Listen` devolve **2** linhas (PIDs diferentes). Portas reservadas: **JOCA_UI 7371/7372**, **JOCA_OS 7381/7382**. Regra: antes de `node dist/server.js`/`vite`/`start.bat`, correr `Get-NetTCPConnection -LocalPort <p> -State Listen` — se houver listener, **parar primeiro** (`stop.bat` ou `taskkill /F /T /PID`), só depois arrancar. Nunca relançar um backend enquanto o `start.bat` do user pode estar a correr (e vice-versa). Para recuperar: matar TODOS os PIDs da porta (IPv4+IPv6), rebuild, arrancar **um** só.
- **`__dirname` de módulos aninhados — paths de dados partilhados via constante exportada, não `../../`.** Um módulo em `src/sub/x.ts` (→ `dist/sub/x.js`) resolve `__dirname/../../data` para um directório DIFERENTE de um módulo em `src/y.ts` (→ `dist/y.js`) — um nível de profundidade a mais. Bug silencioso: dois módulos a ler/escrever pastas de dados distintas (ex.: memória escrita em `backend/data` enquanto o resto usa `JOCA_OS/data`). Fix: **exportar `DATA_DIR` de um único módulo e importá-lo**; nunca recomputar o path de dados com `../../` em cada ficheiro.
- **Renomear/mover a pasta-raiz do projecto** — NÃO se faz de dentro do Claude: o cwd do próprio processo Claude (e dos shells persistentes) segura o directório → `Permission denied`/`Sharing violation` no `git mv`/`move`. Padrão: (1) actualizar TODAS as refs in-session por `sed`/Edit — ficheiros *internos* são graváveis, só o *rename do dir* bloqueia; (2) parar apps que leem a pasta (libertar handles); (3) deixar um `.bat` (`cd /d %~dp0` + `git mv old new`) que o user corre **com o Claude fechado**; (4) reabrir o Claude na pasta nova. Preferir `git mv` (preserva história) com fallback `move`.

## Plugins Claude Code

Gerir por CLI, não só pelo `/plugin` TUI interactivo:
```bash
claude plugin marketplace add <repo>
claude plugin install <plugin>@<marketplace>
```
Plugins de marketplace são sempre **user-scope** → custo always-on em todas as sessões.

## Browser (Playwright) no main loop

O MCP playwright pode estar **totalmente ausente** — não só "só sub-agentes". Pode falhar silenciosamente no boot do MCP se `npx playwright install` não tiver sido corrido na sessão. Não assumir disponível em lado nenhum.
Fallback canónico quando playwright não está disponível:
1. **Windows:** `Start-Process "<url>"` para abrir no browser do SO.
2. Verificação programática: `tsc --noEmit` + output do bundler (vite/next build) como proxy.
3. Confirmação visual: pedir ao user "podes confirmar que X aparece no browser?".
Nunca reportar "não consigo verificar" sem primeiro tentar o fallback. Não redirigir para sub-agente se o sub-agente também não tem playwright.

## Vite no HOST, não no container Sail (Windows)

Em projectos Laravel Sail + Vite no Windows: **Vite corre sempre no HOST** (PowerShell/terminal local), nunca dentro do container Sail. Razões:
- `node_modules/` tem binários nativos da plataforma do `npm install` — se instalado no host Windows, os binários não correm no container Linux Alpine.
- `docker-proxy` segura a porta mapeada (ex.: `:5173`) mesmo sem processo dentro do container → o Vite do host usa `:5174` (auto-increment).
Regra: `npm run dev` no PowerShell do host; nunca `sail npm run dev` a não ser que `node_modules/` tenha sido instalado dentro do container.

## robocopy /XD — sempre caminho absoluto

`robocopy /XD <nome>` exclui pastas por nome em **QUALQUER nível** da árvore, não só no nível raiz. Excluir `models` remove também `pip/_internal/models/` → pip partido (`No module named 'pip._internal.models'`).
Regra: usar **sempre caminho absoluto** com `/XD`:
```
robocopy src dst /E /XD "C:\abs\path\to\models" "C:\abs\path\to\output"
```
Nunca usar o nome nu (`/XD models`) em trees que contenham pacotes Python ou node_modules.

## ComfyUI portable — python embeddable sem .lib/Include

ComfyUI portable (python embeddable) NÃO traz `libs/python3XX.lib` nem `Include/`. JITs que compilam C (triton-tcc, alguns CUDA custom nodes) falham com `returned non-zero exit status 1`.
Fix — descarregar os headers/lib via nuget:
```powershell
$ver = "3.13.2"  # versão exacta do python_embeded
$url = "https://api.nuget.org/v3-flatcontainer/python/$ver/python.$ver.nupkg"
Invoke-WebRequest $url -OutFile python_pkg.zip
Expand-Archive python_pkg.zip python_pkg
Copy-Item python_pkg/tools/libs/python313.lib python_embeded/libs/
Copy-Item -Recurse python_pkg/tools/include/* python_embeded/Include/
```
⚠ Windows: `flash_attn` não tem wheel prático → usar backend `sdpa` (torch nativo). `xformers` só se existir wheel para o torch exacto instalado.

## SDK externo — verificar types do .d.ts, não da doc

Ao escrever código contra um SDK externo (ex.: `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`), **ler os `.d.ts` instalados** como fonte de verdade antes de escrever código:
```bash
cat node_modules/@anthropic-ai/claude-agent-sdk/dist/*.d.ts | head -100
```
Doc online pode estar desactualizada; `.d.ts` reflecte o pacote instalado. `tsc`/`build` passam com uma opção de API errada que só rebenta em runtime.

## Plugin marketplace — SSH → HTTPS rewrite

`claude plugin marketplace add` usa SSH para clonar do GitHub por defeito. Em Windows sem chave SSH configurada para GitHub, falha com `Permission denied (publickey)`.
Fix (idempotente, não destrutivo):
```bash
git config --global url."https://github.com/".insteadOf "git@github.com:"
```
⚠ Este config global afecta todos os `git clone` por SSH do GitHub → remover depois se indesejável: `git config --global --unset url."https://github.com/".insteadOf`.

## Asset readiness

Um plano que depende de **propriedades visuais** de assets (vídeo sem watermark, hook ao seg. 0, imagem limpa) não é verificável pelo nome do ficheiro. Antes de declarar "pronto a publicar", amostrar frames via `gemini-brain`/`watch`. Ficheiro existir ≠ ficheiro pronto.
