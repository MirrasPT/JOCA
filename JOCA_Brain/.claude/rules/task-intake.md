# Task Intake — Auto-Orquestração

Decision tree corrido ANTES do Decision Filter. Classifica QUALQUER tarefa recebida em 4 vias.
Carregado em todas as sessões. Determinístico por thresholds — "decidir sozinho" não é vibes.

## A pergunta que vem primeiro: isto parte-se?

**Antes de escolher a via, conta as partes independentes do pedido.** Duas partes que não dependem
uma da outra são duas coisas que podiam correr ao mesmo tempo; fazê-las em série é tempo deitado
fora, não prudência. **≥2 partes independentes → despachar em paralelo.**

> **Default: delegar.** O modo normal é **workflow com agentes em paralelo**, não o chat principal a
> escrever. O principal orquestra — decide a via, despacha, verifica o artefacto, reporta; **o código
> escrevem-no os agentes**. Na dúvida, despacha. "Quando NÃO escalar" (abaixo) é o travão, não o
> default. Não é preciso o utilizador pedir: o hook `prompt-triage.js` já entrega o sinal (partes,
> domínios, escala) antes de tu responderes.
>
> ⚠ **Eixo: agentes na EXECUÇÃO.** Não colide com `planear-ondas`, que fala de **issues em curso**.
> Os dois passos e os seus travões:
> 1. **Partir o trabalho** — muitos issues pequenos, sempre. É planeamento, não custa tokens nem
>    revisão; issues grandes é que impedem o paralelismo (sem "Ficheiros prováveis" não há como saber
>    o que colide).
> 2. **Resolver** — agentes em paralelo, **inclusive em issues diferentes**, desde que não toquem nos
>    mesmos ficheiros. O travão aqui é colisão de ficheiros e tokens, não o nº de issues.
>
> O que `planear-ondas` trava é outra coisa: quantos issues ficam **PRONTOS ao mesmo tempo** à espera
> de revisão — porque quem aprova é uma pessoa só. Despachar muito é bom; entregar tudo de uma vez
> para aprovação é que faz fila. Ver `.claude/skills/planear-ondas.md`.

**Conta como parte independente:** pedidos ligados por "e também"/"depois"/lista · domínios
diferentes **com acções diferentes** (criar API + criar componente + deploy) · o mesmo trabalho em N
sítios (o caso mais rentável: um agente por sítio).
**NÃO conta:** uma frase com vocabulário de vários domínios que pede **uma** coisa ("refactoriza o
componente de login em react" = 1 tarefa). O teste é o nº de acções pedidas, não de palavras técnicas.

## As 4 vias

| Via | Quando | Acção |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisão/conversa | Responder inline |
| B — 1 Skill | 1 parte · 1 domínio · **1 ficheiro** · reversível · skill match ≥60% | Read `.claude/skills/<x>.md` → executar inline. Notify `[skill: <x>]` |
| C — 1 Agente | 1 parte, mas isolável e longa (review/debug/research/deploy/build) · beneficia de contexto próprio | `Agent(subagent_type="<x>")` com brief obrigatório |
| D — Fan-out | **≥2 partes independentes** · OU escala (mesmo trabalho em N sítios) · OU feature completa cross-stack | Despachar N agentes **no mesmo turno**. Se casar uma **pipeline nomeada** (`rules/pipelines.md`) → o **auto-runner** corre-a a fundo. |

## Plano antes de executar (o gate de plano)

O plano não é uma quinta via — é o que as vias C e D **consomem**. Um agente não pode perguntar: o
que não estiver no brief, ele inventa. Delegar mais sem planear mais é delegar pior.

| Sinal | Plano |
|---|---|
| Via A/B · 1 ficheiro · reversível | **Nenhum.** Planear uma mudança de cor é desperdício |
| Via C · 1 agente | O **brief obrigatório** já é o plano mínimo — não escrever um segundo |
| Via D · fan-out | **Plano visível antes do 1º `Agent()`**: objectivo · fronteira de ficheiros por agente · critério de aceitação por stream. Sem isto não há como saber que dois agentes não escrevem no mesmo sítio |
| Irreversível ★ (migration · delete · deploy · push · payments · auth · git destrutivo) | `Read(".claude/skills/plan.md")` — 7 fases, gate explícito. Sozinho activa |
| ≥3 ficheiros · feature nova sem precedente · arquitectura com tradeoffs reais | `Read(".claude/skills/plan.md")`. Se cruzar produto + design + engenharia → `/autoplan` |

Sem sinal → **age**. `Prefer action over planning when cost of reversal is low` (soul.md) continua a
mandar: a tabela é a lista fechada das excepções, não licença para planear tudo.

**O plano é artefacto, não documento:** 5-15 linhas no chat, com critério de sucesso verificável e
fronteira de ficheiros. Ficheiro em `docs/` só se o utilizador pedir ou o projecto já o usar.
Aprovação implícita — "ok" / silêncio → executa; só o ★ irreversível espera resposta.

## Agentes de execução por domínio

Cada skill de execução tem um agente gémeo em `.claude/agents/<skill>-agent.md` (65: frontend,
tailwind, laravel-specialist, copywriting, deploy-vps, wp-*, shopify-*, …). Lê a skill como Step 0 —
**mesma doutrina**, a diferença é onde corre. Inline: barato, imediato, 1 parte. Agente: ~15x tokens,
paralelo, principal livre — ≥2 partes ou trabalho longo.

**Escolhe de propósito, com o default do lado de despachar.** Serializar trabalho que se partia em
três não é cuidado; despachar um agente para mudar uma cor não é rapidez. Fora das excepções abaixo,
o principal produz o brief e a verificação, não os ficheiros.

**Domínio fora do Trigger Map do `CLAUDE.md` → `grep` a `memory/SKILL_INDEX.json` antes de responder
de memória** — o mapa é atalho à mão, o índice é o inventário gerado. Responder genericamente com uma
skill no disco é a falha mais cara do sistema (`soul.md` Hard Limits).

## Thresholds

- Partes independentes: 1=A/B/C · **≥2=D**
- Ficheiros: 0=A · **1=B** · 2 isolado=C · **≥2 paralelizável=D** (era 1-2=B, ≥3=D — o default desceu)
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

- Reversível → age sem perguntar. Irreversível (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 confirmação, mesmo em D — e **em `AskUserQuestion` de Sim/Não com o "Sim" em primeiro**, nunca pergunta aberta em texto.
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
- **Contrato de continuidade:** via C/D ou pipeline → escrever `.joca/loop.json` (passos, `produtor`,
  `verificador`, `estado`) ANTES de começar e actualizar a cada passo. O `Stop` hook
  (`hooks/stop-continuar.js`) lê-o e dá **um empurrão por turno** — não é um loop: fechar os passos é
  teu. Gate humano → `"aguarda_utilizador": true` antes de perguntar.

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
