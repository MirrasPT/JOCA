# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Toolkit centralizado de skills, agentes, memoria e MCPs para Claude Code — com interface visual browser integrada. Instala uma vez, usa em qualquer projecto. macOS e Windows.

**Problema que resolve:** cada projecto novo recomeca do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA e a camada persistente que vive acima dos projectos.

---

## Arquitectura

O JOCA e composto por dois modulos que funcionam em conjunto:

```
JOCA/
├── install.md               <- bootstrap de instalacao (maquina nova)
├── JOCA_Logic/              <- Motor Agenctico (skills, agents, commands, memory)
│   ├── CLAUDE.md            <- comportamento base
│   ├── memory/
│   │   ├── INDEX.md         <- catalogo de componentes
│   │   ├── soul.md          <- personalidade e decision filters
│   │   ├── SKILL_INDEX.json <- indice lazy-loading
│   │   ├── projects/        <- estado por projecto (/save)
│   │   └── tools/           <- graphify, MCP routing
│   └── .claude/
│       ├── commands/        <- 16 comandos (/install, /resume, /save, /plan, ...)
│       ├── agents/          <- 25 agentes (tester-*, debug, research, media, ...)
│       ├── skills/          <- 92 skills flat (.md) — on-demand loading
│       ├── hooks/           <- autonomous testing pipeline
│       ├── rules/           <- api-design, testing
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

**134 componentes:** 92 skills + 25 agents + 17 commands.

---

## JOCA_UI — Interface Visual

Dashboard browser com terminal multi-sessao, file browser, toolkit panel e notificacoes.

- **Terminal multi-sessao:** cada sessao corre Claude Code real via node-pty
- **Dashboard:** projectos, sessoes activas, JOCA_Logic status em tempo real
- **Toolkit panel:** browse/search/edit dos 133 componentes do JOCA_Logic
- **File browser:** filesystem real com auto-refresh, preview, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), JOCA_Logic engine status
- **Cross-platform:** macOS (zsh) e Windows (PowerShell) via deteccao automatica de OS

O JOCA_UI detecta automaticamente o `JOCA_Logic` como directorio irmao — zero configuracao.

---

## Inicio rapido

### Maquina nova — bootstrap completo

Cola no Claude Code:

```
Le o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md e segue as instrucoes.
```

O assistente clona o repo, configura identidade, personalidade (soul), skills, MCPs e instala o JOCA_UI.

### Iniciar a interface

```bash
# macOS / Linux
bash JOCA_UI/start.sh

# Windows
JOCA_UI\start.bat
```

Abre automaticamente `http://localhost:7362`.

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

## Skills (92)

Skills sao activadas on-demand — so carregam quando invocadas. Formato flat: um `.md` por skill em `.claude/skills/`.

### Base
`caveman` · `karpathy-guidelines` · `agent-context` · `plan` · `prd` · `create-skill` · `feedback-joca` · `pt-pt-translator`

### Design
`frontend` · `mobile` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `canvas-design` · `img-gen` · `blender` · `design-system` · `design-tokens` · `component-system` · `comfyui-core` · `comfyui-io` · `comfyui-deploy`

### Dev
`laravel-specialist` · `filament` · `mysql` · `rest-api` · `nodejs` · `flutter` · `saas-patterns` · `file-storage` · `reverb-realtime` · `auth` · `transactional-email` · `error-tracking-dev` · `error-tracking-prod` · `search` · `realtime` · `queues` · `webhooks` · `caching` · `availability`

### Tools
`test-master` · `webapp-testing` · `browser-use` · `google-analytics` · `microsoft-clarity` · `adr` · `blueprint`

### Marketing
`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `competitor-profiling`

### Video
`video` · `hyperframes` · `remotion`

### WordPress
`wordpress-router` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-rest-api` · `wp-performance` · `wp-phpstan` · `wp-playground`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

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
| `/install` | Setup interactivo numa maquina nova |
| `/init-project` | Liga um projecto ao JOCA |
| `/resume` | Carrega contexto no inicio da sessao |
| `/save` | Guarda estado no fim da sessao |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/one-shot` | Dev autonomo end-to-end: PRD -> orchestrator -> parallel -> tests |
| `/create-skill` | Pipeline self-improving para criar skills |
| `/feedback-joca` | Captura gaps no workflow JOCA |
| `/feedback-projeto` | Actualiza docs do projecto |
| `/upgrade-joca` | Le feedback e implementa melhorias |
| `/update-joca` | Sync com repositorio GitHub |
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
| Frontend | `frontend` -> `tester-ui-ux` -> `tester-performance` |
| One-shot | `master-orchestrator` -> parallel agents -> `tester-*` (auto) |
| Debug | `log-debugger` -> `query-debugger` (se SQL) |
| Deploy | deploy agent -> `tester-security` |
| Nova skill | `deep-research` -> `create-skill` |
| Self-improvement | `self-improver` -> `gemini-auditor` -> apply |

---

## Cross-CLI Bridge

O JOCA funciona com 3 CLIs. Source of truth: `.claude/` — compilado para formatos externos via `compile-bridges.sh`:

| CLI | Model | Bridge |
|-----|-------|--------|
| Claude Code | claude-opus-4-7 | `.claude/` (nativo) |
| Codex CLI | gpt-5.5 | `.agents/skills/` + `.codex/agents/` |
| Antigravity (agy) | Gemini 3.5 Flash | `GEMINI.md` + `AGENTS.md` |

```bash
bash .claude/scripts/compile-bridges.sh
```

---

## Requisitos

- **Claude Code** instalado e autenticado
- **Node.js 18+** (para JOCA_UI)
- **macOS** ou **Windows** (Linux experimental)
- Opcional: Python 3.10+ (graphify), Docker (Firecrawl)

---

## Creditos

Skills e agentes construidos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](JOCA_Logic/CREDITOS.md).

---

**Repositorio:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licenca dos componentes individuais pertence aos autores originais. JOCA como sistema de integracao: MIT.
