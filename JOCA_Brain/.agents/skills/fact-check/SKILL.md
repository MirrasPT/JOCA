---
name: fact-check
description: "Verifica as afirmações factuais de um texto ANTES de publicar ou enviar: extrai cada número, data, nome, cargo, citação e superlativo, verifica cada um à parte, liga cada um a uma fonte concreta, e marca o que não se prova. Nunca «corrige» inventando. MUST be invoked when the user says: fact-check, verifica os factos, confirma os números, isto está certo?, verificar afirmações, tem fonte?, confirmar dados antes de publicar, checar factos. SHOULD also invoke antes de publicar post, comunicado, artigo, landing ou email a cliente com números, datas, cargos ou citações. Adaptado de elvisun/newsjack fact-check (MIT)."
triggers: fact-check, fact check, factcheck, verifica os factos, verificar factos, confirmar factos, confirma os números, confirmar números, checar factos, verificar afirmações, tem fonte, fonte disto, verificar dados, comunicado de imprensa, press release, verificar citação
chain: stop-slop
---
# fact-check — Verificar afirmações antes de publicar

Porta de exactidão factual. Tira cada afirmação do texto, verifica-a sozinha, cola-lhe uma fonte real e torna impossível não ver o que ficou por provar.
Não é copywriter nem editor: **não reescreve o texto**, não melhora o ângulo. Adaptado de `elvisun/newsjack` `skills/fact-check` (MIT, © 2026 Elvis Sun).

## Doutrina
- **O ónus da prova é de quem afirma.** Afirmação sem prova não é verdadeira por defeito.
- **A memória do modelo não é prova.** Só contam as fontes dadas pelo utilizador e o que se pesquisa agora (WebSearch/WebFetch, ficheiros do projecto).
- **Cada afirmação à parte.** Um parágrafo credível não torna verdadeira cada frase dele. Uma fonte que prova que a empresa existe não prova o cargo, o número nem a citação.
- **Campo impresso é afirmação do emissor** (`soul.md`): NIF, prazo, valor ou morada lidos numa factura/contrato cruzam-se com 2.ª fonte.
- **Nunca corrigir inventando.** Afirmação refutada → cita a fonte que a contradiz e o valor que ela dá. Sem fonte → marca e deixa ao humano. Nunca trocar um número por outro «mais plausível».
- **A incerteza fica à vista.** Prova velha, indirecta ou ambígua diz-se, no veredicto e no aviso final.

## Âncora de tempo
Tirar a data de hoje do ambiente (`date`), nunca do treino. Sem data fiável → tudo o que depende de tempo («actual», «recente», «o primeiro», cargos, «este ano») fica **Não verificável**, com a nota de que falta a âncora.

## Ordem de trabalho
Fazer por esta ordem e não decidir se é verdade enquanto ainda se extrai:
1. **Extrair** — lista numerada, pela ordem do texto: palavras exactas, tipo de afirmação, fonte que o texto já dá.
2. **Verificar** — por afirmação: pesquisar, abrir as fontes, guardar link, data e excerto.
3. **Julgar** — comparar com a prova, atribuir estado, apanhar contradições internas, escrever o aviso.

## O que extrair
- **Triagem:** opinião, previsão e enchimento publicitário («o melhor vinho da região», «redefine o sector») não se verificam. Trivial (existe, abriu) → verificação leve. **Verificável e com consequência** → esforço todo.
- Pessoas com nome · cargos e títulos · organizações e meios · autoria («o artigo de X no Y») · **números** (percentagens, rankings, facturação, clientes, crescimento) · **datas e palavras de recência** («ontem», «recentemente», «novo», «o primeiro») · **citações** (quem, palavras, onde, quando) · **superlativos** («o maior», «o único», «n.º 1») · afirmações legais, médicas, financeiras e de segurança (exigem prova mais forte).
- Não fundir: «A Maria é CEO» e «a Maria fundou a empresa» são duas afirmações.
- Marcadores por preencher (`XX%`, `[nome]`, `TBD`) → falha dura, nunca gralha a ignorar.

