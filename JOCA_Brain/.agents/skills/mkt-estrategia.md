---
name: mkt-estrategia
description: "Proposta de marketing de uma marca (F2 do /marketeer): objetivo de negócio → métrica, objetivos realistas com a conta à vista, canais online e offline com porquê, funil e captação de leads, oferta, orçamento por canal em €/dia e €/mês, datas de revisão e lista de materiais. MUST be invoked when the user says: proposta de marketing, estratégia de marketing da marca, plano de campanhas, F2 do marketeer, onde investir o orçamento, objetivos realistas. SHOULD also invoke when: repartir orçamento por canais, que canais usar, lead magnet para a marca, quanto posso esperar de leads, campanha offline com flyers ou cartazes."
triggers: mkt-estrategia, proposta de marketing, estratégia de marketing, plano de campanhas, plano de meios, repartição do orçamento, objetivos realistas, metas de leads, que canais usar, funil de captação, lead magnet da marca, marketing offline, flyers, cartazes, F2 marketeer, marketing strategy, media plan, budget allocation, realistic targets, channel mix
chain: mkt-copy, mkt-medicao, mkt-psicologia, mkt-revisor-agent, mkt-relatorio
---
# mkt-estrategia

Primeiro passo da **F2 Proposta** do `/marketeer`. Pega na análise da F1 e decide o que se promove,
onde, com que dinheiro, para que número e como se sabe se resultou. Escreve o esqueleto do
`02-proposta.md` que `mkt-copy`, `mkt-medicao` e `mkt-psicologia` completam. Segue o `marketeer/CONTRATO.md`.

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md` — negócio, ofertas, público, zona, voz, objetivos e orçamento, restrições. **Lê-se primeiro.**
- `<RAIZ>/clientes/<slug>/conectores.md` — que canais têm acesso e dados (ausente ≠ zero).
- `<RAIZ>/clientes/<slug>/ciclos/<ciclo>/01-analise.md` — baseline, concorrentes, auditoria.
- Estado: `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" ler <slug>`.
- Se existirem: `ads/diagnostico-*.md` (CPC e conversões reais de 12 meses), `campanhas/pesquisa-*.md`
  (Planeador ou histórico), `auditorias/<data>.json`, `05-review.md` do ciclo anterior.
- Referências: `"<MKT>/referencias/lead-magnet.md"`, `"<MKT>/referencias/psicologia.md"`, `"<MKT>/referencias/utm.md"`.

## Entrega
- `<RAIZ>/clientes/<slug>/ciclos/<ciclo>/02-proposta.md` no esqueleto do passo 10: secções da estratégia
  preenchidas; blocos `mkt-copy`, `mkt-psicologia`, `mkt-medicao`, `mkt-medicao-site` vazios (são de outras skills).
- Datas de revisão **propostas** no `.md` («Campanhas» → «Calendário, revisões e critérios de corte»). Esta skill não
  chama `estado.mjs revisao`: quem as regista é o `marketeer`, na F4, com o dia de arranque real (CONTRATO §3).

## Regras desta skill
- **Cada número tem fonte e data** (`[fonte]` com caminho/URL/comando · `[inferência]` com o raciocínio · `[por confirmar]`).
  Benchmarks de mercado só com fonte e `(verificado AAAA-MM-DD)`; sem fonte não entram — usa-se o histórico da conta ou um cenário declarado.
- **Nunca um número só** nos objetivos: intervalo baixo-alto com a conta escrita.
- **Ausente não é zero**: canal sem acesso → «não verificado»; sem baseline de conversões → o 1.º objetivo é medir.
- € (não $). Orçamento mensal = diário × 30,4 (mesmo fator do `campanha/investimento.mjs`).
- Decisões avançar/não-avançar e escolhas de taste → `AskUserQuestion` (2-4 opções, recomendada primeiro, «Não sei»).

## Passos

### 0. Preparar
1. Resolver `<MKT>` (CONTRATO §2; `ls "<MKT>/scripts"`) e a raiz: `export MARKETEER_RAIZ="$(node "<MKT>/scripts/raiz.mjs")"`
   (sai 2 → perguntar a pasta por `AskUserQuestion` e gravar com `raiz.mjs --definir <pasta>`).
