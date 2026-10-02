# /help-joca — Referência rápida do JOCA

Apresenta todos os comandos, agentes e skills do JOCA com descrição curta.

## Passos

1. Ler `memory/INDEX.md` para obter a lista actualizada de commands e agentes.
2. Ler `memory/SKILL_INDEX.json` para obter a lista actualizada de skills (name + description).
3. Apresentar o output abaixo — a secção de comandos sai da tabela `## Commands` deste ficheiro (agrupada pela coluna Grupo); Agentes e Skills com o conteúdo real (INDEX.md para agentes, SKILL_INDEX.json para skills), resumido a ~10 palavras por item.

## Commands

Tabela canónica dos comandos (saiu do `JOCA_Brain/CLAUDE.md` a 2026-09-15 para não pesar em cada mensagem; lá fica só «Comandos: `/help-joca`»). Comando novo → linha aqui.

| Grupo | Command | Function |
|---|---|---|
| SESSÃO | `/resume` | load context + knowledge graph |
| SESSÃO | `/save` | save state + update graph + auto-feedback |
| SESSÃO | `/start` | arranque de projecto e router por tipo: aplicação → `executar-projeto` · website → pipeline Website · branding → pipeline Identidade/branding · marketing → `/marketeer` |
| SESSÃO | `/init-project` | fundido no `/start` — redirect |
| SESSÃO | `/install` | JOCA setup on new machine |
| WORKFLOW | `/executar-projeto` | do PRD a produção: fundação → design → ondas |
| WORKFLOW | `/plan` | Plan Mode — architecture |
| WORKFLOW | `/autoplan` | plano completo auto-revisto (produto → design → eng) — corre a pipeline a fundo, gate final |
| WORKFLOW | `/goal` | auto-orquestração a partir de tarefa NL (sem PRD) → main loop segue o playbook `reference/master-orchestrator.md` em loop |
| WORKFLOW | `/one-shot` | autonomous dev: PRD → orchestrator → agents → tests |
| WORKFLOW | `/build-plan` | supervised phased build: plano em docs → tasks por fase → loop com gate de testes |
| WORKFLOW | `/gauntlet-loop` | reformula qualquer pedido num workflow contra uma referência real: fan-out + crítico severo + comparação cega, sem paragem automática |
| WORKFLOW | `/debug` | error triage + stack skill |
| WORKFLOW | `/review-code` | tester-code + codex adversarial |
| WORKFLOW | `/review-design` | UI/UX + accessibility |
| WORKFLOW | `/ship` | levar código a PR: sync → testes → review diff → version/CHANGELOG → gate → push → PR |
| WORKFLOW | `/create-skill [desc]` | new skill via research pipeline (`--upgrade [nome]` melhora uma existente) |
| MARKETING | `/marketeer <marca>` | ciclo de marketing: análise → proposta → artes → implementação (em pausa) |
| MARKETING | `/marketeer-review <marca>` | rever resultados e abrir o ciclo seguinte |
| CONHECIMENTO | `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| CONHECIMENTO | `/learn` | memória institucional do Brain (decisões/aprendizagens event-sourced + recall) |
| CONHECIMENTO | `/retro` | retrospectiva: aprendizagens da janela → acções (manual ou automação cron) |
| MANUTENÇÃO | `/upgrade-joca` | feedback → self-improvement → apply |
| MANUTENÇÃO | `/update-joca` | sync with GitHub (protects `origin: local`) |
| MANUTENÇÃO | `/clean-install` | audita instalações JOCA existentes (possivelmente várias na mesma máquina), compara com o baseline, propõe optimizações de tokens, consolida memória, arquiva o antigo em `Old/`, promove instalação nova |
| MANUTENÇÃO | `/joca-doctor` | diagnóstico da instalação |
| MANUTENÇÃO | `/status` | show rate limits, model and context inline |
| WORDPRESS | `/wp-perf` | quick WordPress performance triage |
| WORDPRESS | `/wp-perf-review` | WordPress code review |
| — | `/help-joca` | quick reference (esta página) |

---

## Output a apresentar

```
JOCA — Referência rápida
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[comandos: tabela ## Commands acima, agrupada por Grupo (SESSÃO · WORKFLOW · MARKETING · CONHECIMENTO ·
 MANUTENÇÃO · WORDPRESS), uma linha por comando: nome alinhado + função em ~10 palavras.
 Feedback do projecto + JOCA é auto-capturado pelo /save.]

/help-joca           Esta página

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENTES
[ler do memory/INDEX.md — secção ## Agents — e apresentar agrupado por categoria]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SKILLS
[ler de memory/SKILL_INDEX.json — apresentar agrupado por domínio]
Nota: Skills Shopify e WordPress só activas nos projectos respectivos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Regras de formatação

- Descrições: máximo ~10 palavras, sem artigos quando possível
- Agentes agrupados por categoria tal como no INDEX.md; skills agrupadas por domínio
- Sem markdown pesado — texto plano com `━` como separador
- Famílias grandes de skills (GSAP, ComfyUI, WordPress): agrupar como bloco "GSAP (8)" etc. com nota "(ver SKILL_INDEX.json para lista completa)"
- Se o utilizador passar argumento (ex: `/help-joca design`): filtrar e mostrar só essa categoria
