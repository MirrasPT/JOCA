# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Toolkit centralizado de skills, agentes, memoria e comandos para Claude Code — com interface visual browser integrada. Instala uma vez, usa em qualquer projecto. macOS e Windows.

**Problema que resolve:** cada projecto novo recomeca do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA e a camada persistente que vive acima dos projectos.

---

## Arquitectura

```
JOCA/
├── install.md               <- bootstrap (maquina nova)
├── update.md                <- guia de actualizacao
├── JOCA_Brain/              <- Motor Agenctico
│   ├── CLAUDE.md            <- comportamento base
│   ├── memory/
│   │   ├── INDEX.md         <- catalogo de componentes
│   │   ├── soul.md          <- personalidade calibravel
│   │   ├── SKILL_INDEX.json <- indice lazy-loading
│   │   ├── projects/        <- estado por projecto (/save)
│   │   ├── feedback/        <- sessoes de feedback (capturado pelo /save)
│   │   └── tools/           <- graphify, MCP routing
│   └── .claude/
│       ├── commands/        <- 25 comandos (/install, /save, /goal, /know, /upgrade-joca, ...)
│       ├── agents/          <- 101 agentes (tester-*, debug, research, media, orquestração, ...)
│       ├── skills/          <- 131 skills flat — triggers declarativos, on-demand loading
│       ├── rules/           <- 8 directivas globais (task-intake, chaining, pipelines, testing, ...)
│       ├── reference/       <- referencia densa, carregada on-demand (nao vive em contexto)
│       ├── hooks/           <- Node.js cross-platform (track-changes, auto-test, task-intake)
│       └── scripts/         <- statusline, compile-bridges, build-skill-index
│
└── JOCA_OS/                 <- Interface: terminais multi-sessao + automacoes/tarefas
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- estado local (projectos, definicoes, tarefas) — nunca commitado
    ├── start.sh / start.bat <- launchers cross-platform
    └── stop.sh / stop.bat   <- stop scripts
```

**257 componentes:** 131 skills + 101 agents + 25 commands.

---

## JOCA_OS — Interface Visual

Um dashboard browser com terminais Claude Code multi-sessao, file browser, toolkit panel e rate
limits em tempo real — com automacoes e um quadro de tarefas que correm sozinhos em workers
dedicados, sem precisares de estar a olhar.

### Automacoes + Tarefas — trabalho em background

- **Automacoes:** cria por formulario, corre em cron (diario/semanal/intervalo); cada automacao abre um worker dedicado (terminal real), executa a ordem e o worker fica aberto com o resultado — recebes uma notificacao no fim
- **Tarefas / Kanban:** quadro de 5 colunas (A Definir → A Executar → Em Execucao → Concluida → Arquivada); as tarefas movem-se sozinhas pelo quadro conforme o trabalho avanca
- **Um worker por projecto:** tarefas do mesmo projecto correm em SEQUENCIA no mesmo worker (nunca em paralelo — nao se pisam); o worker carrega o contexto do projecto (`/resume` da pasta) antes da primeira tarefa
- **Supervisao silenciosa:** um juiz SDK (sem ferramentas) classifica cada execucao — ok, erro, ou bloqueada numa pergunta; nesse caso recebes uma notificacao para ir responder ao terminal e a fila espera por ti
- **Workers visiveis:** cada worker e um terminal PTY real que podes ler e assumir a qualquer momento — nao ha caixa preta

### A Sala — os gestores discutem entre si

Um chat de grupo onde estás tu, o gestor global e os gestores de cada projecto, todos na mesma
conversa. Serve para o que os chats privados não resolvem: decisões que atravessam projectos,
verificações cruzadas ("confirma com o gestor do X se isto ainda bate certo"), e reaproveitamento
de trabalho entre projectos.

- **Escolhes quem responde** por chips no compositor — o gestor global e/ou projectos concretos
- **Os agentes chamam-se uns aos outros** com `@etiqueta`: quem for mencionado responde a seguir,
  já a ver o que o anterior disse. Não é uma ronda de respostas — é um debate com várias voltas