2. `estado.mjs ler <slug>`: a F1 tem de estar `feito`. Senão → parar e devolver ao `marketeer`.
3. `test -f ".../02-proposta.md"`. Existe → **não sobrescrever**: `AskUserQuestion` «Retomar e editar só as
   secções da estratégia (recomendado)» / «Cancelar». Escrever por cima é irreversível.
4. Ler `marca.md` → anotar: valor de um cliente (ou ticket médio), margem, taxa de fecho, quem responde aos
   leads e em quanto tempo, orçamento mensal, zona, restrições. Campo `<sem fonte>` que a conta precisa →
   1 `AskUserQuestion` por campo (opções derivadas de `marca.md`/site; «Não sei» fica `<sem fonte>`).

### 1. Objetivo de negócio → métrica
Um objetivo principal (no máximo dois). Cada um liga a **uma** métrica medível pela `mkt-medicao`:

| Objetivo de negócio | Métrica principal | Evento / fonte |
|---|---|---|
| Mais pedidos de orçamento/contacto | Leads qualificados por mês | `generate_lead` com `formulario` (GA4) + conversão Ads; qualificação no CRM/folha do cliente |
| Mais chamadas | Chamadas por mês | `clique_telefone` + conversões de chamada do Google Ads |
| Mais visitas à loja / reservas | Pedidos de direções, chamadas e reservas | GBP (métricas do perfil, se `conectores.md` der acesso) + QR/códigos de oferta |
| Vendas online | Compras e receita | `purchase` (fora do âmbito F2 desta skill → `[por confirmar]` com a `mkt-medicao`) |
| Crescer a lista de email | Inscrições confirmadas | `generate_lead` com `formulario=<lead-magnet>` + ferramenta de email |
| Notoriedade local | Pesquisas da marca, alcance na zona | Search Console (consultas com a marca), alcance das plataformas |

Métrica de vaidade (gostos, seguidores, impressões soltas) nunca é objetivo principal.

### 2. Baseline
Copiar do `01-analise.md` só o que tem fonte: sessões, leads/chamadas por mês, taxa de conversão da
landing, CPC e CPL históricos, avaliações GBP. Cada valor com fonte e janela (ex.: «Ads, 12 meses até
2026-09-30»). Valor que falta → «não verificado» e entra na lista de medição.

### 3. Objetivos realistas — a conta
Mostrar sempre esta tabela, com cenário **baixo** e **alto**:

```
cliques/mês   = orçamento do canal €/mês ÷ CPC            (CPC: diagnóstico Ads 12 m · Planeador · [por confirmar])
leads/mês     = cliques × taxa de conversão da landing     (baseline GA4/Ads · [inferência] se não há)
clientes/mês  = leads × taxa de fecho                      (entrevista F0 / marca.md)
CPL           = orçamento ÷ leads     ·  CAC = orçamento ÷ clientes
CPL de equilíbrio = valor de um cliente (margem) × taxa de fecho
```

Regras da conta:
- CPC por ordem de preferência: CPC real da conta (`ads/diagnostico`, `campanha investimento`) → Planeador
  (`campanha/pesquisa.mjs`) → CPM/CPC da plataforma **lido** numa fonte datada → sem fonte: o operador dá
  um intervalo por `AskUserQuestion` e fica `[por confirmar]`.
- Sem taxa de conversão medida → cenário com dois valores declarados como `[inferência]` e o aviso
  «objetivo a recalibrar na revisão de 30 dias». O objetivo comprometido é o **baixo**.
- Se CPL do cenário alto > CPL de equilíbrio → dizê-lo: o canal não paga com estes números (mudar oferta,
  landing ou canal), não se esconde.
- Meta Ads: a fase de aprendizagem precisa de cerca de 50 eventos de otimização por conjunto de anúncios em
  7 dias `[por confirmar na fonte Meta — business help 112167992830700 não renderizou em 2026-10-01; valor citado por fontes secundárias]`.
  Orçamento semanal ÷ CPL < 50 → otimizar para um evento mais frequente ou concentrar num só conjunto.
