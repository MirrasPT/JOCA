# Task Intake — Auto-Orquestração

Corre ANTES do Decision Filter e classifica QUALQUER tarefa em 4 vias, por thresholds. O sinal do `prompt-triage.js` (partes, domínios, escala, via sugerida) não obriga: decide o modelo.
Casuística e texto integral: `reference/task-intake-casos.md`.

## A pergunta que vem primeiro: isto parte-se?

**Antes da via, conta as partes independentes. ≥2 → despachar em paralelo**; fazê-las em série é tempo deitado fora, não prudência.

**Default: workflow** (= `Agent()` em paralelo, não a ferramenta `Workflow` do harness). O principal orquestra — decide a via,
despacha, verifica o artefacto, reporta; **o código escrevem-no os agentes**. Na dúvida, despacha; **entre C e D → D**.
**Trabalho que toque ≥2 ficheiros ou passe de uma edição trivial vai para agentes**, mesmo sendo "uma coisa só" — parte-se
por ficheiro/área, no mesmo turno. «Quando NÃO escalar» é a lista **FECHADA** de excepções.
Eixo = agentes na EXECUÇÃO: não colide com `planear-ondas` (que trava quantos issues ficam PRONTOS à espera de revisão);
issues pequenos sempre, e agentes em paralelo **inclusive em issues diferentes** desde que não toquem nos mesmos ficheiros.

**Conta como parte:** pedidos ligados por "e também"/"depois"/lista · domínios com **acções** diferentes (API + componente +
deploy) · o mesmo trabalho em N sítios (um agente por sítio — o caso mais rentável). **NÃO conta:** vocabulário de vários
domínios a pedir **uma** coisa ("refactoriza o login em react" = 1). O teste é o nº de acções, não de palavras técnicas.

## As 4 vias

| Via | Quando | Acção |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisão/conversa | Responder inline |
| B — 1 Skill | 1 parte · 1 domínio · **1 ficheiro** · **edição curta** · reversível · skill match ≥60% | Read `.claude/skills/<x>.md` → executar inline. Notify `[skill: <x>]` |
| C — 1 Agente | 1 parte **mesmo indivisível**, isolável e longa (review/debug/research/deploy/build). **Caso raro** | `Agent(subagent_type="<x>")` com brief obrigatório |
| D — Fan-out | **≥2 partes independentes** · OU **1 parte em ≥2 ficheiros/áreas** · OU escala · OU feature cross-stack · OU trabalho não-trivial fora do gate de valor | N agentes **no mesmo turno**. Casa **pipeline nomeada** → **auto-runner** (`pipelines.md`), **sem perguntar** |

## Plano antes de executar (o gate de plano)

| Sinal | Plano |
|---|---|
| Via A/B · 1 ficheiro · reversível | **Nenhum** |
| Via C | O **brief obrigatório** é o plano mínimo — não escrever um segundo |
| Via D | **Plano visível antes do 1º `Agent()`**: objectivo · fronteira de ficheiros por agente · critério de aceitação por stream |
| Irreversível ★ (migration · delete · deploy · push · payments · auth · git destrutivo) | `Read(".claude/skills/plan.md")` — 7 fases, gate explícito. Sozinho activa |
| ≥3 ficheiros · feature sem precedente · arquitectura com tradeoffs reais | `Read(".claude/skills/plan.md")`; produto + design + engenharia → `/autoplan` |

Sem sinal → **age** (a tabela é a lista fechada, não licença para planear tudo). Plano = **artefacto, não documento**: 5-15
linhas no chat, critério de sucesso verificável + fronteira de ficheiros; ficheiro em `docs/` só a pedido ou se o projecto já
o usar. "ok"/silêncio → executa; só o ★ espera resposta.

## Agentes de execução por domínio

Gémeo `.claude/agents/<skill>-agent.md` por skill de execução (inline = 1 parte; agente = ≥2 ou longo). **Skill pelo ARTEFACTO DE SAÍDA**, não pelo vocabulário · domínio sem gatilho → `grep` ao `memory/SKILL_INDEX.json` antes de responder de memória · CLI externo → `memory/tools/clis.md` antes do 1.º comando · skill nova → upstream primeiro. Texto integral → casos §Agentes.

## Thresholds

- Partes independentes: 1=A/B/C · **≥2=D**
- Ficheiros: 0=A · **1 (edição curta)=B** · **≥2=D** — C só quando o trabalho for mesmo indivisível
- Domínios **com acção própria**: 0=A · 1=B/C · ≥2=D
- Escala (N sítios, mesmo trabalho) → D, um agente por sítio
- Skill match ≥60% → preferir B sobre A
- **Empate → a via mais paralela** (serializar custa tempo em CADA pedido; delegar a mais custa tokens uma vez)
- `orchestration_threshold` e `loop_max_iterations` calibráveis em `soul.md`

## Quando NÃO escalar (o gate de valor)

Fan-out custa ~15x tokens por agente. Lista **fechada** — fora dela, escala:
- é **pergunta, decisão ou conversa** — responde;
- é **uma** edição trivial num só ficheiro (valor, typo, renomear);
- as partes **dependem umas das outras** → sequencial (pipeline, não fan-out);
- as partes **tocam nos mesmos ficheiros** → reagrupa: um agente por ficheiro/área, não por tarefa.

"Isto era capaz de fazer eu" não é excepção — as quatro alíneas são.

