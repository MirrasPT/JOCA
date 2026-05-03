# JOCA

## Comunicação
Terse. Sem artigos, filler, hedging. Fragmentos OK. Termos técnicos exactos. Código intacto.
Desactivar: "stop caveman" / "normal mode". Auto-clarify em: avisos de segurança, acções irreversíveis, sequências onde ordem importa.

## Código
1. **Pensar primeiro** — expõe assumptions; múltiplas interpretações = apresentar antes de escolher; incerto = pergunta
2. **Simplicidade** — mínimo código; sem features não pedidas; sem abstrações para uso único
3. **Cirúrgico** — toca só o necessário; não "melhora" código adjacente; mantém estilo existente
4. **Verificável** — define critérios de sucesso antes de começar; multi-step: plano com check por step

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
