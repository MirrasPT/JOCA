# Workflows & Tooling

Gotchas recorrentes em workflows multi-agente e ambiente local. **Carregado on-demand** (`Read()`), NÃO em todas as sessões — o pointer auto-carregado é `rules/workflows-and-tooling.md`. Terso por design.

---

## Briefs de sub-agentes (Agent / Workflow)

Cada brief de worker DEVE carregar explicitamente:
- **Anti-fabricação** — credencial/endpoint/key em falta → no-auth source ou `TODO: credencial em falta` + reportar. Nunca inventar (ver `soul.md`).
- **Verificar parsers contra resposta real** — quem escreve cliente de API externa faz 1 chamada real e valida o parsing antes de finalizar (ver `api-design.md`).
- **Validar CONTEÚDO contra a fonte real (não só código).** Um worker que escreve conteúdo a partir de um site/documento (prémios, notícias, specs, copy) DEVE validar cada bloco contra a fonte e marcar `TODO: não consta da fonte` o que não existir — por defeito, não só quando o user pede comparação. A regra anti-fabricação aplica-se a conteúdo, não apenas a APIs/credenciais; sem este passo no brief, workers inventam conteúdo plausível que só é apanhado por auditoria explícita. (Fonte: projecto de e-commerce de cliente, 2026-06-24.) **Estende-se a ELEMENTOS VISUAIS de brand:** ao iterar sobre um design a partir de referências, NÃO inventar elementos não presentes nas refs (barras, labels, watermarks, badges, slogans). Se não está visível na referência → não existe. (Fonte: projecto de social media de cliente, 2026-06-26 — inventou barra lateral + labels de brand nunca presentes nas refs.)
- **Componentes partilhados antes do fan-out** — em builds paralelos por página/feature, definir player/card/layout numa fase de fundação sequencial; agentes de fan-out IMPORTAM, não recriam (ver `frontend.md`).
- **Convenções do JOCA em briefs que mexem no próprio JOCA** — agente que escreve validador/linter/script sobre o JOCA recebe as convenções no brief, não as infere: `name:` do frontmatter é descritivo e ≠ ficheiro de propósito (ex.: `horizon`→`horizon-queues`); o campo `skills:` no frontmatter NÃO carrega skill (garantia = `Read()` no corpo); skills flat depth 1. Fonte: `CLAUDE.md` + `docs/ARQUITECTURA.md`. (Lição: um linter escrito sem isto marcou 3 skills válidas como FAIL.)

Sub-agentes **não herdam** `soul.md` automaticamente — só recebem o brief. Por isso estas regras vão no brief, não se assumem.

## Workflow tool

- **`args` não-fiável** — dados passados em `args` podem chegar `undefined` ao script. Embeber dados como literais no script, ou validar `args` no arranque com erro claro antes de usar.
- **Verify adversarial sem falsos positivos** — passar ao verificador o conjunto exacto de ficheiros/linhas DESTA tarefa (ou commitar por fase). Caso contrário o review estático sobre o `git diff` cumulativo marca trabalho anterior aprovado como "scope creep".
- **Git destrutivo ≠ workflow** — sequência determinística não-paralelizável → usar script versionado. Workflow é bom para fan-out (auditoria, research, drafting).
- **Gate de lint/testes: MEDIR o baseline, nunca hardcode.** Um gate com `LINT_BASE` constante fica desactualizado (vivido: constante 24, baseline real do HEAD 33 → gate `pass=false` e **3 iterações de reparação inúteis** a tentar baixar lint que já era baseline). Medir no arranque do workflow: `git stash` → `npm run lint` → contar → `git stash pop`; a regressão é `atual − baseline_medido`.
- **Agente que falha só o StructuredOutput ≠ agente que morreu.** Sintoma: o stream devolve `null` ("retry cap (5) exceeded — 5 failed calls with no valid output") mas os ficheiros estão TODOS escritos e a compilar (vivido: 249+418 linhas + 4 endpoints dados como perdidos). Antes de re-correr o stream, **verificar o disco** (`git status`/`ls` dos ficheiros esperados). Mitigar na origem: schemas de retorno com poucos `required`, e pedir o resumo estruturado antes do trabalho pesado saturar o contexto.
- **Revisão por leitura ≠ verificação em execução.** Revisores adversariais podem dar 9/10 e mesmo assim deixar passar defeitos triviais que só um smoke test apanha (vivido: assets em falta + coluna sem privilégio `ALTER`, ambos invisíveis à leitura). Pipeline que acaba em deploy leva uma fase **pós-deploy** de verificação end-to-end (HTTP real + estado da BD), separada da revisão de código.
- **Upgrades grandes do próprio JOCA = 2 fases** (padrão validado): Fase 1 = workflow de análise → escreve plano + drafts em staging (`_improvement/`), não toca canónicos. Fase 2 = aplicação: ficheiros independentes (skills/agentes/hooks novos) via workflow paralelo; ficheiros canónicos partilhados (`CLAUDE.md`, `soul.md`, `settings.json`) via main loop sequencial (anti-clobber). Verificar hooks com `node` antes de confiar.

