# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Toolkit centralizado de skills, agentes, memoria e workflows para Claude Code — com interface visual browser integrada. Instala uma vez, usa em qualquer projecto. macOS e Windows.

**Problema que resolve:** cada projecto novo recomeca do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA e a camada persistente que vive acima dos projectos.

---

## Arquitectura

O JOCA e composto por dois modulos que funcionam em conjunto:

```
JOCA/
├── install.md               <- bootstrap de instalacao (maquina nova)
├── JOCA_Brain/              <- Motor Agentico (skills, agents, commands, memory)
│   ├── CLAUDE.md            <- comportamento base
│   ├── memory/
│   │   ├── INDEX.md         <- catalogo de componentes
│   │   ├── soul.md          <- personalidade e decision filters
│   │   ├── SKILL_INDEX.json <- indice lazy-loading
│   │   ├── projects/        <- estado por projecto (/save)
│   │   └── tools/           <- graphify, routing
│   └── .claude/
│       ├── commands/        <- 22 comandos (/install, /resume, /save, /plan, /goal, ...)
│       ├── agents/          <- 36 agentes (tester-*, debug, research, media, orquestração, ...)
│       ├── skills/          <- 110 skills flat (.md) — on-demand loading
│       ├── hooks/           <- autonomous testing + task-intake pipeline
│       ├── rules/           <- api-design, testing, task-intake, orchestration-patterns
│       └── scripts/         <- compile-bridges, build-skill-index, statusline
│
└── JOCA_UI/                 <- Interface Visual (browser)
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- projects.json, project-memory.json
    ├── start.sh             <- launcher macOS/Linux
    ├── start.bat            <- launcher Windows
    └── stop.sh              <- stop macOS/Linux
```

**168 componentes:** 110 skills + 36 agents + 22 commands.

---

## JOCA_UI — Interface Visual

Dashboard browser com terminal multi-sessao, file browser, toolkit panel e notificacoes.

- **Terminal multi-sessao:** cada sessao corre Claude Code real via node-pty
- **Dashboard:** projectos, sessoes activas, JOCA_Brain status em tempo real
- **Toolkit panel:** browse/search/edit dos componentes do JOCA_Brain
- **File browser:** filesystem real com auto-refresh, preview, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), JOCA_Brain engine status
- **Slash autocomplete:** ao digitar `/` no terminal emulado aparece um dropdown com commands, skills e agents
- **Cross-platform:** macOS (zsh) e Windows (PowerShell) via deteccao automatica de OS

O JOCA_UI detecta automaticamente o `JOCA_Brain` como directorio irmao — zero configuracao.

> **Plataforma de desenvolvimento:** o JOCA_UI foi desenvolvido e validado em **macOS**. O codigo suporta Windows (deteccao automatica de OS, PowerShell, `%TEMP%`), mas o Windows nao e continuamente testado. Ao **instalar ou actualizar no Windows**, o JOCA activa a skill `joca-ui-windows`, que testa, verifica e corrige numa so passagem os pontos sensiveis (build do node-pty, PTY PowerShell, paths, statusline/Keychain, launchers).

---

## Inicio rapido

### Maquina nova — bootstrap completo

Cola no Claude Code:

```
Le o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md e segue as instrucoes.
```

O assistente clona o repo, configura identidade, personalidade (soul), skills, CLIs externos e instala o JOCA_UI.

### Iniciar a interface

```bash
# macOS / Linux
bash JOCA_UI/start.sh

# Windows
JOCA_UI\start.bat
```

Backend em `http://localhost:7371`, interface em `http://localhost:7372`.

### Actualizar o JOCA

```
/update-joca
```

Compara a instalacao local com o repositorio GitHub, mostra o que e novo e aplica updates apos confirmacao. Nunca sobrescreve memoria de projectos ou feedback pessoal.

### Sessao de trabalho

No inicio de cada sessao:

```
/resume
```

Para ligar um projecto existente:

```
/init-project
```

---

## Skills (110)

Skills sao activadas on-demand — so carregam quando invocadas. Formato flat: um `.md` por skill em `.claude/skills/`, com triggers RFC 2119 (MUST/SHOULD/MAY).

### Base & JOCA
`caveman` · `karpathy-guidelines` · `agent-context` · `create-skill` · `feedback-joca` · `pt-pt-translator` · `joca-ui-windows` · `browser-automate` · `yagni`

### Planeamento & Specs
`plan` · `planning` · `prd` · `tech-spec` · `task-breakdown` · `adr` · `rfc` · `c4-diagram` · `blueprint` · `html-review`

