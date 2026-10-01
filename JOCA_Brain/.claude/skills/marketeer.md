---
name: marketeer
description: "Orquestrador do ciclo de marketing de uma marca: retoma o estado em disco e conduz F0 arranque → F1 análise → F2 proposta → F3 artes → F4 implementação, com fan-out de agentes do pack, revisão adversarial e gates de aprovação. MUST be invoked when the user says: /marketeer, marketeer, marketing da marca, ciclo de marketing, campanha completa para a marca, plano de marketing para o cliente. SHOULD also invoke when: retomar o marketing de uma marca, em que fase está o marketing do cliente X, fazer análise + proposta + artes + campanhas de uma marca."
triggers: /marketeer, marketeer, ciclo de marketing, marketing da marca, marketing do cliente, campanha completa, plano de marketing, retomar marketing, brand marketing cycle, full marketing workflow
chain: marketeer-review, mkt-conectores, mkt-marca, mkt-mercado, mkt-auditoria, mkt-estrategia, mkt-criativos, mkt-relatorio
---
# marketeer

Orquestrador do workflow `/marketeer <marca> [analise|proposta|artes|implementacao]`. Não faz o
trabalho de marketing: decide a fase, despacha as skills `mkt-*` e os agentes do pack, guarda o
estado e segura os gates. O fecho do ciclo (F5) é da skill `marketeer-review`.

**O `CONTRATO.md` do pack ganha a esta skill.** Lê-o antes do passo 0 (`<MKT>/CONTRATO.md`).

## Regras que esta skill impõe (CONTRATO §5, resumo)

- Nada inventado: cada número com `[fonte]` (URL/comando + data), `[inferência]` ou `[por confirmar]`.
  Ausente não é zero: canal sem acesso = «não verificado».
- Credenciais nunca no chat, em stdout, no disco da marca nem no git; nunca leias `~/.config/marketeer/`.
- **Aprovar ≠ ativar.** Tudo nasce em pausa ou rascunho; ensaio antes; custo em € por dia e por mês à
  vista; `AskUserQuestion` Sim/Não. **Ativar campanhas é sempre manual, pelo dono da conta.**
- Medição antes de lançar (gate da F4). Quem produz não revê (F2 e F3 → `mkt-revisor-agent`).
- Conversões de plataformas diferentes não se somam. Portugal primeiro: €, RGPD, Lei 41/2004.
- Uma decisão = um `AskUserQuestion`, 2-4 opções derivadas de fonte, a recomendada primeiro, sempre
  «Não sei». Valor livre (€, nome, data) → o operador escreve-o na opção livre do formulário.
- Relatórios para pessoas em `.html` local, abertos no browser (`open` no macOS, `start` no Windows).
- Uma junção passa **contexto, nunca denominador**: um total de uma fonte (faturação da empresa) não
  entra no rácio de outra que mede um universo mais estreito (vendas online, leads de um canal).

## Recebe
- `$ARGUMENTS` = `<marca> [analise|proposta|artes|implementacao]`.
- `<RAIZ>/clientes/<slug>/`: `dossier.md`, `marca.md`, `conectores.md`, `estado.json`, `ciclos/<ciclo>/`.

## Entrega
- `estado.json` atualizado a cada passo (só por `estado.mjs`).
- `marca.md` → secção `## Objetivos e orçamento` (F0); o resto escrevem-no as skills de trabalho.
- `ciclos/<ciclo>/01-analise.*`, `02-proposta.*`, `03-artes/`, `04-implementacao.md` (pelas skills;
  o `04-implementacao.md` tem um só escritor: esta skill).
- `ciclos/<ciclo>/revisao-<fase>.md` (`proposta` · `artes` · `implementacao`; o `review` grava-o a
  `marketeer-review`): cada volta do `mkt-revisor-agent`, gravada por quem conduz a fase (o revisor não escreve).
