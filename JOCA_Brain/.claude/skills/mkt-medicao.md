---
name: mkt-medicao
description: "Infraestrutura de medição de uma marca (F2 do /marketeer): plano de eventos GA4 (generate_lead com formulario, clique_telefone), GTM, conversões Google Ads incluindo chamadas, Meta Pixel + CAPI, Consent Mode v2 com banner e RGPD/Lei 41/2004, convenção de UTM para anúncios, emails, posts e QR codes, auditoria do site que afeta campanhas, e o gate de medição da F4. MUST be invoked when the user says: plano de medição, tracking da campanha, medir as campanhas, UTMs, GA4 e GTM, pixel do Meta, CAPI, consentimento de cookies, gate de medição. SHOULD also invoke when: conversões não aparecem, montar eventos de lead, QR code com UTM, Consent Mode, preparar a F4 do marketeer."
triggers: mkt-medicao, plano de medição, medição, tracking, UTM, UTMs, convenção de UTM, GA4, GTM, generate_lead, clique_telefone, conversões Google Ads, chamadas Google Ads, Meta Pixel, CAPI, Conversions API, Consent Mode, banner de cookies, RGPD cookies, Lei 41/2004, QR code UTM, gate de medição, measurement plan, conversion tracking, consent mode v2, tracking plan
chain: mkt-psicologia, mkt-revisor-agent, mkt-relatorio
---
# mkt-medicao

