---
name: mkt-google-ads
description: "F4 do marketeer para Google Ads: monta as campanhas aprovadas na proposta, sempre em pausa — Search por script (especificação, validação, ensaio, criação em PAUSED) e Performance Max/Display/YouTube por especificação + via manual/CSV — com checklist de pré-lançamento, conversões, recursos, negativas e data de revisão. MUST be invoked when the user says: montar a campanha Google Ads, F4 Google Ads, criar campanha Search, campanha Performance Max, Google Ads em pausa, google ads campaign setup. SHOULD also invoke when: carregar CSV no Google Ads Editor, negativas da campanha, sitelinks e frases de destaque, conversões do Google Ads antes de lançar, investimento da campanha, métricas Google Ads para a review."
triggers: google ads, campanha search, campanha google, performance max, pmax, display, youtube ads, google ads editor, csv google ads, rsa, sitelinks, negativas, palavras-chave negativas, campanha em pausa, investimento google ads, F4 google, google ads setup
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-google-ads

Fase F4 (e leitura na F5) para Google Ads. Search vai pelos scripts provados do marketeer
(`campanha/*`, `ads/*`), que criam **só em `PAUSED`**. PMax, Display e YouTube não têm script: saem
como especificação + montagem manual (ou CSV do Google Ads Editor), também em pausa.

**Regra que não se negoceia:** não existe caminho para pôr uma campanha em `ENABLED`, e tu não o
fazes por outro (API, script ad hoc, interface). Ativar é decisão do dono da conta, à mão, depois de
ver a tabela de investimento. Se pedirem para ativar: mostras orçamento diário e mensal, licitação,
CPC máximo e gasto estimado, e paras.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — campanhas Google, objetivos, orçamentos, factos aprovados.
- `ciclos/<ciclo>/03-artes/` aprovado — RSAs, imagens/vídeos/logótipos para PMax/Display/YouTube.
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.
- `clientes/<slug>/conectores.md` (canal `google-ads`: `customer_id`, acesso, via) e `dossier.md`.
- `<MKT>/referencias/plataformas.md` · `<MKT>/modelos/campanha-search.md`.