- `<ciclo>` é **sempre** o campo `.ciclo` do `estado.mjs ler` (CONTRATO §3), nunca a data de hoje
  (`AAAA-MM`, ou `AAAA-MM-2`… quando abriu outro ciclo no mesmo mês).

## Passo 0 — situar (sempre, antes de qualquer fase)

1. **`<MKT>`** (CONTRATO §2): `MARKETEER_HOME` → `<raiz do JOCA_Brain>/.claude/marketeer` →
   `~/.claude/marketeer`. Confirma com `ls "<MKT>/scripts"`. Falta → pára e diz como instalar.
   Sem `"<MKT>/node_modules"` → corre `npm --prefix "<MKT>" ci` e, 1× por máquina,
   `npx --prefix "<MKT>" playwright install --only-shell chromium`.
2. **`<RAIZ>`:**
   ```bash
   node "<MKT>/scripts/raiz.mjs"
   ```
   Saída 0 → a linha impressa é a `<RAIZ>`. Saída 2 → `AskUserQuestion` «Onde guardo os dados das
   marcas?»: `~/Marketeer (recomendado)` / «Outra pasta (escreve o caminho)» / «Não sei» (→ pára).
   Grava com `node "<MKT>/scripts/raiz.mjs" --definir "<pasta>"`. Saída 1 → mostra o erro e pára.
   A partir daqui **todos** os scripts correm com `MARKETEER_RAIZ="<RAIZ>"` à frente.
3. **Marca e fase pedida.** Se o último termo de `$ARGUMENTS` for `analise`, `proposta`, `artes` ou
   `implementacao`, é a fase pedida; o resto é o nome. Sem nome → pergunta. Slug pelo script, nunca
   de cabeça:
   ```bash
   node "<MKT>/scripts/criar-dossier.mjs" --slug - <<'NOME'
   <nome da marca>
   NOME
   ```
   Saída ≠ 0 (nome só com símbolos) → formulário a pedir o slug. Sem `"<RAIZ>/clientes/<slug>/"` →
   `ls "<RAIZ>/clientes"`; se houver um parecido, `AskUserQuestion` «É esta marca?» (as existentes
   parecidas / «Marca nova» / «Não sei»).
4. **Estado:**
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" ler <slug>
   ```
   Antes da 1.ª chamada lê o cabeçalho de uso do `estado.mjs` (subcomandos e argumentos exatos):
   esta skill usa `ler`, `marcar`, `aprovar`, `revisao` e `ciclo-novo` — se algum faltar, pára e reporta.
5. **Confirma o estado contra o disco** antes de confiar nele (ficheiros em `ciclos/<ciclo>/`): passo
   `feito` sem o artefacto — F1 `01-analise.md` · F2 `02-proposta.md` · F3 `03-artes/aprovacao.html` ·
   F4 `04-implementacao.md` — volta a `pendente` (`estado.mjs marcar`) e di-lo numa linha. Um estado
   que mente gera relatórios fantasma. **Exceção — F3 sem peças:** F3 `feito` sem `aprovacao.html`
   não se reabre quando `proxima_accao` começa por «F3 sem peças» ou o `04-implementacao.md` tem a
   linha `Artes: F3 sem peças` (F3.1 e F4.1 escrevem-nas).
6. **Retoma** — a 1.ª linha que casa, por esta ordem:

   | Situação | Entra em |
   |---|---|
   | Sem `estado.json` (1.º ciclo) | F0 |
   | Fase pedida nos argumentos | essa fase, se os pré-requisitos existem (abaixo) |
   | `passos.F5` = `feito` (review completa — sem revisões futuras —, ciclo seguinte por abrir) | corre `estado.mjs ciclo-novo <slug>` (`marketeer-review` §9.1, com o mesmo tratamento de erro) e entra na F1 delta |
   | `passos.F4` = `feito` (o script põe `fase` = F5; F5 `pendente`, ou `em_curso` depois de uma review parcial) | não refaz nada. Há `revisoes` com data > hoje → diz «próxima revisão a <menor data futura>» (e, se houver, os canais em «Ainda por rever» do `05-review.md`) e **oferece de novo a review**: `Read` a `marketeer-review` e segue o §1 dela, cuja pergunta já traz «Voltar a <menor data futura>» (uma pergunta só, não duas). Nenhuma futura → as datas já passaram: oferece a review por `AskUserQuestion` («Rever agora (recomendado)» / «Mais tarde» / «Não sei» = mais tarde) |
   | `passos.F0` ≠ `feito`, ou `marca.md` sem `## Objetivos e orçamento` preenchido | F0 (só as perguntas em falta) |
   | `fase` + passo `em_curso`/`pendente` | essa fase: lê primeiro `proxima_accao` (diz o que falta, ex.: medição) e entra no 1.º artefacto em falta |

   Ciclo aberto pela review (`ciclo-novo`: F0 `feito`, `fase` = F1) cai na última linha e faz a **F1
   só com o delta** (`marketeer-review` §9) — há um `ciclos/*/05-review.md` de um ciclo anterior.

   Pré-requisitos: proposta ← `01-analise.md`; artes ← `aprovacoes.proposta`; implementação ←
   `aprovacoes.artes` (ou F3 marcada «sem peças») + gate de medição. Falta um → di-lo e oferece a fase
   anterior por `AskUserQuestion`.
