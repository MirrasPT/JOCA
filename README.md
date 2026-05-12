# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Toolkit centralizado de skills, agentes, memória e MCPs para Claude Code. Instala uma vez, usa em qualquer projecto.

**Problema que resolve:** cada projecto novo recomeça do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA é a camada persistente que vive acima dos projectos.

**Fonte de verdade:** JOCA é Claude-first. `CLAUDE.md`, `.claude/`, `memory/INDEX.md` e `memory/tools/` são canónicos. Outros ficheiros de agente, quando existirem, são pontes de compatibilidade.

---

## Como funciona

Abre qualquer projecto no Claude Code com a pasta do JOCA como working directory adicional (ou define como path global nas definições do Claude Code). O `CLAUDE.md` do JOCA é lido automaticamente — comportamento, skills e agentes ficam disponíveis imediatamente.

```
JOCA/
├── CLAUDE.md          ← comportamento base (comunicação, código, agentes)
├── install.md         ← assistente interactivo de instalação
├── CREDITOS.md        ← créditos e origens das skills
├── memory/
│   ├── INDEX.md       ← catálogo de skills, agentes e ferramentas
│   ├── projects/      ← entrada por projecto (criado por /save)
│   ├── feedback/      ← sessões /feedback-joca
│   └── tools/         ← graphify, MCP routing, motion, laravel-stack
└── .claude/
    ├── commands/      ← /install, /init-project, /resume, /save, /feedback-joca, ...
    ├── agents/        ← tester-code, flutter-expert, deep-research, ...
    ├── scripts/       ← graphify-global.py, graphify-patch.sh
    └── skills/
        ├── base/      ← caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca
        ├── design/    ← frontend-design, impeccable, slides, huashu-design, gsap/*, stitch/*, ...
        ├── dev/       ← laravel, php, postgres, browser-use/*, wordpress/*, shopify/*, ...
        ├── marketing/ ← ads, seo, email, content, social, copywriting
        └── video/     ← video, hyperframes/*
```

---

## Início rápido

### Máquina nova — bootstrap completo

Cola no Claude Code:

```
Lê o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/master/install.md e segue as instruções.
```

O assistente faz o questionário, detecta o teu stack, selecciona as skills relevantes e configura MCPs.

### Já tens o JOCA instalado

No início de cada sessão:

```
/resume
```

Para ligar um projecto existente ao JOCA:

```
/init-project
```

---

## Skills disponíveis

Skills são activadas on-demand — só carregam quando invocadas.

### Base *(sempre activas — comportamento embutido)*
| Skill | O que faz |
|-------|-----------|
| `caveman` | Comunicação ultra-comprimida, sem filler |
| `karpathy-guidelines` | Pensar antes de codar, simplicidade, mudanças cirúrgicas |
| `agent-context` | Orquestração multi-agente, compressão de contexto 70-80% |
| `create-skill` | Pipeline self-improving para criar/melhorar skills |
| `feedback-joca` | Captura problemas de workflow JOCA numa sessão |

### Design
`frontend-design` · `impeccable` · `slides` · `huashu-design` · `canvas-design` · `brand-guidelines` · `img-gen` · `lottie-animator` · `comfyui/core` · `comfyui/io` · `comfyui/deploy`

**GSAP** (8 skills): `gsap/gsap-core` · `gsap/gsap-timeline` · `gsap/gsap-scrolltrigger` · `gsap/gsap-plugins` · `gsap/gsap-utils` · `gsap/gsap-react` · `gsap/gsap-frameworks` · `gsap/gsap-performance`

**Stitch** (8 skills): `stitch/stitch-design` · `stitch/stitch-loop` · `stitch/design-md` · `stitch/enhance-prompt` · `stitch/react-components` · `stitch/remotion` · `stitch/shadcn-ui` · `stitch/taste-design`

### Dev
`laravel-specialist` · `php-pro` · `postgres-pro` · `api-designer` · `devops-engineer` · `test-master` · `webapp-testing` · `flutter` · `blender` · `google-analytics` · `microsoft-clarity`