- Google Ads com licitação inteligente: a aprendizagem dura tipicamente 1-2 ciclos de conversão e depende do
  volume de conversões (verificado 2026-10-01, support.google.com/google-ads/answer/13020501). Sem histórico
  de conversões, o marketeer cria Search com `maximizar-cliques` ou `cpc-manual` (modelo `campanha-search.md`).
- Sem baseline de conversões e sem medição montada → objetivo do ciclo 1 = **medir** (gate de medição
  verde + 30 dias de dados) e cenários só ilustrativos.

### 4. Oferta
- Uma oferta por campanha, escrita em linguagem simples: o que recebe · por quanto · garantia · porquê agora · nome.
- Equação de valor (resultado desejado × probabilidade percebida ÷ tempo × esforço): diagnosticar a alavanca
  mais fraca e mexer **só nessa** neste ciclo.
- Garantia: escolher pelo maior risco que o cliente sente (não funcionar → reembolso condicional; atraso →
  prazo com compensação; resultado → extensão). Só garantias que a marca aceita cumprir (`AskUserQuestion`).
- Urgência só honesta: capacidade real, data de fim verificável, sazonalidade, stock. Formas e proibições em
  `referencias/psicologia.md`. Promoção com preço anterior riscado: regras de anúncio de reduções de preço em
  Portugal `[por confirmar legislação em vigor antes de propor]`.
- Factos da oferta (anos, números, casos) só de `marca.md`/site → passam a «factos aprovados» para a `mkt-copy`.

### 5. Canais — onde e porquê
Distribuição em três camadas: **próprios** (site, email, GBP) · **alugados** (Meta, LinkedIn, Google, redes) ·
**emprestados** (imprensa, parcerias, eventos de terceiros). Tudo encaminha para um canal próprio (landing,
lista de email, telefone).

| Canal | Faz sentido quando | Não faz quando |
|---|---|---|
| Google Ads Search | Há pesquisa ativa pelo serviço na zona (Planeador/histórico) | Serviço que ninguém procura pelo nome; orçamento < custo de ~1 clique/dia útil |
| Performance Max | Já há conversões medidas e criativos (imagem, vídeo, textos) `[inferência]` | Sem conversões a alimentar a licitação; marca sem materiais |
| Meta Ads | Público local definível, oferta visual, procura latente (não pesquisam mas compram) | Sem criativos; B2B muito nichado |
| LinkedIn Ads | B2B com cargo/setor definido e valor de cliente alto | B2C; orçamento pequeno `[inferência: CPC alto — confirmar no Planeador de campanhas do LinkedIn]` |
| GBP + reputação | **Quase sempre** em negócio local: perfil completo, fotos, publicações, pedir e responder avaliações | Negócio sem morada nem zona de serviço |
| Orgânico (redes) | A marca consegue manter cadência; serve de prova social e remarketing | Como único canal para leads a curto prazo |
| Email | Há lista (clientes, contactos) com consentimento, ou lead magnet a criar | Lista sem consentimento — não se usa (Lei 41/2004, art. 13.º-A) |
| SEO / conteúdo | Horizonte ≥ 3 meses; site com problemas técnicos que bloqueiam campanhas (auditoria F1) | Precisa de leads este mês e só tem este canal |
| **Offline**: flyers, cartazes, roll-ups | Zona de 1-2 concelhos, público pouco digital, ponto de venda físico, evento local | Público disperso pelo país |
| **Offline**: eventos, feiras, workshops | Produto que se demonstra; B2B regional; captação de contactos com consentimento | Sem pessoa para estar presente e fazer follow-up em 24-48 h |
| **Offline**: imprensa e rádio locais | Notícia real (abertura, prémio, número de clientes), ligação à comunidade | Sem notícia — anúncio pago só com tiragem/audiência com fonte |