7. **No JOCA** (existe `.joca/` na pasta atual): escreve o contrato de continuidade de
   `rules/chaining.md` com os passos que faltam deste ciclo, `produtor`/`verificador` distintos, e
   `aguarda_utilizador: true` em cada gate. Sem o JOCA, o `estado.json` é o único estado.

## F0 — arranque (1.º ciclo, ou campos em falta)

1. **Sem `dossier.md`** → pergunta o site (opção recomendada: o que aparecer em `$ARGUMENTS` ou numa
   pesquisa pelo nome, com o URL citado) e cria o dossier mínimo (campo não respondido fica fora):
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/criar-dossier.mjs" "<RAIZ>" <<'JSON'
   {"nome": "<nome>", "site": "<url>"}
   JSON
   ```
   Saída 2 → já existe: lê-o e segue. Saída 1 → mostra o erro.
2. **Entrevista curta**, uma pergunta por `AskUserQuestion`, por esta ordem, só as que faltam em
   `marca.md`. Opções derivadas do site/dossier/diagnóstico (cita a fonte na `description`):
   1. **Objetivo de negócio** (leads, vendas, marcações, chamadas, notoriedade) — deriva dos CTA do site.
   2. **Orçamento mensal de media** em € (sem honorários). Há gasto lido numa conta → «Manter ~X €/mês
      [fonte]» como opção; senão «Ainda por decidir (a proposta sugere)».
   3. **Valor de um cliente ou margem por venda** em € — é o que permite à F2 fixar o custo máximo
      aceitável por lead. «Não sei» → a F2 trabalha sem custo-alvo e di-lo.
   4. **Quem responde aos leads e em quanto tempo** (nome/função + prazo).
   5. **Prazo** (data ou evento a que o ciclo tem de chegar).
   6. **Aprovador** da proposta, das artes e da implementação (nome/função; pode ser o operador).
3. **Grava** em `marca.md`. Não existe → `test -f` e cria-o com as 9 secções fixas do CONTRATO §2,
   todas `<sem fonte>` exceto esta. Existe → edita **só** `## Objetivos e orçamento`:
   ```markdown
   ## Objetivos e orçamento
   - Objetivo de negócio: <resposta> [fonte: operador, AAAA-MM-DD]
   - Orçamento mensal de media: <n> € [fonte: operador, AAAA-MM-DD]
   - Valor de um cliente / margem: <n> € [fonte: operador, AAAA-MM-DD]
   - Resposta aos leads: <quem>, em <tempo>
   - Prazo: <data ou evento>
   - Aprovador: <nome/função>
   ```
   «Não sei» → `<sem fonte>` nesse campo. Nunca um valor plausível no lugar do operador.
