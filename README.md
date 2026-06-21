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
│   │   ├── feedback/        <- sessoes de feedback (/feedback-joca)
│   │   └── tools/           <- graphify, MCP routing
│   └── .claude/
│       ├── commands/        <- 20 comandos (/install, /save, /upgrade-joca, ...)
│       ├── agents/          <- 28 agentes (tester-*, debug, research, media, ...)
│       ├── skills/          <- 106 skills flat — RFC 2119 triggers, on-demand loading
│       ├── hooks/           <- Node.js cross-platform (track-changes, auto-test)
│       ├── rules/           <- api-design, testing
│       └── scripts/         <- statusline, compile-bridges, build-skill-index
│
└── JOCA_UI/                 <- Interface Visual (browser)
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- user data (projects, sessions, settings — protected on update)
    ├── start.sh / start.bat <- launchers cross-platform
    └── stop.sh / stop.bat   <- stop scripts
```

**154 componentes:** 106 skills + 28 agents + 20 commands.

---

## JOCA_UI — Interface Visual

Dashboard browser com terminal multi-sessao, file browser, toolkit panel e rate limits em tempo real.

- **Terminal multi-sessao:** cada sessao corre Claude Code real via node-pty (scrollback 2M linhas, buffer 5MB por sessao, cap 30 sessoes simultaneas)
- **File preview:** janela redimensionavel com drag, suporta codigo (highlight.js), markdown, HTML (iframe sandbox), PDF, imagens, audio, video — focus trap + ARIA dialog
- **Slash command autocomplete:** `/` abre dropdown de comandos, skills e agentes com combobox ARIA + filtragem
- **Rate limits dashboard:** Claude (context, 5h, 7d, Sonnet via OAuth + Keychain), Codex (SQLite), Gemini (agy statusline)
- **Dashboard:** projectos, sessoes activas, JOCA_Brain engine status, rate limits multi-CLI
- **Toolkit panel:** browse/search/edit dos 135+ componentes do JOCA_Brain
- **File browser:** filesystem real com dotfiles toggle, window-focus refresh, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), conexoes
- **Sidebars colapsaveis:** left rail (62px) e right rail (54px) com animacoes suaves (280ms ease-out-quart)
- **Cross-platform:** macOS (zsh) e Windows (PowerShell) — deteccao automatica de OS

O JOCA_UI detecta automaticamente o `JOCA_Brain` como directorio irmao — zero configuracao.

### Seguranca (local-only, single-user)

O `JOCA_UI` corre apenas em `127.0.0.1` e implementa hardening defense-in-depth contra tabs de browser maliciosos:

- **Origin guard:** middleware HTTP rejeita mutacoes (POST/PATCH/DELETE) de origens non-loopback; WebSocket usa `verifyClient` para rejeitar pre-handshake (HTTP 401)
- **Path safety:** helper unico `safePath()` aplicado a todas as rotas FS — resolve symlinks via `fs.realpathSync.native()`, refusa HOME root, e bloqueia subdirs sensitive (`.ssh`, `.gnupg`, `.aws`, `.kube`, `.config/gh`, `.gitconfig`, `.env`, `.zshrc`, `Library/Keychains`, etc)
- **Write/rename:** `O_EXCL` (openSync `wx`) + `lstat` recusam symlink targets; refusa `nlink > 1` (hardlink → ficheiros sensitive)
- **`/open`:** allowlist de extensoes seguras (docs/media) + check de bit executavel + `stat.isFile()` (rejeita FIFO/socket/device)
- **`/file-content`:** SVG com CSP `sandbox`; HTML serve `Content-Disposition: attachment` excepto quando `Sec-Fetch-Dest: empty` (fetch/XHR); `nosniff` global
- **PTY:** `resumePath` validado por allowlist Unicode (`\p{L}\p{N}`); cap de 30 sessoes simultaneas; resize bounds (cols 10-500, rows 5-200)
- **FilePreview iframe:** sandbox sem `allow-same-origin` para HTML, `tabIndex={-1}` para conter focus trap, focus-bounce em mouse-click
- **OAuth:** statusline usa `https` nativo (sem shell), token validado por regex antes de Bearer injection, cache em `tmpdir` com mode `0600`

> Modelo de ameaca: machine compromise = jogo over (qualquer ferramenta dev cai). Mas em uso solo normal + tabs random no mesmo browser, o JOCA_UI esta hardened a um nivel equivalente ao Vite dev server / Storybook.

---

## Inicio rapido

### Maquina nova — bootstrap completo

Cola no Claude Code:

```
Le o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/master/install.md e segue as instrucoes.
```

O assistente clona o repo, configura identidade, personalidade (soul), skills, CLIs e instala o JOCA_UI.

### Iniciar a interface

```bash
# macOS / Linux
bash JOCA_UI/start.sh

