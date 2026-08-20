# /upgrade-joca — Self-Improvement Loop

Reads unprocessed feedback, researches best practices, plans improvements, executes via skill-improver/skill-evaluator loop, validates, and reports. Full autonomous upgrade pipeline for JOCA internals.

Scope: **JOCA interno apenas** -- skills, agentes, comandos, hooks, memory tools.
Never touches project files, external repos, or user data.

## When to run

- After accumulating `/save` sessions that generated feedback
- When the user says "upgrade joca", "apply feedback", "self-improve", "improve toolkit"
- As periodic maintenance

---

## Phase 1 -- Collect Feedback

### 1.0 Baseline do sistema (antes de tocar em nada)

O bloco de sistema da Phase 4c compara-se contra este baseline. Sem baseline, um ⚠ novo introduzido
pela corrida é indistinguível de um ⚠ que já lá estava — e passa despercebido (foi assim que um
`SKILL_INDEX.json` stale sobreviveu a uma corrida inteira de 62 achados).

```bash
mkdir -p .joca/upgrade
node .claude/scripts/joca-doctor.mjs > .joca/upgrade/doctor-baseline.txt 2>&1; echo "exit=$?"
tail -2 .joca/upgrade/doctor-baseline.txt          # linha "Resumo: N ✓ · N ⚠ · N ✗"
git rev-parse HEAD > .joca/upgrade/head-baseline.txt
ls memory/feedback/*.md | wc -l                    # nº de ficheiros à entrada
```

Se `memory/feedback/auto-upgrade-log.md` já existir, guardar a data do último cabeçalho `## <data>` —
é o marco a partir do qual se conta **entrada vs saída** na Phase 6.

### 1.1 Locate JOCA

```bash
# Windows
$JOCA_DIR = (Get-ChildItem -Path "$env:USERPROFILE" -Recurse -Depth 6 -Filter "CLAUDE.md" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'JOCA[/\\]CLAUDE\.md' } | Select-Object -First 1).DirectoryName
# macOS/Linux
JOCA_DIR=$(find ~ -maxdepth 6 -name "CLAUDE.md" -path "*/JOCA/CLAUDE.md" 2>/dev/null | head -1 | sed 's|/CLAUDE.md$||')
```

All paths below are relative to `$JOCA_DIR`.

### 1.2 Read all unprocessed feedback files

Scan `memory/feedback/` for all `.md` files. For each file:
1. Parse YAML frontmatter
2. Skip if frontmatter contains `processed: true`
3. Skip if file is inside `memory/feedback/archive/`

Accepted filename patterns:
- `session-*.md` -- feedback sessions auto-extracted by `/save`
- `auto-*.md` -- auto-extracted by `/save`
- `joca-patterns.md` -- accumulated trigger/skill patterns

### 1.3 Aggregate and deduplicate

Collect every issue from every unprocessed file into a single list.
Deduplicate: if two issues target the same file + same section + same fix, merge them (keep the more specific description, note both sources).

### 1.4 Classify each issue

Assign exactly one type per issue:

| Type | Criteria |
|------|----------|
| `NEW_SKILL` | Skill that should exist but does not |
| `IMPROVE_SKILL` | Existing skill needs better instructions, triggers, or coverage |
| `FIX_TRIGGER` | Skill exists but triggers incorrectly (false positive or false negative) |
| `IMPROVE_COMMAND` | Existing command is incomplete, unclear, or missing steps |
| `FIX_WORKFLOW` | Multi-step workflow has a gap, wrong order, or missing error handling |
| `NEW_AGENT` | Agent that should exist but does not |
| `IMPROVE_AGENT` | Existing agent needs better instructions or tools |

If no unprocessed feedback files exist, inform the user:

```
No unprocessed feedback found in memory/feedback/.
Run /save to auto-extract feedback patterns from a session first.
```

Stop here.

### 1.5 Campo `estado` -- obrigatório, com prova lida do disco