4. Fecha a F0 e segue para a F1 sem perguntar:
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F0 feito
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F1 em_curso "análise (F1)"
   ```

**Saída ≠ 0 de qualquer `estado.mjs`** (aqui e em todas as fases) → mostra a linha `✗ …` que o script
imprimiu e pára: nada foi gravado, e seguir sem o estado gravado faz a retoma mentir.

## F1 — análise (fan-out de 4 frentes, sem gate)

1. **Antes de despachar**, `ls` às 4 skills (`mkt-conectores`, `mkt-marca`, `mkt-mercado`,
   `mkt-auditoria`) e lê a `## Entrega` de cada uma. Duas a escrever no mesmo ficheiro (ex.: `marca.md`)
   → essas correm em série (a do `mkt-marca` primeiro); as restantes em paralelo. **Exceção:** os
   ficheiros escritos por secções marcadas (`01-analise.md`, `02-proposta.md` — CONTRATO §6) aceitam
   vários escritores em paralelo, cada um só na sua secção; não contam para esta regra.
2. **Despacha no mesmo turno** um `mkt-analista-agent` por frente, com o brief-modelo (§Brief) —
   objetivo da frente, a skill a ler, `<MKT>`, `<RAIZ>`, slug, ciclo, ficheiros que lhe pertencem.
   Cada agente grava o que a sua skill manda e devolve ≤ 20 linhas + caminhos.
3. **Recolhe** e confirma em disco (`ls`) cada ficheiro anunciado. Agente que falhou → frente
   «não verificada» com o motivo; nunca zero, nunca silêncio. Acessos em falta → lista com a receita
   da coluna `como ligar` do `conectores.md`; segue com o que há.
4. **Síntese:** `Read` a `mkt-relatorio` e gera `01-analise.md` + `01-analise.html`. É **um**
   relatório que lê as 4 frentes juntas (onde se explicam umas às outras), não 4 relatórios agrafados.
   Inclui a **baseline** (números atuais por canal, com fonte e data) — é contra ela que a F5 compara.
5. Abre o html no browser, mostra no chat o resumo (5-10 linhas) e os `[por confirmar]` que os agentes
   devolveram (pergunta agora, por `AskUserQuestion`, só os que mudam a F2), depois
   `estado.mjs marcar <slug> F1 feito` e segue para a F2 (sem gate).

## F2 — proposta (gate: aprovação)

1. `estado.mjs marcar <slug> F2 em_curso "proposta (F2)"`. **`mkt-estrategia`** (inline: `Read` a skill) → objetivos
   realistas sobre a baseline, canais, funil, orçamento, KPIs e custo-alvo por lead (se F0 deu o valor
   de cliente). Passa à frente só a síntese da estratégia, não a análise inteira.
2. **Em paralelo, no mesmo turno:** `mkt-copy` e `mkt-medicao`, cada um num
   `Agent(subagent_type="general-purpose")` com o brief-modelo (Step 0: CONTRATO + a skill).
   Ficheiros: cada um escreve só o que a sua `## Entrega` declara. A `mkt-medicao` em modo agente não
   gera o `tracking/plano.md`: devolve os formulários e telefones `[por confirmar]` — esta skill pergunta-os
   (`AskUserQuestion`) e corre o `tracking/plano.mjs` como a `mkt-medicao` passo 2 manda; depois pede os IDs
   (GA4, conta/contentor GTM, Ads) e corre o `tracking/gtm.mjs` como a `mkt-medicao` manda — sem contentor, o G2
   do gate de medição falha na F4.
   Quem gera o `02-proposta.md` é a `mkt-estrategia` (esqueleto e secções dela, passo 1); a `mkt-copy` e a
   `mkt-medicao` escrevem só entre os seus marcadores.