Regras: orçamento pequeno → 1-2 canais pagos, não cinco (cada um precisa de volume para aprender) `[inferência]`.
Todo o offline leva QR com UTMs (`referencias/utm.md` §4) e, se possível, código de oferta próprio para medir.
Para cada canal escolhido: uma linha «porquê este, com que dado».

### 6. Funil e captação de leads
- Desenhar o caminho: anúncio/peça → landing (uma por oferta) → formulário ou chamada → resposta da marca → cliente.
- Lead magnet: 3 conceitos com os critérios de `referencias/lead-magnet.md` (capacidade de resposta, valor do
  cliente, ciclo de decisão, prova, canal) e um recomendado.
- Formulários: campos mínimos; consentimento de marketing separado e não pré-marcado.
- Lista de email: origem dos contactos, sequência a criar (boas-vindas/nutrição/conversão), quem escreve (F4, `mkt-email`).
- Tempo de resposta ao lead: registar o compromisso da marca («responde em X h») — vai para a landing e para o gate da F4.

### 7. Orçamento por canal

| Canal | €/dia | €/mês (×30,4) | % do total | Porquê / com que dado |
|---|---|---|---|---|

Offline e produção (impressão, design, vídeo) em linhas próprias como **custo único** (€), não €/dia.
A soma bate com o orçamento de `marca.md`; reserva de teste ≤ 10-20 % `[inferência]` se houver dois canais novos.
Repartir pela intenção: canais de procura ativa (Search) primeiro; descoberta (Meta/LinkedIn) com o resto.

### 8. Calendário e datas de revisão
Para cada canal: data de arranque prevista (depois da aprovação das artes e do gate de medição) e revisões.

| Canal | `canal` (CONTRATO §4) | 1.ª revisão | 2.ª revisão | Base |
|---|---|---|---|---|
| Google Ads (licitação inteligente) | `google-ads` | arranque + 1-2 ciclos de conversão (mín. 14 dias `[inferência]`) | 30 dias | support.google.com/google-ads/answer/13020501 (verificado 2026-10-01) |
| Google Ads (cliques/CPC manual) | `google-ads` | 14 dias `[inferência]` | 30 dias | termos de pesquisa e QS acumulam |
| Meta Ads | `meta-ads` | 7 dias (fim da aprendizagem) | 30 dias | ~50 eventos/7 dias `[por confirmar]` |
| LinkedIn Ads | `linkedin-ads` | 14 dias `[inferência]` | 30 dias | — |
| GBP e reputação | `gbp` | 30 dias | 90 dias | `[inferência]` |
| SEO / conteúdo | `seo` | 30 dias (mais cedo em que se vê efeito) | 90 dias | 30 dias: knowledge-work-plugins `seo-ai-visibility` Step 7; 90 `[inferência]` |
| Email | `email` | 7 dias após cada envio | 30 dias | `[inferência]` |
| Offline | `offline` | fim da ação + 14 dias | — | QR/código de oferta acumulados `[inferência]` |

Estas datas são **propostas** e ficam só no `.md` (com o `canal` da 2.ª coluna, que é o que a F4 vai usar —
`seo` e `offline` são canais válidos para revisões, CONTRATO §4). **Não se corre `estado.mjs revisao` aqui:** as
datas finais regista-as o `marketeer` na F4, quando se sabe o dia de arranque (CONTRATO §3).

Critérios de corte por canal (escritos já, para a F5 não decidir de cabeça), derivados do CPL alvo:
pausar anúncio novo que gaste 2-3× o CPL alvo sem conversões; rever o que ande 1,5-2× acima do alvo
depois de 7-14 dias (heurística, marketingskills `ads/references/b2b-paid-playbook.md` — não é estatística).
Nunca escalar orçamento sem a F5.

### 9. Materiais a produzir

| # | Peça | Formato | Canal | Mensagem/oferta | Dono | Prazo | Brief F3 |
|---|---|---|---|---|---|---|---|

Inclui: artes por formato (feed, stories, display, LinkedIn, flyer A5, cartaz, roll-up), landing pages (uma
por oferta), emails da sequência, posts orgânicos, publicações GBP, lead magnet. Medidas e zonas seguras
**não** se escrevem aqui — são da `mkt-criativos` com fonte. Dono = pessoa (cliente, agência, designer
externo) ou «marketeer F3»; prazo em data.