Passo da **F2 Proposta**, em paralelo com a `mkt-copy`, depois da `mkt-estrategia`. Define como se mede
cada objetivo da proposta antes de gastar um euro, e escreve o **gate de medição** que a F4 tem de passar
(CONTRATO §5.5). Reaproveita os scripts de `tracking` e `auditoria` do pack; não escreve no site do cliente.

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md`, `conectores.md` (canais `ga4`, `gtm`, `google-ads`, `meta-ads`, `linkedin-ads`, `site`).
- `ciclos/<ciclo>/02-proposta.md` «Objetivos e KPIs», «Estratégia e canais» (canais, formulários, funil), «Materiais a produzir».
- `ciclos/<ciclo>/01-analise.md` e a última `auditorias/<data>.json` (tracking atual, SEO técnico, disparo antes do consentimento).
- `tracking/plano.md`, `tracking/contentor-*.json`, `tracking/relatorio-*.md` se já existirem.
- Referências: `"<MKT>/referencias/utm.md"`, `"<MKT>/modelos/tracking-plano.md"`, `"<MKT>/modelos/tracking-banner.md"`,
  `"<MKT>/modelos/tracking-politica-cookies.md"`.

## Entrega
- `02-proposta.md` «Medição» — entre `<!-- mkt-medicao:inicio -->` e `<!-- mkt-medicao:fim -->` — e «Melhorias ao site/SEO»
  — entre `<!-- mkt-medicao-site:inicio -->` e `<!-- mkt-medicao-site:fim -->`. Mais nada.
- `<RAIZ>/clientes/<slug>/tracking/plano.md` (gerado pelo script; nunca sobrescreve). Em modo agente gera-o o caller,
  com as respostas (passo 2).

## Regras
- **IDs nunca inventados**: `G-…`, `AW-…` + rótulo, `GTM-…`, accountId/containerId, ID do pixel → do operador
  por `AskUserQuestion`; «Não sei» → `TODO` com o sítio onde se encontra (ver `modelos/tracking-plano.md` §7).
- **O site muda-se no repo do cliente**, por quem o mantém. Daqui saem plano, contentor GTM, guias e provas.
- **Nada se publica no GTM nem nas contas** a partir daqui. **Nunca se cria um lead real** (a prova intercepta o envio).
- **Nunca dados pessoais** em eventos, parâmetros ou UTMs. Dados para CAPI/conversões otimizadas só com hash e consentimento.
- **Conversões de plataformas diferentes não se somam** (CONTRATO §5.7). Fonte de verdade da contagem: o
  backoffice/CRM/caixa de email do cliente; as plataformas explicam a origem.

## Passos

### 1. O que medir (a partir da proposta)
Uma linha por métrica de «Objetivos e KPIs» da proposta: evento → onde dispara → plataforma(s) que o recebem → decisão que ele alimenta.
Evento que não muda nenhuma decisão não entra.

**Padrão de eventos do pack:**

| Evento | Parâmetros | Quando | Evento-chave GA4 | Conversão Ads |
|---|---|---|---|---|
| `generate_lead` | `formulario` (id do formulário: `contacto`, `orcamento`, `<lead-magnet>`) | só no **2xx** do envio (nunca no clique, nunca em 4xx/5xx) | sim | sim, «Lead (formulário)» |
| `clique_telefone` | `numero` (da empresa, só algarismos) | clique num `tel:` | sim | opcional (ver passo 3) |

`generate_lead` é o evento recomendado do GA4 para «submete um formulário online ou informação offline»
(verificado 2026-10-01, support.google.com/analytics/answer/9267735). Nomes: só letras, algarismos e `_`,
começam por letra, sensíveis a maiúsculas (verificado 2026-10-01, support.google.com/analytics/answer/13316687).
Funil a seguir ao lead (opcional, se o cliente marcar estados no CRM): `qualify_lead`, `close_convert_lead`
(mesma fonte) — só com processo real do lado do cliente.

**Plano antigo mantém o nome:** marca já em produção com outro nome de evento de lead (ex.: `lead_enviado`)
não muda a meio de um ciclo (parte a série histórica) — o `tracking/plano.md` da marca manda (CONTRATO §5.5); na prova
passa-se `--evento <nome do plano>`. Regista-se a exceção em «Medição»; a mudança, se a houver, faz-se num ciclo novo.

### 2. Plano de medição (script)
Perguntar por `AskUserQuestion` (opções do site e de `marca.md`, sempre «Não sei»): os formulários do site
(valores de `formulario`) e os telefones da empresa com link `tel:`.
**Em modo agente** (F2.2, `general-purpose`; CONTRATO §5.9) não se pergunta e **não se corre o `plano.mjs`**
(o plano nunca se sobrescreve; gerado com valores por confirmar ficaria errado): deriva do site os formulários e os
`tel:` encontrados, escreve-os em «Medição» como `[por confirmar]` (com o URL onde os viste) e devolve ao caller as
duas perguntas. O `plano.mjs` só corre com as respostas, pelo caller (o `marketeer`) depois de perguntar. Inline, depois das respostas:

```bash
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/tracking/plano.mjs" <slug> --formularios contacto,orcamento --telefones <numero> [--com-ads|--sem-ads]
```
→ `clientes/<slug>/tracking/plano.md` (já existe → o script recusa; edita-se o existente). Eventos novos editam-se no frontmatter `tracking.eventos` (é dele que o `gtm` gera o contentor).

### 3. Conversões por plataforma

**Google Ads**
- Lead: conversão «Lead (formulário)» a partir do evento do plano, via GTM (o contentor gerado no passo 6).
- Etiquetagem automática (`gclid`) ligada — verificada no relatório da prova (`checklist.mjs` lê-a por GAQL).
- **Chamadas** — tipos (verificado 2026-10-01, support.google.com/google-ads/answer/6100664): chamadas a partir
  de anúncios (recurso de chamada) · chamadas para o número do site · cliques no número no site para telemóvel ·
  cliques em anúncios de chamada · importadas. As duas primeiras e a importação **exigem números de
  encaminhamento da Google**, que não existem em todos os países — disponibilidade em Portugal `[por confirmar na conta]`.
  Sem eles: medir «cliques no número no site para telemóvel» (= `clique_telefone`) e a conversão de clique em
  chamada, dizendo que são cliques, não chamadas atendidas.
- Objetivos de conversão por campanha: `ads objectivos` (script existente, com ensaio + confirmação) — é F4.
- Conversões otimizadas (dados do utilizador com hash): só com consentimento `ad_user_data` e decisão do cliente → `[por confirmar]` por marca.

**Meta (Pixel + Conversions API)** — só se a proposta tem Meta Ads.
- Pixel no GTM com consentimento de marketing (`ad_storage`); evento padrão para o lead a mapear a partir de
  `generate_lead` `[por confirmar: nome do evento padrão Meta e configuração no Gestor de Eventos]`.
- CAPI: exige servidor (do site do cliente ou GTM server-side) → decisão e custo para o cliente; sem isso, só Pixel e dizê-lo.
- Deduplicação Pixel + CAPI: `eventID` do Pixel = `event_id` da CAPI **e** nome do evento igual; janela de
  48 h desde o primeiro evento recebido (verificado 2026-10-01,
  developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/). O `event_id`
  gera-se uma vez, no servidor, no momento do lead.
- Verificação de domínio e qualidade de correspondência: ver no Gestor de Eventos → manual, entra no gate como ☐.

**LinkedIn** — Insight Tag no GTM com consentimento de marketing; conversão de lead `[por confirmar: configuração no Campaign Manager]`.

### 4. Consentimento — Consent Mode v2, banner, RGPD e Lei 41/2004
- Lei 41/2004, art. 5.º: guardar ou ler informação no equipamento do utilizador exige consentimento prévio,
  com informação clara e completa, salvo o estritamente necessário à comunicação (verificado 2026-10-01,
  diariodarepublica.pt/dr/detalhe/lei/41-2004-480710, resumo). Analytics e publicidade **não** são estritamente necessários.
- Consent Mode v2 — quatro sinais: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`
  (verificado 2026-10-01, developers.google.com/tag-platform/security/guides/consent).
