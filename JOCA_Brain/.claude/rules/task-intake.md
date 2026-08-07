# Task Intake — Auto-Orquestração

Decision tree corrido ANTES do Decision Filter. Classifica QUALQUER tarefa recebida em 4 vias.
Carregado em todas as sessões. Determinístico por thresholds — "decidir sozinho" não é vibes.

## A pergunta que vem primeiro: isto parte-se?

**Antes de escolher a via, conta as partes independentes do pedido.** Duas partes que não dependem
uma da outra são duas coisas que podiam estar a acontecer ao mesmo tempo — e fazê-las em série é
tempo deitado fora, não prudência.

> **Regra de paralelismo (calibrada): ≥2 partes independentes → despachar em paralelo.**

Isto não precisa de o utilizador pedir. Ele não tem de dizer "usa agentes", "/goal" nem "em
paralelo" — a avaliação é feita em todos os turnos, e o hook `prompt-triage.js` já entrega o
sinal (partes, domínios, escala) antes de tu responderes.

**O que conta como parte independente:**
- pedidos ligados por "e também", "depois", "além disso", ou em lista/bullets;
- domínios diferentes **com acções diferentes** (criar API + criar componente + fazer deploy);
- o mesmo trabalho repetido em N sítios (todas as páginas, cada ficheiro, um por um) — o caso mais
  rentável: um agente por sítio.

**O que NÃO conta** (armadilha comum): uma frase que menciona vocabulário de vários domínios mas
pede **uma** coisa. "Refactoriza o componente de login em react" toca frontend e backend no léxico e
é **uma** tarefa. O teste é o número de acções pedidas, não o de palavras técnicas.

## As 4 vias

| Via | Quando | Acção |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisão/conversa | Responder inline |
| B — 1 Skill | 1 parte · 1 domínio · 1-2 ficheiros · reversível · skill match ≥60% | Read `.claude/skills/<x>.md` → executar inline. Notify `[skill: <x>]` |
| C — 1 Agente | 1 parte, mas isolável e longa (review/debug/research/deploy/build) · beneficia de contexto próprio | `Agent(subagent_type="<x>")` com brief obrigatório |
| D — Fan-out | **≥2 partes independentes** · OU escala (mesmo trabalho em N sítios) · OU feature completa cross-stack | Despachar N agentes **no mesmo turno**. Se casar uma **pipeline nomeada** (`rules/pipelines.md`) → o **auto-runner** corre-a a fundo. |

## Agentes de execução por domínio

Cada skill de execução tem um agente correspondente em `.claude/agents/<skill>-agent.md` (65 deles:
frontend, tailwind, laravel-specialist, copywriting, deploy-vps, wp-*, shopify-*, …). O agente lê a
skill como Step 0, portanto **tem a mesma doutrina** — a diferença é onde corre.

Para o mesmo trabalho tens duas vias legítimas:

| | Ler a skill e fazer inline | Despachar `<skill>-agent` |
|---|---|---|
| **Quando** | 1 parte; queres o resultado no fio da conversa | ≥2 partes; ou trabalho longo que ocuparia o principal |
| **Custo** | Barato — sem contexto novo | ~15x tokens |
| **Ganho** | Imediato, sem coordenação | Paralelo; o principal fica livre |

**Escolhe de propósito.** Fazer inline trabalho que se partia em três não é ser cuidadoso — é
serializar sem motivo. Despachar um agente para mudar uma cor também não é ser rápido — é pagar
15x por nada.

## Thresholds

- Partes independentes: 1=A/B/C · **≥2=D**
- Ficheiros: 0=A · 1-2=B · 1-3 isolado=C · ≥3 ou paralelizável=D
- Domínios **com acção própria**: 0=A · 1=B/C · ≥2=D
- Escala (N sítios, mesmo trabalho) → D, um agente por sítio
- Skill match ≥60% → preferir B sobre A
- `orchestration_threshold` e `loop_max_iterations` calibráveis em `soul.md`

## Quando NÃO escalar (o gate de valor)

Fan-out custa ~15x tokens por agente e coordenação. Não vale quando:
- é **pergunta, decisão ou conversa** — responde;
- é **uma** edição pequena (mudar um valor, corrigir um typo, renomear);
- as partes **dependem umas das outras** (o passo 2 precisa do output do passo 1) → sequencial, e
  aí é uma pipeline, não fan-out;
- as partes **tocam nos mesmos ficheiros** → dois agentes a escrever no mesmo sítio pisam-se.
  Reagrupa: um agente por ficheiro/área, não por tarefa.

Em caso de dúvida entre inline e fan-out num trabalho de 2 partes: **despacha**. O custo de
serializar trabalho paralelizável é maior, e repete-se em cada pedido.

## Segurança (não negociável)

- Reversível → age sem perguntar. Irreversível (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 linha de confirmação, mesmo em D.
- **Escrever por cima de um ficheiro que já existe é irreversível.** Vale para qualquer via — skill,
  agente, script inline, construção geométrica — e sobretudo para assets que o utilizador já viu e
  aprovou (imagens, PDFs, vídeos, exports). A regra vivia só na skill `img-gen` e não se aplicou
  porque a geração seguinte não passou por lá: dois emblemas aprovados foram sobrescritos e só se
  recuperaram por sorte, do cache do codex. Verificação barata, sem gate: `test -f <path>` antes de
  escrever; se existir, **nome irmão versionado** (`nome-v2.png`). Só se sobrescreve quando o
  utilizador pediu explicitamente substituição.
- Steward, não initiator: em loop, só continuar trabalho já no GOAL. Não inventar scope.
- Anti-loop: workflow tem máx N iterações (default 4); 3x "nada a fazer" → parar e reportar.

## Auto-runner (o JOCA delega e encadeia sozinho)

O objectivo é máxima autonomia: **o user diz, o JOCA conduz a sequência inteira** sem pedir o próximo passo.
- Via B/C/D que casa uma pipeline → correr a pipeline pelo **auto-runner** (`rules/pipelines.md`): cada passo a fundo, auto-decisão das intermédias reversíveis (princípios em `pipelines.md`), gate só em irreversível, encadeamento automático (`rules/chaining.md`).
- Skills/agentes que terminam disparam o `chain:` seguinte automaticamente (reversível → sem perguntar; notificar `[chain → x]`).
- Subagentes recebem no brief o **Step 0 (Read das skills)** + o `chain:` deles (devolvem o próximo passo sugerido; o caller dispara).
- Travão: `loop_max_iterations` (soul.md) + 3x-sem-progresso → parar.

## Modelo agentes-usam-skills

Quem despacha um agente (via C/D) carrega no brief a instrução de **Read das skills relevantes** (Step 0).
O campo `skills:` no frontmatter de um agente NÃO carrega a skill — a garantia real é o Read no corpo.

## Ancoragem

Referenciado do `CLAUDE.md` Decision Filter (passo 0 e 2). Injectado a cada prompt pelo
`UserPromptSubmit` hook — que já **não** é um nudge genérico: o `prompt-triage.js` lê o pedido,
conta partes/domínios/escala e entrega a via recomendada com o motivo. O hook não obriga; decide o
modelo. Mas decide com o sinal à frente, não de memória.
Padrões de orquestração detalhados em `rules/orchestration-patterns.md`.
Agentes de execução gerados por `node .claude/scripts/skill-agents.mjs` (fonte: as próprias skills).
