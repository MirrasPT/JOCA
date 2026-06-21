# AUTONOMY_DESIGN — JOCA

Mecanismo de auto-orquestracao + modelo agentes-usam-skills.
Caveman-lite. Claude-first. Windows primario.

> Estado actual verificado na fonte (nao inventado):
> - `master-orchestrator.md`: single-pass (Fase 1-5 uma vez), PRD-gated, tabela de work-streams hardcoded a web-dev.
> - Hooks (`settings.json`): so PostToolUse(Write|Edit) + Stop. SEM SessionStart, SEM UserPromptSubmit.
> - `tester-code.md`: FAZ in-body `Read()` das skills (padrao correcto). `master-orchestrator.md`/`self-improver.md`: declaram `skills:` no frontmatter mas NAO forcam `Read()` no corpo.
> - Decision Filter (CLAUDE.md) passo 2 = "Skill exists?" — nunca pergunta skill-vs-agente-vs-workflow.
> - `self-improver.md` Fase 5 chama `python3` — stub vazio da Store no Windows do Renato.

---

## 1. O Problema (porque a autonomia hoje e fragil)

JOCA decide rotear via uma REGRA textual no CLAUDE.md ("relevancia >=60% -> Read a skill").
O modelo TEM de se lembrar de a executar a cada turn. U-curve recall (a propria CLAUDE.md avisa):
regra a meio do contexto perde-se. Resultado: auto-seleccao inconsistente.

Falta tambem o degrau a seguir: a regra so decide "skill ou nao". Nunca decide
"isto precisa de 1 agente" ou "isto precisa de workflow multi-agente em loop".
O unico caminho para o `master-orchestrator` e `/one-shot`, que EXIGE PRD.md/TECH_SPEC.md/TASKS.md.
Logo: tarefa NL arbitraria nunca auto-escala para orquestracao. Quebra objectivos #1 e #3 do Renato.

Solucao em 3 camadas, da mais determinista para a mais flexivel:
1. **Hooks** (deterministico — garante a decisao, nao depende da memoria do modelo).
2. **Rule task-intake** (decision tree ancorado, sempre carregado).
3. **task-router agent + /goal** (executa a escalada quando o intake o indica).

---

## 2. Decision Tree de Auto-Orquestracao (o nucleo)

Corre ANTES do Decision Filter existente. Classifica QUALQUER tarefa recebida em 4 vias.
Deterministico por thresholds — "decidir sozinho" deixa de ser vibes.

```
TAREFA RECEBIDA (linguagem natural)
        │
        ▼
[0] Triage barata (sem gastar agentes)
    Estimar: nº ficheiros a tocar · nº dominios · reversivel? · ha skill match >=60%? · cross-stack?
        │
        ├─ Pergunta/conversa/decisao pura (0 ficheiros) ──────────────► VIA A: RESPOSTA DIRECTA
        │
        ├─ 1 dominio · 1-2 ficheiros · reversivel · skill match >=60% ─► VIA B: 1 SKILL
        │       (Read .claude/skills/<x>.md → executar inline)
        │
        ├─ 1 dominio especialista · trabalho isolavel · beneficia de    ► VIA C: 1 AGENTE
        │   contexto proprio (ex: review, debug, research, deploy)
        │       (Agent(subagent_type="<x>") com brief obrigatorio)
        │
        └─ >=2 dominios EM PARALELO · OU >=3 ficheiros · OU feature ────► VIA D: WORKFLOW (loop)
            completa · OU cross-stack
                (task-router → /goal → master-orchestrator com GOAL + loop-ate-concluir)
```

### Thresholds concretos (deterministicos)

| Sinal | VIA A | VIA B | VIA C | VIA D |
|---|---|---|---|---|
| Ficheiros tocados | 0 | 1-2 | 1-3 isolado | >=3 OU paralelizavel |
| Dominios | 0 | 1 | 1 especialista | >=2 concorrentes |
| Beneficia de contexto isolado | nao | nao | sim | sim |
| Reversivel | — | sim | sim | sim (gates p/ irreversivel) |
| Exemplo | "qual a diferenca entre X e Y" | "adiciona um campo ao form" | "review deste PR" / "debug deste erro" / "pesquisa sobre Z" | "constroi a feature de checkout" / "automacao de noticias" |

### Regra de seguranca (herdada de soul.md + Anthropic loop.md)

