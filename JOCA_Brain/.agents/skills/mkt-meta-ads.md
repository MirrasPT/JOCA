---
name: mkt-meta-ads
description: "F4 do marketeer para Meta Ads (Facebook + Instagram): especifica e monta campanha, conjuntos e anúncios aprovados — objetivo, públicos, posicionamentos, Pixel + CAPI, Lead Forms ou landing — sempre em pausa, pela via manual do Ads Manager ou importação em massa, com checklist e data de revisão. MUST be invoked when the user says: montar campanha Meta, campanha Facebook Ads, campanha Instagram Ads, F4 Meta, Meta Ads em pausa, meta ads setup. SHOULD also invoke when: públicos personalizados, posicionamentos Reels e Stories, Lead Ads ou formulário instantâneo, pixel e conversions API antes de lançar, importar anúncios em massa, métricas Meta para a review."
triggers: meta ads, facebook ads, instagram ads, ads manager, gestor de anúncios, campanha meta, conjunto de anúncios, ad set, públicos personalizados, lookalike, posicionamentos, reels ads, stories ads, lead ads, formulário instantâneo, pixel meta, conversions api, capi, importação em massa, F4 meta
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-meta-ads

Fase F4 (e leitura na F5) para Meta Ads. O marketeer **não tem script** para a Meta: a via principal é
o operador montar no Ads Manager com a especificação que esta skill produz (ou importá-la em massa).
Tudo nasce em pausa. Ativar é manual, pelo dono da conta, depois de ver o custo.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — campanhas Meta, objetivo, público, orçamento, factos aprovados.
- `ciclos/<ciclo>/03-artes/` aprovado — briefs e finais por posicionamento.
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.
- `clientes/<slug>/conectores.md` (canais `meta-ads`, `facebook`, `instagram`) · `marca.md`.
- `<MKT>/referencias/plataformas.md`.

