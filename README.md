# JOCA — Joint Orchestrator of Cognitive Agents

Toolkit centralizado de skills, agentes, memória e MCPs para Claude Code. Instala uma vez, usa em qualquer projecto.

**Problema que resolve:** cada projecto novo recomeça do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA é a camada persistente que vive acima dos projectos.

---

## Como funciona

Abre qualquer projecto no Claude Code com `d:\Mega\Claude\JOCA` como working directory adicional (ou define como path global). O `CLAUDE.md` do JOCA é lido automaticamente — comportamento, skills e agentes ficam disponíveis imediatamente.

```
JOCA/
├── CLAUDE.md          ← comportamento base (comunicação, código, agentes)
├── install.md         ← assistente interactivo de instalação
├── memory/
│   ├── INDEX.md       ← catálogo de skills, agentes e ferramentas
│   └── tools/         ← graphify, MCP routing, motion, laravel-stack
└── .claude/
    ├── commands/      ← /install, /init-project, /resume, /save, ...
    ├── agents/        ← tester-code, flutter-expert, deep-research, ...
    └── skills/        ← design/, dev/, marketing/, video/, base/
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

### Design
`frontend-design` · `slides` · `huashu-design` · `canvas-design` · `brand-guidelines` · `img-gen` · `lottie-animator` · `comfyui/core` · `comfyui/io` · `comfyui/deploy`

### Dev
`laravel-specialist` · `php-pro` · `postgres-pro` · `api-designer` · `devops-engineer` · `test-master` · `webapp-testing` · `flutter` · `blender` · `google-analytics` · `microsoft-clarity`

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
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/create-skill [desc]` | Cria nova skill via pipeline self-improving |
| `/create-skill --upgrade [nome]` | Melhora skill existente |
| `/wp-perf-review [path]` | Code review WP completo |
| `/wp-perf [path]` | Quick triage WP |

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

O JOCA integra com [graphify](https://github.com/safishamsi/graphify) para mapear a arquitectura do projecto em grafo semântico persistente — elimina releituras repetidas entre sessões.

```bash
# Instalar
pip install graphifyy && graphify install

# Gerar grafo do projecto actual
/graphify .

# Gerar grafo das skills/agentes (requer merge manual)
/graphify .claude/
```

---

## Créditos

Skills e agentes construídos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`READ.md`](READ.md).

---

> Licença dos componentes individuais pertence aos autores originais. JOCA como sistema de integração: MIT.