3. **`mkt-psicologia`** em modo revisão sobre a copy (inline ou agente), antes do revisor.
4. **Revisão adversarial — conselho de 3** (`mkt-revisor-agent` ×3, no mesmo turno, nunca o produtor):
   - juiz 1 — evidência: cada número/promessa tem `[fonte]`; **dissidente obrigatório**, argumenta
     contra enviar a proposta;
   - juiz 2 — voz da marca (perfil e amostras de `marca.md`), PT-PT sem PT-BR, sem frases de IA;
   - juiz 3 — promessa vs landing (abre os URL), medição/UTM por peça, custos em € dia/mês.
   Bloqueia: **achado duro** (número sem fonte, promessa que a landing não cumpre, PT-BR, falta de
   UTM/medição, custo sem €) com **um** juiz; achado de gosto só se **2+** juízes o apontarem.
5. **Registo de cada volta:** esta skill acrescenta a `ciclos/<ciclo>/revisao-proposta.md` (cria-o se
   faltar; o revisor só lê) um bloco `## Volta <n> — <AAAA-MM-DD>` com, por juiz, a lente e o relatório
   que devolveu tal como veio (`aprovado`, achados `[duro|gosto]`, o que ficou resolvido).
6. **Volta:** corrige (o produtor — main loop ou `SendMessage` ao agente que produziu), e re-despacha
   **os mesmos** juízes com a lista anterior. Fecha só com `aprovado: true` de todos. **Máximo 3
   voltas**; à 3.ª sem aprovação → pára e leva os achados abertos ao gate, listados.
7. `mkt-relatorio` → gera **só** o `02-proposta.html` e escreve no `02-proposta.md` a secção «Revisão
   independente» (voltas, juízes, achados resolvidos e abertos) **a partir de
   `ciclos/<ciclo>/revisao-proposta.md`** — indica-lhe o caminho. O resto do `.md` é da `mkt-estrategia` e
   das secções de `mkt-copy`/`mkt-medicao`. Abre no browser.
8. **Gate** — `AskUserQuestion` «A proposta está aprovada por <aprovador>?»:
   «Sim, aprovada» / «Não — alterações (escreve-as)» / «Enviada ao aprovador, aguarda» / «Não sei».
   - Sim → fecha a F2 e segue para a F3:
     ```bash
     MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" aprovar <slug> proposta
     MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F2 feito
     ```
   - Alterações → volta ao passo 1 só com o delta.
   - Aguarda → `estado.mjs marcar <slug> F2 em_curso "aprovar a proposta (enviada a <aprovador>)"` e
     termina o turno.

## F3 — artes (gate: aprovação)

1. `estado.mjs marcar <slug> F3 em_curso "artes (F3)"`. A proposta sem peças criativas → regista-o na
   `proxima_accao` (é o que o Passo 0.5 lê para não reabrir a F3) e segue para a F4:
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F3 feito "F3 sem peças — seguir para a implementação (F4)"
   ```
2. **Guidelines primeiro:** `## Identidade visual` em `<sem fonte>` → `AskUserQuestion`: «Indico o
   caminho/URL das guidelines» / «Não há — usar só o que se mede no site» / «Não sei». Cores, fontes e
   espaçamentos sem token medido ou documentado ficam `TODO: token em falta`.
3. **Briefs:** `Read` a `mkt-criativos` e escreve `03-artes/briefs/<peca>.md` por peça da proposta.
4. **Modo (decide-se só aqui; vai no brief de cada peça — os agentes não perguntam):** por peça, `ls`
   à skill de produção que ela pede (`"<raiz do JOCA_Brain>/.claude/skills/<skill>.md"`: `img-gen`,
   `graphic-design`, `landing-page`, `react-email`, `video`).
   - skill ausente → **exportar brief** (CONTRATO §5.11), sem perguntar;
   - skill presente → criar e exportar são ambos possíveis: **um** `AskUserQuestion` para o lote
     «Criar as peças aqui ou exportar os briefs?» — «Criar aqui (recomendado)» / «Exportar briefs para
     designer/IA» / «Misto — escreve quais» / «Não sei» (→ exportar).
   Geração com custo (créditos de API) → orçamento de geração (nº de chamadas por peça) à vista e um
   `AskUserQuestion` para o lote, antes de gerar. O brief leva `modo=<criar|exportar>`, a skill de
   produção e o nº de chamadas autorizado.