Nenhum issue passa à Phase 2 sem `estado`. É o passo que torna o comando **idempotente entre
máquinas** e o que mais poupa: numa corrida real, 163 de 285 issues já estavam feitos; noutra, 54 de
131. Sem ele o comando reescreve o que já existe.

| `estado` | Critério | Prova exigida |
|---|---|---|
| `JA_RESOLVIDO` | o fix descrito **está no disco** | comando + saída: `grep -n "<texto novo>" <alvo>` com hit |
| `PENDENTE` | o alvo existe e não tem o fix | `grep` sem hit **no caminho completo do alvo** |
| `INCERTO` | alvo ambíguo, ou o fix não é verificável por texto | dizer porquê, em 1 linha |

Regras duras:
- **`**Resolvido:** <data>` no ficheiro de feedback é pista, não filtro.** Com 2 máquinas alternadas,
  um fix marcado como aplicado numa máquina pode nunca ter atravessado para a outra. Confirmar no
  disco antes de saltar.
- **Alvo inexistente = achado.** Se o `ls` do componente afectado falhar, o issue é `INCERTO` com a
  nota "alvo não existe" — nunca se cria o ficheiro a partir do nada para "cumprir" o issue. Numa
  corrida real o feedback citava `skills/webapp-testing.md`, que não existia.
- Afirmação de inexistência exige o **caminho completo** no comando, não o basename.
- Só os `PENDENTE` seguem para a Phase 2. Os `INCERTO` vão para o gate da Phase 3, listados à parte.

### 1.6 Modo backlog (acima de ~30 issues)

Acima de ~30 issues a Phase 1.3 ("agregar e deduplicar numa lista") e a Phase 3 (tabela para
confirmar) deixam de ser praticáveis — já se chegou a 330 issues em 101 ficheiros. Nesse caso:

**(a) Triagem por fan-out de agentes SÓ-LEITURA.** Um agente por **família de alvos** (comandos ·
rules · skills · agents · scripts · memory), 3-5 em paralelo no mesmo turno. Cada um devolve, por
issue: `estado` + prova + severidade + alvo. Brief obrigatório, além dos 4 campos habituais:

```
NÃO EDITAS NADA. Ferramentas de escrita proibidas — só Read/Grep/Glob/Bash-de-leitura.
Um triador que "aproveita e corrige" destrói a idempotência que a triagem existe para garantir,
e o resultado deixa de ser auditável (não se sabe o que era estado inicial e o que foi acção tua).
Escreve o resultado em .joca/upgrade/triagem-<familia>.md e devolve só o resumo + o path.
```

**(b) Agregar por defeito, não por issue.** Apresentar **clusters** (mesmo defeito, mesmo alvo) na
Phase 3, não 330 linhas. Ficheiros disjuntos por cluster — dois agentes no mesmo ficheiro pisam-se.

**(c) Fatiar por severidade.** Uma corrida = uma banda (`critical`+`high`, depois `medium`+`low`).
No frontmatter de cada ficheiro coberto só em parte:

```yaml
processed: partial
upgrade_run: 2026-08-17
upgrade_covered: [critical, high]
```

Arquivar (Phase 6.3) só quando **todas** as bandas estiverem cobertas.

**(d) Caducidade.** `medium`/`low` com mais de ~8 semanas num toolkit que mudou entretanto já não
descrevem o mesmo gap. Propor arquivo por idade no gate da Phase 3, com a lista à vista — arquivar
por idade é mais honesto do que manter uma fila que nunca se esvazia.

**(e) Entrada vs saída.** Reportar sempre: ficheiros novos desde a última corrida (baseline 1.0) vs
processados nesta. Se a entrada ganhar de forma consistente, o modo backlog está a mascarar o
problema, não a resolvê-lo — dizê-lo no relatório da Phase 6.

---

## Phase 2 -- Research (deep-research agent)

For each classified issue, decide whether research is needed:

| Issue Type | Research Action |
|------------|----------------|
| `NEW_SKILL` | MUST research: industry best practices, similar tools on GitHub, relevant standards (RFC, OWASP, W3C, etc.) |
| `IMPROVE_SKILL` | MUST research: current best practices for that domain, compare with 2-3 similar open-source skill/prompt implementations |
| `IMPROVE_COMMAND` | SHOULD research: how other CLI tools (gh, npm, cargo, brew) handle the same workflow pattern |
| `NEW_AGENT` | SHOULD research: agent orchestration patterns, similar multi-agent setups |
| `FIX_TRIGGER` | No research needed -- fix is mechanical (update description field) |
| `FIX_WORKFLOW` | No research needed unless the workflow is complex (3+ steps) |
| `IMPROVE_AGENT` | SHOULD research if agent covers a technical domain |

### 2.1 Spawn deep-research agent

For each item that needs research, invoke:

```
Agent(subagent_type="deep-research")
```

**Brief to deep-research (mandatory fields):**
1. **Objective:** "Research best practices for [domain/topic]. Find actionable patterns for a Claude Code skill/command that [what it does]."
2. **Relevant files:** Path to the existing skill/command/agent being improved (or "new -- does not exist yet")
3. **Constraints:** "Output a concise summary (max 500 words) with: (a) 3-5 actionable patterns, (b) 2-3 reference implementations or tools, (c) relevant standards/RFCs. No full report -- just actionable findings."
4. **What NOT to do:** "Do not generate HTML/PDF output. Do not create a research directory. Return findings inline."

Use `mode: quick` for SHOULD-research items, `mode: standard` for MUST-research items.

### 2.2 Compile research into actionable improvements

For each researched item, extract:
- Concrete patterns to incorporate
- Specific standards to reference (with section numbers)
- Anti-patterns to warn against
- Example implementations to adapt

Attach these as context for Phase 4.

---

## Phase 3 -- Plan Improvements

### 3.1 Build the improvement plan

Present a numbered list. Every item MUST include all fields:

```
JOCA UPGRADE PLAN
-----------------

 #  Type          Component    Description                                     Impact   Effort
--- ------------- ------------ ----------------------------------------------- -------- --------
 1  NEW_SKILL     skill        next-auth — Next.js authentication patterns     HIGH     SMALL
                               Research: OAuth 2.1 PKCE, NextAuth.js v5 API
 2  IMPROVE_SKILL skill        frontend-dev — add Tailwind v4 utilities        MEDIUM   SMALL
                               Research: Tailwind v4 migration guide patterns
 3  FIX_TRIGGER   skill        laravel-specialist — false positive on "artisan" HIGH     TRIVIAL
                               in non-Laravel contexts
 4  IMPROVE_CMD   command      save — missing error handling when graph fails   MEDIUM   SMALL
 5  FIX_WORKFLOW  workflow     create-skill pipeline — evaluator timeout        LOW      MEDIUM
                               not handled
 6  NEW_AGENT     agent        perf-monitor — continuous performance tracking   LOW      LARGE
 7  IMPROVE_AGENT agent        deep-research — add firecrawl_extract fallback  MEDIUM   TRIVIAL

-----------------
7 improvements planned (2 HIGH, 3 MEDIUM, 2 LOW)

Sources:
  #1: session-meu-projecto-2026-05-20.md > Issue 3
  #2: auto-2026-05-22.md > Issue 1, joca-patterns.md > "Tailwind v4"
  ...
```

### 3.2 User confirmation

Ask the user which items to apply:

```
Apply which improvements?
  - "all" to apply everything
  - "1,2,3" to select specific items
  - "all except 6" to exclude specific items
  - "high only" to apply only HIGH impact items
  - "cancel" to abort
```

Wait for explicit confirmation. Never proceed without it.

---

## Phase 4 -- Execute

Process approved items in priority order:
1. `FIX_TRIGGER` (highest urgency -- prevents misfires)
2. `FIX_WORKFLOW` (prevents broken pipelines)
3. `IMPROVE_SKILL` / `IMPROVE_AGENT` / `IMPROVE_COMMAND`
4. `NEW_SKILL` / `NEW_AGENT`