# Windows
JOCA_UI\start.bat
```

Abre automaticamente `http://localhost:7372`.

### Actualizar o JOCA

**Opcao 1 — Comando (dentro de uma sessao JOCA):**
```
/update-joca
```

**Opcao 2 — Prompt directo (se o comando falhar ou JOCA nao estiver configurado):**
```
Le o ficheiro update.md em https://raw.githubusercontent.com/MirrasPT/JOCA/master/update.md e segue as instrucoes.
```

Sync one-way do GitHub. Protege memoria de projectos, feedback, soul calibration e componentes locais (`origin: local`).

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

## Skills (92)

Activadas on-demand com sistema de triggers RFC 2119 (`MUST be invoked when...`, `SHOULD also invoke when...`). Activacao automatica quando relevancia >= 60%.

### Base
`caveman` · `karpathy-guidelines` · `agent-context` · `plan` · `planning` · `prd` · `create-skill` · `feedback-joca` · `pt-pt-translator` · `browser-automate`

### Design
`frontend` · `mobile` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-system` · `design-tokens` · `component-system` · `html-review`

### Dev
`laravel-specialist` · `filament` · `mysql` · `rest-api` · `saas-patterns` · `file-storage` · `reverb-realtime` · `auth` · `transactional-email` · `postmark` · `error-tracking-dev` · `error-tracking-prod` · `search` · `queues` · `bullmq` · `webhooks` · `caching` · `availability` · `security` · `horizon`

### DevOps
`deploy-cpanel` · `deploy-docker` · `deploy-ploi` · `github`

### Marketing
`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `content-calendar` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `lead-capture` · `competitor-profiling` · `landing-page` · `marketing`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video & Media
`video` · `hyperframes` · `remotion` · `lyric-align`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-interactivity-api` · `wp-abilities-api` · `wpds` · `blueprint`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Architecture & Docs
`rfc` · `adr` · `tech-spec` · `task-breakdown` · `c4-diagram`

---

## Agents (26)

Agentes correm em sub-processos isolados, em paralelo.

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

---

## Commands (18)

| Command | Funcao |
|---------|--------|
| `/install` | Setup interactivo — identidade, soul, skills, CLIs, statusline, JOCA_UI |
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
| `/feedback-joca` | Captura gaps no toolkit (7 categorias + severidade) |
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
| Self-improvement | `/feedback-joca` -> `/upgrade-joca` -> `deep-research` + `skill-evaluator` loop |
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
- **Node.js 18+** (para JOCA_UI e hooks cross-platform)
- **macOS** ou **Windows** (Linux experimental)
- **gh CLI** (GitHub — `winget install GitHub.cli` / `brew install gh`)
- Opcional: Python 3.10+ (graphify), Codex CLI, Antigravity CLI (agy), browser-use CLI, playwright-cli, sentry-cli, ffmpeg, gws, zmail-cli (Java 11+)

---

## Creditos

Skills e agentes construidos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](JOCA_Brain/CREDITOS.md).

---

**Repositorio:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licenca dos componentes individuais pertence aos autores originais. JOCA como sistema de integracao: MIT.
