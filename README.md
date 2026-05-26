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
├── JOCA_Logic/              <- Motor Agenctico
│   ├── CLAUDE.md            <- comportamento base
│   ├── memory/
│   │   ├── INDEX.md         <- catalogo de componentes
│   │   ├── soul.md          <- personalidade calibravel
│   │   ├── SKILL_INDEX.json <- indice lazy-loading
│   │   ├── projects/        <- estado por projecto (/save)
│   │   ├── feedback/        <- sessoes de feedback (/feedback-joca)
│   │   └── tools/           <- graphify, MCP routing
│   └── .claude/
│       ├── commands/        <- 17 comandos (/install, /save, /upgrade-joca, ...)
│       ├── agents/          <- 25 agentes (tester-*, debug, research, media, ...)
│       ├── skills/          <- 92 skills flat — RFC 2119 triggers, on-demand loading
│       ├── hooks/           <- Node.js cross-platform (track-changes, auto-test)
│       ├── rules/           <- api-design, testing
│       └── scripts/         <- statusline, compile-bridges, build-skill-index
│
└── JOCA_UI/                 <- Interface Visual (browser)
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- projects.json, project-memory.json
    ├── start.sh / start.bat <- launchers cross-platform
    └── stop.sh / stop.bat   <- stop scripts
```

**134 componentes:** 92 skills + 25 agents + 17 commands.

---

## JOCA_UI — Interface Visual

Dashboard browser com terminal multi-sessao, file browser, toolkit panel e rate limits em tempo real.

- **Terminal multi-sessao:** cada sessao corre Claude Code real via node-pty (scrollback 100k linhas)
- **Slash command autocomplete:** `/` abre dropdown de comandos, skills e agentes com filtragem
- **Rate limits bar:** contexto%, 5h% e 7d% sempre visiveis, actualizados via statusline Node.js
- **Dashboard:** projectos, sessoes activas, JOCA_Logic engine status
- **Toolkit panel:** browse/search/edit dos 134 componentes do JOCA_Logic
- **File browser:** filesystem real com dotfiles toggle, window-focus refresh, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), conexoes
- **Sidebars colapsaveis:** left rail (62px) e right rail (54px) com animacoes suaves (280ms ease-out-quart)
- **Cross-platform:** macOS (zsh) e Windows (PowerShell) — deteccao automatica de OS

O JOCA_UI detecta automaticamente o `JOCA_Logic` como directorio irmao — zero configuracao.

---

## Inicio rapido

### Maquina nova — bootstrap completo

Cola no Claude Code:

```
Le o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md e segue as instrucoes.
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

```
/update-joca
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
`caveman` · `karpathy-guidelines` · `agent-context` · `plan` · `planning` · `prd` · `create-skill` · `feedback-joca` · `pt-pt-translator`

### Design
`frontend` · `mobile` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-system` · `design-tokens` · `component-system` · `html-review`

### Dev
`laravel-specialist` · `filament` · `mysql` · `rest-api` · `saas-patterns` · `file-storage` · `reverb-realtime` · `auth` · `transactional-email` · `postmark` · `error-tracking-dev` · `error-tracking-prod` · `search` · `queues` · `bullmq` · `webhooks` · `caching` · `availability` · `security` · `horizon`

### DevOps
`deploy-cpanel` · `deploy-docker` · `deploy-ploi` · `github`

### Marketing
`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `lead-capture` · `competitor-profiling` · `landing-page` · `marketing`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video & Media
`video` · `hyperframes` · `remotion`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-interactivity-api` · `wp-abilities-api` · `wpds` · `blueprint`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Architecture & Docs
`rfc` · `adr` · `tech-spec` · `task-breakdown` · `c4-diagram`

---

## Agents (25)

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
`img-gen-openai` · `img-gen-google` · `watch` · `gemini-brain`

### Specialists
`payment-integration` · `skill-evaluator` · `skill-improver` · `security-review`

---

## Commands (17)

| Command | Funcao |
|---------|--------|
| `/install` | Setup interactivo — identidade, soul, skills, CLIs, statusline, JOCA_UI |
| `/init-project` | Liga um projecto ao JOCA (PRD, skills, MCPs) |
| `/resume` | Carrega contexto no inicio da sessao |
| `/save` | Guarda estado + feedback projecto + feedback toolkit (auto) |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/one-shot` | Dev autonomo: PRD -> orchestrator -> parallel -> tests |
| `/create-skill` | Pipeline: research -> draft -> evaluate -> iterate |
| `/feedback-joca` | Captura gaps no toolkit (7 categorias + severidade) |
| `/upgrade-joca` | Self-improvement: research -> plan -> execute -> validate |
| `/update-joca` | Sync com GitHub (protege local, rebuild UI) |
| `/migrate` | Migracao v1-legacy -> v2.0 |
| `/wp-perf-review` | Code review WordPress |
| `/wp-perf` | Quick triage WordPress |
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
- Opcional: Python 3.10+ (graphify), jq (statusline legacy), Codex CLI, Gemini CLI

---

## Creditos

Skills e agentes construidos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](JOCA_Logic/CREDITOS.md).

---

**Repositorio:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licenca dos componentes individuais pertence aos autores originais. JOCA como sistema de integracao: MIT.