### 4.1 Trigger fixes (FIX_TRIGGER)

For each trigger fix:
1. Read the target skill file
2. Rewrite the `description` field in frontmatter using RFC 2119 keywords:
   - MUST trigger on: [specific phrases that should activate the skill]
   - MUST NOT trigger on: [specific phrases that should NOT activate it]
   - SHOULD also trigger on: [secondary phrases]
3. Verify `description` + `when_to_use` combined stays under 1,536 characters
4. Edit the file directly

### 4.2 Workflow fixes (FIX_WORKFLOW)

For each workflow fix:
1. Read the target command/workflow file
2. Identify the gap (missing step, wrong order, missing error handling)
3. Apply the fix directly with inline validation
4. Add error handling where missing (what to do when X fails)

### 4.3 Skill improvements and new skills (skill-improver + skill-evaluator loop)

For each `IMPROVE_SKILL` or `NEW_SKILL` item:

**Step A -- Draft/Revise (skill-improver agent)**

```
Agent(subagent_type="skill-improver")
```

Brief:
```
ORIGINAL REQUEST: [description of what the skill should do, from the feedback issue]
ITERATION: 1 of 3
PREVIOUS EVALUATOR FEEDBACK: [none for iteration 1, or evaluator's feedback array for iterations 2-3]
CURRENT SKILL CONTENT: [full content of existing skill, or "NEW -- create from scratch"]
RESEARCH CONTEXT: [actionable findings from Phase 2, if available]
```

**Step B -- Evaluate (skill-evaluator agent)**

```
Agent(subagent_type="skill-evaluator")
```

Brief:
```
ORIGINAL REQUEST: [same as above]
ITERATION: [N] of 3
SKILL TO EVALUATE:
[the full skill content returned by skill-improver]
```

**Step C -- Decision**

Parse the evaluator's JSON response:
- If `verdict` is `"PASS"` (score >= 8.0): accept the skill, proceed to write
- If `verdict` is `"FAIL"` and iteration < 3: go back to Step A with `feedback` array as `PREVIOUS EVALUATOR FEEDBACK`
- If `verdict` is `"FAIL"` and iteration == 3: report the skill as failed, include the best-scoring version in the report, suggest manual review

**Step D -- Write**

For accepted skills:
1. Write/overwrite the skill file at `.claude/skills/<name>.md`
2. Ensure frontmatter includes `origin: local`
3. Confirm: `[skill: <name>] score <X>/10 -- applied (iteration N)`

For failed skills (3 iterations, never passed):
1. Do NOT write the file
2. Report: `[skill: <name>] best score <X>/10 -- FAILED after 3 iterations. Manual review needed.`

### 4.4 Agent improvements and new agents

For each `IMPROVE_AGENT` or `NEW_AGENT`:
1. Read 2-3 existing agents (for pattern consistency)
2. Apply improvements directly (agents are not scored via skill-evaluator -- they use a different format)
3. Add `origin: local` to frontmatter of new agents
4. Validate: check that `tools:` field lists only tools that exist, `model:` is valid (opus/sonnet/haiku)

### 4.5 Command improvements (IMPROVE_COMMAND)

For each command improvement:
1. Read the target command file
2. Apply the fix (missing steps, error handling, clarity)
3. Validate: ensure the command has clear phases, user confirmation points where needed, and a summary output format
4. No origin marking needed for commands (they are part of the core workflow)

---

## Phase 4b -- Verificar por EFEITO (obrigatória)

Nunca se passa da Phase 4 à Phase 5 pelo relatório de quem escreveu. Numa corrida com verificação
adversarial por fora apanharam-se 4 defeitos que teriam entrado em silêncio: um agente apagou 20
linhas inteiras de um comando e não o reportou; outro escreveu um aviso factualmente falso alegando
tê-lo "verificado a correr o script". **O relatório descreve a intenção; só o disco mostra o efeito.**

Para **cada ficheiro tocado**:

```bash
grep -n "<frase exacta que foi acrescentada>" <ficheiro>   # o texto novo existe mesmo?
git diff --stat -- <ficheiro>                               # quanto entrou vs quanto saiu
git diff -- <ficheiro> | grep '^-' | grep -v '^---'         # o que foi APAGADO (deve ser só o previsto)
```

E, conforme o tipo:

| O que a alteração introduziu | Verificação |
|---|---|
| caminho de ficheiro | `ls <caminho completo>` |
| flag de CLI | `<cli> --help` e confirmar a flag na saída |
| `.js` / `.mjs` | `node --check <ficheiro>` |
| `.py` | `python3 -m py_compile <ficheiro>` |
| `.sh` | `bash -n <ficheiro>` |
| triggers de skill | ver 4b.1 |

**4b.1 Triggers novos vão para o INÍCIO da lista.** O `build-skill-index.py` guarda no máximo **15
triggers por componente** (`return unique[:15]`, linha 130) e não avisa quando corta. Acrescentar no
fim da lista do frontmatter — o que qualquer editor faz por omissão — produz uma alteração que existe
no ficheiro e **não faz nada**: as skills carregam lazy pelo índice e o termo novo nunca é
encontrado. Depois de reindexar (4c):

```bash
grep -c "<trigger novo>" memory/SKILL_INDEX.json   # 0 = inerte, ficou fora do corte
```

**Em modo backlog:** um verificador por lote, despachado **depois** do lote de escrita e **sem** ter
participado nele. Quem escreveu o código não assina o gate.

Defeito encontrado aqui = reparação nesta corrida, não item para o próximo ciclo.

## Phase 4c -- Bloco de sistema (uma vez, contra o baseline)

A verificação por ficheiro não vê o **estado derivado do sistema**. Os 12 defeitos de uma corrida
eram quase todos a mesma família: escreveu-se no `.md` e não se propagou — skill nova fora do
`SKILL_INDEX.json`, triggers novos inertes, espelhos `.agents/`/`.codex/` divergentes, contagens do
`README.md` erradas. Correr os três comandos **depois de todos os ficheiros estarem escritos**:

```bash
python3 .claude/scripts/build-skill-index.py     # Windows: python — regenera memory/SKILL_INDEX.json
bash    .claude/scripts/compile-bridges.sh       # regenera AGENTS.md / GEMINI.md / .agents / .codex
node    .claude/scripts/joca-doctor.mjs > .joca/upgrade/doctor-depois.txt 2>&1; echo "exit=$?"
```

**Comparar com o baseline da 1.0 — correr os comandos sem comparar não é gate:**

```bash
diff .joca/upgrade/doctor-baseline.txt .joca/upgrade/doctor-depois.txt
tail -2 .joca/upgrade/doctor-depois.txt          # "Resumo: N ✓ · N ⚠ · N ✗"
```

| Leitura do diff | Acção |
|---|---|
| ⚠ ou ✗ **novo** face ao baseline | defeito **desta corrida** — reparar antes da Phase 5, nunca reportar como pré-existente |
| ⚠/✗ que já estava no baseline | listar como pré-existente na Phase 6, não corrigir por arrasto |
| ⚠/✗ que desapareceu | ganho — creditar ao item que o resolveu |

`joca-doctor.mjs` sai com `1` se houver ✗. Aceita `--fix` para o que é auto-corrigível (contagens),
mas o `--fix` corre-se **depois** de ler o diff, senão apaga a prova de que a corrida introduziu o ⚠.

Confirmar ainda que os espelhos não divergiram em silêncio:

```bash
git status --short .agents .codex AGENTS.md GEMINI.md
```

Ficheiro alterado aqui e não commitado junto com a fonte = divergência garantida no próximo ciclo.

---

## Phase 5 -- Validate

> Os passos 5.3, 5.4 e 5.6 já correram na Phase 4c, **com comparação contra o baseline**. Aqui só se
> repetem se a Phase 5 tiver alterado mais algum ficheiro (ex.: 5.5 INDEX.md); e nesse caso volta-se
> a comparar, não se corre por correr.

