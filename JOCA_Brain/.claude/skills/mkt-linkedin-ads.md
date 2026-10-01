---
name: mkt-linkedin-ads
description: "F4 do marketeer para LinkedIn Ads: especifica e monta no Campaign Manager os grupos de campanhas, campanhas e anúncios aprovados — objetivo, segmentação B2B, formato, Lead Gen Forms, Insight Tag — sempre em pausa e pela via manual, com custo à vista, checklist e data de revisão. MUST be invoked when the user says: montar campanha LinkedIn, LinkedIn Ads, Campaign Manager, F4 LinkedIn, linkedin ads setup. SHOULD also invoke when: segmentação por cargo ou setor, Lead Gen Form do LinkedIn, Insight Tag, anúncio patrocinado no LinkedIn, orçamento mínimo LinkedIn, métricas LinkedIn Ads para a review."
triggers: linkedin ads, campaign manager, campanha linkedin, sponsored content, conteúdo patrocinado, lead gen form, lead gen forms, insight tag, segmentação b2b, cargo, setor, matched audiences, F4 linkedin, linkedin ads setup
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-linkedin-ads

Fase F4 (e leitura na F5) para LinkedIn Ads. Sem script no marketeer: a especificação sai daqui e o
operador monta no Campaign Manager, em pausa. Só faz sentido quando o público é definível por
empresa/cargo/setor (B2B) e o orçamento aguenta os mínimos da plataforma.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — campanhas LinkedIn, objetivo, público, orçamento, factos aprovados.
- `ciclos/<ciclo>/03-artes/` aprovado.
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.
- `clientes/<slug>/conectores.md` (canais `linkedin-ads`, `linkedin`) · `marca.md`.
- `<MKT>/referencias/plataformas.md`.

