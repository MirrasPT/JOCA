# JOCA Memory Index

Catálogo dos componentes do Brain. **Inventário verificado em disco a 2026-10-02:**
**178 skills · 97 agentes (59 gerados + 38 curados) · 30 comandos · 5 ficheiros em `rules/` · 1 workflow · 14 hooks · 29 scripts · pack `marketeer/`.**

> Este ficheiro é mantido à mão e é fácil de deixar apodrecer. Quem adicionar/renomear/remover um
> componente actualiza-o **na mesma sessão** — ver `/save` PASSO 6 e `/upgrade-joca` §5.6.
> Contagens reais a qualquer momento:
> ```bash
> cd JOCA_Brain && for d in skills agents commands rules; do echo "$d: $(ls .claude/$d/*.md | wc -l)"; done
> ```

## Core
- [soul.md](soul.md) — motor de personalidade: drives, filtros de decisão, estados, alinhamento com o utilizador. Base de todas as sessões (`@import` do `CLAUDE.md`).
- [SKILL_INDEX.json](SKILL_INDEX.json) — índice **leve** das skills e agentes (nome/path/description/triggers/domínio). É isto que o hook `prompt-triage.js` lê a cada pedido; as skills nunca são pré-carregadas. Gerado por `.claude/scripts/build-skill-index.py`.
- [tools/mcps.md](tools/mcps.md) — servidores MCP ligados + setup do markitdown para `/know`.
- [tools/clis.md](tools/clis.md) — inventário de CLIs externos (função + instalação macOS/Windows + auth interactiva).

## Rules (`.claude/rules/`) — auto-carregadas em TODAS as sessões
⚠ Custo recorrente: cada linha aqui é re-enviada em cada mensagem. Ler `.claude/reference/rules-README.md` antes de acrescentar.

| Rule | Função |
|---|---|
| `task-intake.md` | classifica qualquer pedido nas 4 vias (directa / skill / agente / fan-out). **Regra de paralelismo: ≥2 partes independentes → despachar em paralelo.** |
| `stack-padrao.md` | a stack da casa para projectos novos — o /start escolhe as peças, sair exige razão em DECISIONS.md |
| `pipelines.md` | auto-runner das sequências nomeadas + doutrina de projecto + gates estático ≠ runtime (catálogo em `reference/pipelines-catalogo.md`) |
| `chaining.md` | convenção `chain:` — como um passo entrega ao seguinte sem o utilizador pedir; contrato de continuidade |
| `orchestration-patterns.md` | fan-out, cap 3-5 workers, agentes-escrevem-para-disco, steward-não-initiator, **sessões paralelas**. **Regra crítica: sub-agentes não fazem spawn de sub-agentes.** |

## Reference (`.claude/reference/`) — NÃO auto-carregado, `Read()` on-demand
Doutrina e casos: `task-intake-casos.md` · `orquestracao-casos.md` · `chaining-casos.md` · `doutrina-projecto.md` · `gates-runtime.md` · `pipelines-catalogo.md` · `sessoes-paralelas.md` · `claude-md-porques.md` · `rules-README.md` · `master-orchestrator.md` (playbook) · `trigger-map.md` (gerado por `trigger-map-gen.mjs`).
Técnica: `api-design.md` · `workflows-and-tooling.md` · `codigo-minimo.md` · `naming.md` · `adr-formato.md` · `design-dataset.md` · `design-system-tokens.md` · `design-system-componentes.md` · `tokens-multibrand.md` · `graphic-design-print.md` · `blender-*.md` · `anima-*.md` · `deploy-*.md` · `ploi-api.md` · `postmark.md` · `react-email.md` · `bullmq.md` · `wpds.md` · `wp-playground-blueprint.md` · `estados-motivacionais.md` · pastas `start/` · `frontend/` · `filament/` · `availability/` · `reverb-realtime/` · `saas-patterns/` · `wp-performance-review/` · `gsap/` · `review/` · `escrita/` · `minimax-h3-*` · `skill-logs/`.

## Workflows (`.claude/workflows/`, via Workflow tool `{name: '<x>', args: {…}}`)
- `analisar-plataforma` — análise total de uma plataforma: recon → 8 lentes de auditoria em paralelo (backend/frontend/segurança/performance/código-morto/admin/produção/UX) → verificação adversarial de Critical/High → relatório em `docs/`. Args: `{ path, nome?, reportDir?, lentes?, dataISO? }`.

## Commands (30)