- **Fecha sozinho:** quando o assunto está resolvido alguém escreve `RESOLVIDO: <decisão>` e não
  passa a palavra. Travões duros para o caso de não convergir (16 turnos no total, 5 por gestor)
- **Cada gestor traz as ferramentas dele** — pode ir mesmo ver o projecto antes de afirmar
- **Identidade visual:** cada gestor aparece com o nome e o ícone do seu projecto; tu configuras o
  teu nome e avatar num mini-perfil

> Custo: uma discussão longa são dezenas de chamadas ao modelo e pode abrir workers reais nos
> projectos. Os limites vivem no topo de `JOCA_OS/backend/src/manager/room.ts`.

### Temas de marca — o JOCA com a cara que quiseres

Selector em Definições → Tema. Muda **nome, logo e cores** da interface; nada mais. O cérebro, a
memória e o trabalho ficam exactamente iguais — é só aparência.

Vêm cinco: **JOCA** (o original), **Alfredo**, **K.I.T.T.**, **R2-D2** e **HAL 9000**. Cada tema
traz modo claro **e** escuro (eixo independente do selector claro/escuro/dinâmico), e troca também
o favicon do separador. Quando o tema muda, o gestor global passa a chamar-se pelo nome do tema em
toda a interface.

> Os logos que acompanham os temas não-JOCA são arte de terceiros, incluída para uso local. Quem
> publicar um fork deve substituí-los.

### Interface

- **Terminal multi-sessao:** cada sessao corre Claude Code real via node-pty (scrollback 2M linhas, buffer 5MB por sessao, cap 30 sessoes simultaneas)
- **File preview:** janela redimensionavel com drag, suporta codigo (highlight.js), markdown, HTML (iframe sandbox), PDF, imagens, audio, video — focus trap + ARIA dialog
- **Slash command autocomplete:** `/` abre dropdown de comandos, skills e agentes com combobox ARIA + filtragem
- **Rate limits dashboard:** Claude (context, 5h, 7d, Sonnet via OAuth + Keychain), Codex (SQLite), Gemini (agy statusline)
- **Dashboard:** projectos, sessoes activas, JOCA_Brain engine status, rate limits multi-CLI
- **Toolkit panel:** browse/search/edit dos 257 componentes do JOCA_Brain
- **File browser:** filesystem real com dotfiles toggle, window-focus refresh, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), conexoes
- **Agentes rapidos na barra:** as sessoes sem projecto aparecem no topo da barra lateral, com
  acesso directo, renome por duplo-clique e fecho — sem passar pela vista global de Agentes
- **Sidebars colapsaveis:** left rail (62px) e right rail (54px) com animacoes suaves (280ms ease-out-quart)
- **Cross-platform:** macOS (zsh) e Windows (PowerShell) — deteccao automatica de OS

O JOCA_OS detecta automaticamente o `JOCA_Brain` como directorio irmao — zero configuracao.

### Seguranca (local-only, single-user)

O `JOCA_OS` corre apenas em `127.0.0.1` e implementa hardening defense-in-depth contra tabs de browser maliciosos:

- **Origin guard:** middleware HTTP rejeita mutacoes (POST/PATCH/DELETE) de origens non-loopback; WebSocket usa `verifyClient` para rejeitar pre-handshake (HTTP 401)
- **Path safety:** helper unico `safePath()` aplicado a todas as rotas FS — resolve symlinks via `fs.realpathSync.native()`, refusa HOME root, e bloqueia subdirs sensitive (`.ssh`, `.gnupg`, `.aws`, `.kube`, `.config/gh`, `.gitconfig`, `.env`, `.zshrc`, `Library/Keychains`, etc)
- **Write/rename:** `O_EXCL` (openSync `wx`) + `lstat` recusam symlink targets; refusa `nlink > 1` (hardlink → ficheiros sensitive)
- **`/open`:** allowlist de extensoes seguras (docs/media) + check de bit executavel + `stat.isFile()` (rejeita FIFO/socket/device)
- **`/file-content`:** SVG com CSP `sandbox`; HTML serve `Content-Disposition: attachment` excepto quando `Sec-Fetch-Dest: empty` (fetch/XHR); `nosniff` global
- **PTY:** `resumePath` validado por allowlist Unicode (`\p{L}\p{N}`); cap de 30 sessoes simultaneas; resize bounds (cols 10-500, rows 5-200)
- **FilePreview iframe:** sandbox sem `allow-same-origin` para HTML, `tabIndex={-1}` para conter focus trap, focus-bounce em mouse-click
- **OAuth:** statusline usa `https` nativo (sem shell), token validado por regex antes de Bearer injection, cache em `tmpdir` com mode `0600`

