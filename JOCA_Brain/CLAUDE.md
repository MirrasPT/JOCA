# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

@memory/soul.md

# JOCA

## Source of Truth
JOCA is Claude-first. `CLAUDE.md`, `.claude/`, `skills/`, `memory/soul.md` and `memory/INDEX.md` are canonical; `memory/soul.md` (personalidade) carrega em todas as sessões por `@import`.
Pontes compiladas para Codex (GPT) e agy (Gemini): `AGENTS.md`, `GEMINI.md`, `.agents/`, `.codex/` — publicam à mesma. Qualquer edição a skills/agentes exige `bash .claude/scripts/compile-bridges.sh`, senão divergem em silêncio.
Porquês e exemplos tirados destes ficheiros: `.claude/reference/claude-md-porques.md`.

## Communication
Terse. No articles, filler, hedging. Fragments OK. Technical terms exact. Code intact.
Auto-clarify on: security warnings, irreversible actions, order-dependent sequences.
Desligar: "stop caveman" / "normal mode". Nível fino: skill `caveman` (`/caveman lite|full|ultra`).
Língua de resposta: o bloco `## Lingua` do `~/CLAUDE.md` (escrito pelo `/install`).
**Subagentes** recebem só os CLAUDE.md: para eles vale a regra de relatório de §Context & Agents.

## Code
1. **Think first** — surface assumptions; multiple interpretations → present 2 and ask the choice before acting; uncertain = ask (max 1 cycle)
2. **Simplicity** — minimum code; no unrequested features; no single-use abstractions
3. **Surgical** — touch only what is needed; never "improve" adjacent code; preserve existing style
4. **Verifiable** — define success criteria before starting; multi-step: plan with check per step

## Decision Filter (sequential, before any action)
0. **Task intake** — antes de tudo, classificar a tarefa pelas 4 vias de `.claude/rules/task-intake.md` (fonte única dos thresholds), SEM o user pedir. Pipeline nomeada → auto-runner (`.claude/rules/pipelines.md`, encadeia via `chain:` de `.claude/rules/chaining.md`).
1. **Reversible?** yes → execute without asking · no → confirm 1 line
2. **Skill?** relevance ≥ 60% → **Read() the skill BEFORE writing code** (mandatory), notify `[skill: <name>]`; no match → respond directly. **CRITICAL:** Laravel → `laravel-specialist` · Filament resource → `filament` · React/frontend → `frontend`. Hierarchy: specialized skill > agent > generic response.
3. **Inline ou agente?** pelos thresholds de `.claude/rules/task-intake.md` (≥2 ficheiros ou partes → agentes; edição trivial num só ficheiro → inline)
4. **Validation?** code changed → auto-test (PostToolUse `Write|Edit` → `.joca/test-queue.jsonl` → o Stop recomenda testers → despachá-los sem perguntar) · config changed → show diff

Doutrina de projecto (issue antes de código · design antes de UI · testes em sessão separada · `PROGRESSO.md` + `docs/DECISIONS.md`) vale em qualquer projecto: `.claude/rules/pipelines.md` §Doutrina de projecto.

## Repository Structure
`memory/` — `soul.md` · `INDEX.md`+`SKILL_INDEX.json` (índice de componentes) · `projects/`+`feedback/` (por projeto, via `/save`).
`memory/projects/<slug>/` — lê-se só `index.md` (área → + `<area>.md`; `arquivo.md` em último caso); grava-se só na área + ≤3 linhas no index (regras: `/resume`, `/save`).
`.claude/` — `skills/` (flat, depth 1; lazy, nunca pré-carregadas) · `rules/` (carregadas sempre; antes de acrescentar uma → `reference/rules-README.md`) · `reference/` on-demand: `api-design.md` (antes de desenhar endpoints) · `workflows-and-tooling.md` (antes de workflow multi-agente, scripts com credenciais/binários/paths Windows, ou gotcha de ambiente) · `commands/` (tabela: `/help-joca`) · `agents/` · `hooks/` · `scripts/` · `settings.json`.
Add a **skill** = `.claude/skills/<name>.md` (frontmatter `name`+`description`, add to `INDEX.md`) · **agent** = `.claude/agents/<name>.md` (`Agent(subagent_type=…)`) · **command** = `.claude/commands/<name>.md` (`/<name>`).
Gatilhos: o hook `.claude/hooks/prompt-triage.js` lê `memory/SKILL_INDEX.json` e injeta `[skill] gatilho casado`; tabela completa (gerada, on-demand) em `.claude/reference/trigger-map.md`; sem match → `grep` ao `SKILL_INDEX.json`.
Regenerar: índice de skills `python .claude/scripts/build-skill-index.py` (Windows: `python`, não `python3`) · trigger map `node .claude/scripts/trigger-map-gen.mjs --apply` · agentes gémeos das skills de execução `node .claude/scripts/skill-agents.mjs` (lista curada no topo do script).

### Skill inline OU agente de execução
Cada skill de **execução** tem um agente gémeo em `.claude/agents/<skill>-agent.md`, que lê a skill como Step 0. **1 parte trivial** → `Read()` a skill e faz inline · **≥2 partes independentes** → um `<skill>-agent` por parte, **no mesmo turno**. Gate de valor: `.claude/rules/task-intake.md`.

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor 3-5 workers. Compress at 70-80% (anchored iterative). Critical info at start+end (U-curve).
**Mandatory brief:** every agent gets (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.
**Relatório de subagente ao principal:** resultado primeiro, ≤8 linhas, sem preâmbulo nem recapitulação; o detalhe vai para um ficheiro e devolve-se o caminho — nunca o relatório inteiro. Erros e avisos de segurança citam-se exatos. Formato pedido no brief prevalece.

## Hooks
Ligados em `.claude/settings.json` (o `/install` substitui `<JOCA_ROOT>` pelo caminho real): triagem do pedido (`prompt-triage.js`), recall no arranque (`session-intake.js`), guardas (`check-freeze`/`check-careful`/`check-tdd`, `guard-claudemd`, `guard-git-add`), auto-teste e checkpoints (`track-changes`, `auto-checkpoint`, `stop-checkpoint`, `auto-test-dispatch`), continuidade (`stop-continuar.js`) e registo de uso (`registo-uso.js`). Diagnóstico: `/joca-doctor`.