5. **Fan-out:** um `mkt-criativos-agent` por peça, no mesmo turno (máx. 5 por vaga; mais → vagas
   seguintes). Finais em `03-artes/finais/`.
6. **Revisão:** um `mkt-revisor-agent` sobre o **conjunto** (coerência entre peças, specs da
   plataforma, voz, copy vs proposta aprovada, zonas seguras). Cada volta registada por esta skill em
   `ciclos/<ciclo>/revisao-artes.md` (como na F2, passo 5). Mesmo ciclo de voltas da F2 (máx. 3).
7. `03-artes/aprovacao.html` (como a `mkt-criativos` manda) → abre no browser → **gate**
   `AskUserQuestion`: «Sim, todas aprovadas» / «Aprovadas com exceções (escreve quais)» / «Não» /
   «Não sei». Sim/exceções → fecha a F3 (exceções registadas no html) e segue para a F4:
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" aprovar <slug> artes
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F3 feito
   ```

## F4 — implementação (gates: medição antes; aprovação por escrita)

1. **Gate de medição — uma vez, aqui** (CONTRATO §5.5). `Read` a `mkt-medicao` e segue o seu «Modo
   verificar» inline (é o main loop que pergunta os itens manuais): G1-G9 sobre o plano aprovado da F2;
   provas automáticas (G1, G2, G4, G6) corridas agora; manuais (G3, G5, G7-G9) por `AskUserQuestion`,
   «Não sei» = ✗. Grava o resultado no topo de `ciclos/<ciclo>/04-implementacao.md` (cria-o se faltar):
   ```markdown
   # Implementação — <marca> · ciclo <ciclo>
   Artes: <aprovadas em AAAA-MM-DD | F3 sem peças>

   ## Gate de medição
   | item | ✓/✗ | data | evidência |
   |---|---|---|---|
   | G1 | ✓ | AAAA-MM-DD | `grep -n "generate_lead" …/tracking/plano.md` → linha 3 |
   | G3 | ✓ | AAAA-MM-DD | operador: versão 7 publicada em AAAA-MM-DD |
   ```
   (uma linha por item G1-G9; `não aplicável` com a justificação da F2). O evento de lead é o do plano
   da marca (`tracking/plano.md`; o da casa é `generate_lead` com `formulario`).
   Qualquer ✗ → gate vermelho: `estado.mjs marcar <slug> F2 em_curso "medição: <itens ✗ e o que falta>"`
   e pára aqui (volta à F2).
2. `estado.mjs marcar <slug> F4 em_curso "implementação (F4)"`. **Fan-out de ensaio:** um `mkt-plataforma-agent` por
   plataforma aprovada (`mkt-google-ads`, `mkt-meta-ads`, `mkt-linkedin-ads`, `mkt-email`, `mkt-gbp`,
   `mkt-organico`), no mesmo turno. O brief de cada um leva, **copiada**, a tabela §Gate de medição do
   passo 1 (com a data) e os nomes de campanha a usar — `<PLAT>_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM>`,
   `PLAT` ∈ `GADS` · `META` · `LINK` (CONTRATO §6; ex.: `GADS_Search_Leads_Software_2026-10`). Cada um
   prepara e **ensaia** (validateOnly / dry-run / CSV) e devolve o bloco da plataforma; **não escreve
   na conta** e não toca no `04-implementacao.md`.
3. **Revisão das especificações** (antes de qualquer custo à vista): um `mkt-revisor-agent` (lente:
   promessa/medição/custos) sobre os blocos devolvidos e as artes/proposta aprovadas — nomes, UTMs por
   anúncio, evento de conversão = o do plano, estado em pausa/rascunho, € dia e mês, copy = a aprovada.
   Cada volta registada por esta skill em `ciclos/<ciclo>/revisao-implementacao.md`; achado duro →
   `SendMessage` ao agente da plataforma para corrigir e re-ensaiar, e o mesmo revisor de novo (máx. 3
   voltas; à 3.ª, os achados abertos vão listados no bloco de custo).
4. **Aprovação por escrita, uma por alteração.** Para cada plataforma, mostra o bloco:
   ```
   Alteração · Conta · Estado em que nasce (pausa/rascunho) · € por dia · € por mês · Reversível? · Avançar?
   ```
   `AskUserQuestion`: «Sim, criar em pausa — aprovado por <aprovador>» / «Tenho a aprovação por escrita
   do aprovador (indico onde)» / «Não» / «Não sei». Um «Sim» cobre essa alteração e mais nenhuma.
   Percentagens sozinhas não servem: o custo vai sempre em €.
5. **Aplicar:** `SendMessage` ao mesmo agente para correr a escrita confirmada (ou inline pela skill da
   plataforma). Tudo em pausa/rascunho; **nunca ativar**. Pedem para ativar → mostra os números de
   investimento e pára: é do dono da conta.
6. **`04-implementacao.md`** (só esta skill escreve), a seguir ao §Gate de medição: por plataforma —
   IDs e nomes criados, estado, UTMs, € dia e € mês, quem aprovou e onde, data, e **data de revisão +
   motivo + «o que tornaria isto um erro»** (vêm da skill da plataforma, com fonte). **Só esta fase
   regista datas de revisão** (CONTRATO §3; as da F2 eram propostas e ficam no `.md`), uma por canal —
   a do mesmo canal é substituída:
   `estado.mjs revisao <slug> <canal> <AAAA-MM-DD> "<motivo>"` (canal da lista do CONTRATO §4).
7. **Calendário, uma vez, só aqui** (as skills de plataforma não o propõem): oferece por
   `AskUserQuestion` criar o lembrete da review na menor data de revisão (evento de calendário ou tarefa
   agendada, conforme o que existir). **Nunca** digas que ficou agendado sem o ter criado e lido de volta.

## Fim do ciclo

Fecha a F4 com a próxima ação (é o que a retoma mostra até à review):
```bash
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F4 feito "review: /marketeer-review <marca> a partir de <menor data de revisão>"
```
O estado fica `fase` = F5 (F0-F4 `feito`, F5 `pendente`). Responde com:
- o que ficou montado (por plataforma, em pausa/rascunho) e **quem ativa** (o dono da conta);
- as datas de revisão por canal (tabela canal · data · motivo);
- a linha: «Volta com `/marketeer-review <marca>` a partir de <menor data de revisão>.»

## Brief-modelo dos agentes

Todo o `Agent()` deste workflow leva, por esta ordem (o agente não pode perguntar — o que não está
no brief, inventa):
```
Objetivo: <2 frases: a frente/peça/plataforma e o que entrega>.
Step 0: lê "<MKT>/CONTRATO.md" e "<caminho absoluto da skill>" (ls antes; não existe → pára e reporta).
Contexto: MKT=<MKT> · MARKETEER_RAIZ=<RAIZ> · slug=<slug> · ciclo=<.ciclo do estado.json> · fase=<Fn>.
Modo agente: não perguntas ao utilizador. O que a skill mandaria perguntar → decide pelo default da
  skill ou deixa [por confirmar], e devolve-o na lista; o caller pergunta depois (CONTRATO §5.9).
