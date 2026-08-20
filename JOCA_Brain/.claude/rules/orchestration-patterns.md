# Orchestration Patterns

Catálogo de padrões de orquestração endorsed para o JOCA. Carregado em todas as sessões. Terso por design.

Recodificado a partir de referências públicas (addyosmani/agent-skills, system_prompts_leaks) — **conceitos**, não prompts proprietários. Nada copiado verbatim.

---

## REGRA CRÍTICA — sub-agentes não fazem spawn de sub-agentes

Um agente despachado via `Agent()` **não pode** despachar outro agente. A árvore tem 1 nível: main loop → workers. Não há netos.

Consequências directas:
- **Auto-orquestração vive no main loop ou num command** (ex.: `/one-shot`, `/goal`) — **nunca** num agente-que-chama-agentes. O `master-orchestrator.md` é um **PLAYBOOK que o main loop/command ADOPTA** — é o **main loop** que lê o índice, decompõe e **dispara os workers ele próprio** (via `Agent()`). **NÃO** se faz `Agent(subagent_type="master-orchestrator")`: um subagente não poderia despachar workers (seriam netos, proibido). O ficheiro vive em `.claude/agents/` como doutrina canónica, mas é **executado pelo main loop**, não spawned.
- Um classificador (`task-router`) **devolve uma decisão**; quem a executa é o **caller** (main loop / command). Ver `.claude/agents/task-router.md`.
- Pipeline de N fases que precisa de fan-out em cada fase → orquestrar do main loop / command, não enfiar tudo num único agente.

Se um design exige "agente que coordena agentes", o coordenador tem de ser o main loop ou um command — não um `subagent_type`.

---

## Padrões endorsed

### 1. Router-que-classifica-não-executa
Separar **classificação** de **execução**. Um agente leve recebe a tarefa NL, decide a via, devolve JSON, **pára**. O caller dispara.
- Implementação JOCA: `.claude/agents/task-router.md` (4 vias A/B/C/D).
- Thresholds canónicos em `rules/task-intake.md` (existe; é a fonte de verdade da decisão). Se por algum motivo faltar, o router usa fallback heurístico e di-lo no `justificacao`. Não inventar thresholds.
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
- **⚠ `.joca/intermediate/` é apanhado por content-scanners do projecto-alvo.** Quando os resumos ficam DENTRO da árvore do projecto, o content-scan do Tailwind v4 (e afins) trata-os como código e regenera classes citadas neles — uma classe partida num resumo `.md` parte o build do projecto-alvo (e o gate `tsc`/`build` NÃO apanha; só o dev runtime). Mitigar: `.joca/` no `.gitignore` E excluído do content-scan (`@source not`), OU escrever os resumos no scratchpad da sessão (fora da árvore do projecto). Ver `tailwind.md` + `workflows-and-tooling.md`. (Fonte: projecto React + Tailwind v4, 2026-06-23.)

### 5b. Sessões paralelas (dois Claude no mesmo repo)

Pares, não subagentes — cada um com o seu main loop. Protocolo mínimo: **handshake** ao descobrir um
par (path · o que vou fazer · ficheiros sujos) · **fronteira por directório** (leitura livre, escrita
só no meu território) · estado partilhado (BD, portas, config, `~/CLAUDE.md`) avisa-se sempre ·
ficheiro partilhado edita-se com `Edit` cirúrgico, **nunca** `Write` · endereçar pelo socket do
`from=`, não pelos nomes opacos do `ListAgents` · artefactos derivados do **projecto**, não do cwd.
Casos e detalhe: `.claude/reference/sessoes-paralelas.md`.
### 5. Doutrina Agent / Skill / Workflow
Quando usar cada um:

| Via | Quando | Não para |
|---|---|---|
| **Skill** | Domínio com match ≥60%, cabe num contexto, sem isolamento necessário. `Read(skill)` no main loop. | Trabalho que precisa de contexto isolado ou fan-out. |
| **Agent** | Contexto isolado (review adversarial, refactor, debug profundo, scaffold), ou tarefa que sujaria o main loop. Custo ~15x. | Classificação trivial (usa router); orquestrar outros agentes (não pode — regra crítica). |
| **Workflow / command** | Cross-stack (≥2 domínios dependentes), fan-out paralelo, multi-fase com gates, ou sequência determinística destrutiva. | Tarefa de 1 ficheiro/1 domínio (overkill). |

