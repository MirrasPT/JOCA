---
name: mkt-email
description: "F4 do marketeer para email marketing, em qualquer plataforma (Brevo, Mailchimp, outra): listas e segmentos com consentimento (RGPD + Lei 41/2004), sequências e campanhas montadas como rascunho ou automação desligada, UTMs em todos os links, entregabilidade verificada (SPF/DKIM/DMARC com dig) — nunca envia sem aprovação. MUST be invoked when the user says: email marketing, newsletter da marca, montar sequência de emails, F4 email, campanha de email, email sequence setup. SHOULD also invoke when: lista de contactos, segmentos, dupla confirmação, double opt-in, consentimento para marketing, SPF DKIM DMARC, entregabilidade, Brevo, Mailchimp, métricas de email para a review."
triggers: email marketing, newsletter, campanha de email, sequência de emails, sequencia de emails, automação de email, lista de contactos, segmentos, double opt-in, dupla confirmação, consentimento marketing, lei 41/2004, rgpd email, spf, dkim, dmarc, entregabilidade, brevo, mailchimp, F4 email
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-email

Fase F4 (e leitura na F5) para email marketing. Agnóstica de plataforma: monta listas, segmentos,
sequências e campanhas na ferramenta que a marca já usa, **sempre como rascunho ou automação
desligada**. Enviar e agendar são decisões do dono, com o texto inteiro à vista.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — sequências/campanhas, público, oferta, copy aprovado.
- `ciclos/<ciclo>/03-artes/` aprovado — templates (`react-email` ou da plataforma), imagens.
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.
- `clientes/<slug>/conectores.md` (canal `email`: plataforma, conta, via) · `marca.md` (§Voz, §Restrições).
- `<MKT>/referencias/plataformas.md` §Email.

