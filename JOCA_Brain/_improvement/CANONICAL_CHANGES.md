# CANONICAL_CHANGES — texto exacto a aplicar

> O main loop aplica estas mudancas SEQUENCIALMENTE (uma de cada vez) para evitar clobber.
> NAO aplicadas por este agente. Cada bloco indica ficheiro + ancora + texto.
> Antes de qualquer edit em massa de agentes, verificar a doc de subagentes do Claude Code
> (o fix do contrato agentes-usam-skills e o body Read(), nao o frontmatter `skills:`).

---

## CC-1 — CLAUDE.md · Decision Filter passo 2 (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\CLAUDE.md`
Seccao: `## Decision Filter (sequential, before any action)`

SUBSTITUIR a linha actual:
```
2. **Skill exists?** match ≥60% → **Read() the skill BEFORE writing any code**. Not optional. Notify: `[skill: <name>]`. No match → respond directly. Check trigger map below — Laravel/Filament/frontend/etc. all have skills.
```
POR:
```
2. **Skill OR agente OR workflow?** Classificar a tarefa (ver `rules/task-intake.md`):
   - 0 ficheiros / pergunta pura → **resposta directa**.
   - 1 dominio + 1-2 ficheiros + reversivel + skill match ≥60% → **Read() a skill ANTES de escrever codigo**. Notify: `[skill: <name>]`.
   - 1 dominio especialista + trabalho isolavel (review/debug/research/deploy) → **delegar a 1 agente** com brief obrigatorio.
   - ≥2 dominios em paralelo OU ≥3 ficheiros OU feature completa OU cross-stack → **workflow** via `/goal` (master-orchestrator com GOAL + loop). Irreversivel → 1 linha de confirmacao primeiro.
   Check trigger map abaixo — Laravel/Filament/frontend/etc. tem skills.
```

---

## CC-2 — CLAUDE.md · novo passo 0 do Decision Filter (P0)

Ficheiro: `CLAUDE.md`
Seccao: `## Decision Filter (sequential, before any action)`

INSERIR como primeiro item da lista (antes do actual "1. Reversible?"), renumerar os seguintes:
```
0. **Task intake** — antes de tudo, classificar a tarefa pelas 4 vias (directa / skill / agente / workflow) conforme `rules/task-intake.md`. Decidir a via SEM o user pedir.
```

---

## CC-3 — rules/task-intake.md · NOVO ficheiro (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\rules\task-intake.md`
Accao: CRIAR. Conteudo exacto:

```markdown
# Task Intake — Auto-Orquestracao

Decision tree corrido ANTES do Decision Filter. Classifica QUALQUER tarefa recebida em 4 vias.
Carregado em todas as sessoes. Deterministico por thresholds — "decidir sozinho" nao e vibes.

## As 4 vias

| Via | Quando | Accao |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisao/conversa | Responder inline |
| B — 1 Skill | 1 dominio · 1-2 ficheiros · reversivel · skill match ≥60% | Read .claude/skills/<x>.md → executar inline. Notify [skill: <x>] |
| C — 1 Agente | 1 dominio especialista · trabalho isolavel (review/debug/research/deploy) · beneficia de contexto proprio | Agent(subagent_type="<x>") com brief obrigatorio |
| D — Workflow | ≥2 dominios em paralelo · OU ≥3 ficheiros · OU feature completa · OU cross-stack | /goal → master-orchestrator com GOAL + loop ate concluir |

## Thresholds

- Ficheiros: 0=A · 1-2=B · 1-3 isolado=C · ≥3 ou paralelizavel=D
- Dominios: 0=A · 1=B · 1 especialista=C · ≥2 concorrentes=D
- Contexto isolado ajuda → C ou D
- Skill match ≥60% → preferir B sobre A

## Seguranca (nao negociavel)

- Reversivel → age sem perguntar. Irreversivel (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 linha de confirmacao, mesmo em D.
- Steward, nao initiator: em loop, so continuar trabalho ja no GOAL. Nao inventar scope.
- Anti-loop: workflow tem max N iteracoes (default 4); 3x "nada a fazer" → parar e reportar.

## Ancoragem

Referenciado do CLAUDE.md Decision Filter (passo 0 e 2). Injectado a cada prompt pelo
UserPromptSubmit hook. Sobrevive ao recall loss por estar tambem nos hooks.
```

---

## CC-4 — soul.md · Working Principles (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\memory\soul.md`
Seccao: `## Working Principles`

ADICIONAR como ultima linha da lista:
```
- Auto-escala: ao receber tarefa, classificar via (directa/skill/agente/workflow) por thresholds e disparar — sem o user pedir (ver rules/task-intake.md)
```

---

## CC-5 — soul.md · Calibration Parameters (P1)

Ficheiro: `memory/soul.md`
Seccao: bloco yaml `## Calibration Parameters`

