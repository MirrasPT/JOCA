---
name: marketeer-review
description: "F5 do ciclo marketeer: verifica o que está mesmo implementado, puxa os resultados por plataforma, compara com os objetivos e a baseline, aplica regras de cortar/manter/escalar com limiares explícitos, grava 05-review e abre o ciclo seguinte só com o delta. MUST be invoked when the user says: /marketeer-review, review de marketing, rever as campanhas da marca, resultados do ciclo, como correram as campanhas. SHOULD also invoke when: chegou a data de revisão de um canal, cortar ou escalar campanhas, as vendas/leads caíram numa marca em ciclo."
triggers: /marketeer-review, marketeer review, review de marketing, rever campanhas, resultados das campanhas, cortar ou escalar, data de revisão, como correram as campanhas, campaign review, marketing results review
chain: marketeer, mkt-relatorio, mkt-revisor-agent
---
# marketeer-review

Fase F5 do ciclo `/marketeer`: lê o que a F4 deixou montado, mede o que aconteceu desde então, decide
por canal (cortar · manter · escalar · esperar), propõe melhorias e abre o ciclo seguinte. **Lê e
propõe; não aplica** — as propostas vão ao gate da F2 do ciclo novo (CONTRATO §1).

O `CONTRATO.md` do pack ganha a esta skill. Passo 0 (`<MKT>`, `<RAIZ>`, slug, `estado.mjs ler`) é o
mesmo da skill `marketeer` — segue-o de lá. **`<ciclo>` = o campo `.ciclo` desse `estado.mjs ler`**
(CONTRATO §3), nunca a data de hoje. Qualquer `estado.mjs` com saída ≠ 0 → mostra a linha `✗ …` que
imprimiu e pára (nada foi gravado).

## Recebe
- `ciclos/<ciclo>/04-implementacao.md` — IDs, estado, UTMs, € dia/mês, datas de revisão.
- `ciclos/<ciclo>/01-analise.md` — **baseline** (números por canal, com fonte e data).
- `ciclos/<ciclo>/02-proposta.md` — objetivos, KPIs, custo-alvo por lead, kill criteria se os houver.
- `marca.md` (`## Objetivos e orçamento`: valor de cliente, quem responde aos leads), `conectores.md`.

## Entrega
- `ciclos/<ciclo>/05-review.md` (gravado **antes** da revisão, passo 7) + `05-review.html` (via `mkt-relatorio`,
  depois da revisão, passo 8).
- `ciclos/<ciclo>/revisao-review.md`: cada volta do `mkt-revisor-agent`, gravada por esta skill (o revisor não escreve).
- `estado.json`: review **completa** (sem revisões futuras) → F5 `feito` + `estado.mjs ciclo-novo` (baseline nova =
  resultados desta review); review **parcial** → F5 `em_curso` com a `proxima_accao` da retoma, sem ciclo novo (passo 9).

## Passos

### 1. Pré-condições
- Sem `04-implementacao.md` → não há o que rever: di-lo e oferece `/marketeer <marca>`.
- Datas de revisão = `revisoes` do `estado.json` (só a F4 as regista, uma por canal; as de ciclos
  anteriores estão em `revisoes_anteriores` e não contam). Divide-as em **na data** (≤ hoje) e
  **futuras** (> hoje). **Retoma de uma review parcial** (`05-review.md` deste ciclo com `## Ainda por
  rever`): os canais a rever agora são os dessa secção já na data; os já revistos não se refazem.
- **Sem futuras** → review **completa**: todos os canais ainda não revistos neste ciclo (numa retoma, os de `## Ainda por rever`); o passo 9 fecha a F5 e abre o ciclo novo.
- **Com futuras** → `AskUserQuestion` com a **menor data futura**:
  - há canais na data: «Rever só os canais já na data (recomendado)» / «Rever tudo agora (os futuros
    em leitura provisória)» / «Voltar a <menor data futura>» / «Não sei» (= voltar);
  - nenhum na data: «Voltar a <menor data futura> (recomendado)» / «Rever tudo agora (leitura
    provisória)» / «Não sei» (= voltar).
  «Voltar» → nada se grava; diz a data e termina. Rever → review **parcial**: os canais futuros ficam
  em `## Ainda por rever` (`canal · data`), mesmo que tenham entrado como provisórios, e **não se abre
  ciclo novo** (passo 9) — fecha-se só quando não houver revisões futuras deste ciclo.
  Canal antes da sua data entra na review só como **provisório**, nunca com decisão de cortar.