## Ambiente local (Windows-first)

O ambiente primário é **Windows**. Ao escrever scripts/skills que tocam credenciais, binários ou paths:
- **`python`, não `python3`** — no **PowerShell/cmd** o `python3` é o stub vazio da Microsoft Store (`ModuleNotFoundError`). ⚠ **No Git Bash o `python3` pode resolver para um Python real** — o aviso não é universal, e tratá-lo como universal gera falso alarme (vivido: previsto que a purga Cloudflare de um `deploy-staging.sh` ia falhar por chamar `python3`; correu bem, `purge success: True`). Detectar em vez de assumir: `for PY in python python3; do command -v "$PY" && "$PY" -c "import <mod>" && break; done`.
- **O `/tmp` do Git Bash NÃO é visível ao Python nativo do Windows.** Um script misto Bash→`/tmp`→Python vê ficheiros inexistentes, devolve listas vazias e **trunca o destino** ao reescrever (vivido: `runs.jsonl` truncado; só se salvou porque os blobs ainda estavam no índice do git). Usar um path que ambos vêem (o scratchpad da sessão). E ao reescrever um ficheiro a partir de dados lidos, **falhar** em vez de escrever vazio quando a leitura devolve 0 registos.
- **`tar` com drive-letter → `--force-local`.** No Git Bash, `tar czf x.tgz C:/algo` trata `C:` como host remoto (rmt) → `Cannot connect to C: resolve failed` / `Broken pipe`. Usar `tar --force-local`.
- **Não fazer `find` recursivo em drives de cloud sync** (`G:` Google Drive File Stream, `D:\Mega`) — o File Stream materializa cada pasta ao percorrê-la e o `find -iname`/`-mtime` estoura o timeout de 2 min do Bash (vivido 2×, uma delas ficou em background a correr para nada). Navegar por paths conhecidos com `ls` direccionado.
- **Porta a responder ≠ o teu processo.** Depois de reiniciar um servidor, confirmar que o PID em LISTEN é o **novo** (`Get-NetTCPConnection -LocalPort <p> -State Listen | Select OwningProcess` + contar instâncias) — senão testa-se o build **anterior** sem dar por isso (vivido, com `EADDRINUSE` repetido a mascarar a instância velha). Complementa o double-bind IPv4+IPv6 abaixo.
- **Caracteres de controlo literais partem Write/Edit/Workflow.** Escrever os bytes reais numa classe de regex (`[\x00-\x20\x7f]`) torna o ficheiro "binário": o `grep` recusa mostrar, o `Edit` deixa de casar strings, e o validador do Workflow rejeita o script. Preferir comparação por code point. ⚠ **CRLF num script de Workflow dá o MESMO erro enganador** ("control characters") — verificar line endings antes de caçar regex.
- **Rasterizar PDF sem poppler** — o Read tool falha em PDF sem poppler e `fitz`/`poppler` não estão instalados nesta máquina. Usar `pypdfium2`: `pdf[i].render(scale=…).to_pil()`.
- **Credenciais** — Claude em `~/.claude/.credentials.json` (não Keychain macOS); Codex sem binário `sqlite3` → usar `node:sqlite`.
- **Detecção de processo local** — filtrar `Name='python.exe'` + `CommandLine -like '*main.py*'`. NUNCA incluir o nome único da app no filtro `Win32_Process` — a própria pwsh que corre a query contém essa string (falso positivo "loop de reinício").
- **Matar servidores por porta** — `taskkill /F /T /PID` (o `/T` mata a árvore; vite/esbuild children seguram a porta).
- **`$PID` é read-only no PowerShell** — variável automática reservada. Num loop `taskkill` por porta, usar outro nome (`foreach ($p in $procs) { taskkill /F /T /PID $p }`); `$pid` rebenta com "Cannot overwrite variable PID".
- **`sed -i` do Git Bash strippa CR de ficheiros `.bat`/`.cmd`** (CRLF→LF) — o cmd.exe não lê batch com LF: parte o parsing char-a-char (`setlocal`→`tlocal`, `set`→`et`) e dá erros enganadores (ex.: um `if !errorlevel! neq 0` que não expande → "build failed" FALSO mesmo com build OK; ou `LOG_DIR` herdado do env porque a linha `set` falhou). Sintoma: o `.bat` "quase" corre mas com comandos comidos. Detectar: `od -c x.bat | head` (procurar `\n` sem `\r`). Fix: reconverter SÓ os `.bat`/`.cmd` para CRLF — `sed -i 's/\r*$/\r/' x.bat` (idempotente). NÃO converter `.sh`/`.command` (devem ficar LF para macOS/Linux). Preferir editar `.bat` com Edit (preserva CRLF) a `sed -i`.
- **NUNCA arrancar um servidor numa porta já ocupada — verificar ANTES de iniciar.** Em Windows dois processos node PODEM bind à *mesma* porta por famílias diferentes: o 1º agarra `127.0.0.1` (IPv4), o 2º agarra `::` (IPv6) → os pedidos batem ora num ora noutro → **estado dividido** (UI "marada", chat/projectos inconsistentes). Sintoma: `Get-NetTCPConnection -LocalPort <p> -State Listen` devolve **2** linhas (PIDs diferentes). Portas reservadas: **JOCA_OS 7491 (backend) / 7492 (frontend)** — as mesmas nas duas instalacoes, logo **nunca correm ao mesmo tempo**: para uma antes de arrancar a outra, ou passa portas por `JOCA_BACKEND_PORT`/`JOCA_FRONTEND_PORT`. Regra: antes de `node dist/server.js`/`vite`/`start.bat`, correr `Get-NetTCPConnection -LocalPort <p> -State Listen` — se houver listener, **parar primeiro** (`stop.bat` ou `taskkill /F /T /PID`), só depois arrancar. Nunca relançar um backend enquanto o `start.bat` do user pode estar a correr (e vice-versa). Para recuperar: matar TODOS os PIDs da porta (IPv4+IPv6), rebuild, arrancar **um** só.
- **`__dirname` de módulos aninhados — paths de dados partilhados via constante exportada, não `../../`.** Um módulo em `src/sub/x.ts` (→ `dist/sub/x.js`) resolve `__dirname/../../data` para um directório DIFERENTE de um módulo em `src/y.ts` (→ `dist/y.js`) — um nível de profundidade a mais. Bug silencioso: dois módulos a ler/escrever pastas de dados distintas (ex.: memória escrita em `backend/data` enquanto o resto usa `JOCA_OS/data`). Fix: **exportar `DATA_DIR` de um único módulo e importá-lo**; nunca recomputar o path de dados com `../../` em cada ficheiro. **Quando o consumidor do data-dir é um subprocesso/bridge externo** (ex.: `.mjs` standalone executada por outro processo, que NÃO pode importar o módulo TS compilado): o **processo-pai PASSA o caminho absoluto** (computado da fonte-única `DATA_DIR`) por **argv/env**; o filho lê de lá e **falha alto** (stderr + exit≠0) se faltar — nunca recomputa com `../../`. (Sintoma vivido: bridge do Codex recomputou `backend/src/master → ../../data = backend/data` enquanto o backend usa `JOCA_OS/data` → ENOENT no arranque → bridge morre → o CLI externo ficou com 0 tools e fez o trabalho ele próprio em vez de orquestrar. JOCA_OS 2026-06-25.)
- **Proxy do Vite tem de listar TODAS as rotas do backend.** Num app Vite-dev + backend separado (ex.: JOCA_OS frontend :7392 → backend :7391), um `fetch('/x')` relativo a uma rota **ausente do `server.proxy` do `vite.config`** NÃO dá erro — o dev server serve o `index.html` (SPA fallback) com **HTTP 200** → `await res.json()` rebenta a parsear HTML → o estado fica silenciosamente vazio. **Sintoma enganador:** dados "perdidos no refresh" enquanto o backend persiste bem (parece bug de persistência, é de routing). `tsc`/build passam. Fix: adicionar a rota ao `proxy` do `vite.config`. Regra: ao criar uma rota nova no backend que o frontend consome por fetch relativo, **adicionar logo ao proxy**; auditar com `grep "fetch('/" frontend/src` vs as chaves do proxy. (JOCA_OS 2026-06-25: `/master-chat` e `/roots` em falta → chat "perdia" histórico.)
- **Escrita de estado JSON em disco tem de ser ATÓMICA (temp + rename).** `fs.writeFileSync(file, json)` directo pode deixar um ficheiro **meio-escrito/"congelado"** se o processo morrer a meio (stop.bat, `taskkill /F /T`, crash) — no próximo boot o `JSON.parse` falha e um `catch { return [] }` reverte o estado **silenciosamente** ao default (parece "memória bloqueada"/dados perdidos). Fix: escrever para `file.tmp` e `fs.renameSync(tmp, file)` (rename é atómico no mesmo volume) + **logar** o erro de leitura só quando o ficheiro existe (não no first-run). Aplicar a TODO o estado persistido (projectos, memória, settings). (JOCA_OS 2026-06-25.)
- **Git Bash (MSYS) converte um argumento iniciado por `/` num path Windows.** Passar `/labels/x` a um script via Git Bash chega como `C:/Program Files/Git/labels/x` (prefixo lixo) — bug silencioso (ex.: `src` na BD com prefixo errado → "imagens desapareceram"). Fix: `MSYS_NO_PATHCONV=1 <cmd>`, ou correr via PowerShell, ou no script normalizar pelo segmento conhecido (`p.slice(p.indexOf('/labels/'))`). (Fonte: app local de geração de rótulos, 2026-06-24.)
- **Debug de discrepância de cor/render (fonte vs export): medir pixels reais ANTES de mexer no código.** Extrair pixels de ambos (PIL / canvas `getImageData`) + comparar por hash localiza onde a cor muda — fonte (CMYK→sRGB), canvas (color-management do Chrome → `createImageBitmap({colorSpaceConversion:'none'})`) ou encoder. Teorizar = ciclos perdidos. (Fonte: app local de geração de rótulos, 2026-06-24; complementa Asset readiness.)
- **Renomear/mover a pasta-raiz do projecto** — NÃO se faz de dentro do Claude: o cwd do próprio processo Claude (e dos shells persistentes) segura o directório → `Permission denied`/`Sharing violation` no `git mv`/`move`. Padrão: (1) actualizar TODAS as refs in-session por `sed`/Edit — ficheiros *internos* são graváveis, só o *rename do dir* bloqueia; (2) parar apps que leem a pasta (libertar handles); (3) deixar um `.bat` (`cd /d %~dp0` + `git mv old new`) que o user corre **com o Claude fechado**; (4) reabrir o Claude na pasta nova. Preferir `git mv` (preserva história) com fallback `move`.