## Entrega
- `clientes/<slug>/campanhas/<nome>.md` — especificação da sequência/campanha (passo 4).
- Secção `## email` em `ciclos/<ciclo>/04-implementacao.md`.
- Data de revisão **proposta** (canal `email`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

### 1. Gate de medição
- **Modo agente** (`mkt-plataforma-agent`, F4 do `marketeer`): o brief traz a tabela de
  `ciclos/<ciclo>/04-implementacao.md` §Gate de medição, verificada pelo caller. Aceita-a se a data for **deste ciclo**
  e não tiver ✗; repete **só** as provas automáticas G1, G2, G4, G6 e **não perguntas** os manuais (G3, G5, G7-G9).
  Tabela em falta, de outro ciclo, com ✗, ou prova automática que agora falha → paras e devolves a linha ao caller.
- **Inline, sem tabela** em `04-implementacao.md`: corres o gate todo (manuais por `AskUserQuestion`, «Não sei» = ✗).

Gate de `02-proposta.md` §Medição (G1-G9 da `mkt-medicao`): aplicam-se ao email sobretudo a G4 (conversão no site medida) e a G6 (UTMs); todos ✓ ou «não aplicável» justificado, senão volta à F2.
- UTMs do plano em **todos** os links (incluindo logótipo e rodapé que levem ao site); copiados da folha de UTMs (`utm_medium=email`, `utm_content=<n.º do email>-<link>` — `referencias/utm.md` §2). Link sem linha na folha → volta à F2.
- A conversão no site que o email procura (lead, compra, marcação) é medida (`mkt-medicao` verde).

### 2. Plataforma e via
Lê `conectores.md` (`email`). Diz numa linha a via:
- **MCP/API** da plataforma, se estiver ligada e verificada — só criação de rascunhos, listas e automações desligadas.
- **Manual** (por omissão): passo a passo para o operador na interface da plataforma.
Sem plataforma → não escolhes por eles (em modo agente: devolves as opções como `[por confirmar]` e paras esta frente): inline, `AskUserQuestion` com 2-3 opções que sirvam o volume e o orçamento da marca, cada uma com fonte e data do preço `(verificado AAAA-MM-DD)` ou `[por confirmar]`, mais «Não sei».

### 3. Consentimento e listas (RGPD + Lei 41/2004) — bloqueante
Regras (CNPD Diretriz/2022/1, verificado 2026-10-01):
- **Pessoas singulares sem relação de cliente**: só com consentimento **prévio e expresso** (art. 13.º-A, n.º 1, Lei 41/2004) — ato positivo, caixa nunca pré-marcada, informado (quem envia, finalidade, como retirar).
- **Clientes atuais**: produtos/serviços **análogos** aos que compraram → sem consentimento, mas com oposição fácil e gratuita na recolha **e em cada mensagem** (n.º 3 do art. 13.º-A); produtos **diferentes** → consentimento.
- **Prova**: lista atualizada de quem consentiu e de clientes que não se opuseram; o ónus da prova é de quem envia (CNPD §§84-85).
- **Pessoas coletivas (B2B)**: regime próprio nos arts. 13.º-A e 13.º-B, fora da Diretriz → `[por confirmar]` com jurista antes de importar listas de empresas.
- **Dupla confirmação** (email de confirmação antes de entrar na lista): não é exigida por estas fontes, mas é a forma mais simples de **provar** o consentimento → recomendada por omissão [inferência]; desligá-la é decisão do dono, registada.
Para cada lista a usar, regista: origem (formulário X, loja, evento), base legal (consentimento | cliente-análogo), data e forma de recolha, onde está a prova. Origem desconhecida ou lista comprada → **não se usa**; diz-se porquê.
Formulários de inscrição: caixa de marketing separada, não pré-marcada, link para a política de privacidade; revisão da implementação com a skill `gdpr-compliance` do JOCA (se existir).
Segmentos: por base legal (clientes vs. subscritores), interesse/oferta, atividade (abriu/clicou nos últimos N dias) — só com campos que existam na plataforma.

### 4. Especificação da sequência/campanha
Escrever ou rever o copy: a skill JOCA `email-sequence` (se existir; `ls` antes) faz a sequência; template visual com `react-email`; texto final por `stop-slop` → `pt-pt-translator`. Sem JOCA → modo exportar (brief em ficheiro).
Tipos e estrutura (resumo da skill JOCA `email-sequence`, §Sequence Types e §Frameworks; sem o JOCA vale este resumo): boas-vindas 5-7 (entregar → ligar → valor → ponte → oferta) · nutrição 4-8 · conversão 4-7 (abrir → desejo → prova → objeção → urgência real → fecho) · lançamento 6-10 · reativação 3-4 (quebrar padrão → valor → decisão) · pós-compra 4-7. Um objetivo e **um CTA** por email; o P.S. é espaço nobre; urgência só se for verdadeira.
```markdown
# <nome>  (EMAIL_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM> — mesma forma do CONTRATO §6; `EMAIL` não é `PLAT` de anúncios)
- Plataforma · lista/segmento · base legal · tamanho do segmento (número que a plataforma mostra, data)
- Gatilho (entrada) · condições de saída (comprou, cancelou, respondeu)
- Remetente (nome + endereço do domínio da marca) · responder-para
| # | Envio (dia/hora, fuso Europe/Lisbon) | Assunto (car.) | Pré-visualização | Objetivo | CTA → URL com UTM | Ficheiro do template |
- Rodapé: identidade e contacto da marca, link de cancelamento num clique
- Factos aprovados usados · Decisões tomadas
```
Revisão independente (`mkt-revisor-agent`): consentimento por lista, factos, links, PT-PT, um CTA.

### 5. Entregabilidade (antes de montar)
Domínio do remetente = `<dominio>`. Verifica e regista a saída:
```bash
dig +short TXT <dominio> | grep -i "v=spf1"          # SPF — tem de incluir a plataforma de envio
dig +short TXT _dmarc.<dominio>                        # DMARC — tem de existir (p=none aceite)
dig +short TXT <seletor>._domainkey.<dominio>          # DKIM — seletor dado pela plataforma
dig +short CNAME <seletor>._domainkey.<dominio>        # alguns ESP usam CNAME
```
O seletor DKIM lê-se na página de autenticação de domínio da plataforma — nunca adivinhado. Requisitos de referência (GMAIL, verificado 2026-10-01, para quem envia 5000+/dia a Gmail): SPF e DKIM, DMARC publicado, `From:` alinhado com SPF ou DKIM, cancelamento num clique (RFC 8058) e link visível, spam abaixo de 0,30%. Falta algum registo → entrega ao operador a receita (registo a criar no DNS, com o valor que a plataforma indica) e **não** se envia nada até `dig` o confirmar. Alterar DNS é do operador/dono do domínio.

### 6. Ensaio, custo e aprovação
- Ensaio: pré-visualização de cada email na plataforma (desktop e telemóvel), todos os links clicados (`curl -sI` → 200, UTMs presentes), contagem do segmento.
- Envio de teste só para endereços internos da marca, e só com «Sim».
- Custo **em €/dia e €/mês**: plano da plataforma `<P ÷ 30,4> €/dia · <P> €/mês` (fonte e data) + custo adicional desta campanha (ex.: créditos por envio, também em €/dia · €/mês) ou «0 €/dia · 0 €/mês adicionais»; desconhecido → `[por confirmar]`.
- Em modo agente não perguntas: devolves a especificação + o ensaio + o custo; o `marketeer` pergunta (F4.4).
- `AskUserQuestion` Sim/Não: «Sim, montar como rascunho/automação desligada» primeiro. **Agendar ou ativar uma automação é enviar** → gate próprio, depois, com o texto inteiro de cada email, o segmento, o número de destinatários e a data/hora; um «sim» por campanha/automação.

### 7. Montagem
Na plataforma: lista/segmento → templates → campanha em **rascunho** ou automação com os emails, **desligada**. Recolher: IDs/nomes da lista, segmento, campanha/automação, estado, URL de pré-visualização.

### 8. Checklist de pré-lançamento
- [ ] Base legal e prova registadas por lista; nada de listas de origem desconhecida.
- [ ] Formulários de inscrição com caixa de marketing não pré-marcada e política de privacidade.
- [ ] SPF, DKIM e DMARC confirmados por `dig` (saída registada com data).
- [ ] Cancelamento num clique + link no rodapé; identidade e contacto da marca em cada email.
- [ ] Todos os links 200 com UTMs; um CTA por email; só factos aprovados.
- [ ] Pré-visualização desktop e telemóvel revista; modo escuro sem texto ilegível.
- [ ] Estado rascunho/automação desligada confirmado.

### 9. Registo e data de revisão
Secção para `ciclos/<ciclo>/04-implementacao.md` (inline escreves; em modo agente devolve-la ao `marketeer`, que junta):
```markdown
## email
| Campanha/automação | ID | Plataforma | Lista · segmento · base legal | Destinatários | Emails | Estado | Envio previsto | Custo €/dia | Custo €/mês | UTMs | Especificação |
Entregabilidade: SPF ✓/✗ · DKIM ✓/✗ · DMARC ✓/✗ (dig, <data>)
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: cancelamentos ou queixas acima do habitual da lista>
Envio/ativação: manual, pelo dono — por fazer
```
Data de revisão **proposta**: envio previsto + 7 dias (campanha única) ou ativação + 14 dias (sequência); sem data de
envio/ativação → montagem + 7 dias, motivo «confirmar se foi enviada», e a pergunta na lista `[por confirmar]`.
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `email · <AAAA-MM-DD> · <motivo>`
e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 10. Modo leitura (F5)
Relatório da plataforma (export CSV ou MCP): entregues, aberturas (indicativas — a privacidade dos clientes de email infla-as), cliques e taxa de cliques, cancelamentos, queixas de spam, devoluções; conversões do site atribuídas pelos UTMs no GA4 (não pela plataforma de email). Por email da sequência, para ver onde caem. Sem dado → «sem dado», nunca 0.

## Próximo passo (chain)
- Especificação → `mkt-revisor-agent`.
- Montada como rascunho e registada → `marketeer`.
- Data de revisão → `marketeer-review`.
- Formulário/consentimento por corrigir no site → `mkt-medicao` / skill `gdpr-compliance`.

## Créditos
Adaptado de:
- skill JOCA `email-sequence` (`.claude/skills/email-sequence.md`, §Sequence Types, §Frameworks, §CTA Guidelines) — tipos de sequência, frameworks, um CTA, P.S.
- coreyhaines31/marketingskills (MIT) — `skills/emails/SKILL.md` (formato de entrega email a email, condições de saída).
- knowledge-work-plugins (MIT) — `small-business/skills/social-content-engine` via relatório A (staging, nunca enviar daqui).