- Janela: da data de criação em `04-implementacao.md` até ontem. Sempre a mesma janela por canal e
  dita no relatório.

### 2. O que está mesmo implementado (fan-out, só leitura)
Um `mkt-plataforma-agent` por plataforma de `04-implementacao.md`, no mesmo turno, com o brief-modelo
da skill `marketeer` em **modo leitura** (Step 0: CONTRATO + a skill da plataforma; modo agente: não
pergunta, devolve `[por confirmar]` — as perguntas faz esta skill depois). Cada um devolve,
por item criado na F4: existe? estado atual (pausa/ativa/removida — e **quem** ativou não se infere);
orçamento atual vs o aprovado; UTMs presentes no URL final; resultados da janela (gasto €, impressões,
cliques, conversões **da própria plataforma**, com a janela de atribuição dela).
Inline, em paralelo com os agentes:
```bash
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/ads/diagnostico.mjs" <slug> [--login mcc]
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/investimento.mjs" <slug> --todas
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/auditoria/correr.mjs" <slug>
```
(o último lê a GA4 pela área `contas` e refaz SEO/tracking/GBP; grava `auditorias/<data>.json`).
**Tracking a disparar:** prova de rede como a `mkt-medicao` manda
(`"<MKT>/scripts/tracking/prova.mjs" <url> --cliente <slug> …`). Evento de lead que não dispara →
achado **crítico** e todos os números de conversão desse site ficam «não verificados».
Divergência entre o aprovado e o que está na conta (orçamento maior, campanha ativa sem registo,
UTM em falta) → secção própria do relatório, antes dos resultados.

### 3. Uma fonte de verdade para a contagem
- **A contagem de leads/vendas vem de uma só fonte** — a que regista o negócio (CRM, caixa de
  correio dos formulários, backend da loja; quem a mantém está em `marca.md`). As plataformas
  explicam *de onde* vieram; não redefinem *quantas* foram.
- **Nunca somar conversões de plataformas diferentes** (CONTRATO §5.7). Lado a lado, cada uma com a
  sua janela; «as plataformas reclamam N; verificamos M; a diferença é sobre-atribuição + view-through
  + não rastreado».
- GA4 é a vista neutra entre canais (última interação não direta), não a verdade.
- **Ausente ≠ zero.** Canal sem acesso ou fonte que falhou → «não verificado» e sai de qualquer
  agregado; o relatório diz «Google e Meta revistos; LinkedIn não revisto (sem acesso)».
- Muito «direct» e pesquisa da marca = o topo do funil a funcionar e a atribuição a escondê-lo: di-lo.
  Recomenda (proposta, não ação) o campo «Como nos conheceu?» no formulário, com lista de canais +
  texto livre.
- **Cobertura antes de nota:** ≥ 80% das verificações aplicáveis feitas → avaliação; 60-79% →
  provisória, com a lista do que falta; < 60% → achados sem nota global.

### 4. Comparar
Por canal, três colunas: **baseline** (F1) · **objetivo** (F2) · **resultado** (janela). Cada número
com fonte e data. Rácios contra o universo que o canal alcança (vendas online, não a faturação toda).
Objetivo da F2 sem número → «sem objetivo mensurável» (achado para o ciclo seguinte), nunca um
objetivo inventado agora.

### 5. Decidir por canal — cortar · manter · escalar · esperar
Custo-alvo por lead (**CAL**) = o da `02-proposta.md`. Sem ele → só «esperar/manter» com a nota
«sem custo-alvo: definir na F2 do ciclo novo». Para em cada regra pela 1.ª que dispara:

| # | Regra | Decisão |
|---|---|---|
| 1 | Medição a falhar no canal (passo 2) | **corrigir medição** antes de qualquer decisão de desempenho |
| 2 | Gasto na janela < 3× CAL | **esperar** — sinal insuficiente |
| 3 | Gasto ≥ 3× CAL e 0 leads verificados | **cortar** a peça/conceito (pausar; não iterar o mesmo) |
| 4 | Custo por lead > 1,5× CAL | **cortar ou trocar** a peça (ângulo, oferta ou público) |
| 5 | Custo por lead entre 1× e 1,5× CAL | **manter** e rever na data seguinte |
| 6 | Custo por lead ≤ CAL durante 2+ semanas seguidas, e o canal limitado por orçamento | **escalar** |
| 7 | Custo de aquisição > 2× o alvo após 30 dias com gasto relevante | **pausar o canal** (critério de corte do canal) |