- **PHP/Laravel em Windows nativo — Octane impossível, `composer install` corrompe `vendor/` silenciosamente.** (1) **Octane** (qualquer runtime, incl. FrankenPHP/RoadRunner) **NÃO corre em Windows nativo** — exige `pcntl`/`posix` (sinais POSIX inexistentes); FrankenPHP só tem binários Linux/macOS (instalador recusa Windows). Persistent-worker/multi-thread em Windows → **WSL2 ou Docker**; senão `php artisan serve` + opcache é o tecto (single-thread, pedidos serializam). (2) **`composer install` falha a criar symlinks** de alguns pacotes sem Developer Mode/admin → `vendor/` inconsistente. Com **opcache ON** isso manifesta-se como **corrupção da tabela de funções** (ex.: `mb_convert_encoding(...)` despacha para `intltz_create_default()` → `ArgumentCountError` no boot, **mascarado** por "Class config does not exist"). Diagnosticar com opcache OFF (`php -d opcache.enable=0 -d opcache.enable_cli=0`); reparar `rm -rf vendor && composer install --no-scripts --ignore-platform-req=ext-pcntl --ignore-platform-req=ext-posix` + `php -d opcache.enable_cli=0 artisan package:discover`. (3) **PHP 8.4 portátil**: JIT do opcache **segfalha** em Windows (exit 5) → manter `opcache.jit=disable`. Exemplo de ambiente (PHP portátil em Windows): `<YOUR_PHP_PATH>`. (Fonte: projecto SaaS Laravel, 2026-06-26.)
- **Escrita em massa numa BD externa com nomes duplicados — validar a real por metadados primeiro.** Bases/data-sources com o mesmo nome (ex.: cópia de backup "Save DD-MM" criada hoje + a real) são fáceis de confundir → editar a errada. Antes de escrita em massa, **distinguir por metadados** (`created_time` / `database_parent` / `id`) e **confirmar 1 linha** qual é a real. (Fonte: Notion `ntn` 2026-06-27 — editou a data source de backup em vez da real.)