## Como verificar bem
1. **Ler de lado.** Antes de confiar numa fonte, sair dela: quem a publica, quem a paga, o que o resto da web diz dela. Um site bonito não é prova.
2. **Subir até à fonte primária.** Primária (o documento, o registo, o anúncio oficial, a gravação) › secundária (notícia sobre a primária) › terciária (listas, agregadores, blogs). Número, superlativo, citação ou data → só a primária fecha. Fontes primárias PT habituais: Diário da República, INE, registo comercial, site oficial da entidade, a própria factura ou contrato.
3. **Proveniência.** Captura, recorte ou imagem: é o original? Quem o fez? Quando foi feito (e não quando apareceu)? Porque existe?
4. **Triangular.** Facto assente = 2+ fontes **independentes**. Três sites a reproduzir o mesmo comunicado são uma fonte.
5. **Três perguntas antes do estado:** é literalmente verdade? Há outra leitura? Quem afirma deu prova? Procurar também a premissa escondida (número verdadeiro usado de forma enganadora).

## Estados (só estes quatro)
| Estado | Quando | Link obrigatório |
|---|---|---|
| **Verificado** | fonte credível e no tema suporta directamente | sim |
| **Contestado** | prova credível contradiz, ou a fonte citada diz outra coisa | sim (a que contradiz) |
| **Não verificável** | a pesquisa e as fontes dadas não resolvem, ou a prova é velha/ambígua | — |
| **Sem fonte** | o texto precisa de citação, não a dá, e não se encontra a origem | — |

«Provavelmente certo» e «parcialmente verificado» são notas, nunca estados. Prova só indirecta → Não verificável ou Sem fonte, não Verificado. Pesquisa sem resultado nunca vira Verificado.

## Frescura da prova (limiares do newsjack)
| Tipo | Fresca | Arriscada | Velha demais |
|---|--:|--:|--:|
| Cargo ou título actual | ≤ 30 dias | 31-90 dias | > 90 dias |
| Autoria / referência a publicação | ≤ 90 dias | 91-180 dias | > 180 dias |
| Estatística ou inquérito | ≤ 12 meses | 12-24 meses | > 24 meses |
| Data de evento | só com correspondência exacta | — | — |
| Organização ou meio existe | ≤ 180 dias | 181-365 dias | > 365 dias |

Cargo, «actual» ou «o mais recente» com prova para lá de «velha demais» → não pode ser Verificado.

## Recusas (gates, não estilo)
- Pedem para certificar o que não se prova → recusar.
- «Confia em mim» → Sem fonte ou Não verificável. Conhecimento privado não é citação pública.
- Há um Contestado → o texto **não** está pronto a publicar.
- Sem acesso a pesquisa → lista completa na mesma, com o que precisa de prova externa marcado Não verificável ou Sem fonte.

## Saída (Markdown, esta ordem)
```md
## Veredicto
[1-2 frases: pronto, arriscado, ou bloqueado por Contestado / Não verificável / Sem fonte.]

## Afirmações e fontes
1. **Afirmação:** "[palavras exactas]"
   - **Estado:** Verificado | Contestado | Não verificável | Sem fonte
   - **Fonte(s):** [título + URL, ou `Nenhuma encontrada`]
   - **Notas:** [ambiguidade, qualidade da fonte, idade, o que um humano tem de confirmar]

## Aviso
[Tudo o que ficou por resolver, contestado, sem fonte ou velho, e o que um humano tem de rever antes de publicar.]
```
- Todas as afirmações materiais, numeradas pela ordem do texto. URLs à vista, nunca só o nome do meio nem uma página de resultados de pesquisa.
- Sem afirmações verificáveis → dizê-lo, e mesmo assim `## Aviso`.
- Sem reescrita, salvo pedido à parte. Se pedida: só com os valores **Verificados**; o resto fica `TODO: facto por confirmar`.

## Próximo passo (chain)
Tudo Verificado (ou corrigido pelo utilizador com fonte) → `stop-slop` para a passada de polish, que não pode acrescentar nem perder factos. Consumidores habituais: `copywriting`, `social-content`, `email-sequence`, `seo` (secção AEO/GEO), textos de cliente antes de publicar.
