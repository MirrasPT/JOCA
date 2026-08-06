# JOCA Memory Index

Catálogo dos componentes do Brain. **Inventário verificado em disco a 2026-08-05:**
**131 skills · 101 agentes (65 gerados + 36 curados) · 25 comandos · 7 rules (+`README.md` = 8 ficheiros em `rules/`) · 1 workflow · 10 hooks · 22 scripts.**

> Este ficheiro é mantido à mão e é fácil de deixar apodrecer. Quem adicionar/renomear/remover um
> componente actualiza-o **na mesma sessão** — ver `/save` PASSO 6 e `/upgrade-joca` §5.6.
> Contagens reais a qualquer momento:
> ```bash
> cd JOCA_Brain && for d in skills agents commands rules; do echo "$d: $(ls .claude/$d/*.md | wc -l)"; done
> ```

## Core
- [soul.md](soul.md) — motor de personalidade: drives, filtros de decisão, estados, alinhamento com o utilizador. Base de todas as sessões (`@import` do `CLAUDE.md`).
- [SKILL_INDEX.json](SKILL_INDEX.json) — índice **leve** das 131 skills (nome/path/description/triggers). É isto que o matching por relevância lê; as skills nunca são pré-carregadas. Gerado por `.claude/scripts/build-skill-index.py`.
- [tools/mcps.md](tools/mcps.md) — servidores MCP ligados + setup do markitdown para `/know`.
- [tools/clis.md](tools/clis.md) — inventário de CLIs externos (função + instalação macOS/Windows + auth interactiva).

## Rules (`.claude/rules/`) — auto-carregadas em TODAS as sessões
⚠ Custo recorrente: cada linha aqui é re-enviada em cada mensagem. Ler `rules/README.md` antes de acrescentar.

| Rule | Função |
|---|---|
| `task-intake.md` | classifica qualquer pedido nas 4 vias (directa / skill / agente / fan-out). **Regra de paralelismo: ≥2 partes independentes → despachar em paralelo.** |
| `pipelines.md` | catálogo de sequências nomeadas + o auto-runner que as corre a fundo |
| `chaining.md` | convenção `chain:` — como um passo entrega ao seguinte sem o utilizador pedir |
| `orchestration-patterns.md` | fan-out, cap 3-5 workers, agentes-escrevem-para-disco, steward-não-initiator. **Regra crítica: sub-agentes não fazem spawn de sub-agentes.** |
| `testing.md` | doutrina de testes (funcional/performance/segurança) |
| `api-design.md` · `workflows-and-tooling.md` | **ponteiros** — o conteúdo extenso vive em `.claude/reference/` e carrega-se com `Read()` |

## Reference (`.claude/reference/`) — NÃO auto-carregado, `Read()` on-demand
`api-design.md` · `workflows-and-tooling.md` · `design-dataset.md` · `availability/` · `filament/` · `frontend/` · `reverb-realtime/` · `saas-patterns/` · `wp-performance-review/`

## Workflows (`.claude/workflows/`, via Workflow tool `{name: '<x>', args: {…}}`)
- `analisar-plataforma` — análise total de uma plataforma: recon → 8 lentes de auditoria em paralelo (backend/frontend/segurança/performance/código-morto/admin/produção/UX) → verificação adversarial de Critical/High → relatório em `docs/`. Args: `{ path, nome?, reportDir?, lentes?, dataISO? }`.

## Commands (26)