### 5.1 Codex review (if available)

```bash
# Check if codex CLI is available
which codex 2>/dev/null && echo "AVAILABLE" || echo "NOT_AVAILABLE"
```

If available, for each modified file:
```bash
codex review <path-to-file>
```

If codex finds issues: report them but do not auto-fix. Include in the Phase 6 report.
If codex is not available: skip this step silently.

### 5.2 TypeScript check (if applicable)

If any `.ts` or `.tsx` files were modified:
```bash
npx tsc --noEmit 2>&1
```

Report errors if any.

### 5.3 Regenerate SKILL_INDEX.json

```bash
# Windows usa `python` (o `python3` e o stub vazio da Store); macOS/Linux usam `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" .claude/scripts/build-skill-index.py && break; done
```

If the script does not exist or fails: manually rebuild the index by scanning `.claude/skills/` and `.claude/agents/` for frontmatter (`name`, `description`, `path`) and writing to `memory/SKILL_INDEX.json`.

### 5.4 Recompile bridges

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null
```

If the script fails or does not exist: skip and note in report.

### 5.5 Update INDEX.md

For each new skill or agent created, add an entry to `memory/INDEX.md` in the appropriate section.

### 5.6 Realign the derived inventory (if skills/agents/commands were added or removed)

A component that no index surfaces is effectively invisible — relevance matching never reaches it. So when this upgrade creates, renames or removes anything, realign the three derived surfaces in the same run:

```
python .claude/scripts/build-skill-index.py    # macOS/Linux: python3 — regenerates memory/SKILL_INDEX.json
bash   .claude/scripts/compile-bridges.sh      # regenerates AGENTS.md / GEMINI.md / .agents / .codex
node   .claude/scripts/joca-doctor.mjs         # gate: exit 1 on dead paths/indexes
```

Then edit by hand, surgically: the counts and the component's line in `memory/INDEX.md`, the Trigger Map / `## Commands` table in `JOCA_Brain/CLAUDE.md`, and `README.md`.

> There used to be a `/sync-questionnaires` command here, whose job was keeping form-style questionnaires in `/install` and project onboarding aligned with the inventory. Those questionnaires are gone — onboarding is a conversation now (see `/start`), so nothing has to be kept in sync with a hardcoded list. Only the derived indexes above remain.

---

## Phase 6 -- Report

### 6.1 Summary

```
JOCA UPGRADE COMPLETE
---------------------

Applied: N
  [1] NEW_SKILL    next-auth               score 8.5/10 (iter 2)
  [3] FIX_TRIGGER  laravel-specialist       applied
  [4] IMPROVE_CMD  save                     applied

Skipped: M (user choice)
  [6] NEW_AGENT    perf-monitor             skipped by user

Failed: K
  [5] FIX_WORKFLOW create-skill pipeline    failed -- codex review found regression

---------------------
Files modified:
  .claude/skills/next-auth.md         (NEW)
  .claude/skills/laravel-specialist.md (trigger fix)
  .claude/commands/save.md             (improved)

Validation:
  SKILL_INDEX.json regenerated
  Bridges recompiled
  joca-doctor: baseline 20 ✓ · 1 ⚠ · 1 ✗  →  depois 21 ✓ · 1 ⚠ · 0 ✗
    novos desta corrida: 0        (qualquer ⚠/✗ novo é defeito desta corrida)
    pré-existentes:      1 ⚠ (soul.md por preencher)
  [Codex review: 0 issues / not available]

Entrada vs saída (desde <data da última corrida>):
  ficheiros de feedback novos: N     processados nesta corrida: M
  → saldo: +/-K        (se a entrada ganhar de forma consistente, dizê-lo em voz alta)
  banda coberta: [critical, high]    adiado: X issues medium/low

---------------------
```

### 6.2 Mark feedback as processed

For each feedback file that was fully processed (all its issues either applied or explicitly skipped by user):

