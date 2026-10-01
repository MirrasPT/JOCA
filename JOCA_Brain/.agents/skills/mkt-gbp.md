---
name: mkt-gbp
description: "F4 do marketeer para Google Business Profile: completar o perfil (categorias, horários, serviços, fotos), preparar publicações, modelos de resposta a avaliações na voz da marca e o pedido de avaliações (link + QR com UTM no site) — tudo entregue ao dono para aplicar à mão, com a auditoria pública (Places API) como antes e depois. MUST be invoked when the user says: Google Business Profile, perfil do Google, ficha do Google Maps, F4 GBP, responder a avaliações, pedir avaliações. SHOULD also invoke when: categorias do perfil, horários no Google, publicações no perfil do Google, QR para avaliações, link de avaliações, métricas do perfil para a review."
triggers: google business profile, gbp, perfil empresarial google, ficha google maps, google meu negócio, avaliações google, responder avaliações, pedir avaliações, qr avaliações, publicações gbp, categorias gbp, horários google, F4 gbp
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-gbp

Fase F4 (e leitura na F5) para o Google Business Profile. Via **manual**: o marketeer prepara tudo
(texto, fotos, modelos, QR) e o dono/gestor do perfil aplica em business.google.com. O marketeer só
**lê** dados públicos do perfil (auditoria pela Places API); não escreve no perfil.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — melhorias ao perfil, publicações, pedido de avaliações.
- `ciclos/<ciclo>/03-artes/` aprovado — fotos, imagens de publicações, QR/impressos.
- Última auditoria `clientes/<slug>/auditorias/<AAAA-MM-DD>.json` (área GBP: estado, NAP, horário, avaliações, fotos).
- `marca.md` (§Negócio, §Ofertas, §Zona, §Voz) · `conectores.md` (canal `gbp`: Place ID, acesso de gestor).
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.