| Comando | Função |
|---|---|
| `/install` | setup do JOCA numa máquina nova — **conversa guiada**, não formulário |
| `/start` | arranque de projecto — entrevista → PRD → stack → design; projecto existente liga-se pelo levantamento da pasta |
| `/init-project` | fundido no `/start` (ficheiro mantido como ponteiro) |
| `/executar-projeto` | a execução do `/start`: fundação → design → gate ⏸ → ondas até produção |
| `/resume` | carregar contexto do projecto (memória por pastas + checkpoint + decisões activas + drift git) |
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
| `/create-skill [desc]` | criar skill nova por pipeline de research |
| `/gauntlet-loop` | reformula um pedido num workflow medido contra uma referencia real: fan-out + critico severo + comparacao cega |
| `/upgrade-joca` | feedback → auto-melhoria → aplicar |
| `/update-joca` | sincronizar com o GitHub (**Fase 0** distingue clone público de instalação com história própria) |
| `/clean-install` | audita instalações JOCA existentes (várias, se houver), compara com o baseline, propõe tabela de optimização de tokens, consolida memória por mtime, arquiva antigo em `Old/`, promove instalação nova |
| `/status` | rate limits, modelo e uso de contexto |
| `/joca-doctor` | diagnóstico da instalação — runtimes, hooks, índices, bridges, memória (`--fix` corrige o seguro) |
| `/help-joca` | referência rápida |
| `/wp-perf` · `/wp-perf-review` | triagem e review de performance WordPress |
| `/marketeer <marca>` · `/marketeer-review <marca>` | ciclo de marketing de uma marca: análise → proposta → artes → implementação (em pausa) → review. Pack em `.claude/marketeer/` (`CONTRATO.md`) |

## Agents (97 = 59 gerados + 38 curados)

**59 agentes de execução gerados** (`<skill>-agent`) — um por cada skill de execução directa, criados
por `node .claude/scripts/skill-agents.mjs` a partir das próprias skills. Cada um lê a sua skill como
Step 0, portanto tem a mesma doutrina; a diferença é **onde corre**. 1 parte → ler a skill inline;
≥2 partes independentes → despachar um agente por parte, no mesmo turno.
**Não se editam à mão** — edita-se a skill e regenera-se.

**38 agentes curados:**

| Grupo | Agentes |
|---|---|
| Review & testes | `tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` |
| Orquestração | `task-router` (classifica e pára) · `self-improver` · `gemini-auditor` · `clean-install-audit` — o `master-orchestrator` é playbook em `reference/`, adoptado pelo main loop (**não** é `subagent_type`) |
| Pesquisa & análise | `deep-research` · `seo-analyst` · `log-debugger` · `query-debugger` |
| Geração & media | `img-gen-google` · `img-gen-openai` · `gemini-brain` · `video-gen` · `watch` |
| Backend / Laravel | `laravel-refactor` · `security-review` · `tech-debt-auditor` · `pr-repair` · `deploy-executor` |
| Especialistas | `payment-integration` · `dependency-auditor` · `design-system-audit` · `skill-evaluator` · `skill-improver` · `a11y-fixer` |
| Marketing (pack marketeer) | `mkt-analista-agent` · `mkt-revisor-agent` · `mkt-criativos-agent` · `mkt-plataforma-agent` |
| Autonomia & pessoal | `knowledge-ingest` (`/know`) · `personal-comms` |

⚠ `personal-comms` e `tech-debt-auditor` estão marcados FUTUROS — aparecem no Trigger Map como se estivessem prontos, mas não estão operacionais (ver `docs/ARQUITECTURA.md` §7).

## Skills (178)
Flat em `.claude/skills/`, profundidade 1 (subpastas **não** são indexadas). Activação por relevância
≥ 60% → `Read(".claude/skills/<nome>.md")` **antes** de escrever código; notificar `[skill: <nome>]`.
O catálogo navegável é o **Trigger Map** em `.claude/reference/trigger-map.md` (gerado; detecção → skill) e o
`SKILL_INDEX.json`. Não se duplica a lista aqui: duplicá-la é garantir que fica desactualizada.

## Projects
<!-- Preenchido pelo /start — uma linha por projecto, detalhe em projects/<slug>/index.md -->
_(vazio — o repositório público não traz memória de ninguém. Corre `/start` para registar o primeiro.)_

## Feedback
<!-- Preenchido pelo /save (auto-extract) — sessões processadas vão para feedback/archive/ -->
_(vazio — corre `/save` no fim de uma sessão para começar a registar.)_