| Comando | Função |
|---|---|
| `/install` | setup do JOCA numa máquina nova — **conversa guiada**, não formulário |
| `/init-project` | ligar um projecto ao JOCA — levantamento da pasta + só as perguntas que faltam |
| `/resume` | carregar contexto do projecto + grafo de conhecimento |
| `/save` | guardar estado, memória, feedback auto-extraído e reindexar o toolkit |
| `/plan` | Plan Mode — decisões de arquitectura |
| `/autoplan` | plano completo auto-revisto (produto → design → eng), gate final |
| `/build-plan` | construção por fases: plano em docs → tarefas por fase → loop com gate de testes |
| `/one-shot` | desenvolvimento autónomo end-to-end a partir de PRD |
| `/goal` | auto-orquestração a partir de tarefa em linguagem natural (sem PRD) |
| `/debug` | triagem de erro com skill de stack auto-detectada |
| `/review-code` | review por `tester-code` + Codex adversarial |
| `/review-design` | review de UI/UX + acessibilidade em paralelo |
| `/ship` | código até PR: sync → testes → review do diff → version/CHANGELOG → gate → push → PR |
| `/learn` | memória institucional (decisões/aprendizagens event-sourced + recall) |
| `/retro` | retrospectiva: aprendizagens da janela → acções |
| `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| `/map-joca` | mapa de conhecimento (skills/agentes/comandos/projectos + chains) → `graph.html` via graphify |
| `/create-skill [desc]` | criar skill nova por pipeline de research |
| `/upgrade-joca` | feedback → auto-melhoria → aplicar |
| `/update-joca` | sincronizar com o GitHub (**Fase 0** distingue clone público de instalação com história própria) |
| `/migrate` | guia de migração v1-legacy → v2.0 |
| `/clean-install` | audita instalações JOCA existentes (várias, se houver), compara com o baseline, propõe tabela de optimização de tokens, consolida memória por mtime, arquiva antigo em `Old/`, promove instalação nova |
| `/status` | rate limits, modelo e uso de contexto |
| `/help-joca` | referência rápida |
| `/wp-perf` · `/wp-perf-review` | triagem e review de performance WordPress |

## Agents (101 = 65 gerados + 36 curados)

**65 agentes de execução gerados** (`<skill>-agent`) — um por cada skill de execução directa, criados
por `node .claude/scripts/skill-agents.mjs` a partir das próprias skills. Cada um lê a sua skill como
Step 0, portanto tem a mesma doutrina; a diferença é **onde corre**. 1 parte → ler a skill inline;
≥2 partes independentes → despachar um agente por parte, no mesmo turno.
**Não se editam à mão** — edita-se a skill e regenera-se.

**36 agentes curados:**

| Grupo | Agentes |
|---|---|
| Review & testes | `tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` |
| Orquestração | `master-orchestrator` (playbook adoptado pelo main loop, **não** um `subagent_type`) · `task-router` (classifica e pára) · `self-improver` · `gemini-auditor` |
| Pesquisa & análise | `deep-research` · `seo-analyst` · `log-debugger` · `query-debugger` |
| Geração & media | `img-gen-google` · `img-gen-openai` · `gemini-brain` · `video-gen` · `watch` |
| Backend / Laravel | `laravel-refactor` · `filament-builder` · `security-review` · `tech-debt-auditor` · `pr-repair` · `deploy-executor` |
| Especialistas | `payment-integration` · `dependency-auditor` · `design-system-audit` · `skill-evaluator` · `skill-improver` · `a11y-fixer` |
| Autonomia & pessoal | `knowledge-ingest` (`/know`) · `automation-builder` · `personal-comms` |

⚠ `automation-builder`, `personal-comms` e `tech-debt-auditor` estão marcados FUTUROS — aparecem no Trigger Map como se estivessem prontos, mas não estão operacionais (ver `docs/ARQUITECTURA.md` §7).

## Skills (131)
Flat em `.claude/skills/`, profundidade 1 (subpastas **não** são indexadas). Activação por relevância
≥ 60% → `Read(".claude/skills/<nome>.md")` **antes** de escrever código; notificar `[skill: <nome>]`.
O catálogo navegável é o **Trigger Map** do `JOCA_Brain/CLAUDE.md` (detecção → skill) e o
`SKILL_INDEX.json`. Não se duplica a lista aqui: duplicá-la é garantir que fica desactualizada.

## Projects
<!-- Preenchido pelo /init-project — uma linha por projecto, detalhe em projects/<x>.md -->
_(vazio — o repositório público não traz memória de ninguém. Corre `/init-project` para registar o primeiro.)_

## Feedback
<!-- Preenchido pelo /save (auto-extract) — sessões processadas vão para feedback/archive/ -->
_(vazio — corre `/save` no fim de uma sessão para começar a registar.)_
