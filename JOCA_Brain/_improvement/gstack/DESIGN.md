# gstack → JOCA — Integração de Autonomia (design)

Fonte: análise do repo `garrytan/gstack` (59 skills, lib/, docs) clonado e lido em 2026-06-26.
Objectivo do Renato: **JOCA máximamente autónomo** — user diz, JOCA delega o workflow com as skills/agentes certos; skills/agentes encadeiam para a próxima automaticamente; subagentes têm conhecimento das skills; integrar o workflow gstack + GBrain para correr **automaticamente** no JOCA.

---

## 1. Insight central

A autonomia do gstack **não é mágica** — são 7 mecanismos concretos, todos roubáveis e compatíveis com a infra que o JOCA já tem (hooks, Brain markdown, agentes, task-intake):

| # | Mecanismo gstack | Ficheiro-fonte | Estado no JOCA |
|---|---|---|---|
| 1 | **Auto-delegação por disk-read + execute inline + auto-decide + final gate** (`autoplan` lê os SKILL.md filhos do disco, corre-os a fundo, auto-decide perguntas intermédias por princípios, só levanta "taste" no fim) | `autoplan/SKILL.md` | task-intake decide a via mas NÃO corre o pipeline sozinho; falta o auto-runner |
| 2 | **Memória institucional event-sourced** (JSONL append-only `decide`/`supersede`/`redact`, "active" computado, scope repo/branch/issue, injection-check + secret-redact na escrita, snapshot bounded p/ arranque O(active)) | `lib/gstack-decision.ts`, `lib/jsonl-store.ts` | Brain é prosa markdown — sem log estruturado de decisões nem recall por scope |
| 3 | **Guard-rails por PreToolUse hooks** (`freeze`=deny edits fora dum dir; `careful`=warn em rm -rf/DROP/force-push; `guard`=ambos; estado em ficheiro txt) | `freeze/`,`careful/`,`guard/` + `bin/check-*.sh` | JOCA tem hooks (PostToolUse/Stop/UserPromptSubmit) mas NENHUM lock de scope nem warn destrutivo |
| 4 | **Checkpoints de sessão** (snapshot branch+decisões+trabalho-restante, frontmatter YAML, append-only, cross-branch restore p/ handoff) | `context-save/`,`context-restore/` | `/save`+`/resume` existem mas guardam prosa, não checkpoint estruturado restaurável |
| 5 | **Skill routing injectado no CLAUDE.md** (secção `## Skill routing` que faz a skill auto-disparar) | gstack setup + `learn` preamble | JOCA tem o Trigger Map — falta torná-lo **auto-fire garantido** + chaining |
| 6 | **Iron-contract na criação de skills** (`skillify` nunca escreve skill meia-partida: gera script+test+fixture, **corre o teste em temp**, só commita se passar) | `skillify/SKILL.md` | `/create-skill` tem gate de avaliação mas não "test-before-commit" determinístico |
| 7 | **Aprendizagem de preferências de pergunta** (`plan-tune`: `gstack-question-preference --check <id>` → AUTO_DECIDE ou ASK; perfil declarado vs comportamento) | `plan-tune/SKILL.md` | JOCA não aprende — pergunta sempre as mesmas coisas |

E o **loop de aprendizagem** (`learn`/`retro`): `learnings.jsonl` por projecto, pesquisável, injectado no preamble de cada skill (top-3 recall), com `retro` a fazer retrospectiva. JOCA tem memória mas não a **injecta automaticamente** nem aprende com falhas.

---

## 2. Veredicto de borrowability (todas as skills)

### BORROW — alto valor (núcleo da autonomia)
- **autoplan** → padrão de auto-runner de pipeline (o centro do pedido do Renato).
- **gstack-decision (lib)** → log de decisões/aprendizagens event-sourced no Brain.
- **learn + retro** → recall automático + retrospectiva (encaixa em automação cron).
- **freeze/careful/guard/unfreeze** → guard-rails por hook (scope-lock + warn destrutivo).
- **context-save/context-restore** → checkpoints restauráveis.
- **qa (test→fix→verify loop)** → disciplina de loop com commit atómico + re-verify por severidade.
- **investigate (Iron Law: no fix without root cause + prior-learnings check)** → endurecer `log-debugger`.
- **design-review atomic-fix (issue→fix→screenshot→commit→re-screenshot→compare)** → endurecer `design-review`.
- **skillify iron-contract (test-before-commit)** → endurecer `/create-skill`.
- **plan-tune (question-preference learning)** → reduzir confirmações ao longo do tempo.
- **spec (5-phase, never-skip + dedupe gate)** → endurecer criação de spec/skill.