**Browser Use** (4 skills): `browser-use/browser-use` · `browser-use/remote-browser` · `browser-use/open-source` · `browser-use/cloud`

### Marketing
`ads-creation` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `social-content` · `copywriting`

### Vídeo
`video` · `hyperframes/core` · `hyperframes/gsap` · `hyperframes/website-to-video`

### WordPress *(activar só em projectos WP)*
`wordpress-router` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-rest-api` · `wp-performance` · `wp-phpstan` · e mais

### Shopify *(activar só em projectos Shopify)*
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

---

## Agentes disponíveis

Agentes correm em sub-processos isolados, em paralelo.

| Categoria | Agentes |
|-----------|---------|
| **Review & Testing** | `tester-code`, `tester-accessibility`, `tester-ui-ux`, `codex-review` |
| **Geração & Media** | `img-gen-openai`, `img-gen-google`, `watch`, `gemini-brain` |
| **Especialistas** | `flutter-expert`, `payment-integration`, `deep-research`, `skill-improver`, `skill-evaluator` |

---

## Commands

| Command | Função |
|---------|--------|
| `/install` | Setup interactivo numa máquina nova |
| `/init-project` | Liga um projecto ao JOCA |
| `/resume` | Carrega contexto no início da sessão |
| `/save` | Guarda estado no fim da sessão |
| `/feedback-joca` | Captura gaps no workflow JOCA desta sessão |
| `/feedback-projeto` | Actualiza docs do projecto com aprendizagens da sessão |
| `/upgrade-joca` | Lê feedback acumulado e implementa melhorias ao JOCA |
| `/update-joca` | Verifica e aplica updates do repositório oficial GitHub |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/create-skill [desc]` | Cria nova skill via pipeline self-improving |
| `/create-skill --upgrade [nome]` | Melhora skill existente |
| `/wp-perf-review [path]` | Code review WP completo |
| `/wp-perf [path]` | Quick triage WP |
| `/help-joca` | Referência rápida de todos os comandos, agentes e skills |

---

## MCPs configurados

| MCP | Uso |
|-----|-----|
| `github` | Issues, PRs, repos |
| `mermaid` | Diagramas técnicos |
| `blender` | 3D modeling e renderização |
| `huggingface` | Modelos e datasets open-source |
| `playwright` | Browser automation e testes E2E |
| `firecrawl` | Web scraping (self-hosted, Docker) |
| `gmail` · `google-calendar` · `google-drive` | Google Workspace (OAuth) |
| `lunar-docs` | Documentação Lunar PHP |
| `wordpress/mcp-adapter` | Gestão de conteúdo WP (WP 6.8+) |

Guia de decisão completo: [`memory/tools/mcp-routing.md`](memory/tools/mcp-routing.md)

---

## Knowledge Graph

O JOCA integra com [graphify](https://github.com/safishamsi/graphify) para mapear código, documentação e designs em grafos semânticos persistentes — elimina releituras repetidas entre sessões.

```bash
# Instalar
pip install graphifyy && graphify install

# Gerar / actualizar grafo do projecto actual
graphify update .

# Grafo global: JOCA + todos os projectos activos numa rede ligada
python3 .claude/scripts/graphify-global.py

# Re-gerar tudo do zero
python3 .claude/scripts/graphify-global.py --refresh

# Output: graphify-out/global/graph.json + GRAPH_REPORT.md + graph.html
```

O grafo global liga automaticamente os nós JOCA (skills, agentes, commands) aos ficheiros de cada projecto activo via uma ponte filesystem — uma única rede navegável. Projectos descobertos via `memory/projects/*.md`.

Após actualizar graphify: `bash .claude/scripts/graphify-patch.sh`

---

## Créditos

Skills e agentes construídos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](CREDITOS.md).

---

**Repositório público:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licença dos componentes individuais pertence aos autores originais. JOCA como sistema de integração: MIT.