ADICIONAR dentro do bloco yaml, antes do fecho ```` ``` ````:
```
orchestration_threshold: 2   # nº min de dominios concorrentes OU ficheiros>=3 → escala para workflow
loop_max_iterations: 4       # travao anti-loop-infinito no workflow goal-seeking
```

---

## CC-6 — settings.json · SessionStart + UserPromptSubmit hooks (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\settings.json`
Accao: ADICIONAR dois blocos dentro de `"hooks"` (manter PostToolUse e Stop existentes).

ADICIONAR ao objecto `"hooks"`:
```json
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/session-intake.js"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/prompt-triage.js"
          }
        ]
      }
    ]
```

> Nota: confirmar os nomes de evento `SessionStart`/`UserPromptSubmit` contra a doc de hooks
> do Claude Code instalado antes de aplicar (verificar, nao assumir). Se o nome do campo de
> output esperado diferir, ajustar os .js. Hooks sao Node (sem jq, sem python3).

---

## CC-7 — hooks/session-intake.js · NOVO (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\hooks\session-intake.js`
Accao: CRIAR. Espec para o autor (Node, Windows-safe, sem deps externas):
- Ler `memory/SKILL_INDEX.json`.
- Construir digest compacto `trigger -> path` (so name + triggers + path, NAO o corpo das skills).
- Emitir como hidden context (formato de output do hook a confirmar contra doc): bloco com
  (a) as 4 vias do task-intake resumidas, (b) o digest trigger->path.
- Falhar silenciosamente (exit 0) se o index nao existir — nunca bloquear arranque.

---

## CC-8 — hooks/prompt-triage.js · NOVO (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\hooks\prompt-triage.js`
Accao: CRIAR. Espec (Node):
- A cada UserPromptSubmit, emitir 1 linha de lembrete:
  `[task-intake] classifica: directa/skill/agente/workflow antes de responder. rules/task-intake.md`
- Nao analisar o prompt (a classificacao e do modelo); so garantir o nudge a cada turn.
- Exit 0 sempre.

---

## CC-9 — master-orchestrator.md · loop-ate-concluir + GOAL (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\agents\master-orchestrator.md`

(a) ADICIONAR ao topo de `## Before Starting`, antes do item 1:
```
0. **GOAL** — recebes sempre um GOAL com criterios de aceitacao explicitos. Se nao houver PRD.md/TECH_SPEC.md/TASKS.md, trabalha a partir do GOAL e do plano in-memory recebido no brief. NAO bloquear por falta de PRD.
```

(b) SUBSTITUIR `### Phase 4: Aggregation & Validation` final + adicionar Phase 4.5. INSERIR apos a Phase 4 actual:
```
### Phase 4.5: Goal-Satisfaction Loop
Apos agregacao:
1. Comparar resultado vs criterios de aceitacao do GOAL.
2. Se TODOS cumpridos e testes verdes → avancar para Phase 5.
3. Se algum falhar → re-decompor SO a lacuna, re-briefar o agente dono com a falha exacta, re-dispatch.
4. Cap de iteracoes: `loop_max_iterations` (default 4). Apos o cap, ou 3x sem progresso → parar e reportar o que falta.
5. NUNCA auto-corrigir accoes irreversiveis (auth/payments/migrations/deletes/deploy) — parar no gate e pedir decisao.
```

(c) SUBSTITUIR a tabela hardcoded de `### Phase 2: Work Stream Generation` (a tabela DB/API/Frontend/Auth/Tests) POR:
```
Ler `memory/SKILL_INDEX.json`. Mapear o GOAL aos triggers das skills/agentes disponiveis
(qualquer dominio — nao so web-dev). Gerar work-streams independentes a partir desse match.
Para GOALs nao-web (automacoes, /know, research, acoes) usar os agentes de dominio correspondentes.
```

(d) SUBSTITUIR a regra `3. **Brief every agent**` POR (brief canonico):
```
3. **Brief every agent (template obrigatorio)** — nenhum agente arranca sem:
   (1) objectivo em 2 frases;
   (2) ficheiros/paths + lista exacta dos ficheiros DESTA tarefa (evita falso-positivo no verify adversarial);
   (3) constraints do projecto;
   (4) o que NAO fazer;
   (5) ANTI-FABRICACAO: credencial/endpoint/key em falta → no-auth ou `TODO: credencial em falta` + reportar, NUNCA inventar;
   (6) VERIFICAR PARSERS contra resposta real (cliente de API externa → 1 chamada real antes de finalizar);
   (7) COMPONENTES PARTILHADOS antes do fan-out → importar, nao recriar;
   (8) STEP 0: Read das skills relevantes antes de codigo.
   Sub-agentes NAO herdam soul.md — estas clausulas vao no brief, nao se assumem.
```

---