- **Reversivel** -> age sem perguntar.
- **Irreversivel** (auth, payments, migrations, deletes, deploy, push, git destrutivo) -> 1 linha de confirmacao, ainda que a VIA seja D.
- **Steward, nao initiator** (adoptado do loop.md da Anthropic): em loop, o agente so continua trabalho ja estabelecido no GOAL/transcript. Nao inventa scope novo.
- **Travao anti-loop-infinito**: max N iteracoes (default 4) no workflow; 3x "nada a fazer" -> para e reporta.

---

## 3. Ancoragem no CLAUDE.md (Decision Filter) e soul.md

O decision tree vive como rule sempre-carregada (`rules/task-intake.md`) E e referenciado
do Decision Filter para sobreviver ao recall loss. Texto exacto em CANONICAL_CHANGES.md.

- **CLAUDE.md Decision Filter passo 2**: reescrito de "Skill exists?" para
  "Skill OR agente OR workflow?" com os thresholds acima.
- **CLAUDE.md**: novo passo 0 "Task intake" no topo do filtro, aponta para `rules/task-intake.md`.
- **soul.md Working Principles**: adicionar linha "Auto-escala: tarefa -> via (directa/skill/agente/workflow) por thresholds, sem o user pedir".
- **soul.md Calibration**: adicionar `orchestration_threshold` documentando os limites de escalada.