### JÁ-TEM (JOCA cobre; talvez afinar)
- office-hours (→ `/plan`), plan-eng-review/plan-design-review (→ `/plan`+`/design-review`), design-consultation (→ design-review+img-gen), diagram (→ `/c4-diagram`), make-pdf, canary (→ deploy-executor verifica), unfreeze (reset simples).

### BORROW — médio valor (features de produto, não-núcleo)
- **design-shotgun** (gerar N variantes de design em paralelo + board de comparação) — multiplica velocidade de design; encaixa com `/img-gen` + `frontend`.
- **design-html** (mockup aprovado → HTML de produção sem deps).
- **ship / land-and-deploy** (sync→test→audit→push→PR; merge→CI→verify prod) — pipeline de envio; JOCA tem deploy-executor mas não o pipeline pré-push.
- **cso** (OWASP Top 10 + STRIDE) — JOCA tem security-review; cso é mais estruturado.

### SKIP
- pair-agent (colab multi-agente remota — fora do foco single-agent autónomo), plan-devex (demasiado API-first), todos os `ios-*` (sem iOS), browse/GStack-Browser bespoke (JOCA usa playwright MCP), supabase/telemetria, multi-host hosts/ (JOCA já tem bridges Codex/agy).

---

## 3. Arquitectura de integração no JOCA

O pedido é comportamental (o Brain), não só features. Mapeamento:

### Camada A — Auto-delegação (o coração)
**Problema:** hoje o task-intake *decide a via* mas o main loop não *corre o pipeline sozinho*.
**Solução:** formalizar o **JOCA Pipeline Auto-Runner** (padrão autoplan):
1. `rules/pipelines.md` (novo) — catálogo de pipelines nomeados com a sequência de skills/agentes e os **gates** (onde pára p/ confirmação irreversível). Já existe a tabela "Pipelines" no CLAUDE.md → promover a runner real.
2. Cada pipeline corre como: ler o SKILL.md de cada passo → executar a fundo → auto-decidir intermédias por princípios (soul.md autonomy 0.95) → só levantar decisões de "taste"/irreversíveis no fim ou no gate.
3. `master-orchestrator` (agente do `/goal`/`/one-shot`) ganha este comportamento de runner explícito.

### Camada B — Skill/Agent chaining (encadeamento automático)
**Problema:** skills/agentes não declaram o que disparar a seguir.
**Solução:** convenção `Chain` no frontmatter/corpo:
- Adicionar campo opcional `chain:` (lista) ao template de skill e agente: "ao terminar, considerar disparar X se <condição>".
- Adicionar secção `## Próximo passo` no corpo das skills-chave (ex.: `frontend`→`design-review`→`tester-ui-ux`; `laravel-specialist`→`tester-code`→`tester-api`).
- O main loop segue a chain automaticamente (reversível → corre; irreversível → 1 linha).

### Camada C — Subagentes skill-aware (garantido)
**Problema:** o "Step 0: Read skills" é regra mas não está em todos os agentes nem no template.
**Solução:**
- Template de agente (`.claude/agents/_TEMPLATE.md`) com **Step 0 obrigatório**: "Antes de agir, Read das skills relevantes (trigger map). Brief carrega isto."
- `master-orchestrator` injecta no brief de cada worker a instrução de Read das skills + o caminho do SKILL_INDEX.
- Reforçar nos agentes existentes que produzem código (tester-code, security-review, laravel-refactor…).