- Padrão da casa (`modelos/tracking-banner.md`): `gtag('consent','default', … 'denied')` **inline no `<head>`
  antes do GTM**; todas as tags exigem consentimento; Recusar com o mesmo peso que Aceitar; revogação no
  rodapé; sem cookie-wall. Variante aceite: GTM só depois do consentimento.
- Política de cookies: `modelos/tracking-politica-cookies.md` — **revisão jurídica obrigatória** (dizer sempre).
- Email: consentimento de marketing separado e não pré-marcado nos formulários (Lei 41/2004, art. 13.º-A) →
  regra de formulário para a `mkt-copy`/landing.
- Revisão do que o programador fizer: skill `gdpr-compliance` do JOCA (sem JOCA → exportar brief, CONTRATO §5.11).

### 5. Convenção de UTM
Aplicar `referencias/utm.md` à proposta: uma **folha de UTMs** em «Medição» com uma linha por peça de «Materiais a produzir»
(anúncios Meta/LinkedIn, posts, emails, GBP, cada QR de material offline) — canal · URL final ·
`utm_source` · `utm_medium` · `utm_campaign` · `utm_content`. Google Ads com etiquetagem automática não leva
UTMs manuais. Validar a folha inteira com o comando de `referencias/utm.md` §5 (sai 0) e o destino com `curl`
(200 e UTMs preservados). A `mkt-copy` e a `mkt-criativos` usam estes URLs, não inventam outros.

### 6. Contentor GTM (preparado na F2, importado na F4)
Com os IDs do operador:
```bash
MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/tracking/gtm.mjs" <slug> --ga4 G-… --conta <accountId> --contentor <containerId> \
  --gtm GTM-… [--ads AW-…/<rótulo>] [--rotulo generate_lead=<rótulo>] [--nome <nome>]
```
Parâmetro em falta → o script sai 1 com a lista; mostrar e perguntar, nunca completar. O contentor atual
gera GA4 + Google Ads; Pixel Meta e Insight Tag acrescentam-se no GTM à mão (com consentimento de marketing)
`[por confirmar: o gtm.mjs não os gera — pedir ao dono dos scripts]`.

### 7. Auditoria do site que afeta campanhas
Da última auditoria (`auditoria/correr.mjs`) e da landing de cada campanha, listar só o que parte medição ou conversão:
- tags a disparar **antes** do consentimento (achado crítico da área tracking);
- landing com HTTP ≠ 200, redirecionamento que **deita fora os `utm_*`/`gclid`**, `noindex` acidental, canonical errado;
- landing lenta ou não usável no telemóvel (Core Web Vitals da auditoria SEO; limiares com a fonte da auditoria);
- formulário sem estado de sucesso detetável (sem 2xx/«obrigado» não há onde disparar `generate_lead`);
- telefone sem `tel:`; NAP diferente entre site e GBP.
Correr de novo se a auditoria tiver mais de 30 dias: `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/auditoria/correr.mjs" <slug>`.

### 8. Gate de medição (o que a F4 tem de provar antes de criar qualquer campanha)
Escrever em «Medição» esta lista, com o comando de prova de cada item. A F4 só começa com todos ✓ ou com
`não aplicável` justificado; um ✗ devolve à F2 (CONTRATO §5.5).