Porque ancorar em ambos: soul.md carrega sempre (slot #1), da o porque; CLAUDE.md da o COMO operacional;
a rule da o decision tree detalhado; os hooks garantem a injeccao a cada prompt.

---

## 4. Camada determinista — Hooks (o que torna a autonomia fiavel)

Adoptado de ponytail / addyosmani/agent-skills / understand-anything (todos provam o padrao).

### 4.1 SessionStart hook — injecta o mapa de decisao
No arranque de cada sessao, injecta como hidden context:
- O decision tree resumido (as 4 vias + thresholds).
- Um digest `trigger -> path` do SKILL_INDEX.json (nao o conteudo das skills — so o indice).

Efeito: o modelo tem SEMPRE o mapa de quando auto-activar skill/agente/workflow, mesmo a meio de contexto longo. Tira a decisao da dependencia da memoria do modelo.

### 4.2 UserPromptSubmit hook — triage a cada prompt
A cada prompt do user, prepende um lembrete de 1 linha + path da rule:
`[task-intake] classifica: directa/skill/agente/workflow antes de responder. Ver .claude/rules/task-intake.md`.

Efeito: a decisao de escalada e reavaliada TODOS os turns, deterministicamente. Este e o ponto de entrada que falta (objectivos #1 e #3).

### 4.3 Implementacao Windows-first (verificado contra workflows-and-tooling.md)
- Entregar `.js` (Node — ja e o que os hooks existentes usam: `track-changes.js`). Node esta garantido.
- Se algum hook precisar de Python: usar `python`, NUNCA `python3` (stub da Store).
- Sem dependencia de `jq` (gotcha documentado) — parsing em Node.
- Hooks novos sao `async` quando nao bloqueiam (padrao do track-changes).

### 4.4 Staleness hook (FUTUROS Fase 6/7, P2)
SessionStart/on-commit compara estado de memoria/grafo vs HEAD; se stale, injecta instrucao imperativa para consolidar — adoptado de understand-anything (`gitCommitHash` em meta vs HEAD). Materializa o self-learning oportunista sem o user pedir.

---

## 5. Modelo "agentes usam skills" (objectivo #2)

### 5.1 Problema verificado
`skills:` no frontmatter de um sub-agente Claude Code NAO carrega a skill automaticamente — o
harness le `name/description/tools/model`. Agentes que so declaram `skills:` no frontmatter
e nao fazem `Read()` no corpo (master-orchestrator, self-improver) NAO leem as suas skills.
`tester-code` faz bem (in-body `Read()` condicional por stack). Objectivo #2 esta meio-partido.

### 5.2 Contrato canonico (a aplicar a TODOS os agentes de dominio)
Cada agente de dominio DEVE ter, como Step 0 do corpo, um bloco explicito:

```
## Antes de iniciar
1. Read .claude/skills/<skill-primaria>.md — <porque>
2. Se <condicao de stack/dominio> → Read .claude/skills/<skill-condicional>.md
```

O `skills:` no frontmatter mantem-se (documentacao + lazy index + bridges cross-CLI), MAS a
garantia real e o `Read()` no corpo. Verificar contra a doc de subagentes do Claude Code antes
de edicao em massa (o fix e o body Read, nao o frontmatter).

### 5.3 Brief obrigatorio para sub-agentes (sub-agentes NAO herdam soul.md)
Todo o brief que o `master-orchestrator`/`task-router` injecta num agente DEVE carregar
(template canonico em CANONICAL_CHANGES.md):
1. Objectivo (2 frases)
2. Ficheiros/paths relevantes + **lista exacta de ficheiros DESTA tarefa** (evita falso-positivo no verify adversarial — gotcha de workflows-and-tooling.md)
3. Constraints do projecto
4. O que NAO fazer (exclusoes)
5. **Anti-fabricacao** — credencial/endpoint/key em falta -> no-auth ou `TODO: credencial em falta` + reportar. Nunca inventar.
6. **Verificar parsers contra resposta real** — quem escreve cliente de API externa faz 1 chamada real e valida antes de finalizar.
7. **Componentes partilhados antes do fan-out** — importar, nao recriar player/card/layout.
8. **Step 0: Read das skills relevantes** antes de escrever codigo.

Estas 4 ultimas existem como regra mas NAO estavam no template de brief do orchestrator. Passam a estar.

---

## 6. Aproveitar o que ja existe (nao reinventar)

| Necessidade | Reutiliza | Mudanca minima |
|---|---|---|
| Motor de fan-out paralelo | `master-orchestrator` | Generalizar work-streams (ler SKILL_INDEX em vez de tabela web-dev hardcoded) + adicionar loop-ate-concluir + injectar brief canonico |
| Entrada autonoma sem PRD | novo `/goal` + `task-router` agent | `/goal` aceita NL, sintetiza plano in-memory, invoca o orchestrator. `/one-shot` fica como variante PRD-driven |
| Loop com criterio de paragem | skill `loop` nativa (ja disponivel) + padrao loop.md | Codificar Fase 4.5 re-dispatch no orchestrator (max 4 iter) |
| Triage de tarefa | `rules/task-intake.md` + hooks | Novo, mas leve (regra + 2 hooks Node) |
| Self-improvement | `self-improver` + `/upgrade-joca` | Fix `python3`->`python`; trigger via Monitor (P2) |
| Lazy load do indice | `SKILL_INDEX.json` + `build-skill-index.py` | Garantir descriptions keyword-rich; correr no /create-skill |

`master-orchestrator` NAO chama agentes que chamam agentes (restricao real do Claude Code,
confirmada por addyosmani/agent-skills orchestration-patterns: subagentes nao spawnam subagentes).
Logo a auto-orquestracao vive no **main loop / num command (/goal)**, nao num agente-que-chama-agentes.
`task-router` e um agente CLASSIFICADOR (devolve a via), nao um spawner — o spawn fica no main loop / /goal.

---

## 7. Fluxo end-to-end (exemplo)

```
User (Master chat ou terminal): "constroi o checkout com Stripe e admin Filament"
        │
[UserPromptSubmit hook] prepende lembrete task-intake
        │
[main loop] corre decision tree → 2 dominios (Laravel+Filament) + payments + >3 ficheiros
        │  → VIA D (workflow)
        │  → irreversivel (payments) detectado → 1 linha de confirmacao
        ▼
/goal "checkout Stripe + admin" → sintetiza plano in-memory (sem PRD)
        │
        ▼
master-orchestrator (GOAL = checkout funcional + admin + testes verdes)
        │  Fase 2: work-streams de SKILL_INDEX (laravel-specialist, filament-builder, payment-integration)
        │  Fase 3: dispatch paralelo, cada brief = template canonico (anti-fabricacao + Read skills + file-scope)
        │  Fase 4: agregar + auto-dispatch tester-* com file-scope desta tarefa
        │  Fase 4.5: GOAL cumprido? testes verdes? NAO → re-brief o agente dono da falha (max 4 iter)
        │  payments → PARA no gate, pede confirmacao
        ▼
Report estruturado + PushNotification de outcome (FUTUROS Fase 2)
```

---

## 8. Resumo do que muda

- **2 hooks novos** (SessionStart, UserPromptSubmit) — Node, Windows-safe.
- **1 rule nova** (task-intake) — o decision tree.
- **CLAUDE.md + soul.md** — ancorar o decision tree no Decision Filter + Working Principles.
- **master-orchestrator** — loop-ate-concluir + work-streams domain-agnostic + brief canonico.
- **/goal command** — entrada autonoma sem PRD.
- **Contrato agentes-usam-skills** — Step 0 Read() em todos os agentes de dominio.
- **6-10 agentes novos** — ver PLAN.md / new_agents.