## Line endings — falsos diffs entre máquinas e servidor

Trabalho em 2 máquinas (Windows + macOS) com deploys a partir de ambas → CRLF vs LF produz divergências que **não são mudanças**.
- Ao sincronizar código de um servidor (sem `.git` lá), o `md5` marca ficheiros como diferentes só por line endings (vivido: 25 ficheiros "diferentes", **7 com mudanças reais**, 18 só CRLF). Diffar com `tr -d '\r'` **antes** de concluir divergência; ao trazer ficheiros do servidor, converter para o estilo do ficheiro local antes de escrever.
- Ao comparar **builds** do mesmo commit entre plataformas: normalizar line endings primeiro. Se os chunks de **vendor** batem e os de **app** não, suspeitar de CRLF (`?raw` + `core.autocrlf`), não de código.
- Corolário de sondagem: em bundles **minificados**, a ausência de uma string NÃO prova ausência de código (comentários são removidos no build, identificadores são minificados). Toda a sonda precisa de um **controlo positivo** — "isto detecta algo que eu SEI que lá está?". Sondas HTTP também precisam de controlo negativo (o Caddy devolve 403 a tudo em `config/`, exista ou não o ficheiro). O sinal fiável é rebuildar o commit e comparar hashes.

## macOS — gotchas