> Modelo de ameaca: machine compromise = jogo over (qualquer ferramenta dev cai). Mas em uso solo normal + tabs random no mesmo browser, o JOCA_OS esta hardened a um nivel equivalente ao Vite dev server / Storybook.

### Modo remoto (VPS) — opt-in com auth obrigatoria

Para correr o JOCA numa VPS e aceder do telemovel (PWA instalavel):

```bash
JOCA_PASSWORD='uma-password-forte' JOCA_HOST=0.0.0.0 npm start
```

- **Auth obrigatoria:** `JOCA_HOST` fora de loopback recusa arrancar sem password (env `JOCA_PASSWORD` ou definida na UI local antes do deploy). Login emite token de 30 dias (cookie httpOnly + Bearer); 5 falhas = lockout 30s
- **TLS:** termina no reverse proxy (Caddy/nginx) ou usa rede privada (Tailscale/WireGuard) — nunca expor http puro a internet
- **Origens:** same-origin verificado por default; origens extra via `JOCA_ALLOWED_ORIGINS=https://joca.exemplo.com`
- **PWA:** abre o link no telemovel e "Adicionar ao ecra principal" — o JOCA instala como app

### Heartbeat, inbox e historico de runs

- **Heartbeat** (Settings → 💓): a cada N minutos, dentro do horario activo, o JOCA le a tua checklist (scratch) + o estado do sistema (tarefas bloqueadas, erros, fila) e decide se te avisa. Sem nada a reportar responde `HEARTBEAT_OK` e fica calado; sem checklist e sem anomalias nem gasta tokens
- **Inbox persistente:** todas as notificacoes (automacoes, perguntas de tarefas, heartbeat, erros) ficam guardadas — fechar a tab ja nao perde nada
- **Historico de runs:** cada execucao de automacao/tarefa/heartbeat fica em `data/runs.jsonl` com duracao, estado e custo SDK; totais em Automacoes → Historico
- **Multi-CLI:** sessoes, tarefas e automacoes podem correr Claude Code (default), Codex CLI, Antigravity ou OpenCode — com modelo configuravel por execucao
- **Os gestores escolhem o CLI:** ao despachar trabalho, um gestor pode abrir o worker em `agy`
  (vídeo, segunda opinião de design) ou `codex` (geração de imagem, revisão independente) em vez do
  default — decide pela natureza do trabalho, sem tu pedires
- **Modelo dos gestores configuravel** (Definições → Modelo dos gestores): Haiku/Sonnet/Opus, com
  escolha separada para o gestor global e para os gestores de projecto. Aplica-se ao turno seguinte,
  sem reiniciar. Só modelos do Agent SDK — trocar de modelo nunca tira ferramentas ao gestor

---

## Inicio rapido

### Maquina nova — bootstrap completo

Cola no Claude Code:

```
Le o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md e segue as instrucoes.
```

O assistente clona o repo, configura identidade, personalidade (soul), skills, CLIs e instala o JOCA_OS.

### Iniciar a interface

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```

Abre automaticamente `http://localhost:7492`.

### Actualizar o JOCA

**Opcao 1 — Comando (dentro de uma sessao JOCA):**
```
/update-joca
```