### 10. Gravar
Escrever `02-proposta.md` com este esqueleto — os títulos `##` são os que a `mkt-relatorio` espera (ela só
garante a ordem, o resumo e o HTML). Os blocos com marcadores ficam vazios para as skills donas; nesta skill,
os passos 1-9 vão para os títulos indicados.

```markdown
# Proposta — <marca> — ciclo <ciclo>
> Estado: rascunho · etiquetas [fonte] [inferência] [por confirmar]
## Resumo executivo                 ← 5 linhas: objetivo · aposta principal · canais · € dia/mês · o que se mede
## Ponto de partida                 ← passo 2 (baseline)
## Objetivos e KPIs                 ← passos 1 e 3 (métrica + a conta, baixo/alto)
## Estratégia e canais              ← passos 4, 5 e 6 (oferta, canais com porquê, funil e captação de leads)
## Campanhas                        ← por canal: tipo de campanha, público/zona, oferta, landing; ### Calendário, revisões e critérios de corte (passo 8)
## Mensagens e copy
<!-- mkt-copy:inicio --><!-- mkt-copy:fim -->
### Revisão psicológica
<!-- mkt-psicologia:inicio --><!-- mkt-psicologia:fim -->
## Materiais a produzir             ← passo 9
## Medição
<!-- mkt-medicao:inicio --><!-- mkt-medicao:fim -->
## Melhorias ao site/SEO
<!-- mkt-medicao-site:inicio --><!-- mkt-medicao-site:fim -->
## Orçamento                        ← passo 7 (€/dia e €/mês por canal + custos únicos)
## Riscos                           ← o que pode falhar + critérios de corte resumidos
## Revisão independente             ← escrita pela mkt-relatorio a partir de ciclos/<ciclo>/revisao-proposta.md; esta skill deixa vazio
## Decisões pedidas                 ← o que o cliente aprova (ex.: «2 canais, 600 €/mês, objetivo 8-15 leads»)
## Lacunas e por confirmar          ← tudo o que ficou [por confirmar] + escolhas de taste para o gate
## Fontes
```

O «Resumo executivo» e as «Decisões pedidas» escrevem-se no fim. As setas `←` são instrução, não vão para o ficheiro.

## Próximo passo (chain)
- Sempre → **`mkt-copy` e `mkt-medicao` em paralelo** (ficheiros-fonte iguais, secções diferentes do mesmo
  ficheiro: cada uma escreve só entre os seus marcadores; o caller despacha-as no mesmo turno ou corre-as em série).
- Depois das duas → **`mkt-psicologia`** em modo rever (sobre «Estratégia e canais» a «Mensagens e copy»).
- Depois → **`mkt-revisor-agent`** (revisão adversarial; nunca quem produziu) → **`mkt-relatorio`** (HTML) →
  gate de aprovação da proposta (`AskUserQuestion`, CONTRATO §1).
- Falta a F1 ou falta orçamento/valor de cliente sem resposta → parar e devolver ao `marketeer` com a lista.

## Créditos
- Skill local `lead-magnet` (princípios, formatos, critérios) — via `marketeer/referencias/lead-magnet.md`.
- coreyhaines31/marketingskills (MIT): `skills/launch/SKILL.md` e `skills/content-strategy/references/content-distribution.md`
  (próprios/alugados/emprestados), `skills/offers/SKILL.md` e `references/guarantee-design.md`, `references/scarcity-urgency.md`,
  `skills/ads/references/b2b-paid-playbook.md` (CPL de equilíbrio, regras de corte), `skills/marketing-plan/references/measurement-framework.md`
  (critérios de corte, «quando os dados não estão ligados»), `skills/events/SKILL.md` (follow-up 24-48 h).
- anthropics/knowledge-work-plugins: `marketing/skills/campaign-plan` (esqueleto), `small-business/skills/seo-ai-visibility` (revisão a 30 dias).