Lê primeiro: <RAIZ>/clientes/<slug>/marca.md + <ficheiros de entrada>.
Ficheiros teus (só estes): <lista>. Outro ficheiro → reporta, não escrevas. Ficheiro por secções
  (01-analise.md, 02-proposta.md): só a tua secção marcada.
[F3] Modo: <criar|exportar> · skill de produção: <caminho> · chamadas de geração autorizadas: <n>.
[F4] Gate de medição verificado pelo caller em <AAAA-MM-DD> (tabela abaixo, de 04-implementacao.md):
  aceita-o; repete só as provas automáticas G1, G2, G4, G6. Nomes de campanha:
  <PLAT>_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM> (PLAT ∈ GADS·META·LINK).
  <tabela item · ✓/✗ · data · evidência>
Regras: CONTRATO §5 inteiro — nada inventado (fonte+data ou [por confirmar]), ausente ≠ zero,
  credenciais nunca (nem o ambiente), aprovar ≠ ativar, € dia/mês, PT-PT AO90.
Não faças: escrever nas contas sem o caller confirmar; ativar; somar conversões entre plataformas;
  pedir credenciais; despachar outros agentes; editar ficheiros de outra frente; propor lembretes de
  calendário (só o caller, F4.7); escrever no estado.json.
Devolve: ≤ 20 linhas — feito, caminhos gravados, lista [por confirmar] (o que precisava de resposta),
  próximo passo sugerido.
