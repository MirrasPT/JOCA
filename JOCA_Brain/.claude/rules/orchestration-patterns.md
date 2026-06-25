# Orchestration Patterns

Catálogo de padrões de orquestração endorsed para o JOCA. Carregado em todas as sessões. Terso por design.

Recodificado a partir de referências públicas (addyosmani/agent-skills, system_prompts_leaks) — **conceitos**, não prompts proprietários. Nada copiado verbatim.

---

## REGRA CRÍTICA — sub-agentes não fazem spawn de sub-agentes

Um agente despachado via `Agent()` **não pode** despachar outro agente. A árvore tem 1 nível: main loop → workers. Não há netos.

Consequências directas:
- **Auto-orquestração vive no main loop ou num command** (ex.: `/one-shot`, `/goal`) — **nunca** num agente-que-chama-agentes. O `master-orchestrator` é despachado pelo command/main loop e é ele que dispara workers; ele próprio não é despachado por outro agente.
- Um classificador (`task-router`) **devolve uma decisão**; quem a executa é o **caller** (main loop / command). Ver `.claude/agents/task-router.md`.
- Pipeline de N fases que precisa de fan-out em cada fase → orquestrar do main loop / command, não enfiar tudo num único agente.

Se um design exige "agente que coordena agentes", o coordenador tem de ser o main loop ou um command — não um `subagent_type`.

---

## Padrões endorsed

### 1. Router-que-classifica-não-executa
Separar **classificação** de **execução**. Um agente leve recebe a tarefa NL, decide a via, devolve JSON, **pára**. O caller dispara.
- Implementação JOCA: `.claude/agents/task-router.md` (4 vias A/B/C/D).
- Thresholds canónicos em `rules/task-intake.md`. **NOTA:** à data desta regra esse ficheiro é **referenciado mas pode não existir** (`soul.md` e `task-router` apontam-lhe) — se faltar, o router usa fallback heurístico e di-lo no `justificacao`. Não inventar thresholds.
- Vantagem: classificação barata (modelo `inherit`/leve) decide antes de gastar tokens com orquestrador pesado.

### 2. Loop steward-não-initiator (com travão)
Um loop autónomo é **mordomo** (mantém/avança trabalho existente), não **iniciador** (não inventa trabalho novo). Travão obrigatório:
- **max iterações** — limite duro de ciclos.
- **3x-nada → pára** — 3 iterações consecutivas sem progresso mensurável → terminar e reportar.
- Sem travão, um loop "ajuda" indefinidamente e queima rate limit. Ver também `loop`/`schedule` (harness).

### 3. Fan-out paralelo numa só mensagem
Workers independentes → emitir **todas** as chamadas `Agent()` no **mesmo turno** (uma mensagem, múltiplos tool calls). Paralelas de facto, não sequenciais disfarçadas.
- Só para streams **independentes**. Streams dependentes (DB → API → frontend) = sequencial.
- Cap: 3-5 workers concorrentes (custo de contexto ~15x/agente — ver `CLAUDE.md` Context & Agents).
- Antes do fan-out: definir componentes partilhados numa **fase de fundação sequencial**; workers IMPORTAM, não recriam (ver `workflows-and-tooling.md`).

### 4. Agentes escrevem para disco, não para o contexto do supervisor
Cada worker grava o output em ficheiro (ex.: `.joca/intermediate/<stream>.md`) e devolve ao supervisor só um **resumo curto + path**.
- Porquê: o cap de 3-5 workers existe porque cada resultado completo inunda o contexto do supervisor. Resultados em disco **escapam** ao cap — o supervisor lê só o que precisa, quando precisa.
- O supervisor agrega lendo os ficheiros (`Read`), não acumulando dumps inline.
- Padrão complementar à fila de testes já existente (`.joca/test-queue.jsonl`).
- **⚠ `.joca/intermediate/` é apanhado por content-scanners do projecto-alvo.** Quando os resumos ficam DENTRO da árvore do projecto, o content-scan do Tailwind v4 (e afins) trata-os como código e regenera classes citadas neles — uma classe partida num resumo `.md` parte o build do projecto-alvo (e o gate `tsc`/`build` NÃO apanha; só o dev runtime). Mitigar: `.joca/` no `.gitignore` E excluído do content-scan (`@source not`), OU escrever os resumos no scratchpad da sessão (fora da árvore do projecto). Ver `tailwind.md` + `workflows-and-tooling.md`. (Fonte: unimedia 2026-06-23.)

### 5. Doutrina Agent / Skill / Workflow
Quando usar cada um:

| Via | Quando | Não para |
|---|---|---|
| **Skill** | Domínio com match ≥60%, cabe num contexto, sem isolamento necessário. `Read(skill)` no main loop. | Trabalho que precisa de contexto isolado ou fan-out. |
| **Agent** | Contexto isolado (review adversarial, refactor, debug profundo, scaffold), ou tarefa que sujaria o main loop. Custo ~15x. | Classificação trivial (usa router); orquestrar outros agentes (não pode — regra crítica). |
| **Workflow / command** | Cross-stack (≥2 domínios dependentes), fan-out paralelo, multi-fase com gates, ou sequência determinística destrutiva. | Tarefa de 1 ficheiro/1 domínio (overkill). |

Hierarquia de selecção: skill especializada > agente > resposta genérica (ver `CLAUDE.md`).
Sequência determinística não-paralelizável + git destrutivo → **script versionado**, não workflow (ver `workflows-and-tooling.md`).

---

## Ligações

- `.claude/agents/master-orchestrator.md` — motor de fan-out do `/one-shot`; despachado pelo command, não por outro agente.
- `.claude/agents/task-router.md` — classificador puro (padrão 1).
- `.claude/commands/one-shot.md` — entrada autónoma PRD → orchestrator → workers → testers.
- `/goal` — referenciado em `soul.md`/`task-router` como caller que executa a via do router. **NOTA:** não há `commands/goal.md` dedicado à data desta regra; na lista de skills, `/goal` mapeia para `commands/migrate.md`. Confirmar antes de assumir um command `/goal` autónomo — não fabricar.
- `rules/task-intake.md` — thresholds das 4 vias (ver NOTA no padrão 1: referenciado, possivelmente ausente).
- `rules/workflows-and-tooling.md` — briefs de sub-agente, componentes partilhados, gotchas de workflow.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Agente que faz spawn de agentes | Coordenação no main loop / command |
| Loop sem travão (iterações infinitas) | max iterações + 3x-nada-para |
| Workers despachados em mensagens separadas (serial) | Todas as chamadas `Agent()` num só turno |
| Worker devolve dump completo ao supervisor | Escreve `.joca/intermediate/` + resumo + path |
| >5 workers concorrentes | Cap 3-5; merge de streams finos |
| Fan-out sem fase de fundação | Componentes partilhados primeiro; workers importam |
| Router que também executa | Router devolve JSON e pára; caller executa |
| Inventar thresholds quando `task-intake.md` falta | Fallback heurístico + dizê-lo no `justificacao` |
| Workflow para sequência git destrutiva | Script versionado |