### Camada D — Brain v2 (GBrain-equivalente, local-first markdown+JSONL)
**NÃO importar Postgres/Supabase.** O Brain do JOCA é markdown local-first — mantém-se. Roubar os *mecanismos*:
1. **Decision log** — `memory/decisions/<project>.jsonl` append-only (`decide`/`supersede`/`redact`), "active" computado, scope repo/branch, escrita atómica + secret-scan (reusa o padrão já documentado em workflows-and-tooling). Script `decision-log.mjs` (Node, Windows-safe).
2. **Learnings recall** — `memory/learnings/<project>.jsonl`; o hook `SessionStart`/`/resume` injecta top-N relevantes (já há infra de hooks).
3. **`/learn`** (command) — registar/pesquisar/podar aprendizagens.
4. **`/retro`** (command + automação) — retrospectiva semanal automática via o motor de automações do JOCA_OS.
5. **Checkpoints** — `/save` ganha modo checkpoint estruturado (frontmatter: branch, decisões, trabalho-restante) restaurável por `/resume`.

### Camada E — Guard-rails (hooks)
3 skills + scripts de hook (Windows-safe, PowerShell/Node em vez de bash):
- `freeze` — PreToolUse(Edit|Write) → deny fora do dir trancado (estado em `.joca/freeze-dir.txt`).
- `careful` — PreToolUse(Bash) → warn em padrões destrutivos (rm -rf, DROP TABLE, force-push, taskkill, format).
- `guard` — ambos. `unfreeze` — limpa o estado.
- Integra no `settings.json` (matchers) — JOCA já usa hooks aqui.

### Camada F — Pipelines gstack como comandos JOCA (auto-chain)
Portar como commands/agentes que **auto-encadeiam**:
- `/autoplan` (office-hours→ceo→eng→design review, auto-decidido) — novo.
- `qa` loop → reforçar `tester-*` com test→fix→verify+commit atómico.
- `investigate` Iron Law → reforçar `log-debugger`.
- `ship` (pré-push: sync→test→audit→PR) → novo command ou reforçar deploy-executor.
- `retro` → command + automação.
- design-shotgun/design-html → opcional (Camada de produto).

---

## 4. Plano faseado (2-fases, anti-clobber)

**Fase A — Fundações (mecanismos, mais aditivo, baixo risco):**
1. Guard-rails: `freeze`/`careful`/`guard`/`unfreeze` skills + hooks Windows-safe + settings.json.
2. Decision/learnings log: `decision-log.mjs` + `learnings-log.mjs` + `/learn` command + recall no hook.
3. Skill/agent chaining: campo `chain:` no template + `## Próximo passo` nas skills-chave + template de agente com Step 0.
4. Checkpoints: `/save` modo checkpoint + `/resume` restore.

**Fase B — Auto-runner + pipelines (comportamental, toca canónicos — main loop sequencial):**
5. `rules/pipelines.md` + promover o auto-runner no CLAUDE.md/soul.md/task-intake.
6. `master-orchestrator` como runner explícito + briefs skill-aware.
7. `/autoplan`, `/retro`, reforço de `tester-*`/`log-debugger`/`design-review` com os loops gstack.
8. `plan-tune`-equivalente (question-preference) — opcional, reduz confirmações.

**Fase C — Produto (opcional, valor médio):**
9. design-shotgun, design-html, ship pipeline, cso.

Ficheiros canónicos partilhados (CLAUDE.md, soul.md, task-intake.md, settings.json, SKILL_INDEX) editados **pelo main loop em sequência** (nunca fan-out paralelo). Ficheiros novos e independentes (skills/scripts novos) podem ir em paralelo.

---

## 5. Riscos / decisões em aberto
- **Onde vive a auto-delegação?** Brain (comportamento Claude Code) E/OU JOCA_OS Master (app). O pedido "user diz, JOCA delega" aplica-se aos dois. Esta integração foca o **Brain**; o Master app reusa a mesma convenção de chaining quando despacha workers.
- **Agressividade do auto-decide:** soul.md já está em autonomy 0.95 — alinhado com "max autonomy". Gates só em irreversível (auth/payments/migrations/deletes/deploy/push). Mantém-se.
- **Hooks em Windows:** os hooks gstack são bash; reescrever em Node (Windows-safe), como os hooks JOCA actuais.
- **Não inflar:** SKIP claro de ios/browse-bespoke/supabase/multi-host — JOCA já tem equivalentes ou não aplica.
