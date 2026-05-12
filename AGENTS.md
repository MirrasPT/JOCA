# AGENTS.md

This file exists only as compatibility bridge for tools that read `AGENTS.md`.
Canonical guidance for JOCA lives in `CLAUDE.md`. Keep JOCA Claude-first.

# JOCA

## Comunicação
Terse. Sem artigos, filler, hedging. Fragmentos OK. Termos técnicos exactos. Código intacto.
Desactivar: "stop caveman" / "normal mode". Auto-clarify em: avisos de segurança, acções irreversíveis, sequências onde ordem importa.

## Código
1. **Pensar primeiro** — expõe assumptions; múltiplas interpretações = apresentar antes de escolher; incerto = pergunta
2. **Simplicidade** — mínimo código; sem features não pedidas; sem abstrações para uso único
3. **Cirúrgico** — toca só o necessário; não "melhora" código adjacente; mantém estilo existente
4. **Verificável** — define critérios de sucesso antes de começar; multi-step: plano com check por step

## Estrutura do repositório

```
JOCA/
├── CLAUDE.md                   ← comportamento base canónico
├── AGENTS.md                   ← ponte de compatibilidade; não é fonte de verdade
├── install.md                  ← script interactivo de instalação
├── README.md                   ← documentação pública
├── CREDITOS.md                 ← créditos e origens das skills
├── memory/
│   ├── INDEX.md                ← índice de skills, agentes e ferramentas
│   ├── projects/               ← entrada por projecto (criado por /save)
│   ├── feedback/               ← sessões /feedback-joca
│   └── tools/                  ← graphify, mcp-routing, laravel-stack, motion
└── .claude/
    ├── commands/               ← /install /init-project /resume /save /plan /debug /review-* /wp-perf*
    ├── agents/                 ← tester-*, img-gen-*, watch, gemini-brain, codex-review, deep-research, ...
    ├── skills/
    │   ├── base/               ← caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca
    │   ├── design/             ← frontend-design, huashu-design, canvas-design, img-gen, lottie-animator, impeccable, comfyui/*, gsap/*, stitch/*
    │   ├── dev/
    │   │   ├── *.md            ← laravel-specialist, php-pro, postgres-pro, api-designer, devops-engineer, ...
    │   │   ├── browser-use/    ← automação browser: CLI, remote, Python lib, Cloud API
    │   │   ├── wordpress/      ← activar só em projectos WP
    │   │   └── shopify/        ← activar só em projectos Shopify
    │   ├── marketing/          ← ads-creation, seo, seo-local, email-sequence, content-strategy, ...
    │   └── video/              ← video, hyperframes/*
    ├── scripts/
    │   └── gemini-generate.py  ← geração de imagens via Gemini
    └── settings.json
```

## Adicionar skill / agente / comando

**Skill:** criar `.claude/skills/<categoria>/<nome>.md` com frontmatter `name`, `description`, triggers. Adicionar entrada em `memory/INDEX.md`.

**Agente:** criar `.claude/agents/<nome>.md`. Disponível via `Agent(subagent_type="<nome>")`. Adicionar entrada em `memory/INDEX.md`.

**Comando:** criar `.claude/commands/<nome>.md`. Disponível como `/<nome>` no Claude Code.

## Contexto e Agentes
Sub-agentes isolam contexto, não dividem papéis. Custo real ~15x tokens. Cap supervisor: 3-5 workers.
Comprimir a 70-80% — antes da degradação, não depois. Método: anchored iterative (sumariza só span novo, nunca re-sumariza o summary).
U-curve: info crítica no início e fim. Meio perde 10-40% recall — nunca colocar instruções importantes no centro.
Tema diferente = sugerir `/compact`. Novo contexto limpo bate correcções em cascata.

**Brief obrigatório ao invocar agentes:** Todo o agente recebe no prompt: (1) objectivo da tarefa em 2 frases, (2) ficheiros/paths relevantes, (3) constraints do projecto (stack, standards), (4) o que NÃO fazer. Agente sem brief começa em folha em branco — resultado genérico.

## Skills e Agentes
Skills por categoria: `design/` · `dev/` · `marketing/` · `video/` · `base/`
Detectar stack (WP, Shopify, Laravel, Flutter, etc.) e activar skill relevante on-demand.

Agentes disponíveis:
- **Review & Testing** — code review, acessibilidade, UI/UX, adversarial via Codex
- **Geração & Media** — imagens OpenAI/Google, análise vídeo (watch), Gemini multimodal
- **Especialistas** — Flutter, payments, deep research, skill pipeline (improver + evaluator)

Para skill ou agente específico: ler `memory/INDEX.md`.

### Regra: skill/agente primeiro

**Antes de qualquer tarefa** — verificar se existe skill ou agente relevante em `memory/INDEX.md`.

| Situação | Acção |
|---|---|
| Skill/agente claramente relevante | Activar directamente, informar qual foi usado |
| Tarefa parece ter cobertura mas não é óbvio | Perguntar: "Existe uma skill para X — quer que a use?" |
| Nenhuma skill relevante | Responder directamente, sem forçar |

**Hierarquia de preferência:** skill especializada > agente > resposta genérica.
Nunca responder genericamente quando existe uma skill para o mesmo domínio.

## Knowledge Graph
Se `graphify-out/GRAPH_REPORT.md` existir: consultar antes de arquitectura/catálogo. Detalhes: `graphify-out/graph.json`.
Actualizar raiz: `graphify . --update` · Actualizar skills/agentes: `/graphify .claude/` → merge → `graphify cluster-only .`

## MCP
`blender` · `github` (`GITHUB_PERSONAL_ACCESS_TOKEN`) · `mermaid` · `huggingface` (`HF_TOKEN`) · `playwright` · `firecrawl` (localhost:3002) · `lunar-docs` · `gmail` · `google-calendar` · `google-drive` · `wordpress/mcp-adapter` (WP 6.8+)

## Commands
| Command | Função |
|---|---|
| `/review-code` | tester-code + codex-review adversarial opcional |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | triage de erros + skill do stack detectado |
| `/create-skill [desc]` | nova skill: research → draft → improve → evaluate |
| `/create-skill --upgrade [nome]` | melhorar skill existente |
| `/install` | setup JOCA numa máquina nova |
| `/init-project` | inicializar projecto real |
| `/resume` | carregar contexto + knowledge graph |
| `/save` | guardar estado + actualizar knowledge graph |
| `/wp-perf-review [path]` | code review WP completo (Critical/Warning/Info) |
| `/wp-perf [path]` | quick triage WP — issues críticos |