1. Add `processed: true` and `processed_date: <YYYY-MM-DD>` to the YAML frontmatter
2. For each issue within the file, append resolution status:
   ```
   **Resolved:** <YYYY-MM-DD> -- <file modified> | skipped by user | failed (reason)
   ```

### 6.3 Archive processed feedback

```bash
mkdir -p memory/feedback/archive
```

Move fully processed files to `memory/feedback/archive/`:
```bash
mv memory/feedback/session-<name>-<date>.md memory/feedback/archive/
mv memory/feedback/auto-<date>.md memory/feedback/archive/
```

For `joca-patterns.md`: do NOT move -- only mark individual entries as processed within the file.

### 6.4 Suggest next steps

```
Next steps:
  - Run /update-joca if upstream changes are available
  - Realign the derived inventory if skills/agents/commands changed (step 5.6)
  - Run /save in your next session to auto-capture new feedback patterns
  - Review failed items manually: <list of failed items>
```

> **Windows:** if this upgrade ran on Windows and any change touches the JOCA_OS layer, defer UI verification to the `joca-os-windows` skill — the JOCA_OS is developed/validated on macOS and that skill re-tests and fixes the Windows-sensitive parts in one pass.

---

## Rules

- Never implement without user confirmation (Phase 3.2 gate)
- Nenhum issue passa sem `estado` + prova lida do disco (Phase 1.5) — a marca `**Resolvido:**` é pista, não filtro
- Acima de ~30 issues, triagem por fan-out de agentes **só-leitura** (Phase 1.6a); um triador que edita destrói a idempotência
- Phase 4b e 4c são obrigatórias: verificar por **efeito**, e comparar o `joca-doctor` com o baseline da 1.0 — correr os comandos sem comparar não é gate
- Never delete feedback files -- mark as processed and archive
- Never touch files outside JOCA (project files, user data, external repos)
- If a file path does not exist: create it with correct structure
- If two feedback issues contradict each other for the same file: present both, ask user which to apply
- Mark all new files with `origin: local` in frontmatter
- Skills MUST pass 8.0/10 threshold via skill-evaluator or be reported as failed
- Max 3 iterations per skill in the improver/evaluator loop
- Preserve existing patterns: read 2-3 similar files before creating new ones
- Archive processed feedback, never delete it
- If no feedback exists: inform user and stop (do not invent improvements)

---

## Modo `--auto` (headless — skill loop à Hermes)

`/upgrade-joca --auto` corre o ciclo SEM interacção — pensado para sessões em que o user pediu explicitamente rotina autónoma. O gate humano da Phase 3.2 é substituído por um perímetro conservador:

**Pode aplicar sozinho (allowlist):**
- `IMPROVE_SKILL` — melhorar skill existente (loop improver/evaluator, threshold 8.0/10 mantém-se)
- `FIX_TRIGGER` — corrigir triggers/description de skill que não disparou quando devia
- Regenerar `SKILL_INDEX.json` + bridges + marcar/arquivar feedback processado

**NUNCA aplica sozinho (fica em proposta):**
- `NEW_SKILL` / `NEW_AGENT` — escreve o draft em `memory/feedback/proposals/<nome>.md` com o rationale e pára
- `FIX_AGENT` em agentes de orquestração (master-orchestrator, task-router, self-improver)
- `CONFIG_CHANGE` (CLAUDE.md, soul.md, rules/, settings.json, hooks)
- Qualquer coisa fora de `.claude/skills/` + índices

**Regras extra do modo auto:**
- Sem feedback pendente (≥1 ficheiro) → termina imediatamente com "nada a processar" (não inventa melhorias)
- Máximo 5 melhorias aplicadas por run (as restantes ficam para o próximo ciclo, por ordem de severidade)
- No fim, escreve um resumo em `memory/feedback/auto-upgrade-log.md` (append): data, itens aplicados, itens em proposta, itens falhados
- Termina SEMPRE com um resumo claro (o worker do JOCA_OS captura-o e o juiz classifica) — listar: aplicado / proposto / falhado / adiado