## Entrega
- `clientes/<slug>/campanhas/GBP_<AAAA-MM>.md` — pacote do perfil (passos 2-5).
- Secção `## gbp` em `ciclos/<ciclo>/04-implementacao.md`.
- Data de revisão **proposta** (canal `gbp`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

### 1. Pré-condições
- Gate de medição de `02-proposta.md` §Medição: G6 (UTM do botão «Website» válido) ✓; as restantes só se o perfil levar a uma conversão no site.
  **Modo agente:** aceitas a tabela de `ciclos/<ciclo>/04-implementacao.md` §Gate de medição que vem no brief (data deste
  ciclo, sem ✗) e repetes só a G6 (e G1, G2, G4 se o perfil levar a uma conversão no site); não perguntas os manuais.
  **Inline, sem tabela:** corres essas provas tu.
- Perfil identificado (Place ID em `conectores.md`/dossier ou encontrado pela auditoria, confirmado pelo operador; em modo agente, Place ID não confirmado → `[por confirmar]` na lista do retorno).
- Quem é proprietário/gestor do perfil (`conectores.md` → acesso). Responder a avaliações exige perfil **verificado** (GBP-REV, verificado 2026-10-01). Sem verificação → o primeiro passo do pacote é verificar o perfil; o resto fica à espera.
- UTM do link do site definido no plano de medição (`utm_source=google&utm_medium=organic&utm_campaign=gbp` — `referencias/utm.md` §2, ou o que a folha de §Medição disser). Sem linha na folha → volta à F2.

### 2. Completar o perfil
A partir da auditoria e de `marca.md`, tabela «atual → proposto → fonte»:
| Campo | Atual (auditoria, data) | Proposto | Fonte |
|---|---|---|---|
- Nome: exatamente o nome real da marca (sem palavras-chave acrescentadas).
- Categoria principal + secundárias: as que descrevem o que a empresa **faz**; escolhidas da lista do próprio GBP (o operador confirma que existem) — não se inventam nomes de categorias.
- Morada/área de serviço, telefone, site com UTM — iguais ao site (NAP coerente; a auditoria compara).
- Horários normais e especiais (feriados próximos) — do dono, nunca presumidos.
- Serviços/produtos com descrição curta e preço só se for facto aprovado.
- Descrição da empresa na voz da marca, sem promessas fora dos factos aprovados. Limite de caracteres `[por confirmar]` — confirmar no campo.
- Atributos aplicáveis (o que o GBP oferecer para a categoria).
- Fotos: logótipo, capa, exterior, interior, equipa, trabalho/produto — reais, da marca; ficheiros em `03-artes/finais/` com dimensões medidas. Specs de foto/vídeo `[por confirmar]`.
Doutrina extra de SEO local: skill JOCA `seo-local` (se existir).

### 3. Publicações
Tipos: Atualização, Oferta, Evento (GBP-POST, verificado 2026-10-01). Por publicação: tipo, texto, imagem, botão (Atualizações e Eventos têm botão com link; Ofertas têm «Ver oferta»), URL com UTM (`utm_content=<publicacao>`), datas (Oferta/Evento).
Regras (GBP-POST): publicações com mais de 6 meses arquivam-se salvo com intervalo de datas; telefone no texto pode levar à rejeição; passam por revisão da Google (Em direto / Pendente / Não aprovada). Calendário: 1 publicação por oferta/evento da proposta — cadência só a que a proposta definir.

### 4. Avaliações
**Pedir** (GBP-REV, verificado 2026-10-01): link e QR em business.google.com → «Ler avaliações» → «Obter mais avaliações» → Copiar (link) / guardar o QR (só no computador). Peças: cartão/autocolante com QR (`graphic-design`), linha no email pós-serviço (`mkt-email`), mensagem curta para o dono enviar. **Proibido** oferecer descontos, ofertas ou qualquer incentivo em troca de avaliações (conteúdo falso e enganador para a Google). Pedir a todos os clientes, não só aos satisfeitos [inferência — filtrar quem pode avaliar contraria o espírito da regra; política exata sobre filtragem `[por confirmar]`].
**Responder** — modelos na voz da marca (`marca.md` §Voz, com as amostras reais), um por situação:
| Situação | Modelo | Notas |
|---|---|---|
| 5★ com texto | agradece algo **específico** do texto; convida a voltar | nunca genérico igual para todos |
| 5★ sem texto | agradecimento curto | |
| 3-4★ | agradece; reconhece o ponto; diz o que muda | |
| 1-2★ cliente real | pede desculpa sem discutir; leva para contacto direto (nome da pessoa + email/telefone da empresa) | nunca dados do cliente na resposta |
| Não é cliente / falsa / ofensiva | resposta neutra e curta; sinalizar pela opção de denúncia do perfil | não acusar |
Regras: sem dados pessoais nem detalhes do serviço do cliente (RGPD); sem promessas fora dos factos; PT-PT; resposta passa por revisão da Google (~10 min, até 30 dias). O dono responde; o marketeer só redige. Avaliações recentes sem resposta: lista com rascunho para cada uma.

### 5. Ensaio, custo e aprovação
- Ensaio = o pacote completo (`GBP_<AAAA-MM>.md`) com a tabela atual → proposto, publicações e modelos, e o QR lido (`zbarimg`, se existir) a dar o link de avaliações.
- Custo: **0 €/dia · 0 €/mês** de plataforma (o perfil é gratuito) `[por confirmar se a marca tem anúncios locais associados]`; impressão dos QR, se houver, como custo único em € (orçamento da gráfica).
- Em modo agente não perguntas: devolves o pacote + o custo; o `marketeer` pergunta (F4.4).
- `AskUserQuestion` Sim/Não: «Sim, entregar ao dono para aplicar» — publicar no perfil é público e é o dono que o faz.

### 6. Checklist
- [ ] Perfil verificado; quem gere identificado.
- [ ] NAP igual ao site; site com UTM.
- [ ] Categorias confirmadas na lista do GBP; horários do dono (incluindo especiais).
- [ ] Fotos reais, medidas, sem logótipo gerado por IA.
- [ ] Publicações sem telefone no texto, com UTM.
- [ ] Pedido de avaliações sem incentivos; QR lido e a apontar ao link certo.
- [ ] Modelos de resposta revistos (`mkt-revisor-agent`).

### 7. Registo e data de revisão
Secção para `ciclos/<ciclo>/04-implementacao.md` (inline escreves; em modo agente devolve-la ao `marketeer`, que junta):
```markdown
## gbp
| Item | Proposto | Aplicado pelo dono? (data) | Link/ID |
Custo: 0 €/dia · 0 €/mês (+ custos únicos: <impressão, €>)
Avaliações à data: <n.º e média da auditoria, data> · sem resposta: <n>
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: publicações rejeitadas; NAP ainda diferente do site>
```
Data de revisão **proposta**: entrega + 30 dias (nova auditoria pública compara perfil e avaliações).
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `gbp · <AAAA-MM-DD> · <motivo>`
e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 8. Modo leitura (F5)
- Dados públicos: `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/auditoria/correr.mjs" <slug>` → área GBP (estado, NAP, horário, n.º e média de avaliações, fotos) — comparar com a auditoria anterior. Sem chave Places → «não verificado» (CONTRATO §5.2).
- Desempenho do perfil (pesquisas, visualizações, chamadas, pedidos de direções): só o dono vê no painel de desempenho → pedir export/captura com o período; não há leitura pela API pública. Sem isso → «não verificado».
- Cliques no site vindos do perfil: GA4 pelo UTM do link.

## Próximo passo (chain)
- Pacote → `mkt-revisor-agent`.
- Entregue e registado → `marketeer`.
- Data de revisão → `marketeer-review`.
- QR/impressos → `mkt-criativos` (se ainda não feitos na F3).