## Verificações ANTES do fan-out

Fan-out multiplica por N o erro da premissa. **Antes do 1.º `Agent()` → `Read(".claude/reference/task-intake-casos.md")` §Verificações antes do fan-out** (fonte de verdade ambígua → perguntar · cada alvo confirmado por `ls`/`grep` nesta sessão · alvo gerado · partição cobre o alvo · sistema externo → 1 `AskUserQuestion`).

## Segurança (não negociável)

- Reversível → age sem perguntar. Irreversível (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 confirmação, mesmo em D.
- **Pergunta = sempre `AskUserQuestion`** Sim/Não, "Sim" primeiro — **qualquer** decisão avançar/não-avançar, reversível ou não, incluindo taste. A reversibilidade decide a **frequência**, nunca o formato. Texto livre (URLs, nomes) pede-se em prosa. Mensagem a terceiros: turno só com o texto, sem formulário; confirma-se no seguinte.
- **Escrever por cima de ficheiro existente é irreversível** (qualquer via; sobretudo assets já aprovados): `test -f` antes; existe → **nome irmão versionado**, salvo substituição pedida.
- **Descartar a working tree é irreversível** (`checkout --`/`restore`/`reset --hard`/`clean -fd`): `git status` antes; modificado → cópia no scratchpad. Mutação de teste desfaz-se por `cp`, nunca por `checkout`.
- **Apagar por critério ≠ por lista:** enumerar o que casa e mostrar antes, sobretudo entre clientes/projectos — um critério não é âmbito aprovado. A lista sai de UMA varredura à raiz e conta-se (mostrado = apagado); o Lixo não é rede — copiar antes para destino estável; relatório diz «movido para o Lixo», nunca «recuperável».
- **Mudar o critério de âmbito de um destrutivo** (exclude/filtro/raiz de `rsync --delete`, `rm`, poda) é acção nova → mostrar o delta (`--dry-run --itemize-changes`).
- **Medir o alcance antes de um gate** sobre risco de dados (quem, quantos, que domínios).
- **Afirmação sobre produção confirma-se na fonte** — a de subagente também; cada opção de formulário sobre produção leva a pré-condição medida; nota medida noutro ambiente diz onde e revalida-se no do cliente antes de remover.
- **Edição e `git commit` nunca no mesmo bloco sem `set -e`**; commit com `git commit --only <caminhos>`.
- **Recurso exclusivo (GPU, dispositivo, browser) preso >5 min → gate. Mudar de via por bloqueio é decisão nova** e vai ao gate (divergir de projecto irmão também).
- **Segredo colado na conversa:** destino gitignored → `git log -S`/`git status` prova que não entrou no histórico → avisar que ficou no transcript e sugerir rotação. **Nunca** repetir o valor, nem em relatório de agente.
- **Ficheiro de credenciais:** só as chaves precisas; forma inspecciona-se por **lista branca**, nunca lista negra.
- **Rodar credencial que um processo vivo usa é derrubá-lo** → gate, com a recuperação confirmada ANTES (receita Laravel: casos §Segurança). Transporte sem passar pelo modelo: `.claude/skills/credential-handling.md`.
- **Config de terceiros** (`.env`, `ini`, `toml`, `Caddyfile`, `.htaccess`) → confirmar o PARSER: imitar a forma de uma linha existente do mesmo ficheiro.
- **Matar/reiniciar processo do UTILIZADOR é irreversível** (terminal, dev server, editor) → gate; nunca por "parece parado": **controlo positivo primeiro**.
- **Pergunta de viabilidade ("dá para…?") é via A** — responde-se, não se executa. Inversa: mensagem com caminho, ficheiro ou código de erro **não** é via A — `find`/`ls` ao artefacto antes da 1.ª hipótese.
- **Sucesso prova-se pelo efeito, não pelo exit code**.
- **Utilizador diz «já existe» e a medição diz que não → perguntar onde ficou**, em vez de medir outra volta.
- **Antes de declarar bloqueio** (ou levá-lo a `AskUserQuestion`): (a) tentar a **2ª via** ao mesmo recurso (API vs mount, CLI vs REST); (b) `<cli> --help` das CLIs instaladas antes de pedir credencial; (c) prova = **inventário obtido**, nunca UI cinzenta; (d) esgotadas **2 vias nativas**, a 3.ª opção a levantar é **instalar uma ferramenta de terceiros verificada** (editor, nº de transferências, permissões, política de dados) — é escolha do utilizador num gate, não bloqueio. Vale também para afirmar capacidade/limite de ferramenta.
- **Pergunta factual sobre um repo → `git fetch` antes** (`git log --oneline HEAD..@{u} [-- <f>]`) — também antes de editar estado versionado (`PROGRESSO.md`).
- **Steward, não initiator:** em loop/chain só trabalho já no GOAL ou em chains/pipelines declaradas. **Travão:** profundidade ≤ `loop_max_iterations` (4) · o mesmo par passo→próximo não dispara 2x sem progresso novo · 3x sem progresso → parar e reportar.

⚠ Cada regra custou um incidente — porquês e acrescentos de 2026-09-15 (critério de apagar, código antes dos dados, autorização ≠ âmbito) → `Read(".claude/reference/task-intake-casos.md")`.

## Auto-runner

Via B/C/D que casa pipeline → **auto-runner** (`pipelines.md`); encadeamento, contrato e Step 0 → `chaining.md`.