## Entrega
- `clientes/<slug>/campanhas/<nome>.md` (uma campanha por ficheiro; Search no modelo; PMax/Display/YouTube no formato do passo 5).
- `clientes/<slug>/campanhas/<nome>-carregamento/` (CSV, quando a via é CSV).
- Secção `## google-ads` em `ciclos/<ciclo>/04-implementacao.md`.
- Data de revisão **proposta** (canal `google-ads`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

Comandos sempre com `MARKETEER_RAIZ="<RAIZ>"` exportado e `<MKT>` resolvido (CONTRATO §2). Timeouts a
`*.googleapis.com` → repetir com `node --network-family-autoselection-attempt-timeout=2000 …`.
`USER_PERMISSION_DENIED` com a conta já na MCC → repetir com `--login mcc`.

### 1. Gate de medição (antes de tudo)
- **Modo agente** (`mkt-plataforma-agent`, F4 do `marketeer`): o brief traz a tabela de
  `ciclos/<ciclo>/04-implementacao.md` §Gate de medição, verificada pelo caller. Aceita-a se a data for **deste ciclo**
  e não tiver ✗; repete **só** as provas automáticas G1, G2, G4, G6 (comandos de `mkt-medicao` §8) e **não perguntas**
  os manuais (G3, G5, G7-G9 — já confirmados pelo caller). Tabela em falta, de outro ciclo, com ✗, ou uma prova
  automática que agora falha → paras e devolves ao caller a linha que falhou (não crias nada).
- **Inline, sem tabela** em `04-implementacao.md`: corres o gate todo, como abaixo (manuais por `AskUserQuestion`,
  «Não sei» = ✗).

Corre o gate de `02-proposta.md` §Medição (escrito pela `mkt-medicao`): G1-G6 e G8-G9 aplicam-se a Google Ads, cada um com o seu comando de prova, com data deste ciclo. Em especial:
- G4 — `tracking/prova.mjs` com saída 0 (sem consentimento → 0 hits; com consentimento → GA4 e Ads; lead 1 evento no 201, 0 no 422).
- G5 — etiquetagem automática ligada e a ação de conversão do rótulo existe na conta (também em `ads/diagnostico.mjs` → «acções de conversão»).
- G6 — destinos da folha de UTMs a responder 200. Google Ads usa etiquetagem automática: os URLs finais são os da folha (sem UTMs manuais, salvo o que a folha disser).
Todos ✓ (ou «não aplicável» justificado). Um ✗ → paras e devolves à F2 (`mkt-medicao`) com a linha que falhou. Nada se cria sem isto.

### 2. Acesso e via
Lê `conectores.md` (canal `google-ads`). Diz numa linha que via vai correr:
- **API** (`acesso: sim`, refresh token no cofre) → scripts.
- **Sem API** → CSV (`campanha/csv.mjs`) ou passo a passo manual. Ligar a conta: o operador corre **no terminal dele** `node "<MKT>/scripts/ads/ligar.mjs" <slug> [--login mcc]` (nunca pedes credenciais no chat).

### 3. Search — especificação (por campanha)
1. Se a proposta ainda não tiver especificação: inline, questionário por `AskUserQuestion` (uma decisão de cada vez, «Não sei» → `<sem fonte>`): objetivo e conversões a contar/não contar · tema e público · zona (`geoTargetConstant`: Portugal = 2620) e idioma (1014) · orçamento diário, licitação (`maximizar-cliques` | `cpc-manual`) e CPC máximo — **só valores dados pelo operador** · factos aprovados · URL final e caminho · horários e telefone.
   Em modo agente não perguntas: campo sem valor na proposta/brief → `[por confirmar]`, essa campanha não se ensaia, e a pergunta volta na lista do retorno (orçamento e CPC **nunca** se preenchem por defeito).
   Nome (CONTRATO §6): `GADS_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM>` — o do brief, se o trouxer (ex.: `GADS_Search_Leads_Software_2026-10`; PMax → `GADS_PMax_…`).
2. Gravar (nunca sobrescreve):
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/nova.mjs" <slug> <<'JSON'
   {"nome": "...", "tema": "...", "objectivo": "...", "localizacoes": [{"id": 2620, "nome": "Portugal"}], "idiomas": [1014],
    "orcamento_dia": 5, "licitacao": "maximizar-cliques", "cpc_max": 2.3, "url_final": "https://...?utm_...", "factos": ["..."]}
   JSON
   ```
3. Dados reais: `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/ads/diagnostico.mjs" <slug>` (secção 1) e
   `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/pesquisa.mjs" <slug> --sementes "a,b,c" [--geo 2620] [--idioma 1014]` (secção 2, grupos, negativas). Sem Planeador → não há volumes; não os estimas.
4. RSAs a partir das artes aprovadas: por grupo 15 títulos ≤30 e 4 descrições ≤90, contagem na coluna `Car.`, pelo menos 2 RSAs por grupo com força «Boa/Excelente» (G-RSA). Telefone nunca no texto. Números só dos factos aprovados.
5. Recursos: ≥4 sitelinks (texto ≤25; descrições ≤35 como o validador exige), ≥4 frases de destaque ≤25, snippet estruturado, recurso de chamada com horário.
6. Negativas: só com evidência — termos de pesquisa reais (`pesquisa.mjs`/diagnóstico) ou lista partilhada já existente. **Sem relatório de termos não se inventam negativas** (diz-se e pede-se o relatório). Revisão de sobre-bloqueio: nenhuma negativa pode bloquear uma positiva da mesma campanha (o validador recusa).
7. Validar até sair 0:
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/validar.mjs" "<RAIZ>/clientes/<slug>/campanhas/<nome>.md"
   ```
8. Revisão independente obrigatória (`mkt-revisor-agent`, nunca o produtor): números fora dos factos, promessas que a landing não cumpre, negativas que cortam pesquisas comerciais, grupos com intenção misturada, PT-BR. Em modo agente quem a despacha é o `marketeer` (F4.3) sobre o bloco que devolves; tu corriges quando ele te reenviar os achados. Corrige → valida → regista em «Decisões tomadas».

Definições por omissão em Search (registar na especificação; mudar só com razão escrita):
Rede de Pesquisa sim · parceiros de pesquisa e Display **não** · localização por **Presença** · só correspondência de expressão e exata · licitação manual ou maximizar cliques até haver volume de conversões. Referência prática (não regra da Google): com 0-15 conversões/mês por campanha não há dados para CPA alvo; 30+ estáveis → considerar CPA alvo perto do real [inferência, marketingskills `google-search-playbook`].

### 4. Search — ensaio, custo e criação em pausa
1. **Ensaio** (não cria nada: `validateOnly` + GAQL confirma que não existe):
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/criar.mjs" <slug> <nome>
   MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/investimento.mjs" <slug> <nome>
   ```
2. Mostra o plano do ensaio + bloco de custo:
   ```
   Conta:        <customer_id> · <nome da conta>
   Campanha:     <nome> (nasce em PAUSED)
   Orçamento:    <X> €/dia · <X × 30,4> €/mês (máx. mensal = 30,4 × diário; num dia pode gastar até 2×, G-BUD)
   Licitação:    <estratégia> · CPC máx. <Y> €
   Reversível:   sim — fica em pausa; nada gasta até alguém a ativar à mão
   ```
3. `AskUserQuestion` Sim/Não: «Sim, criar em pausa» primeiro, nomeando conta e orçamento. Um «sim» vale para **esta** campanha.
   Em modo agente não perguntas: paras aqui e devolves o plano do ensaio + o bloco de custo; o `marketeer` pergunta (F4.4) e, com «Sim», reenvia-te a ordem de criar.
4. Criar: o mesmo comando com `--confirmar`. Saída 1 → mostras e não repetes às cegas (há idempotência). Fecha sempre com `investimento.mjs`.
5. Sem API: `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/csv.mjs" <slug> <nome>` → mostra a ordem de carregamento impressa. No Google Ads Editor: **Conta → Importar → De ficheiro / Colar texto**, rever cabeçalhos, Importar; a coluna de estado aceita `Enabled`/`Paused`/`Removed` — tem de estar `Paused` (Ads Editor Help 30564 / 57747, verificado 2026-10-01). Publicar a importação no Editor é do operador, depois do mesmo gate.

### 5. Performance Max, Display, YouTube (sem script)
Só se a proposta os tiver e com razão escrita (PMax/Display/YouTube depois de Search de marca e de intenção alta estarem a funcionar e com tracking provado — ordem prática, marketingskills `google-search-playbook`).
Especificação em `campanhas/<nome>.md` com: objetivo e conversão · orçamento `<X> €/dia · <X × 30,4> €/mês` · licitação · zona/idioma · grupos de recursos com cada texto e a contagem · imagens/logótipos/vídeos (caminho em `03-artes/finais/`, dimensões **medidas**) · sinais de público (dados próprios, temas de pesquisa) · exclusões de marca (PMax) · URLs com UTM · `[por confirmar]` onde `plataformas.md` não tem fonte.
Limites a cumprir (G-PMAX, verificado 2026-10-01): títulos 3-15 × 30 (um ≤15) · títulos longos 1-5 × 90 · descrições 2-5 × 90 · nome da empresa 25 · imagens 1,91:1 / 1:1 (obrigatória) / 4:5 · logótipo 1:1 obrigatório · vídeos ≥10 s. YouTube: formatos e durações em `plataformas.md` (YT). Display: imagens em `plataformas.md` (G-RDA); limites de texto `[por confirmar]`.
Montagem: passo a passo para o operador na interface (Campanhas → Nova → objetivo → tipo) **guardando a campanha em pausa**, ou CSV do Google Ads Editor com estado `Paused`. Antes: mesmo bloco de custo + `AskUserQuestion`. A Google gera vídeo automático se não houver vídeo — diz-se e decide-se no gate.

### 6. Checklist de pré-lançamento (por campanha; vai para `04-implementacao.md`)
- [ ] Gate de medição verde (passo 1) com data.
- [ ] Ação de conversão certa como principal; as que não interessam marcadas «não contar» (`ads/alterar.mjs objectivos`, com ensaio + confirmação).
- [ ] Zona com ID e **Presença**; idioma; horário.
- [ ] Parceiros de pesquisa e Display desligados (Search).
- [ ] Orçamento próprio (sem orçamento partilhado com a marca).
- [ ] Negativas com evidência; nenhuma bloqueia positivas.
- [ ] RSAs: contagens, sem telefone, só factos aprovados; recursos completos.
- [ ] Todas as URLs respondem 200 (o validador confirma) e levam UTMs do plano.
- [ ] Landing cumpre a promessa do anúncio (abrir no telemóvel).
- [ ] Estado `PAUSED` confirmado por GAQL/`investimento.mjs` (0 campanhas ativas novas).

### 7. Registo e data de revisão
Inline, acrescenta a `ciclos/<ciclo>/04-implementacao.md`; em modo agente **devolves** a secção e o `marketeer` junta-a (um só escritor por ficheiro):
```markdown
## google-ads
| Campanha | ID | Tipo | Estado | €/dia | €/mês | Licitação | Conversão otimizada | Destino (UTM) | Especificação | Criada em |
Checklist: <passo 6 com ✓/✗>
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: custo por lead > X € após 30 conversões>
Ativação: manual, pelo dono da conta — por fazer
```
Data de revisão **proposta**: ativação prevista + 14 dias (semana 2 do plano de medição do modelo). A ativação prevista
vem do brief ou, inline, de um `AskUserQuestion` (Esta semana · Próxima semana · Não sei); sem ela (ou «Não sei», ou
modo agente sem o dado) → criação + 7 dias com motivo «confirmar se foi ativada» e a pergunta na lista `[por confirmar]`.
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `google-ads · <AAAA-MM-DD> ·
<motivo>` e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 8. Modo leitura (F5)
- `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/ads/diagnostico.mjs" <slug>` → custo, cliques, impressões, conversões, CPC, parcela de impressões, termos com gasto e sem conversão, índice de qualidade, landings com HTTP atual.
- `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/campanha/investimento.mjs" <slug> --todas` → estado, orçamentos, CPC real.
- `campanha/pesquisa.mjs --campanha <texto>` → termos de pesquisa (fonte única para negativas novas).
- PMax/Display/YouTube sem script: pedir export CSV da interface (Campanhas → período → transferir) e mapear colunas; coluna em falta → diz-se, não se assume 0.
- **Pausar de urgência** (decisão da review, ex.: gasto sem conversões acima do critério de corte). Só pausa — o
  script não tem caminho para ativar. Primeiro o ensaio (`validateOnly`, não muda nada), com nome exato ou ID de cada campanha:
  ```bash
  MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/ads/alterar.mjs" pausar <slug> "<nome ou ID>" ["<nome ou ID>" …] [--login mcc]
  ```
  Mostra o plano + o gasto que se trava (€/dia · €/mês, de `investimento.mjs`) e `AskUserQuestion` Sim/Não («Sim, pausar
  <campanha>» primeiro). Só depois do «Sim»: o mesmo comando com `--confirmar` (aplica e verifica por GAQL; saída 1 =
  a conta não ficou como pedido → mostra, não repetes às cegas). Nome repetido → o script pede o ID. Campanha de
  experiência não se pausa por aqui (termina-se a experiência na interface). Em modo agente: só o ensaio; a pergunta e o
  `--confirmar` são do caller.
- Comparar com a especificação e com o baseline da F1. **Nunca somar conversões com Meta/LinkedIn.** Menos de ~30 conversões ou <14 dias → «dados insuficientes», não veredicto.

## Próximo passo (chain)
- Especificação pronta → `mkt-revisor-agent` (obrigatório antes do bloco de custo; em modo agente despacha-o o `marketeer`).
- Campanhas criadas em pausa e registadas → `marketeer` (fecha a F4 quando todas as plataformas acabarem).
- Data de revisão chegou → `marketeer-review` (F5) usa o passo 8.

## Créditos
Adaptado (MIT) de:
- coreyhaines31/marketingskills — `skills/ads/references/google-search-playbook.md` (definições por omissão, licitação por volume, negativas e sobre-bloqueio), `skills/ads/references/rsa-output-spec.md` (recursos mínimos), `skills/ads/references/google-ads-audit-checklist.md` e `platform-setup-checklists.md` (checklist), `skills/ads/references/audit-guardrails.md` (nada de negativas sem relatório; mudança mínima reversível).
- anthropics/knowledge-work-plugins — `small-business/skills/ad-manager/` (CSV como via principal; bloco de custo em valores absolutos; um «sim» por alteração; data de revisão com «o que tornaria isto um erro»).
- Synter-Media-AI/free-skills — `skills/launch-gates/SKILL.md` e `skills/campaign-preflight/SKILL.md` (aprovar ≠ ativar; pausado por omissão; pré-voo bloqueante).