**Opcao 2 — Prompt directo (se o comando falhar ou JOCA nao estiver configurado):**
```
Le o ficheiro update.md em https://raw.githubusercontent.com/MirrasPT/JOCA/main/update.md e segue as instrucoes.
```

Sync one-way do GitHub. Protege memoria de projectos, feedback, soul calibration, componentes
locais (`origin: local`) e todo o estado do JOCA_OS em `JOCA_OS/data/` — projectos, definicoes
(tema, modelos), tarefas, automacoes, historico da Sala e chats dos gestores.

**Depois de actualizar, se mexeu no JOCA_OS:**

```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
bash JOCA_OS/stop.sh && bash JOCA_OS/start.sh   # Windows: stop.bat / start.bat
```

Duas coisas que se esquecem e dao "o update nao fez nada":
- o **frontend precisa de `npm run build`** — o backend serve `frontend/dist/`, portanto sem build
  a interface fica na versao anterior mesmo com os ficheiros novos no disco;
- o **backend corre o build compilado, sem watch** — so ganha as alteracoes ao reiniciar, e o
  reinicio **mata os agentes e terminais vivos**. Fecha o que estiveres a correr primeiro.

### Melhorar o JOCA

```
/upgrade-joca
```

Le feedback acumulado, pesquisa best practices com `deep-research`, melhora skills com `skill-improver` + `skill-evaluator` loop, valida com Codex review.

### Sessao de trabalho

```
/resume          <- inicio de sessao
/save            <- fim de sessao (auto-feedback incluido)
/init-project    <- ligar projecto novo
```

---

## Skills (131)

Activadas on-demand com sistema de triggers RFC 2119 (`MUST be invoked when...`, `SHOULD also invoke when...`). Activacao automatica quando relevancia >= 60%. (Lista parcial — inventario completo em `JOCA_Brain/memory/SKILL_INDEX.json`.)

### Base
`caveman` · `karpathy-guidelines` · `agent-context` · `plan` · `planning` · `prd` · `create-skill` · `pt-pt-translator` · `browser-automate` · `joca-terminal`