```
Os `[por confirmar]` devolvidos perguntam-se no fecho da fase, um `AskUserQuestion` por decisão que
mude o passo seguinte; os restantes ficam listados no relatório da fase.

## Sem `Agent` ou sem o JOCA

- Sem a ferramenta `Agent` → as frentes correm **em sequência, inline**, pela mesma ordem e com os
  mesmos ficheiros. A revisão **não** se faz inline (quem produz não revê). **Regra única do gate sem
  revisor** (vale na F2, F3, F4.3 e na F5 do `marketeer-review`; a `mkt-relatorio` segue-a):
  1. grava `ciclos/<ciclo>/revisao-brief-<fase>.md` (o brief do revisor) para outra sessão/pessoa;
  2. a secção «Revisão independente» do relatório diz «revisão independente por fazer — brief em
     `revisao-brief-<fase>.md`» (sem `revisao-<fase>.md` não há voltas a citar);
  3. **antes** do gate da fase (na F5, que não tem gate: antes de fechar a F5 e de qualquer `ciclo-novo`), `AskUserQuestion` «Avançar sem revisão independente?»: «Não — esperar
     pela revisão (recomendado)» / «Sim, aceito sem revisão» / «Não sei» (= não). «Sim» → acrescenta a
     `revisao-<fase>.md` um bloco `## Sem revisão — <AAAA-MM-DD>` (quem aceitou, brief exportado) e segue
     para o gate normal; não/«Não sei» → `estado.mjs marcar <slug> <Fn> em_curso "revisão independente
     por fazer (brief em revisao-brief-<fase>.md)"` e termina o turno.
- Sem uma skill do JOCA que uma skill do pack chame → modo «exportar brief» (CONTRATO §5.11).

## Próximo passo (chain)
- F1 → F2 → F3 → F4 sem perguntar, exceto nos gates (proposta, artes, medição, aprovação por escrita).
- Fim da F4 → `marketeer-review` na data de revisão (o utilizador volta com `/marketeer-review`, ou a
  retoma com F4 `feito` oferece-a). Review parcial (revisões futuras por fazer) não abre ciclo novo.
- Pedido vago sobre uma marca já em ciclo («as vendas caíram») → `marketeer-review` antes de gerar
  coisas novas: diagnosticar antes de produzir.

## Créditos
- Encadeamento com entrada/saída/handoff/gate por passo, síntese única e cadência só com «sim»
  explícito: `anthropics/knowledge-work-plugins` — `small-business/skills/marketing-monday/SKILL.md`,
  `small-business/shared/chain-seams.md`, `small-business/shared/absent-is-not-zero.md` (Apache-2.0).
- Estado em disco com retoma confirmada contra o artefacto e conselho de 3 juízes com dissidente:
  `ucsandman/marketing-studio` — `skills/marketing/SKILL.md` (MIT).
- Regras de sequência («diagnosticar antes de gerar», «brief antes de rascunho», «rascunho antes de
  avaliar»): `JinnWorks/jinn-skills` — `skills/suite-orchestrator/SKILL.md` (MIT).