## Entrega
- `clientes/<slug>/campanhas/<nome>.md` — especificação (passo 3).
- Secção `## linkedin-ads` em `ciclos/<ciclo>/04-implementacao.md`.
- Data de revisão **proposta** (canal `linkedin-ads`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

### 1. Gate de medição
- **Modo agente** (`mkt-plataforma-agent`, F4 do `marketeer`): o brief traz a tabela de
  `ciclos/<ciclo>/04-implementacao.md` §Gate de medição, verificada pelo caller. Aceita-a se a data for **deste ciclo**
  e não tiver ✗; repete **só** as provas automáticas G1, G2, G4, G6 (comandos de `mkt-medicao` §8) e **não perguntas**
  os manuais (G3, G5, G7-G9). Os pontos LinkedIn abaixo que dependem do operador (Insight Tag, conversão criada) ficam
  `[por confirmar]` na lista do retorno se a tabela não os cobrir. Tabela em falta, de outro ciclo, com ✗, ou uma prova
  automática que agora falha → paras e devolves ao caller a linha que falhou.
- **Inline, sem tabela** em `04-implementacao.md`: corres o gate todo (manuais por `AskUserQuestion`, «Não sei» = ✗).

Corre o gate de `02-proposta.md` §Medição (G1-G9 da `mkt-medicao`, com data deste ciclo); todos ✓ ou «não aplicável» justificado. Para o LinkedIn, além disso:
- **Insight Tag** instalada (Campaign Manager → Data → Signals manager → Insight Tag; LinkedIn Help a418880, verificado 2026-10-01), a carregar **só com consentimento**, e a conversão do plano criada (Insight Tag/event-specific; a425606). Via GTM é aceite (a422760).
- Objetivo «Website Conversions» exige conversão a funcionar (LI-OBJ). Sem ela → só Lead Generation (formulário nativo) ou paras.
- URLs dos anúncios = os da folha de UTMs (`linkedin` / `paid_social`), validados (G6).
Um ✗ → devolves à F2 (`mkt-medicao`).

### 2. Acesso, moeda e orçamento mínimo
- Acesso do operador à conta de anúncios e à Página da empresa (`conectores.md`). Sem acesso → receita em `como ligar`, paras.
- A moeda da conta escolhe-se na criação e não muda (LinkedIn Help a426137 via pesquisa, verificado 2026-10-01) → confirmar que é EUR.
- Mínimos de orçamento em EUR (diário por campanha, vitalício, saldo do grupo): `[por confirmar]` — a página oficial lida só diz que é preciso um saldo mínimo não gasto de 100 (USD) no grupo para lançar campanhas novas com orçamento vitalício (a415996, verificado 2026-10-01). Inline, pede ao operador o mínimo que o Campaign Manager mostra ao criar e regista-o com data; em modo agente fica `[por confirmar]` na lista do retorno.
- Público pequeno demais não entrega: o Campaign Manager mostra a estimativa de audiência — regista o número que aparece; limiares de tamanho `[por confirmar]`.

### 3. Especificação
Nome (CONTRATO §6): `LINK_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM>` — o do brief, se o trouxer (ex.: `LINK_LeadGen_Leads_Software_2026-10`). O público vai na segmentação, não no nome.
```markdown
# <nome>
## Grupo de campanhas
- Nome · orçamento do grupo (se houver) · datas
## Campanha
- Objetivo: <Brand Awareness | Website Visits | Engagement | Video Views | Lead Generation | Website Conversions> (LI-OBJ, verificado 2026-10-01)
- Formato: <Imagem única | Carrossel | Vídeo | Documento | …>
- Orçamento: <X> €/dia · <X × 30,4> €/mês (vitalício: <Y> € em <N> dias → <Y ÷ N> €/dia · <Y ÷ N × 30,4> €/mês) · licitação (a que o Campaign Manager propuser, registada)
- Datas · Estado: em rascunho/pausa
## Segmentação
- Localização (permanente/recente — a escolhida e porquê) · idioma do perfil
- Empresa: setor, dimensão, lista de empresas (se houver, com fonte)
- Pessoa: cargos ou funções + senioridade (preferir função + senioridade a dezenas de cargos)
- Exclusões: concorrentes, colaboradores da própria marca, clientes atuais (lista com consentimento)
- Audiência estimada mostrada: <n> (data)
## Anúncios
| Anúncio | Formato | Ficheiro | Texto de introdução (car.) | Título (car.) | Descrição | CTA | URL com UTM |
## Lead Gen Form (se houver)
## Factos aprovados usados · Decisões tomadas
```
Limites (LI-SI, verificado 2026-10-01): texto de introdução máx. 3000, recomendado 150 · título máx. 200, recomendado 70 · descrição máx. 300, recomendado 100 · imagem 1200×628 (1,91:1), 1200×1200 (1:1) ou 720×900 (4:5), JPG/PNG/GIF, ≤5 MB. Outros formatos: `[por confirmar]` → confirmar na pré-visualização.
**Lead Gen Form** (LI-LGF/LI-EU, verificado 2026-10-01): até 12 campos, até 3 perguntas personalizadas; URL da política de privacidade obrigatória; na UE não há caixa de consentimento por omissão — acrescentar caixas de divulgação **por finalidade** (contacto ≠ marketing), não pré-marcadas (CNPD §30). Formulário já ligado a anúncio ativo não se edita: cria-se novo. Definir quem recebe os leads (download CSV ou integração) e em quanto tempo responde — de `marca.md`; sem isto, não avança.
Textos: tom profissional, sem promessas fora dos factos aprovados. Revisão independente obrigatória (`mkt-revisor-agent`) antes do passo 4 — em modo agente despacha-a o `marketeer` (F4.3).

### 4. Custo e aprovação
```
Conta:        <ID> · <nome> · moeda EUR
Campanha:     <nome> — fica em rascunho/pausa
Orçamento:    <X> €/dia · <X × 30,4> €/mês (convenção do marketeer; vitalício <Y> € em <N> dias → <Y ÷ N> €/dia · <Y ÷ N × 30,4> €/mês)
Mínimos:      <o que o Campaign Manager mostrou, com data> 
Reversível:   sim — em pausa não gasta; ativar é manual, pelo dono
```
`AskUserQuestion` Sim/Não («Sim, montar em pausa» primeiro). Um «sim» por campanha.
Em modo agente não perguntas: devolves a especificação + o bloco de custo; o `marketeer` pergunta (F4.4).

### 5. Montagem (via manual)
1. Campaign Manager → conta → grupo de campanhas (criar ou escolher) → Criar campanha.
2. Objetivo, segmentação, formato, orçamento e datas da especificação; Lead Gen Form ligado se houver.
3. Anúncios com os ficheiros de `03-artes/finais/` e textos literais; URLs com UTM.
4. **Não lançar.** Deixar a campanha em rascunho ou, se tiver de ser submetida, com estado pausado — confirmar na lista o estado mostrado `[por confirmar os nomes dos estados na interface atual]`.
5. O operador devolve: IDs do grupo, campanha e anúncios, estado, estimativa de audiência e captura.

### 6. Checklist de pré-lançamento
- [ ] Gate de medição verde (Insight Tag com consentimento, conversão criada) com data.
- [ ] Conta em EUR; mínimos confirmados e registados.
- [ ] Segmentação = público da proposta; exclusões aplicadas; audiência estimada registada.
- [ ] Textos e imagens dentro dos limites; só factos aprovados.
- [ ] URLs 200 com UTMs; Lead Gen Form com política de privacidade e caixas de consentimento por finalidade.
- [ ] Destino dos leads e responsável definidos.
- [ ] Estado rascunho/pausa confirmado.

### 7. Registo e data de revisão
Secção para `ciclos/<ciclo>/04-implementacao.md` (inline escreves; em modo agente devolve-la e o `marketeer` junta):
```markdown
## linkedin-ads
| Grupo | Campanha | ID | Objetivo | Formato | Estado | €/dia | €/mês | Vitalício (se houver) | Audiência estimada | Destino (UTM) / Lead Gen Form | Especificação | Montada em |
Checklist: <passo 6>
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: CTR abaixo do anterior da conta após X impressões; leads fora do público>
Ativação: manual, pelo dono — por fazer
```
Data de revisão **proposta**: ativação prevista + 14 dias (LinkedIn entrega devagar com orçamentos pequenos); sem a
data de ativação («Não sei», ou modo agente sem o dado) → montagem + 7 dias, motivo «confirmar se foi ativada», e a
pergunta na lista `[por confirmar]`.
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `linkedin-ads · <AAAA-MM-DD> ·
<motivo>` e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 8. Modo leitura (F5)
- Export CSV do Campaign Manager (relatório de desempenho por campanha/anúncio, período) — via principal. Coluna em falta → «sem dado».
- Métricas: gasto, impressões, cliques, CTR, CPC, CPM, conversões (com a janela), leads do formulário e taxa de preenchimento, custo por lead; demografia de quem clicou (cargo/setor/empresa) se o relatório a der, para confirmar que o público é o certo.
- Leads cruzados com o CRM ou com quem responde (qualificados vs. não). **Nunca somar conversões com Google/Meta.** Volumes pequenos → «dados insuficientes».

## Próximo passo (chain)
- Especificação → `mkt-revisor-agent` (obrigatório; em modo agente despacha-o o `marketeer`).
- Montada em pausa e registada → `marketeer` (fecho da F4).
- Data de revisão → `marketeer-review` (passo 8).
- Insight Tag/conversão por fazer → `mkt-medicao`.

## Créditos
Adaptado (MIT) de:
- coreyhaines31/marketingskills — `skills/ads/references/platform-setup-checklists.md` §LinkedIn (checklist), `skills/ads/references/linkedin-b2b-playbook.md` (via relatório B: tamanho de audiência e retargeting como risco de não entrega), `skills/ads/references/audit-guardrails.md`.
- anthropics/knowledge-work-plugins — `small-business/skills/ad-manager/` (via manual/CSV, bloco de custo, data de revisão).
- Synter-Media-AI/free-skills — `skills/launch-gates/SKILL.md`, `skills/campaign-preflight/SKILL.md`.