### Design & Frontend
`frontend` · `mobile` · `design-system` · `design-tokens` · `component-system` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-review` · `tailwind` · `shadcn` · `react-composition` · `react-patterns` · `landing-page`

### Dev (Laravel / backend)
`laravel-specialist` · `filament` · `laravel-react` · `saas-patterns` · `rest-api` · `mysql` · `auth` · `security` · `file-storage` · `caching` · `queues` · `bullmq` · `horizon-queues` · `reverb-realtime` · `search-engine` · `webhooks` · `availability` · `error-tracking-dev` · `error-tracking-prod` · `github`

### Email
`react-email` · `transactional-email` · `postmark`

### Deploy
`deploy-cpanel` · `deploy-docker` · `deploy-ploi`

### Portugal
`portugal-payments` (ifthenpay/MB WAY/Multibanco) · `portugal-invoicing` (Moloni/faturacao certificada)

### Marketing
`marketing-router` · `paid-ads` · `seo` · `seo-local` · `copywriting` · `content-strategy` · `content-calendar` · `social-content` · `email-sequence` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `competitor-profiling` · `lead-capture`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video
`video` · `hyperframes` · `remotion` · `lyric-align`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-abilities-api` · `wp-interactivity-api` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-wpcli-and-ops` · `wpds`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Wix
`wix-cli`

### Autonomia & Pessoal (FUTUROS)
`knowledge-ingest` (/know) · `automations` · `personal-comms`

---

## Agents (36)

Agentes correm em sub-processos isolados, em paralelo.

### Review & Testing
`tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` · `design-system-audit`

### Debug
`log-debugger` · `query-debugger`

### Search & Analysis
`deep-research` · `seo-analyst` · `dependency-auditor`

### Orchestration & Self-improvement
`master-orchestrator` · `task-router` · `self-improver` · `gemini-auditor` · `skill-evaluator` · `skill-improver`

### Generation & Media
`img-gen-openai` · `img-gen-google` · `video-gen` · `watch` · `gemini-brain`

### Specialists
`payment-integration` · `security-review` · `laravel-refactor` · `filament-builder` · `pr-repair` · `deploy-executor` · `a11y-fixer` · `tech-debt-auditor`

### Autonomia & Pessoal (FUTUROS)
`knowledge-ingest` · `automation-builder` · `personal-comms`

---

## Commands (22)

| Command | Funcao |
|---------|--------|
| `/install` | Setup interactivo numa maquina nova |
| `/init-project` | Liga um projecto ao JOCA |
| `/resume` | Carrega contexto no inicio da sessao |
| `/save` | Guarda estado no fim da sessao |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/one-shot` | Dev autonomo end-to-end: PRD -> orchestrator -> parallel -> tests |
| `/goal` | Auto-orquestracao a partir de tarefa NL (sem PRD) -> orchestrator em loop |
| `/know` | Ingerir conteudo na Knowledge Base (markitdown -> resumo -> tags) |
| `/build-plan` | Build supervisionado por fases: plano em docs -> tasks -> loop com gate de testes |
| `/create-skill` | Pipeline self-improving para criar skills |
| `/sync-questionnaires` | Audita e actualiza os questionarios/listas contra o inventario real |
| `/feedback-joca` | Captura gaps no workflow JOCA |
| `/feedback-projeto` | Actualiza docs do projecto |
| `/upgrade-joca` | Le feedback e implementa melhorias |
| `/update-joca` | Sync com repositorio GitHub |
| `/migrate` | Guia de migracao v1-legacy -> v2.0 |
| `/status` | Mostra rate limits, modelo e contexto |
| `/wp-perf-review` | Code review WP completo |
| `/wp-perf` | Quick triage WP |
| `/help-joca` | Referencia rapida de comandos |

---

## Pipelines

Sequencias pre-definidas activadas automaticamente:

| Workflow | Sequencia |
|----------|-----------|
| Nova feature Laravel | `plan` -> `laravel-specialist` -> `tester-code` -> `tester-api` |
| SaaS / multi-tenant | `plan` -> `saas-patterns` -> `laravel-specialist` -> `tester-security` |
| E-commerce full-stack | `plan` -> `saas-patterns` -> `laravel-specialist` -> `filament-builder` -> `laravel-react` -> `frontend`+`shadcn` -> `payment-integration` |
| Frontend producao | `design-system` -> `frontend` -> `react-composition`+`tailwind`+`react-patterns` -> `anima` -> `design-review`+`tester-ui-ux` |
| One-shot | `master-orchestrator` -> parallel agents -> `tester-*` (auto) |
| Debug | `log-debugger` -> `query-debugger` (se SQL) |
| Deploy | `deploy-docker`/`deploy-ploi`/`deploy-cpanel` -> `tester-security` |
| Nova skill | `deep-research` -> `create-skill` |
| Manutencao questionarios | `/sync-questionnaires` (drift inventario↔questionarios) |
| Self-improvement | `self-improver` -> `gemini-auditor` -> apply |

---

## Cross-CLI Bridge

O JOCA funciona com 3 CLIs. Source of truth: `.claude/` — compilado para formatos externos via `compile-bridges.sh`:

| CLI | Model | Bridge |
|-----|-------|--------|
| Claude Code | Claude (Opus) | `.claude/` (nativo) |
| Codex CLI | OpenAI GPT | `.agents/skills/` + `.codex/agents/` |
| Antigravity (agy) | Google Gemini | `GEMINI.md` + `AGENTS.md` |

```bash
bash .claude/scripts/compile-bridges.sh
```

---

## Requisitos

- **Claude Code** instalado e autenticado
- **Node.js 18+** (para JOCA_UI)
- **macOS** ou **Windows** (Linux experimental)
- No Windows: Visual Studio Build Tools + Python 3.x (build do node-pty)
- Opcional: Python 3.10+ (graphify), Docker (Firecrawl)

---

## Creditos

Skills e agentes construidos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](JOCA_Brain/CREDITOS.md).

---

**Repositorio:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licenca dos componentes individuais pertence aos autores originais. JOCA como sistema de integracao: MIT.