## CC-10 — commands/goal.md · NOVO command (P0)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\commands\goal.md`
Accao: CRIAR. Espec:
- `/goal <descricao NL>` — entrada autonoma de workflow SEM PRD.
- Fluxo: (1) ler CLAUDE.md + SKILL_INDEX.json; (2) sintetizar plano minimo in-memory a partir da descricao (GOAL + criterios de aceitacao + work-streams candidatos); (3) detectar accoes irreversiveis → 1 confirmacao; (4) invocar `master-orchestrator` com o GOAL e o plano in-memory; (5) reportar.
- `/one-shot` mantem-se como variante PRD-driven. `/goal` e a variante NL-driven.
- Caveman-lite, pt-pt, espelhar o estilo de one-shot.md.

> NOTA: o header de `migrate.md` tem `# /goal` errado (heranca). Corrigir migrate.md para
> `# /migrate` ANTES de criar goal.md, senao colidem no router (ver CC-15).

---

## CC-11 — Contrato agentes-usam-skills: Step 0 Read() (P1)

Ficheiros: agentes que declaram `skills:` mas NAO fazem `Read()` no corpo —
confirmado: `master-orchestrator.md`, `self-improver.md`. Auditar tambem:
`dependency-auditor.md`, `query-debugger.md`, `seo-analyst.md`, `deep-research.md`.

Accao: ADICIONAR a cada um, como primeira seccao do corpo:
```
## Antes de iniciar (obrigatorio)
0. Read cada skill declarada no frontmatter `skills:` ANTES de agir:
   - .claude/skills/<skill-1>.md
   - .claude/skills/<skill-2>.md
   (lista = o que esta no teu frontmatter `skills:`)
```
Modelar pelo padrao ja correcto de `tester-code.md` (que le condicionalmente por stack).

---

## CC-12 — Windows fix: python3 → python (P1)

Ficheiros (verificado/suspeito de chamar `python3`):
`self-improver.md` (Fase 5), `watch.md` + `watch/scripts/*.py` (shebang), `tester-api.md`,
`tester-performance.md`, `tester-security.md`, `dependency-auditor.md`.

Accao: SUBSTITUIR `python3` por `python` nessas invocacoes. OU usar o loop de deteccao
documentado em workflows-and-tooling.md:
```
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import sys" && break; done
```
Razao: `python3` e o stub vazio da Microsoft Store no Windows do utilizador (ModuleNotFoundError).

---

## CC-13 — CLAUDE.md · Trigger Map (P1)

Ficheiro: `CLAUDE.md`
Seccao: `### Trigger Map`

ADICIONAR linhas:
```
| ingerir conhecimento · /know · guardar isto · PDF/YouTube/Instagram/artigo · segundo cerebro | `knowledge-ingest` (agent) |
| automacao · cron · todos os dias as · recorrente · agendar tarefa | `automation-builder` (agent) |
| ler email · resumo de emails · caixa de entrada · calendario · marcar evento | `personal-comms` (agent) |
| classificar tarefa · que via · skill ou agente ou workflow | `task-router` (agent) |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| divida tecnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
```

---

## CC-14 — CLAUDE.md · Pipelines + Commands (P1)

Ficheiro: `CLAUDE.md`

(a) Seccao `### Pipelines` — ADICIONAR:
```
| Auto-orquestracao (NL) | `task-intake` → `task-router` → `/goal` → `master-orchestrator` (loop) → `tester-*` |
| Knowledge ingest | `knowledge-ingest` (markitdown → resumo → tags → memory/knowledge/) |
| Automacao | `automation-builder` (NL → automacoes.json → cron) |
```

(b) Seccao `## Commands` (tabela) — ADICIONAR:
```
| `/goal` | auto-orquestracao a partir de tarefa NL (sem PRD) |
| `/know` | ingerir conteudo na Knowledge Base (markitdown) |
```

---

## CC-15 — migrate.md · corrigir header (P2)

Ficheiro: `C:\Users\<user>\Desktop\JOCA\JOCA_Brain\.claude\commands\migrate.md`
Accao: SUBSTITUIR o header `# /goal` por `# /migrate`. (Heranca errada — confunde o router e
colide com o novo /goal.)

---

## CC-16 — Skills orfas / metadados (P2)

- `availability.md` e `planning.md`: integrar na Trigger Map do CLAUDE.md (ou fundir planning em plan). Hoje nao sao roteadas.
- `error-tracking-dev.md` + `error-tracking-prod.md`: ponderar fundir em 1 skill com 2 modos.
- Correr `python .claude/scripts/build-skill-index.py` apos qualquer mudanca de skills (Windows: `python`, nao `python3`).

---

## CC-17 — MCP markitdown (P1, FUTUROS Fase 5)

Ficheiro: `CLAUDE.md` (seccao MCPs globais) + config MCP do Claude Code.
Accao: registar `markitdown-mcp` como MCP (STDIO) ao lado do playwright.
Setup: `pip install markitdown-mcp` (Windows: `python -m pip`). Documentar em `memory/tools`.
Validar o output `.md` contra 1 ficheiro real de cada tipo antes de declarar pronto
(regra api-design.md: ficheiro existir ≠ pronto). Sem credencial → no-auth/TODO, nunca inventar.