Salvaguardas (valem sobre a tabela):
- **Nunca cortar só porque o custo passou um múltiplo** com poucas conversões ou atraso de conversão
  longo (ciclos B2B, orçamentos): primeiro amostra e atraso; um pico é uma pergunta, não um veredicto.
- Campanha em **aprendizagem** não se reestrutura por reflexo; diagnostica-se primeiro.
- **Escalar aos poucos:** Meta +20% a cada 5 dias, nunca +30% de uma vez; Google, alvos de licitação
  em passos de ±10-15% e esperar 1-2 semanas. Depois de escalar, custo por lead > 1,5× CAL → recuar
  20-30% e estabilizar 2 semanas.
- **Menor alteração reversível ganha:** pausar > apagar; uma variável de cada vez.
- **Negativas só do relatório de termos de pesquisa** (termos com 3+ cliques e 0 conversões), com
  revisão de sobre-bloqueio; sem relatório → zero negativas propostas.
- Meta, fadiga do criativo: o limiar (frequência, queda de CTR) é o da `mkt-meta-ads` em modo leitura
  — o agente da Meta devolve-o com a fonte; esta skill não fixa número. Fadiga → trocar a execução, não
  o conceito que ganhou.
- Benchmarks só com fonte e data `(verificado AAAA-MM-DD)`, e sempre abaixo dos números da própria
  conta (mesmo período comparável > teste da conta > CRM > pares com método > setor, só direcional).

Os limiares são **heurísticas de praticantes** (Créditos), não regras das plataformas: o relatório
di-lo e, a partir do 2.º ciclo, calibra-os com os dados da própria conta (`[inferência]` explícita).

### 6. Urgências (única escrita possível nesta fase)
Canal a gastar com o evento de conversão partido, ou regra 3/7 com gasto relevante → oferece
**pausar** já: a skill da plataforma faz o ensaio, mostra o € por dia que deixa de sair, e
`AskUserQuestion` Sim/Não. Escalar, mexer em orçamentos ou criar nada aqui: vai para a F2.

### 7. Propostas, gravar e revisão
- No máximo **3 ações** ordenadas pelo impacto em €: o quê · o número desta review que a justifica ·
  quanto vale (estimativa marcada `[inferência]`). Nada a mudar → di-lo; não fabricar ações.
- **Grava o `05-review.md` agora, antes do revisor** (`Read` a `mkt-relatorio`, estrutura do 05-review):
  `## Resumo executivo` — **5 linhas**, como a `mkt-relatorio` manda (o que importa neste ciclo ·
  resultado vs objetivo · o que funcionou e o que não · as ações propostas · próxima revisão) ·
  implementado vs aprovado · resultados por canal (baseline · objetivo · resultado) · decisões da tabela
  com a regra que disparou · 3 ações · `## Ainda por rever` (só na review parcial: `canal · data`) ·
  `## Não verificado` (o que ficou sem acesso ou sem prova — é o conteúdo do bloco de lacunas
  `{{LACUNAS}}` do modelo HTML). Já existe (retoma de parcial) → `cp` para
  `ciclos/<ciclo>/.versoes/05-review-<AAAA-MM-DD-HHMM>.md` e reescreve-o **mantendo** os resultados,
  decisões e ações dos canais já revistos, acrescentando os novos e tirando-os de `## Ainda por rever` —
  o ciclo seguinte parte deste ficheiro, não das versões.