## Entrega
- `clientes/<slug>/campanhas/<nome>.md` — especificação (formato do passo 3).
- Secção `## meta-ads` em `ciclos/<ciclo>/04-implementacao.md`.
- Data de revisão **proposta** (canal `meta-ads`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

### 1. Gate de medição
- **Modo agente** (`mkt-plataforma-agent`, F4 do `marketeer`): o brief traz a tabela de
  `ciclos/<ciclo>/04-implementacao.md` §Gate de medição, verificada pelo caller. Aceita-a se a data for **deste ciclo**
  e não tiver ✗; repete **só** as provas automáticas G1, G2, G4, G6 (comandos de `mkt-medicao` §8) e **não perguntas**
  os manuais (G3, G5, G7-G9 — incluindo a G7 do Pixel, já confirmada pelo caller). Tabela em falta, de outro ciclo,
  com ✗, ou uma prova automática que agora falha → paras e devolves ao caller a linha que falhou.
- **Inline, sem tabela** em `04-implementacao.md`: corres o gate todo, como abaixo (manuais por `AskUserQuestion`,
  «Não sei» = ✗).

Corre o gate de `02-proposta.md` §Medição (G1-G9 da `mkt-medicao`, cada um com o seu comando de prova e data deste ciclo); para a Meta pesam sobretudo a G6 (UTMs `paid_social`) e a G7. Todos ✓ ou «não aplicável» justificado. Concretamente:
- Pixel da Meta a disparar **só depois de consentimento** e o evento de conversão escolhido (ex.: `Lead`) a chegar ao Gestor de Eventos (teste de eventos com data).
- CAPI: se o plano a pedir, eventos de servidor a chegar e deduplicados com o pixel (mesmo `event_id`). Se o plano não a pedir, regista «sem CAPI» e porquê.
- Domínio verificado no Business Manager `[por confirmar o passo atual na interface]`.
- URLs dos anúncios = os da folha de UTMs, validados (G6).
Um ✗ → paras e devolves à F2 (`mkt-medicao`). Sem conversão medida não se monta campanha de Vendas/Leads.

### 2. Acesso e via
Lê `conectores.md` (`meta-ads`). Diz numa linha que via corre:
- **Manual no Ads Manager** (por omissão): o operador, com acesso à conta de anúncios, monta pela especificação.
- **Importação em massa** (muitos anúncios): Ads Manager → Importar/Exportar → importar anúncios em massa a partir de folha de cálculo. Formato, colunas e limites `[por confirmar]` — exporta primeiro uma campanha existente da própria conta e usa esse ficheiro como molde (nunca inventes cabeçalhos).
- **API** (Marketing API): só com app e token de sistema da marca **e** um script do marketeer que ainda não existe → `[por confirmar]` / `TODO: credencial em falta`. Não se escrevem chamadas ad hoc à API. Facto útil para quando existir: na criação de campanha o `status` só aceita `ACTIVE` ou `PAUSED` (M-API, verificado 2026-10-01) — seria sempre `PAUSED`.

### 3. Especificação (uma campanha por ficheiro)
Nome (CONTRATO §6): `META_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM>` — o do brief, se o trouxer (ex.: `META_Leads_Formulario_Obras_2026-10`). O público vai no nome do **conjunto**, não no da campanha.
Em modo agente não perguntas: campo sem valor na proposta/brief (orçamento, zona, quem responde aos leads) → `[por confirmar]`, essa campanha não avança, e a pergunta volta na lista do retorno.
```markdown
# <nome>
## Campanha
- Objetivo: <Notoriedade | Tráfego | Interação | Leads | Promoção de app | Vendas> (API: OUTCOME_AWARENESS | _TRAFFIC | _ENGAGEMENT | _LEADS | _APP_PROMOTION | _SALES — M-API, verificado 2026-10-01)
- Categoria especial: <NONE | EMPLOYMENT | HOUSING | CREDIT | ISSUES_ELECTIONS_POLITICS | ONLINE_GAMBLING_AND_GAMING | FINANCIAL_PRODUCTS_SERVICES> — declarar se o negócio cair numa
- Orçamento: <ao nível da campanha | por conjunto> · <X> €/dia · <X × 30,4> €/mês
- Estado: PAUSED
## Conjuntos (um por público ou por teste)
| Conjunto | Público | Localização | Idade/género | Posicionamentos | Otimização / evento | Janela de atribuição | Horário |
## Anúncios
| Anúncio | Conjunto | Identidade (Página / IG) | Formato | Ficheiro (03-artes/finais) | Texto principal (car.) | Título (car.) | Descrição | CTA | URL com UTM | Parâmetros de URL |
## Lead Form (se houver)
## Factos aprovados usados
## Decisões tomadas
```
Regras:
- **Objetivo pela conversão real**: leads por formulário no site → Leads com evento do site; contacto por Lead Form → Leads com formulário instantâneo; só visitas → Tráfego (otimizar para visualizações da página de destino). Vendas só com evento de compra medido.
- **Públicos**: zona = onde o negócio serve (`marca.md` §Zona), nunca o país inteiro por defeito; públicos personalizados (visitantes do site, lista de clientes com consentimento, quem interagiu com a Página/IG) só se existirem e com fonte; semelhantes só a partir de uma fonte com tamanho conhecido. Excluir clientes atuais em campanhas de aquisição. Nada de empilhar interesses estreitos sem razão escrita.
- **Posicionamentos**: automáticos (Advantage+) por omissão, **desde que** as artes cubram 4:5 (feed) e 9:16 (Stories/Reels); falta 9:16 → ou se cria, ou se excluem Stories/Reels e regista-se. Zonas seguras 9:16: 14% topo, 35% base, 6% lados (M-IGS/M-IGR).
- **Texto**: limites recomendados por posicionamento em `plataformas.md` (ex.: feed IG texto 125 / título 40; Reels texto 44). Contar e registar a contagem.
- **Lead Form vs landing**: landing quando já converte e o plano mede o envio; Lead Form quando a landing é fraca ou não existe, com: pergunta de qualificação (1-3), tipo «maior intenção» se disponível, política de privacidade da marca, texto de consentimento RGPD para marketing (caixa não pré-marcada, separada da finalidade de contacto — CNPD §30), mensagem final com o próximo passo e quem responde. Limites de texto do formulário `[por confirmar]`. Quem recebe e em quanto tempo responde aos leads → de `marca.md`; sem isto, o Lead Form não avança. Heurística prática (não regra da Meta): landing com conversão ≥5% → landing; <2% → Lead Form [inferência, marketingskills `meta-decision-system`].
- Números, preços, prémios e testemunhos só dos factos aprovados. Políticas: sem atributos pessoais («Tem dívidas?»), sem antes/depois enganadores.

Revisão independente obrigatória (`mkt-revisor-agent`) antes do passo 4 — em modo agente despacha-a o `marketeer` (F4.3) sobre o bloco que devolves.

### 4. Ensaio, custo e aprovação
Na via manual, o «ensaio» é a especificação completa + a pré-visualização de cada anúncio no Ads Manager (o operador partilha captura ou link de pré-visualização) antes de guardar.
Bloco de custo, um por campanha:
```
Conta:        <ID da conta de anúncios> · <nome>
Campanha:     <nome> — nasce em PAUSA
Orçamento:    <X> €/dia · <X × 30,4> €/mês (convenção do marketeer; a Meta pode variar o gasto diário — regra exata [por confirmar])
Conjuntos:    <n> · Anúncios: <n>
Reversível:   sim — em pausa não gasta; ativar é manual, pelo dono
```
`AskUserQuestion` Sim/Não («Sim, montar em pausa» primeiro), nomeando conta e orçamento. Um «sim» por campanha.
Em modo agente não perguntas: devolves a especificação + o bloco de custo; o `marketeer` pergunta (F4.4).

### 5. Montagem em pausa (passo a passo para o operador)
1. Ads Manager → Criar → objetivo da especificação → nome exato.
2. Campanha: categoria especial, orçamento, **interruptor da campanha desligado**.
3. Conjunto(s): público, localização, posicionamentos, otimização e evento, horário.
4. Anúncio(s): identidade, formato, ficheiros de `03-artes/finais/`, textos literais, CTA, URL com UTM.
5. Não ativar. Se a interface exigir «Publicar» para submeter à revisão de anúncios, só com a campanha **desligada** — confirmar na lista de campanhas que fica «Desativada» antes e depois `[por confirmar o comportamento atual da interface]`. Guardar como rascunho é a alternativa quando não se quer submeter ainda.
6. O operador devolve: ID da campanha, IDs dos conjuntos e anúncios, estado de revisão de cada anúncio (aprovado/rejeitado) e captura da lista com o estado «Desativada».

### 6. Checklist de pré-lançamento (vai para `04-implementacao.md`)
- [ ] Gate de medição verde (pixel com consentimento, evento de conversão, CAPI se planeada) com data.
- [ ] Objetivo e evento de otimização = conversão do plano.
- [ ] Categoria especial declarada (ou `NONE` justificado).
- [ ] Zona = área servida; clientes excluídos na aquisição.
- [ ] Artes em 4:5 e 9:16 (ou posicionamentos excluídos e registado); zonas seguras respeitadas.
- [ ] Textos dentro dos limites; só factos aprovados.
- [ ] URLs respondem 200 e levam UTMs; Lead Form com política de privacidade e consentimento correto.
- [ ] Anúncios aprovados na revisão da Meta (ou rejeições tratadas).
- [ ] Campanha com estado «Desativada»/pausa confirmado por captura ou export.

### 7. Registo e data de revisão
Secção para `ciclos/<ciclo>/04-implementacao.md` (inline escreves; em modo agente devolve-la e o `marketeer` junta — um só escritor):
```markdown
## meta-ads
| Campanha | ID | Objetivo | Estado | €/dia | €/mês | Conjuntos (IDs) | Anúncios (IDs, revisão) | Evento otimizado | Destino (UTM) | Especificação | Montada em |
Checklist: <passo 6>
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: zero leads após gastar 3× o custo-alvo por lead>
Ativação: manual, pelo dono da conta — por fazer
```
Data de revisão **proposta**: ativação prevista + 7 dias (primeira leitura de entrega). A ativação prevista vem do brief
ou, inline, de um `AskUserQuestion`; sem ela («Não sei», ou modo agente sem o dado) → montagem + 7 dias, motivo «confirmar
se foi ativada», e a pergunta na lista `[por confirmar]`.
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `meta-ads · <AAAA-MM-DD> · <motivo>`
e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 8. Modo leitura (F5)
- Fonte: export CSV do Ads Manager (Campanhas/Conjuntos/Anúncios → período → Exportar) — via principal, sem API. Mapear cabeçalhos; coluna em falta → «sem dado», nunca 0.
- Métricas: valor gasto, alcance, impressões, frequência, CPM, cliques no link, CTR (link), resultados **com o tipo de resultado**, custo por resultado, janela de atribuição; leads do Lead Form cruzados com o CRM/caixa de quem responde.
- **Limiar de fadiga (valor único do pack — a `marketeer-review` lê-o daqui):** em prospeção fria, **frequência > 4,0 =
  fadiga** (trocar o criativo); 2,5-4,0 = aviso (preparar substituto). Remarketing: fadiga > 6,0. Sinais que confirmam:
  CTR a cair ≥ 20% face à base em 7 dias, CPM a subir ≥ 30% em 2 semanas. `[inferência — heurística de terceiros, não
  regra da Meta: marketingskills `skills/ads/references/meta-decision-system.md` §Fatigue detection, lido 2026-10-01]`;
  recalibrar à conta quando houver histórico.
- Heurísticas de decisão (prática, não regra da Meta; recalibrar à conta): custo-alvo por lead qualificado como âncora; não julgar um anúncio antes de gastar ~3× esse custo; nunca editar o criativo de um anúncio que funciona (lança-se um novo ao lado); subir orçamento em passos de ~20% [inferência, marketingskills `meta-decision-system`].
- **Nunca somar conversões com Google/LinkedIn**; lado a lado, com a janela de cada uma. Propostas de alteração vão ao gate da F2.

## Próximo passo (chain)
- Especificação pronta → `mkt-revisor-agent` (obrigatório antes do passo 4; em modo agente despacha-o o `marketeer`).
- Montada em pausa e registada → `marketeer` (fecho da F4).
- Data de revisão → `marketeer-review` (passo 8).
- Pixel/CAPI por fazer → `mkt-medicao` (volta à F2).

## Créditos
Adaptado (MIT) de:
- coreyhaines31/marketingskills — `skills/ads/references/meta-decision-system.md` (âncora de custo por lead, porta de dados, fadiga — bandas de frequência de §Fatigue detection, Lead Form vs landing, não editar o que funciona), `skills/ads/references/platform-setup-checklists.md` §Meta (checklist), `skills/ads/references/audit-guardrails.md` (não somar conversões, mudança mínima reversível).
- anthropics/knowledge-work-plugins — `small-business/skills/ad-manager/` (CSV/manual como via principal, bloco de custo, um «sim» por alteração, passo a passo de cliques, data de revisão).
- Synter-Media-AI/free-skills — `skills/launch-gates/SKILL.md`, `skills/campaign-preflight/SKILL.md` (aprovar ≠ ativar, pré-voo bloqueante).
