# Orchestration Patterns

Padrões de orquestração endorsed. Porquês, incidentes e anti-patterns completos: `reference/orquestracao-casos.md`.

## REGRA CRÍTICA — sub-agentes não fazem spawn de sub-agentes

A árvore tem 1 nível: main loop → workers; um agente de `Agent()` **não pode** despachar outro. Logo:
- Auto-orquestração vive no **main loop ou num command** (`/one-shot`, `/goal`). O `master-orchestrator.md` é um **PLAYBOOK que o main loop ADOPTA** (lê o índice, decompõe, dispara os workers ele próprio) — **NUNCA** `Agent(subagent_type="master-orchestrator")`.
- Pipeline de N fases com fan-out por fase → orquestra o main loop/command, não um agente único.

## Padrões endorsed

### 1. Router-que-classifica-não-executa
Um classificador leve (`task-router`, 4 vias) **devolve a decisão** (JSON) e **pára**; executa o **caller**. Sem `task-intake.md`, fallback heurístico dito no `justificacao` — não inventar thresholds.

### 2. Loop steward-não-initiator
Loop autónomo mantém/avança trabalho existente, não inventa; travão obrigatório (`task-intake.md` §Segurança).

### 3. Fan-out paralelo numa só mensagem
Todas as `Agent()` de streams **independentes** no **mesmo turno**; dependentes (DB → API → frontend) = sequencial. Cap 3-5 concorrentes (~15x/agente).
- **Fundação sequencial primeiro**: componentes partilhados (workers IMPORTAM) + **mapa de assets** (fonte de cada imagem/fonte/ícone e caminho que o BUILD consome); workers apontam ao **artefacto canónico**, nunca a drafts.
- **A fundação fecha com gate de quem NÃO a escreveu**, antes do 1º `Agent()`, com **quebra deliberada** que tem de acusar; o **comando de prova** do brief testa-se contra 1 caso positivo e 1 negativo.
- **Custo:** ≥6 agentes ou loop de rondas → ordem de grandeza de tokens antes; consumido no fim.
- **Input que é output de outro agente da MESMA vaga** → vaga seguinte, ou o caller congela-o (copia) no brief.
- **Frentes que partilham interface** (evento, tipo, rota, payload) → **contrato exacto** com nomes literais nos dois briefs, incluindo **números de decisão reservados por frente** (folha de trabalho nunca usa o prefixo `D`).
- **Mesmo repo = mesmo HEAD:** nenhum agente cria branch, `checkout` ou `stash`; ≥2 escritores no mesmo ficheiro → serializar. **Ficheiro de montagem** (ex.: `page.tsx`) é do caller, ligado antes do 1º `Agent()`; cada agente tem **pasta de build e porta próprias** (`reference/workflows-and-tooling.md`).
- **Cronometrar UMA iteração** antes de N agentes no mesmo build: >~2 min → optimizar o build primeiro.
- **Não escrever em ficheiros que o watcher vigia enquanto o utilizador testa** — esperar, ou cópia + promoção no fim.

### 4. Agentes escrevem para disco, não para o contexto do supervisor
Worker grava o output em ficheiro e devolve **resumo curto + path**; só-leitura (`Explore`, `task-router`, `codex-review`) → **limite de linhas**. Corrida multi-agente longa → relatórios em `~/.claude/joca-runs/<YYYY-MM-DD>-<tarefa>/`, nunca em `.joca/intermediate/` nem no scratchpad.

Regras duras do brief (linhas fixas ao lado do Step 0, nunca imprimir ambiente/credenciais, destino por agente, `failed` não garante que parou, diagnóstico reproduz-se) → `reference/orquestracao-casos.md` §Regras duras do brief. **Ler antes de escrever qualquer brief.**

### 5b. Sessões paralelas (dois Claude no mesmo repo)
Pares, não subagentes: **`ListAgents` ao começar num repo partilhado**; havendo par, ou antes de `/update-joca`·`/upgrade-joca` → `Read(".claude/reference/sessoes-paralelas.md")`.

### 5. Doutrina Agent / Skill / Workflow
Vias e thresholds: `task-intake.md`. Sequência determinística não-paralelizável + git destrutivo → **script versionado**, não workflow.

### 6. Varredura transversal pós-fan-out
**Obrigatória ao fechar cada onda com ≥2 agentes**: **um** agente, **não-produtor**, audita o **sistema todo**.
Regras da varredura (conteúdo e peças não ligadas, `merge-base` por branch, inexistência com comando, refuta o «pronto», estado escrito, vaga sem testes) → `reference/orquestracao-casos.md` §Varredura.

⚠ **Antes de um fan-out, de um brief de sub-agente, ou de auditar a junção → `Read(".claude/reference/orquestracao-casos.md")`.**