- Um `mkt-revisor-agent` (não quem escreveu) revê o `05-review.md` **gravado**: números sem fonte, somas
  entre plataformas, ausentes tratados como zero, decisões que contrariam a tabela, canais futuros sem
  ser em «Ainda por rever». Cada volta → esta skill acrescenta a `ciclos/<ciclo>/revisao-review.md`
  (cria-o se faltar) um bloco `## Volta <n> — <AAAA-MM-DD>` com o relatório do revisor tal como veio
  (`aprovado`, achados, o que ficou resolvido). Achado → corrige o `.md` e re-despacha **o mesmo**
  revisor com a lista anterior. Até 3 voltas; à 3.ª sem `aprovado: true`, os achados abertos vão para
  `## Não verificado`. Sem `Agent` → regra única do gate sem revisor da skill `marketeer` (§«Sem `Agent`
  ou sem o JOCA», fase `review`): a pergunta vem **antes** de gerar o HTML, e o `05-review.md` leva a linha
  «revisão independente por fazer — brief em `revisao-brief-review.md`» em `## Não verificado`.

### 8. Mostrar
`mkt-relatorio` → `05-review.html` a partir do `05-review.md` revisto. Abre no browser.

### 9. Fechar — ciclo novo só sem revisões futuras
Relê o estado (`estado.mjs ler`) e vê se há `revisoes` com data > hoje.
- **Há (review parcial)** → não abre ciclo novo:
  ```bash
  MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F5 em_curso "review dos restantes a partir de <menor data futura>"
  ```
  Responde: canais revistos · «Ainda por rever: <canal · data>» · «Volta com `/marketeer-review <marca>`
  a partir de <menor data futura> (a retoma do `/marketeer` também a oferece).» Termina aqui.
- **Não há (review completa)** → passos 1-3 abaixo.

1. Fecha a F5 e abre o ciclo seguinte (lê o cabeçalho de uso do `estado.mjs` antes; subcomando em
   falta → pára e reporta):
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" marcar <slug> F5 feito "abrir o ciclo seguinte (estado.mjs ciclo-novo)"
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" ciclo-novo <slug>
   ```
   O ciclo novo vem do script (CONTRATO §3): mês novo → `AAAA-MM`; mesmo mês → `AAAA-MM-2` (depois
   `-3`…). Lê-o da saída (`.ciclo`) e usa-o daqui em diante; F0 fica `feito`, `fase` = F1, e as revisões
   deste ciclo (todas já na data) vão para `revisoes_anteriores` — `revisoes` fica vazia.
   **Saída ≠ 0** → mostra a linha `✗ …` e pára: o ciclo novo não abriu (o `05-review` deste ciclo fica
   gravado; F5 já `feito`), e a resposta diz «ciclo seguinte por abrir: <erro>». Nunca crias a pasta
   do ciclo à mão nem escreves no ciclo antigo.
   A baseline do ciclo novo são os resultados desta review.
2. Reentra na **F1 da skill `marketeer` só com o delta**: `mkt-conectores` (reverificar acessos) e
   `mkt-auditoria` sempre; `mkt-mercado` só o que mudou desde a última análise (30 dias); `mkt-marca`
   só se ofertas, voz ou identidade mudaram. O `01-analise.md` novo começa por «o que mudou».
3. As 3 ações entram na F2 do ciclo novo como propostas e passam pelo **mesmo gate de aprovação**.

## Próximo passo (chain)
- Review completa → `marketeer` (ciclo novo, F1 delta → F2 com as propostas desta review).
- `aprovado: false` do revisor → corrigir e re-despachar o mesmo revisor (máx. 3 voltas).
- Review parcial → `marketeer-review` de novo na menor data futura (a retoma do `marketeer` oferece-a).

## Créditos
- Limiares de cortar/escalar, salvaguardas e escada de benchmarks: `coreyhaines31/marketingskills`
  (MIT) — `skills/ads/references/meta-decision-system.md` (Stage 2, escala, fadiga),
  `skills/ads/references/google-search-playbook.md` (licitação, termos de pesquisa),
  `skills/ads/references/audit-guardrails.md` (cobertura, hard stops, segurança),
  `skills/marketing-plan/references/measurement-framework.md` (kill criteria) — lidos 2026-10-01.
- Atribuição para PME (uma fonte de verdade, nunca somar, «como nos conheceu?»): mesmo repo,
  `skills/attribution/SKILL.md` §4-6 e `references/measurement-paradigms.md`.
- Ciclos de review e postmortem: mesmo repo, `skills/marketing-loops/references/loop-catalog.md`.
- Baseline que avança e «um total é contexto, nunca denominador»: `anthropics/knowledge-work-plugins`
  — `small-business/skills/marketing-monday/SKILL.md`, `small-business/shared/chain-seams.md` (Apache-2.0).