Hierarquia de selecção: skill especializada > agente > resposta genérica (ver `CLAUDE.md`).
Sequência determinística não-paralelizável + git destrutivo → **script versionado**, não workflow (ver `workflows-and-tooling.md`).

### 6. Varredura transversal pós-fan-out
Depois de N agentes escreverem em paralelo, correr **um** agente que audita o **sistema todo** — não
os âmbitos individuais. Cada peça correcta, a junção partida, é o buraco típico do trabalho paralelo.
Esse agente **não pode ser nenhum dos produtores**. Cobre contradições de conteúdo (interface vs
documento, copy vs regra implementada), não só de código.

---

## Ligações

- `.claude/agents/master-orchestrator.md` — **playbook** de fan-out do `/one-shot`/`/goal`, **executado PELO main loop/command** (não spawned via `Agent()` — ver Regra Crítica).
- `.claude/agents/task-router.md` — classificador puro (padrão 1).
- `.claude/commands/one-shot.md` — entrada autónoma PRD → main loop adopta o playbook → workers → testers.
- `.claude/commands/goal.md` — entrada NL sem PRD: o main loop sintetiza GOAL+critérios e adopta o playbook do orchestrator (loop até concluir).
- `rules/task-intake.md` — thresholds das 4 vias (fonte de verdade da classificação).
- `rules/workflows-and-tooling.md` — briefs de sub-agente, componentes partilhados, gotchas de workflow.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Agente que faz spawn de agentes | Coordenação no main loop / command |
| Aceitar o **diagnóstico** de um agente sem reproduzir a falha | O relatório localiza o **sintoma**; a causa confirma-se no artefacto (buffer, log, estado real). Corrigir o sintoma e voltar a testar sai mais barato do que assumir que a causa estava certa |
| Brief que apresenta uma decisão de triagem como facto ("a AgentsView foi descartada e não volta") | Separar **FACTOS** verificáveis (paths, contratos, o que está no disco) de **DECISÕES** de quem despacha, e marcar estas como revogáveis: *"se isto contradisser o que encontrares, pára e reporta"*. Um agente obedece a uma decisão errada e propaga-a sem ninguém a questionar |
| Mandar scope novo por `SendMessage` a um agente já a correr | Scope novo **invalida trabalho em curso**: 4 pontos enviados a meio caducaram medições de contraste e anularam a estratégia dada no ponto anterior (~40 min perdidos). Ou se espera pelo relatório e se despacha uma segunda ronda, ou se cancela e re-despacha com o brief completo. `SendMessage` serve para **desbloquear** (dar um dado em falta), não para acrescentar objectivos |
| Agente com whitelist de ferramentas que responde "não tenho essa ferramenta" e pára | A ausência de uma ferramenta é **sinal de delegação**, não impossibilidade — tem de estar escrita no prompt como tal (despachar → verificar → tentar corrigir → só então reportar), senão o modelo lê "não está na minha lista" como "o sistema não consegue" |
| Listas de capacidades escritas à mão nos prompts | Desactualizam-se em silêncio e o modelo acredita nelas — uma lista errada é pior do que nenhuma. Apontar ao índice gerado (`memory/SKILL_INDEX.json`), não transcrever |
| Ler o output de um comando pelo princípio (`\| head`) | `git apply` é **atómico** mas imprime `Applied patch to X` para os ficheiros que passaram **antes** de abortar — um `\| head -40` mostra sucessos e esconde o erro fatal na cauda. Verificar sempre pelo **efeito** (`git status`: 1 ficheiro alterado em vez de 214), nunca pelo relatório |
| Loop sem travão (iterações infinitas) | max iterações + 3x-nada-para |
| Workers despachados em mensagens separadas (serial) | Todas as chamadas `Agent()` num só turno |
| Worker devolve dump completo ao supervisor | Escreve `.joca/intermediate/` + resumo + path |
| Agir sobre o relatório de um agente sem verificar | Relatório = **pista**, não conclusão. Confirmar o achado antes de corrigir (`grep`/`ls`/teste). Um diagnóstico errado custa mais do que o comando que o confirmava |
| >5 workers concorrentes | Cap 3-5; merge de streams finos |
| Fan-out sem fase de fundação | Componentes partilhados primeiro; workers importam |
| Router que também executa | Router devolve JSON e pára; caller executa |
| Inventar thresholds quando `task-intake.md` falta | Fallback heurístico + dizê-lo no `justificacao` |
| Workflow para sequência git destrutiva | Script versionado |
| Fan-out fecha quando o último worker devolve | Varredura transversal no fim: 1 agente (não-produtor) audita a junção |
