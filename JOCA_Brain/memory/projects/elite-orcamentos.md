---
name: elite-orcamentos
description: Orçamentos/facturação para o cliente Luis Gonçalo (Elite Cozinhas e Bracaris) — template HTML reutilizável + geração mensal de orçamentos (Redes Sociais, rótulos, websites, etc.)
type: project
directorio: G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\_Documentos e Propostas\_Quotacoes
---

**Tipo:** Admin/financeiro — geração de orçamentos em PDF para o cliente.
**Cliente:** Luis Gonçalo — Elite Cozinhas e Bracaris (grupo de marcas: Royal Douro, Alkimia, Divine, Vinartis, Bracaris).
**Distinto de** `elite-imagens-db.md` (geração de assets/social media do mesmo cliente — pasta `_DB`, não `_Documentos e Propostas`).
**Iniciado:** 2026-07-03.

## Template
`orcamento_template.html` — replica exacta da estrutura visual dos orçamentos PDF históricos (analisados: 0101, 0102, 0102-1, 12_110_Dezembro, 12_110_Janeiro).

**Estrutura:**
- Card branco arredondado (`border-radius:28px`), fonte Poppins (Google Fonts) — aproxima o rounded bold visto nos PDFs originais.
- Header: título "Orçamento" + número grande em cinza; grid 2×2 de metadados (Data Emissão/Válido Até + De/Para, OU Data Início/Data Fim + De/Para para orçamentos mensais recorrentes).
- Lista de itens com divisórias finas: título a negrito, descrição opcional em cinza, preço à direita.
- Preço tem 3 variantes: valor simples; valor com desconto/pago (original riscado + ajuste + final a negrito); ou "Oferta" (sem valor).
- Caixa de Total: duas variantes — `.light` (cinza claro, orçamentos avulsos tipo websites) e `.dark` (antracite/branco, orçamentos mensais recorrentes tipo Redes Sociais).
- Secção "Condições Gerais" opcional no fim (nota fiscal: valores sem IVA).

## Convenções de numeração
- Nome de ficheiro: `MM_NNN_NomeMes.html/pdf` (ex: `07_121_Julho`) para orçamentos mensais recorrentes.
- Número de orçamento interno sequencial "0NNN" (ex: 0121), independente do nome de ficheiro.

## Export para PDF
Chrome headless: `chrome.exe --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="<out>.pdf" --print-to-pdf-no-header "<file-uri>"`.

**Gotcha crítico — página única:** sem CSS `@page` customizado, o Chrome usa o tamanho Letter (816×1056px) por omissão e corta conteúdo mais longo para uma 2ª página com fundo cinza a meio. Fix: embutir no HTML:
```css
@media print{
  @page{ size:816px <ALTURA>px; margin:0; }
  html,body{ margin:0; }
}
```
Altura medida via Playwright (`document.body.scrollHeight` a viewport 816px de largura) + margem de segurança (~20px). Sem isto o PDF sai em 2 páginas mesmo que o HTML pareça uma peça única no browser.

**Playwright `file://` bloqueado** — o MCP playwright recusa `file:///` directamente. Contornar servindo a pasta com `python -m http.server <porta>` (Bash, em background) e navegar para `http://127.0.0.1:<porta>/ficheiro.html`.

## Preços de referência (precedentes confirmados)
- Redes Sociais Alkimia (mensal): €150.
- Rótulos Romanée-Conti (contra-rótulos): €20/hora.
- Royal Douro — email cold reach (trabalho de maior valor): €30/hora.
- Regra: nunca fabricar preço sem precedente — marcar `[A DEFINIR]` a vermelho no item e pedir ao Renato.

## Decisões tomadas
- 2026-07-03: Template `orcamento_template.html` criado a partir da análise de 5 PDFs históricos (0101, 0102, 0102-1, 12_110_Dezembro, 12_110_Janeiro).
- 2026-07-03: Orçamento 0121 (Junho+Julho, um único orçamento porque nenhum dos dois meses estava pago) — criado com itens: Redes Sociais Jun/Jul (€150 cada), Rótulos Romanée-Conti 3h×€20 (€60), Organização Ficheiros Drive (€0, falta Barca Velha), Royal Douro cold reach 2h×€30 (€60), Bracaris Plano Marketing (€20). Total €440.
- 2026-07-03: Itens sem preço nunca inventados — ficam `[A DEFINIR]` até o Renato confirmar (aplicado a Royal Douro e Bracaris antes de ele dar os valores).
- 2026-07-03: Secções "Assuntos da Reunião" e "Notas do Orçamento (detalhe)" adicionadas ao HTML do orçamento — regista contexto (Petrus a rever, Feira ProWine Brasil, verificação de anos 1950–1969 do Romanée: feitos 53,54,56,57,59,60,61,62,64,66 / faltam 50,51,52,55,58,63,65,67,68,69) directamente no documento, não só no chat.
- 2026-07-06: Orçamento 0122 (Montalegre Car Show 2026) criado para o cliente **Carpower** (organizador de eventos automóveis — marca "BICs" é o car show de Braga; Montalegre é evento distinto). Base = PDF histórico 0113 "BICs 2026 Verão" (Carpower, €940). **Não existia HTML-fonte do 0113** — recriado a partir do PDF. Total final **€900**, faseamento **300/200/400** (300 = "a pagar agora, inclui trabalho feito até ao momento"). Layout item-único (1 preço) com sub-secções (título + `<ul>` bullets) + bloco "Pagamento Faseado" — variante diferente da lista de itens simples do template.
- 2026-07-06: Ficheiros dos orçamentos Carpower/BICs vivem em `G:\...\Clientes\BICs\` (pasta de cliente própria), **não** no `_Quotacoes` da Elite. Pasta do evento: `Clientes\BICs\2026_Montalegra_Car_Show\`.

## Gotcha — export PDF para pasta no Google Drive (G:)
Chrome `--print-to-pdf` para um caminho dentro do Google Drive (`G:\`) falha com `Acesso negado (0x5)` — o sync do Drive bloqueia a escrita directa. **Fix:** gerar o PDF no scratchpad da sessão e depois `cp` para a pasta G:. (Fonte: 0122 Montalegre, 2026-07-06.)

## Pendente
- **Orçamento 0122 (Montalegre Car Show, €900)** — enviar ao cliente (mensagem já redigida). Marco 2 do faseamento ainda menciona "(Cartaz e Processo de Seleção)" mas a secção Processo de Seleção foi removida do âmbito — decidir se se ajusta a menção.
- Reunião com o cliente: rever Petrus (tamanhos dos rótulos, rolhas com anos, cápsula castelo), Feira ProWine Brasil (o que fazer), Bracaris (método de envio + info pagamentos).
- Validar/enviar Orçamento 0121 (€440) ao cliente.
- Continuar rótulos Romanée-Conti 1997–2023 e anos 1950–1969 em falta (50,51,52,55,58,63,65,67,68,69).
- 2ª Linha (1990–2023) — por começar.
- Barca Velha — última peça da organização de ficheiros do Drive.

## Última sessão
2026-07-06 — Orçamento 0122 (Montalegre Car Show 2026, Carpower, €900, faseado 300/200/400) recriado a partir do PDF 0113, editado ao vivo (removida secção Processo de Seleção; ajustes a Autocolantes/Sinalética/Redes Sociais) e exportado a PDF de página única (via scratchpad→cp por causa do bloqueio de escrita no G:). Por enviar ao cliente.
