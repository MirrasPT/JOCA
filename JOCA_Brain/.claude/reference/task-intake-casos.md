# Task Intake — casos e incidentes (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/task-intake.md`. Este ficheiro guarda a casuística: o eixo `planear-ondas`, as narrativas que originaram as duas perguntas do fan-out, e o incidente por trás de cada regra de segurança. `Read()` antes de despachar um fan-out grande, ou quando uma regra de segurança precisar do porquê.

⚠ **As regras vivem na rule, não aqui.** Este ficheiro explica-as; não as substitui. Excepção: as secções «acrescentos de 2026-09-15» e «Agentes de execução por domínio» guardam doutrina que saiu da rule por orçamento — a rule aponta para elas.

---

## Conteúdo

- A pergunta que vem primeiro — o eixo `planear-ondas`
- Duas perguntas ANTES do fan-out — os casos
- Segurança — o incidente por trás de cada regra
- Agentes de execução por domínio (texto integral)
- Verificações antes do fan-out — acrescentos de 2026-09-15
- Segurança — acrescentos de 2026-09-15
- Texto retirado da rule — corte de tokens (issue #3, 2026-09-15)
- Ligações
- Verificações antes do fan-out (saídas da rule — corte de tokens, 2026-09-23)
- Texto retirado da rule — F8.3 (issue #85, 2026-10-01)

## A pergunta que vem primeiro — o eixo `planear-ondas`

⚠ **Eixo: agentes na EXECUÇÃO.** Não colide com `planear-ondas`, que fala de **issues em curso**.
Os dois passos e os seus travões:
1. **Partir o trabalho** — muitos issues pequenos, sempre. É planeamento, não custa tokens nem
   revisão; issues grandes é que impedem o paralelismo (sem "Ficheiros prováveis" não há como saber
   o que colide).
2. **Resolver** — agentes em paralelo, **inclusive em issues diferentes**, desde que não toquem nos
   mesmos ficheiros. O travão aqui é colisão de ficheiros e tokens, não o nº de issues.

O que `planear-ondas` trava é outra coisa: quantos issues ficam **PRONTOS ao mesmo tempo** à espera
de revisão — porque quem aprova é uma pessoa só. Despachar muito é bom; entregar tudo de uma vez
para aprovação é que faz fila. Ver `.claude/skills/planear-ondas.md`.

---

## Duas perguntas ANTES do fan-out — os casos

Fan-out multiplica por N o que estiver errado na premissa. As duas verificações baratas nasceram destes dois incidentes:

- **Mais do que um candidato a "fonte de verdade" → listar e PERGUNTAR, não inferir.** Meio dia de
  trabalho de arte (14 assets) foi feito contra o mockup errado: existiam dois ficheiros de home com
  nomes parecidos e conteúdo diferente, escolheu-se um por inferência (batia com o código) e a
  divergência só apareceu quando o utilizador nomeou a pasta. **Registar a escolha no spec não é
  perguntar.** O sinal é barato de detectar: dois ficheiros cujo nome casa o mesmo conceito
  (`home.png` vs `homepage.png`) em pastas diferentes. Vale para mockups, brandguides e referências
  visuais — e para documentos de fundação **fora** do repo (uma stack decidida num documento que o
  utilizador tinha e o repo não custou ~2.000 linhas de motor deitado fora).
- **Um requisito do brief que se decide NÃO implementar exige a PROVA do bloqueio, não a descrição
  dele.** "Não dá porque X" tem de trazer o comando que mostra X. Uma feature pedida pelo utilizador
  ficou silenciosamente por fazer porque um agente escreveu no cabeçalho do ficheiro que os clips de
  áudio viviam fora de `Resources/` — estavam lá desde sempre, a premissa nunca foi verificada, ficou
  documentada como facto e sobreviveu a duas revisões. Um `ls` bastava.

As verificações acrescentadas depois (mesma secção da rule) vieram destes:

- **Constrangimento numérico com duas leituras** (2026-08-27, projecto de cliente). Um limite dito em linguagem natural ("no máximo 3 por X") tinha duas leituras defensáveis; escolheu-se uma e construiu-se um gate sobre ela. A partir daí a ambiguidade deixou de ser visível: era um requisito medido. Perguntar custa uma linha.
- **O caminho que o brief nomeia** (2026-09-02, projecto de cliente). A regra dos ≥2 candidatos cobria só o empate; um caminho **único**, vindo de memória e nunca confirmado nesta sessão, entra no brief como facto e N agentes trabalham contra ele. `ls`/`grep` nesta sessão, ou escreve-se como suspeita a confirmar.
- **A partição cobre o alvo** — três incidentes, a mesma falha: provar que cada alvo tem dono não prova que a lista de alvos está completa.
  - 2026-09-04 (projecto de cliente): a fronteira do brief saiu de uma listagem de nomes e apontou o ficheiro errado. Os ficheiros certos tiram-se dos imports da página-alvo (`grep '^import' <page>`).
  - 2026-09-07 (projecto de cliente): a partição não cobria o alvo declarado — `apps/ds` e ficheiros órfãos ficaram de fora. Correr o detector no repo inteiro, confirmar que a união das fronteiras cobre todos os hits (sobras com dono explícito) e ver quem consome os tipos exportados.
  - 2026-09-10 (joca): «todos os alvos têm dono» passou, mas a lista vinha de heurística. A lista valida-se pelo **complemento**: `git ls-files` menos a lista, e inspeccionar o que sobra.
- **Provar inexistência** (2026-09-10, joca). A prova cobriu um mecanismo e deu o efeito por inexistente; havia outro mecanismo a produzi-lo, e a busca foi por caminhos adivinhados. Enumerar primeiro todos os mecanismos que produzem o efeito; depois pesquisa indexada (`mdfind`) em vez de palpites de caminho.
- **Alvo gerado editado à mão** (2026-09-02, joca). Um ficheiro gerado corrigido à mão volta atrás na próxima corrida do gerador, em silêncio — e o toolkit tem vários (`CLAUDE.md` com blocos `:INICIO`, `AGENTS.md`/`GEMINI.md`, `memory/SKILL_INDEX.json`). O marcador está no próprio ficheiro; um `grep -l` antes de escrever o brief apanha-o.

---

## Segurança — o incidente por trás de cada regra

A regra está sempre na rule (`## Segurança (não negociável)`); aqui fica só o custo que a pagou.

### Escrever por cima de um ficheiro que já existe
A regra vivia só na skill `img-gen` e não se aplicou porque a geração seguinte não passou por lá: dois emblemas aprovados foram sobrescritos e só se recuperaram por sorte, do cache do codex. Daí valer para **qualquer via** — skill, agente, script inline, construção geométrica — e sobretudo para assets que o utilizador já viu e aprovou (imagens, PDFs, vídeos, exports).

### Descartar a working tree
`git checkout --`/`restore`/`reset --hard`/`clean -fd` sobre ficheiro com alterações por commitar apaga trabalho que nunca esteve no histórico — um ficheiro de dados de 25 entradas voltou ao draft de 140, feito por outra sessão.

### Apagar por critério ≠ apagar por lista
Uma limpeza de memória levou à frente um chat de 62 mensagens, um checkpoint e a entrada de um cliente vivo que não estava no pedido. **Um critério de busca não é um âmbito aprovado.**

2026-09-10 (joca), dois acrescentos:
- **A lista mostrada não era a lista apagada.** A regra dizia «enumerar», mas não como: a lista saiu de buscas parciais e ficou incompleta face ao que foi apagado. Receita: uma varredura única sobre a raiz (ex.: `find ~/Library -maxdepth 2 -iname '*<id>*'`), contar mostrado vs apagado, termo distintivo confirmado por um 2.º comando, quarentena com prefixo da origem.
- **«Movido para o Lixo» foi reportado como «recuperável».** Lixo despejado é perda. O que importa copia-se para destino estável na mesma operação, antes do Lixo; o relatório diz «movido para o Lixo». (A parte dos destinos perecíveis no `/save` 2d-f é de `commands/save.md`.)

### Afirmação sobre produção
- 2026-09-05 (projecto de cliente, **critical**): agiu-se em produção com base no que um subagente disse sobre o estado de produção (`APP_LOCALE`), sem verificar — regressão visível ao cliente. A acção estava autorizada; a premissa não. **O gate autoriza a acção, não valida a premissa.**
- 2026-09-05 (projecto de cliente): um `AskUserQuestion` sobre produção ofereceu 2 opções inseguras porque a pré-condição de cada uma não foi medida. Opção que depende de estado não medido → mede-se primeiro ou não se oferece.
- 2026-09-07 (projecto de cliente): uma nota medida na dev store entrou no brief como facto sobre a loja do cliente, e o workflow apagou uma promoção real. Afirmação sobre estado vivo diz em que ambiente foi medida; a que motiva remoção revalida-se no ambiente do cliente.

### Edição e commit no mesmo bloco
2026-09-11 (projecto de cliente, **critical**). Edição + `git commit` no mesmo bloco bash, sem `set -e`: a edição falhou, o commit correu na mesma e ficou no histórico com uma mensagem que descrevia uma alteração que não existia. `set -e` pára ao primeiro erro; `git diff --cached --quiet && echo NADA STAGED` antes do commit apanha o resto.

Porquê o `git commit --only <caminhos>` (saído da rule, F8.3): o `--cached --quiet` não apanha o que outra sessão deixou staged — sem `--only`, o commit leva-o.

Receita do `git commit --only` com lista de caminhos (2026-09-23 e 2026-09-29, duas falhas):
- **Correr da raiz do repo** (`cd "$(git rev-parse --show-toplevel)"`): o `git status --porcelain` dá caminhos relativos à raiz, não ao cwd.
- **Lista por ficheiro, não por variável**: `git commit --only $F` falha em zsh (a variável não se parte em palavras) → `git commit --only --pathspec-from-file=<lista.txt> -m "…"`.
- **Depois de `git add`, a lista vem de `git diff --cached --name-only`** — o `git diff --name-only` vem vazio e o commit falha com «No paths with --include/--only».

### Rodar credencial que um processo vivo usa
Receita Laravel (saída da rule, F8.3): apagar `bootstrap/cache/config.php` **antes** do `optimize` — é a recuperação a confirmar antes do gate; sem isso o bootstrap já não arranca com a credencial nova.

### Recurso exclusivo e mudança de via
- 2026-09-04 (comfyui): um trabalho prendeu a GPU da máquina ~40 min sem gate. Um recurso exclusivo ocupado muito tempo tira a máquina ao utilizador — é decisão dele.
- 2026-09-04 (projecto de cliente): um bloqueio técnico levou a mudar de via, e o utilizador aprovou o envio sem saber que o formato tinha mudado. Mudar de via por bloqueio é decisão nova e vai ao gate junto com a acção irreversível; divergir do formato de entrega de um projecto irmão é decisão do dono.

### Afirmar sem ler nem medir
- 2026-09-08 (projecto de cliente): um CLI interno devolveu erro em JSON com exit 0, e foi reportado como «criado» algo que não existia. Sucesso confirma-se pelo efeito.
- 2026-09-09 (joca): a doutrina afirmava «o codex não expõe máscara» sem inventariar o CLI instalado — o `image_gen.py edit --mask` existia. Capacidade ou limite de ferramenta sem inventário é opinião.
- 2026-09-05 (projecto de cliente): o utilizador disse «já existe», a medição disse que não, e gastou-se uma volta a provar a ausência. Perguntar onde ficou (chat, documento, tarefa) era mais barato.
- 2026-09-08 (projecto de cliente): uma mensagem que citava um nome de ficheiro e um código de erro foi tratada como via A e diagnosticada sem localizar o artefacto. `find`/`ls` antes da 1.ª hipótese; o `prompt-triage.js` passa a acusar o padrão.

### Receitas das ferramentas antes do CLI
2026-09-07 (projecto de cliente). A receita PT-PT da ferramenta estava em `memory/tools/` e foi ignorada durante 5 rondas, porque nada obrigava a lê-la antes de usar o CLI. O `session-intake.js` passa a lembrá-lo no arranque.

### Prior-art antes de escrever uma skill
2026-09-04 (comfyui). Escreveu-se componente novo sem procurar a skill oficial upstream que já existia. Ordem: upstream oficial → comunidade → índice local. A parte do `/create-skill` vive em `.claude/skills/create-skill.md`.

### Ler um ficheiro de credenciais
Se for preciso inspeccionar a forma, ocultar por **lista branca**, nunca por lista negra — um filtro que escondia chaves cujo *nome* casava token/key/secret **ao primeiro nível** não apanhou o bloco aninhado `r2` e imprimiu uma `secret_access_key` viva no transcrito.

### Matar ou reiniciar um processo do UTILIZADOR
Nunca por inferência de "parece parado": **controlo positivo primeiro** — medir um alvo que se sabe bom antes de concluir que o silêncio é morte (um "não responde" costuma ser o instrumento cego, não o processo).

**Autorização para reiniciar ≠ autorização para forçar** (2026-09-23). O utilizador autorizou «reiniciar» uma app de sync; o `quit` foi recusado («User cancelled») com a app encravada e o passo seguinte foi SIGKILL sem novo gate — o utilizador rejeitou-o. Forçar o fecho é acção diferente: **`quit` recusado volta ao gate** antes de qualquer SIGKILL/`kill -9`/`taskkill /F`.

### Declarar bloqueio, ou levar uma impossibilidade ao utilizador
Três incidentes, a mesma falha: a impossibilidade foi **descrita**, nunca medida.
- 2026-08-27 (projecto de cliente): uma opção foi dada como indisponível ao utilizador com base na UI (botão cinzento/ausente). O `AskUserQuestion` que se seguiu ofereceu escolhas falsas — a decisão dele foi gasta antes de o inventário real de opções ter sido lido.
- 2026-09-01 (projecto de cliente): declarou-se bloqueio na 1ª via de acesso a um recurso que tinha segunda (API vs mount, CLI vs REST). Enumerar as vias é mais barato do que reportar impossibilidade.
- 2026-09-01 (projecto de cliente): pediu-se uma credencial ao utilizador sem antes enumerar a superfície de comandos das CLIs já instaladas — o `--help` já resolvia.

### `git fetch` antes de responder sobre um repo
2026-08-22 (projecto interno). Respondeu-se a uma pergunta factual sobre o conteúdo de um repo lendo o clone local. Com mais do que uma máquina (ou colaborador) o clone é uma fotografia com data: o que a outra máquina empurrou não está lá, e a resposta sai errada com toda a confiança. Um `git fetch` custa segundos; a resposta errada custou retrabalho. Vale igualmente antes de editar estado partilhado versionado (`PROGRESSO.md`, `docs/ONDAS.md`).

### Mudar o âmbito de um destrutivo
2026-08-20 (joca, sincronização entre máquinas). Alterou-se o critério que define o que um `rsync --delete` apaga. O gate humano já tinha sido dado — mas para o âmbito *anterior*. Um critério novo é uma acção destrutiva nova: recalcular e mostrar o delta (`--dry-run --itemize-changes`) antes de correr.

### Gatilho pelo artefacto de saída
2026-08-27 (projecto interno). O pedido não trazia a palavra «PDF», por isso o `html-to-pdf` nunca disparou — o Trigger Map casa vocabulário, e o pedido descrevia o *conteúdo*, não o formato. A pergunta que resolve é "o que sai daqui?": o artefacto final selecciona a skill, mesmo quando ninguém o nomeia.

### Campo impresso num documento de terceiros
2026-08-27 (projecto interno). Um campo lido de um documento oficial foi tratado como facto verificado. É a inversa da regra dos design tokens: o token mede-se no alvo e é facto; o campo impresso é o que o *emissor* afirma — pode estar desactualizado ou errado, e entra em cálculos e documentos nossos sem ninguém o cruzar com 2ª fonte.

### Mensagem a terceiros — excepção ao «Pergunta = sempre `AskUserQuestion`»
2026-09-18, 2026-09-25 e 2026-09-30 (projecto de cliente, 3.ª recorrência). A regra de mostrar a mensagem antes de enviar existia na memória e foi violada na mesma: prosa + `AskUserQuestion` no mesmo turno (o formulário esconde a prosa) e depois o texto só no preview do formulário (estreito, ilegível). Mensagem a terceiros (Mattermost, email, DM) → **turno só com o texto completo, sem formulário**; a confirmação de envio vem no turno seguinte. Hook PreToolUse em `mmctl post create`/envio Gmail que exija o texto no turno anterior: componente novo, por decidir.

### Medir o alcance antes de levantar um gate
Um gate com números inventados ("471 utilizadores") desperdiça a decisão do utilizador e leva a acção inútil.

**O texto do gate é o que fica gravado** (2026-10-01). Um gate sobre ausências mostrou horários (10:15–12:45) que a API descarta — guarda só a data —, e o utilizador aprovou um texto que não correspondia ao gravado. Gate sobre escrita numa API: **criar e ler de volta 1 registo de teste** (ou ler o schema de resposta) antes de mostrar o texto, para que o mostrado seja o que fica gravado.

---

## Agentes de execução por domínio (texto integral)

Movido de `rules/task-intake.md` a 2026-09-15 (orçamento das rules); a rule guarda 1 linha com os imperativos.

Cada skill de execução tem um agente gémeo em `.claude/agents/<skill>-agent.md` (65: frontend,
tailwind, laravel-specialist, copywriting, deploy-vps, wp-*, shopify-*, …). Lê a skill como Step 0 —
**mesma doutrina**, a diferença é onde corre. Inline: barato, imediato, 1 parte. Agente: ~15x tokens,
paralelo, principal livre — ≥2 partes ou trabalho longo.

**Escolhe de propósito, com o default do lado de despachar.** Serializar trabalho que se partia em
três não é cuidado; despachar um agente para mudar uma cor não é rapidez. Fora das excepções abaixo,
o principal produz o brief e a verificação, não os ficheiros.

**Selecciona pelo ARTEFACTO DE SAÍDA, não pelo vocabulário do pedido** — pergunta "o que sai daqui?": HTML
destinado a impressão → `html-to-pdf` mesmo sem a palavra «PDF»; imagem final → `img-gen`/`image-upscale`; vídeo → `video`.
**Domínio sem gatilho → `grep` a `memory/SKILL_INDEX.json` antes de responder de memória** — a tabela de
gatilhos (`reference/trigger-map.md`) é atalho à mão; o encaminhamento por mensagem é o `prompt-triage.js` sobre
o `SKILL_INDEX.json`, o inventário gerado. Responder genericamente com uma
skill no disco é a falha mais cara do sistema (`soul.md` Hard Limits).
**CLI externo (`gen-ai`, `agy`, `mmctl`, `gws`…) → ler a linha dele em `memory/tools/clis.md` e a receita antes do 1.º comando.**
**Skill de domínio nova → procurar antes:** upstream oficial → comunidade → `memory/SKILL_INDEX.json`.

---

## Verificações antes do fan-out — acrescentos de 2026-09-15

Vivem aqui, não na rule (orçamento). A rule aponta para esta secção na linha «Antes de um fan-out grande».

| Verificação | Acção | Incidente |
|---|---|---|
| **Achado contradiz decisão registada** | `tail -40 docs/DECISIONS.md` do projecto antes do 1.º `Agent()`; se o achado a contradiz, é pergunta ao utilizador, não brief | 2026-08-23 (projecto interno, high) |
| **«Workflow» tem dois sentidos** | no JOCA, «workflow» = `Agent()` em paralelo no mesmo turno; a ferramenta `Workflow` do harness é outra coisa e só corre com o opt-in do contrato dela | 2026-08-25 (joca, high) |
| **Termo do utilizador que não casa NADA no disco** | não é gralha: listar o mais próximo que existe e perguntar qual é — corrigir em silêncio escolhe por ele | 2026-08-28 (projecto de cliente, high) |
| **Respostas de formulário incoerentes entre si** | antes de executar, cruzar as respostas (ex.: 7 células pedidas numa grelha de 6); a incoerência só rebenta na execução | 2026-08-21 (projecto interno) |
| **Os dados que o código consome existem no ambiente?** | medir antes do fan-out (`/collections.json`, `SELECT count(*)`); código escrito contra dados inexistentes passa o build e não mostra nada | 2026-08-26 (projecto de cliente, 2×) |
| **Entidade nova (marca, cliente, produto)** | inventariar assets e factos em falta e perguntar tudo **no mesmo turno**, antes de despachar | 2026-09-02 (projecto de cliente) |
| **Via de entrega já provada num projecto irmão** | `grep` à memória do irmão antes de inventar artefacto de entrega novo | 2026-09-04 (projecto de cliente) |
| **Forma do entregável** | só-visual vs narrado (e afins) pergunta-se antes de escrever conteúdo | 2026-09-10 (projecto de cliente) |
| **Enumerar consumidores de uma prop/assinatura** | o `grep` falha em homónimos e JSX; o enumerador exaustivo é o compilador: tirar a prop da assinatura e correr `tsc` | 2026-09-07 (projecto de cliente) |
| **Precedência sobre «como correr»** | o `CLAUDE.md` do projecto ganha à memória do JOCA sobre como correr um comando do projecto | 2026-08-24 (projecto de cliente) |
| **Queixa sensorial** («está lento», «pisca», «está escuro») | é sintoma, não diagnóstico: medir a grandeza antes e depois da correcção | 2026-08-31 (projecto de cliente) |
| **Anúncio de release ≠ capacidade instalada** | medir a versão instalada (`<cli> --version`, `--help`) antes de mudar doutrina por causa de uma release | 2026-09-09 (joca) |
| **`AskUserQuestion` perde o «Other»** | devolve só o rótulo escolhido, não o texto livre; URLs, nomes e valores pedem-se em prosa — o formulário escolhe entre opções | 2026-09-10 e 2026-09-11 (projecto interno) |

---

## Segurança — acrescentos de 2026-09-15

| Regra | Acção | Incidente |
|---|---|---|
| **Critério de apagar valida-se contra amostra conhecida** | antes de apagar por critério, testá-lo em itens que se sabe que devem e não devem casar: casa 0 ou casa tudo → o critério está errado (mtime/EXIF não sobrevivem a transferências) | 2026-08-29 (projecto interno, high) |
| **Pasta de sync na cloud «cheia» pode ser só estrutura** | contar `find <raiz> -type f` antes de apagar ou de dar por copiada | 2026-09-01 (joca) |
| **«Delete» pode ser reversível** | medir `SoftDeletes` (trait no model, coluna `deleted_at`) antes de classificar e levantar o gate | 2026-08-31 (projecto de cliente) |
| **Código antes dos dados** | publicar o código antes de alterar dados de produção (ou no mesmo passo) — o inverso deixa estado misto visível ao cliente | 2026-08-26 (projecto de cliente) |
| **Ocultar/despublicar** | enumerar TODAS as superfícies de exposição (página, sitemap, ficheiros por URL directo, cache/CDN, feeds) antes de agir; descobri-las em camadas deixa fugas | 2026-09-01 (projecto interno) |
| **Autorização ≠ âmbito** | o gate cobre «agir ou não»; «publicar exactamente o quê» (que ficheiros, que variantes) confirma-se à parte. Default = o mínimo mais recentemente confirmado; ambíguo → perguntar | 2026-09-03 (projecto de cliente, deploy publicou variantes rejeitadas) |
| **Aprovação consumida tarde** | aprovação dada e usada minutos depois (upload longo) → reconfirmar, ou fazer o passo longo antes do gate | 2026-09-04 (projecto de cliente) |
| **Reconstruir ficheiro por intervalos de linha** | `cp` do original antes; `wc -l` depois, a conferir com a soma esperada — truncou 28 linhas em silêncio | 2026-09-07 (projecto de cliente) |

---

## Texto retirado da rule — corte de tokens (issue #3, 2026-09-15)

A rule ficou com uma formulação curta por regra; as frases de explicação saíram para aqui, tal qual.

### A pergunta que vem primeiro
- Um agente sozinho é o caso raro (trabalho mesmo indivisível), não o meio-termo confortável.
- Via C: «beneficia de contexto próprio».
- Não é preciso o utilizador pedir: o hook `prompt-triage.js` já entrega o sinal (partes, domínios, escala) antes de tu responderes.

### Plano antes de executar
- O plano não é uma quinta via — é o que as vias C e D **consomem**. Delegar mais sem planear mais é delegar pior.
- Via A/B: planear uma mudança de cor é desperdício.
- Via D: sem o plano visível não há como saber que dois agentes não escrevem no mesmo sítio.
- `Prefer action over planning when cost of reversal is low` (soul.md) continua a mandar: a tabela é a lista fechada das excepções, não licença para planear tudo.
- Aprovação implícita — "ok" / silêncio → executa; só o ★ irreversível espera resposta.

### Thresholds
- O default dos ficheiros desceu duas vezes: era 1-2=B/≥3=D, depois ≥2 paralelizável=D, agora ≥2=D.

### Quando NÃO escalar
- Fan-out custa ~15x tokens por agente **e coordenação**.
- Edição trivial = mudar um valor, corrigir um typo, renomear. Partes dependentes = o passo 2 precisa do output do passo 1. Partes nos mesmos ficheiros = dois agentes a escrever no mesmo sítio pisam-se.
- Em caso de dúvida entre inline e fan-out: **despacha**. O custo de serializar trabalho paralelizável é maior, e repete-se em cada pedido.

### Verificações ANTES do fan-out
- Fonte de verdade: o sinal é barato de detectar — dois ficheiros cujo nome casa o mesmo conceito (`home.png` vs `homepage.png`) em pastas diferentes.
- Requisito não implementado: um `ls` costuma bastar, e uma premissa não verificada fica documentada como facto e sobrevive a revisões.
- Constrangimento com duas leituras: um gate construído sobre a leitura escolhida transforma a ambiguidade em requisito.
- Alvo gerado: ficheiro gerado corrige-se no gerador, e a edição à mão é apagada na próxima corrida.
- «Não existe»: provar um mecanismo não prova o efeito.

### Segurança
- Escrever por cima: vale para qualquer via — skill, agente, script inline, construção geométrica — e sobretudo para assets que o utilizador já viu e aprovou (imagens, PDFs, vídeos, exports). Verificação barata, sem gate.
- Descartar a working tree apaga trabalho que nunca esteve no histórico.
- Rodar credencial: é derrubar o processo mesmo quando o comando parece higiene; sem apagar o `config.php` antes, o bootstrap já não arranca.
- Config de terceiros: têm regras de aspas/escape/comentário próprias; escrever "o que parece certo" produz um ficheiro que carrega e ignora a linha.
- Viabilidade: executar o perguntado gasta a decisão do utilizador antes de ele a tomar.
- Bloqueio: impossibilidade sem o comando que a mostra é opinião, e gasta a decisão do utilizador numa opção falsa.
- `git fetch`: o clone local é uma fotografia com data e, com várias máquinas, mente por omissão.
- Mudar o âmbito de um destrutivo: o gate anterior aprovou o âmbito antigo, não este.
- Gate com números inventados desperdiça a decisão do utilizador e leva a acção inútil.

### Auto-runner · Modelo agentes-usam-skills · Ancoragem (secções fundidas)
- O objectivo é máxima autonomia: **o user diz, o JOCA conduz a sequência inteira** sem pedir o próximo passo — texto canónico em `rules/pipelines.md` §Auto-Runner.
- Skills/agentes que terminam disparam o `chain:` seguinte; subagentes recebem Step 0 + `chain:`; o campo `skills:` não carrega a skill; contrato `.joca/loop/<session_id>.json` — texto canónico em `rules/chaining.md`.
- A rule é referenciada do `CLAUDE.md` Decision Filter (passo 0 e 2). O `UserPromptSubmit` hook já **não** é um nudge genérico: o `prompt-triage.js` lê o pedido, conta partes/domínios/escala e entrega a via recomendada com o motivo.
- Padrões de orquestração detalhados em `rules/orchestration-patterns.md`.

---

## Ligações

- `.claude/rules/task-intake.md` — as 4 vias, thresholds e a lista fechada de regras (auto-carregada).
- `.claude/reference/orquestracao-casos.md` — casos de fan-out, briefs de sub-agente e anti-patterns.
- `.claude/reference/gates-runtime.md` — evidência de runtime por categoria.


## Verificações antes do fan-out (saídas da rule — corte de tokens, 2026-09-23)

Fan-out multiplica por N o erro da premissa. Antes do 1.º agente:
- **>1 candidato a "fonte de verdade"** (ex.: `home.png` vs `homepage.png`; mockups, brandguides, docs fora do repo) → **listar e PERGUNTAR**; registar a escolha no spec não é perguntar.
- **Requisito que se decide NÃO implementar** → a **prova** do bloqueio (o comando que mostra X), não a descrição.
- **Constrangimento numérico com duas leituras** ("no máximo 3 por X") → perguntar qual.
- **Cada alvo do brief confirmado por `ls`/`grep` NESTA sessão** — caminho de memória é suspeita, mesmo candidato único; ficheiros do utilizador começam na ficha do projecto (`pipelines.md` §Recon).
- **O alvo não é gerado:** `grep -l "gerado por\|não editar à mão\|:INICIO" <alvo>` — gerado corrige-se no gerador.
- **A partição cobre o alvo:** fronteiras somam tudo — imports da página-alvo, complemento contra `git ls-files`, cada sobra com dono.
- **Estado novo → todos os consumidores do estado antigo:** brief que muda como um estado se mostra → `grep` a todos os sítios que mostram o estado antigo e pô-los na fronteira de ficheiros (2026-09-28, joca: o brief nomeou 2 componentes, agente e verificador aprovaram, e dashboard, separadores e barra lateral ficaram com o estado antigo).
- **«Não existe» exige enumerar os mecanismos que produzem o efeito** + pesquisa indexada (`mdfind`). **Em UI, elemento colapsado não é elemento ausente**: expandir cada secção que se possa abrir (`> Avançado`) antes de declarar que a opção não existe; memória que contradiz a observação merece uma 2.ª passagem antes de ser dada como errada (2026-09-18, projecto interno: a opção estava atrás de um expansor fechado e a memória, que a descrevia, estava certa).
- **Padrão visual com >1 leitura** → antes de propagar, (a) medir num ecrã-exemplo que elementos o utilizador chama pelo termo («subtítulo», «principal») e incluir **todos os mecanismos** que os produzem (componente dedicado **e** cartões), ou perguntar com 2 exemplos concretos; (b) mudança de regra visual → **mostrar 1 exemplo renderizado (PNG)** ao utilizador antes de a aplicar a páginas/manuais. 2026-09-17: critério estreito, 5 de 6 agentes voltaram sem trabalho e foi precisa 2.ª vaga; 2026-09-23: «a principal deve ser maior» lido como escala em linha quando era construção vertical — ~3 ciclos produtor+verificador.
- **Formulário/conteúdo ligado a sistema externo** (CRM, ERP, headless) → UM `AskUserQuestion` à cabeça: onde se cria a estrutura · onde se edita o texto · onde vive a lógica · para onde vão os dados.

Mais verificações neste ficheiro (`docs/DECISIONS.md`, termo sem match, dados existem?, entidade nova, projecto irmão, forma do entregável).


## Texto retirado da rule — F8.3 (issue #85, 2026-10-01)

A norma ficou na rule; as frases de porquê saíram para aqui, tal qual. As que já existiam neste ficheiro não se repetiram («Other» perde-se, números inventados no gate, o gate autoriza mas não valida, lista negra não apanha blocos aninhados, instrumento cego, exit 0, clone mente por omissão, tabela de gatilhos vs `prompt-triage.js`).

- Cabeçalho: classificar por thresholds — "decidir sozinho" não é vibes. O hook `prompt-triage.js` entrega o sinal a cada prompt; o modelo decide com o sinal à frente.
- Plano antes de executar: o plano é o que C e D **consomem** — um agente não pode perguntar; o que não estiver no brief, inventa.
- Auto-runner: os agentes de execução são gerados por `node .claude/scripts/skill-agents.mjs` (também no `CLAUDE.md` do JOCA_Brain).