- **`~/.Trash` é bloqueado pelo TCC.** `ls`/`find`/`stat` directos no Trash a partir do Terminal dão `Operation not permitted`, mesmo com o `trash` CLI a conseguir escrever lá. Para esvaziar sem exigir Full Disk Access: `osascript -e 'tell application "Finder" to empty trash'` (passa pela API do Finder, sem prompt).

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

### Outputs do MCP caem no JOCA_Brain (produção read-only)
O MCP playwright só escreve dentro dos **allowed roots** = cwd do servidor. Sob JOCA_OS o cwd é sempre `JOCA_Brain` → `.playwright-mcp/` e os `*.png` nascem **dentro da produção read-only**, e um `filename` absoluto para o scratchpad dá `File access denied` / "outside allowed roots". Padrão obrigatório: capturar → `Read` imediato → **mover para o scratchpad e apagar** `JOCA_Brain/.playwright-mcp/` + `*.png` da raiz antes de fechar a sessão.

### Recovery de lock do browser
`Browser is already in use for …ms-playwright-mcp… use --isolated` = instância stale de sessão anterior a segurar o profile lock (bloqueia `navigate`/`resize`). Fix: matar a árvore de processos chrome com `ms-playwright-mcp` na command line (macOS: `pkill -f ms-playwright-mcp`) + remover `SingletonLock` do profile; ou arrancar o servidor MCP com `--isolated`.

### QA visual — o que engana
- **`page.screenshot({fullPage:true})` desalinha elementos `position:fixed`** — aparecem a meio da página e simulam um defeito de layout que não existe. Confirmar qualquer suspeita de sobreposição com uma captura de **viewport normal** antes de a tratar como defeito.
- **`img.decode()` numa imagem `loading="lazy"` ainda não pedida NUNCA resolve** e pendura o script indefinidamente. Pôr `loading="eager"` antes de percorrer a página e correr `decode()` contra um timeout.
- **Scroll-scrub (GSAP ScrollTrigger):** medir `getComputedStyle` logo após `scrollTo` dá valores errados (o scrub tem ~1s de lag) → esperar ≥2s. E **confirmar o viewport ANTES de medir** efeitos dependentes de media query (sticky/stack desligam-se em mobile e a geometria fica sem sentido — vivido a medir um stack a 390px). Para validar a **curva** de um scrub, 3 screenshots em 3 pontos são mais fiáveis que computed style.

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

**Correr no ARRANQUE, não no fim.** Em trabalho de branding/co-branding, montar a tabela `marca · formato · vector? · transparente? · utilizável para lockup?` antes de planear. Vivido: material de marca de terceiro só existia em **JPEG com fundo sólido** — bloqueante para qualquer lockup — e só se detectou no fim do inventário.