| # | Item | Prova |
|---|---|---|
| G1 | Plano com `generate_lead{formulario}` e `clique_telefone{numero}` | `grep -n "generate_lead" "<RAIZ>/clientes/<slug>/tracking/plano.md"` encontra o frontmatter |
| G2 | Contentor gerado | `ls "<RAIZ>/clientes/<slug>/tracking/"contentor-GTM-*.json` |
| G3 | Contentor importado e publicado pelo operador | confirmação do operador por `AskUserQuestion` (versão e data) |
| G4 | Consentimento: 0 hits Google antes e depois de Recusar; hits depois de Aceitar; lead dispara 1 evento no 201 e 0 no 422 | `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/tracking/prova.mjs" <url> --cliente <slug> --formulario <url> [--abrir …] [--form …]` → **saída 0**. `--evento` omite-se (default `generate_lead`); só `--evento <nome do plano>` se o `tracking/plano.md` da marca usar outro nome. `--parametro` também se omite: com `--cliente` o script lê o 1.º parâmetro do evento no plano (senão `formulario`) — cabeçalho de `tracking/prova.mjs` |
| G5 | Checklist GA4/Ads (etiquetagem automática, ação de conversão do rótulo, objetivos por campanha; manuais: ligação GA4↔Ads, retenção 14 meses, tráfego interno, eventos-chave) | `tracking/relatorio-<data>.md` gerado pela G4: itens lidos `ok`, manuais ☑ confirmados pelo operador |
| G6 | UTMs da folha válidos e preservados | comando de `referencias/utm.md` §5 → saída 0; `curl -sL -o /dev/null -w '%{http_code} %{url_effective}'` → 200 com `utm_*` |
| G7 | Meta Pixel (se há Meta): sem disparo antes do consentimento; lead recebido no Gestor de Eventos (Testar eventos); CAPI deduplicada se existir | área tracking da auditoria sem «Meta Pixel antes do consentimento» + ☑ do operador com captura `[por confirmar: a prova.mjs só vigia domínios Google]` |
| G8 | Chamadas medidas como prometido no passo 3 | conversão de chamada visível em Google Ads → Conversões (☑ operador) ou «não aplicável» |
| G9 | Política de cookies com revisão jurídica | ☑ do operador (quem reviu, data) |

Partir o gate uma vez de propósito antes de confiar nele: correr a G6 com um URL com `utm_medium=Paid Social`
→ tem de sair 1. A G4 já tem cenários negativos internos (422 → 0 eventos).

### 9. Gravar
Re-ler `02-proposta.md` imediatamente antes de escrever e editar **só** entre os marcadores
`mkt-medicao` (a `mkt-copy` pode estar a escrever noutra secção do mesmo ficheiro; se a edição falhar porque o
ficheiro mudou, re-ler e repetir). Conteúdo de «Medição»: tabela de eventos (passo 1) · conversões por plataforma (3) · consentimento (4) ·
folha de UTMs (5) · gate (8) · IDs em falta (`TODO`). Entre os marcadores `mkt-medicao-site` («Melhorias ao
site/SEO»): os achados do passo 7, cada um com evidência, impacto na campanha e quem o corrige.

## Modo verificar (gate de medição, no início da F4)
Chamado pelo `marketeer` antes de qualquer escrita nas contas. Não reescreve o plano.
1. Ler a tabela G1-G9 de «Medição» do `02-proposta.md` aprovado (e os itens `não aplicável` com a justificação).
2. Correr cada prova automática (G1, G2, G4, G6) agora — resultados de ciclos ou dias anteriores não contam.
   Confirmar os manuais (G3, G5, G7-G9) por `AskUserQuestion`, um por item, «Não sei» = ✗.
3. Devolver ao `marketeer` só a tabela `item · ✓/✗ · data · evidência (saída do comando ou resposta do operador)`;
   o `marketeer` grava-a em `ciclos/<ciclo>/04-implementacao.md` §Gate de medição (CONTRATO §5.5), que é a tabela que as
   skills de plataforma leem em modo agente.
   Qualquer ✗ → gate vermelho: o `marketeer` volta à F2 com a lista do que falta (CONTRATO §5.5).
4. Sucesso prova-se pelo efeito: `prova.mjs` com saída 0 **e** a linha do cenário D com 1 evento no 201.

## Próximo passo (chain)
- «Medição» gravada e a `mkt-copy` também → **`mkt-psicologia`** (revisão) → **`mkt-revisor-agent`** → **`mkt-relatorio`** → gate de aprovação.
- IDs ou acessos em falta → não bloqueia a F2: ficam `TODO` em «Medição» e entram em «Lacunas e por confirmar»; bloqueiam a F4 (gate).
- Achados críticos no site → brief para o programador do site (skill JOCA `frontend`/`gdpr-compliance` ou exportar brief).

## Créditos
- Synter-Media-AI/free-skills (MIT): `skills/tracking-leak-detector/SKILL.md` (tipos de fuga), `skills/pixel-capi-auditor/SKILL.md`
  (checklists Meta/Google, Consent Mode), `skills/utm-builder/SKILL.md`, `skills/launch-gates/SKILL.md` (gate antes de gastar).
- coreyhaines31/marketingskills (MIT): `skills/ads/references/platform-setup-checklists.md` (checklist pré-lançamento),
  `skills/ads/references/conversion-tracking.md` (validação, erros comuns), `skills/attribution/SKILL.md` (não somar plataformas, fonte de verdade).