### Design
`frontend` · `mobile` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-system` · `design-tokens` · `component-system` · `html-review`

### Dev
`laravel-specialist` · `filament` · `mysql` · `rest-api` · `saas-patterns` · `file-storage` · `reverb-realtime` · `auth` · `transactional-email` · `postmark` · `error-tracking-dev` · `error-tracking-prod` · `search` · `queues` · `bullmq` · `webhooks` · `caching` · `availability` · `security` · `horizon`

### DevOps
`deploy-cpanel` · `deploy-docker` · `deploy-ploi` · `deploy-vps` · `cloudflare-dns` · `cpanel` · `selfhosted-arr` · `github`

### Marketing
`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `content-calendar` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `lead-capture` · `competitor-profiling` · `landing-page` · `marketing`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video & Media
`video` · `hyperframes` · `remotion` · `lyric-align` · `site-capture` · `html-to-pdf`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-interactivity-api` · `wp-abilities-api` · `wpds` · `blueprint`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Architecture & Docs
`rfc` · `adr` · `tech-spec` · `task-breakdown` · `c4-diagram`

---

## Agents (101)

Agentes correm em sub-processos isolados, em paralelo. (Lista parcial — inventario completo em `JOCA_Brain/.claude/agents/`.)

### Review & Testing
`tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` · `design-system-audit`

### Debug
`log-debugger` · `query-debugger`

### Search & Analysis
`deep-research` · `seo-analyst` · `dependency-auditor`

### Orchestration
`master-orchestrator` · `self-improver` · `gemini-auditor`

### Generation & Media
`img-gen-openai` · `img-gen-google` · `video-gen` · `watch` · `gemini-brain`

### Specialists
`payment-integration` · `skill-evaluator` · `skill-improver` · `security-review`

### Execucao (65, gerados das skills)
Cada skill que **produz artefactos** tem um agente gemeo `<skill>-agent` que le a skill como Step 0
— mesma doutrina, contexto proprio. Existem para poder correr varios trabalhos ao mesmo tempo sem
ocupar a conversa principal: `tailwind-agent`, `laravel-specialist-agent`, `copywriting-agent`,
`deploy-vps-agent`, `wp-block-development-agent`, `shopify-app-agent`, ...

Nao sao copias: a skill continua a ser a fonte de verdade e edita-la actualiza os dois.
Regenerar: `node JOCA_Brain/.claude/scripts/skill-agents.mjs` (lista curada no topo do script).

**Quando despachar em vez de ler a skill inline:** a partir de **2 partes independentes** no pedido.
Uma parte so → ler a skill e fazer inline sai mais barato. Ver `rules/task-intake.md`.

---

## Commands (25)

Lista parcial — inventario completo em `JOCA_Brain/.claude/commands/`.

| Command | Funcao |
|---------|--------|
| `/install` | Setup interactivo — identidade, soul, skills, CLIs, statusline, JOCA_OS |
| `/init-project` | Liga um projecto ao JOCA (PRD, skills, CLIs) |
| `/resume` | Carrega contexto no inicio da sessao |
| `/save` | Guarda estado + feedback projecto + feedback toolkit (auto) |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/one-shot` | Dev autonomo: PRD -> orchestrator -> parallel -> tests |
| `/build-plan` | Build supervisionado por fases: plano em docs -> tasks -> loop com gate de testes |
| `/create-skill` | Pipeline: research -> draft -> evaluate -> iterate |
| `/upgrade-joca` | Self-improvement: research -> plan -> execute -> validate |
| `/update-joca` | Sync com GitHub (protege local, rebuild UI) |
| `/migrate` | Migracao v1-legacy -> v2.0 |
| `/wp-perf-review` | Code review WordPress |
| `/wp-perf` | Quick triage WordPress |
| `/status` | Rate limits, contexto e modelo em uso |
| `/help-joca` | Referencia rapida |

---

## Pipelines

Sequencias pre-definidas activadas automaticamente:

| Workflow | Sequencia |
|----------|-----------|
| Nova feature Laravel | `plan` -> `laravel-specialist` -> `tester-code` -> `tester-api` |
| SaaS / multi-tenant | `plan` -> `saas-patterns` -> `laravel-specialist` -> `tester-security` |
| Frontend | `frontend` -> `tester-ui-ux` -> `tester-performance` |
| One-shot | `master-orchestrator` -> parallel agents -> `tester-*` (auto) |
| Debug | `log-debugger` -> `query-debugger` (se SQL) |
| Self-improvement | `/save` (captura gaps) -> `/upgrade-joca` -> `deep-research` + `skill-evaluator` loop |
| Nova skill | `deep-research` -> `skill-improver` -> `skill-evaluator` (8.0/10 threshold) |

---

## Cross-CLI Bridge

O JOCA funciona com 3 CLIs. Source of truth: `.claude/` — compilado para formatos externos:

| CLI | Bridge |
|-----|--------|
| Claude Code | `.claude/` (nativo) |
| Codex CLI | `.agents/skills/` + `.codex/agents/` |
| Antigravity (agy) | `GEMINI.md` + `AGENTS.md` |

```bash
bash .claude/scripts/compile-bridges.sh
```

---

## Requisitos

- **Claude Code** instalado e autenticado
- **Node.js 18+** (para JOCA_OS e hooks cross-platform)
- **macOS** ou **Windows** (Linux experimental)
- **gh CLI** (GitHub — `winget install GitHub.cli` / `brew install gh`)
- Opcional: Python 3.10+ (graphify), Codex CLI, Antigravity CLI (agy), browser-use CLI, playwright-cli, sentry-cli, ffmpeg, gws, zmail-cli (Java 11+)

---

## Creditos

Skills e agentes construidos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](JOCA_Brain/CREDITOS.md).

---

**Repositorio:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licenca dos componentes individuais pertence aos autores originais. JOCA como sistema de integracao: MIT.
