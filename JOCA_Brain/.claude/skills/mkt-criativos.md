---
name: mkt-criativos
description: "F3 do marketeer: transforma cada material aprovado na proposta num brief com specs da plataforma, cria as peças (ou exporta os briefs) e monta a página de aprovação das artes. MUST be invoked when the user says: artes da campanha, criativos, F3 do marketeer, briefs criativos, página de aprovação das artes, ad creative, creative briefs. SHOULD also invoke when: fazer as imagens dos anúncios, exportar briefs para o designer, specs de anúncios por plataforma, zonas seguras, aprovar criativos."
triggers: artes da campanha, criativos, F3 marketeer, brief criativo, briefs criativos, aprovação das artes, aprovacao.html, peças da campanha, exportar briefs, ad creative, creative brief, creative review, specs de anúncios, zonas seguras, safe zone
chain: mkt-revisor-agent, marketeer
---
# mkt-criativos

Fase F3 do `/marketeer`. Pega na lista de materiais da proposta aprovada (F2) e entrega, por peça, um
brief completo e — no modo **criar** — o ficheiro final verificado. Fecha com `03-artes/aprovacao.html`
para o dono aprovar. Não implementa nada nas contas (isso é a F4).

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md` — sobretudo `## Identidade visual`, `## Voz`, `## Restrições`.
- `<RAIZ>/clientes/<slug>/ciclos/<ciclo>/02-proposta.md` aprovado (`estado.json` → `aprovacoes.proposta` preenchido) — lista de materiais, copy aprovado, CTA, destinos, canais.
- Folha de UTMs de `02-proposta.md` §Medição (escrita pela `mkt-medicao`) + `<MKT>/referencias/utm.md` — os URLs de destino saem daí, não se inventam.
- `<MKT>/referencias/plataformas.md` — specs com fonte e data.
- O que já existe da marca: site, redes, Drive, pasta `03-artes/` de ciclos anteriores.

## Entrega
- `ciclos/<ciclo>/03-artes/briefs/<peca>.md` — um por material.
- `ciclos/<ciclo>/03-artes/finais/<peca>.<ext>` — só no modo criar.
- `ciclos/<ciclo>/03-artes/aprovacao.html` — grelha das peças para aprovação.
- Nunca sobrescreve: `test -f` antes; existe → sufixo `-v2`, `-v3`.

## Passos

### 1. Pré-condições (pára se falhar)
1. Resolve `<MKT>` e `<RAIZ>` (CONTRATO §2) e confirma: `ls "<MKT>/scripts"`, `ls "<RAIZ>/clientes/<slug>"`.
2. `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/estado.mjs" ler <slug>` → `aprovacoes.proposta` tem de estar preenchido. Vazio → pára: a F3 só corre sobre proposta aprovada.
3. Extrai de `02-proposta.md` a lista de materiais (plataforma, formato, copy, CTA, destino). Material sem copy aprovado → não inventas copy: volta à F2 (`mkt-copy`).

### 2. Identidade visual — antes de qualquer pixel
Ordem de procura (para no primeiro que der **tokens medidos ou documentados**):
1. `marca.md` → `## Identidade visual` (caminho/URL das guidelines).
2. Ficheiros da marca: `DESIGN.md`/`BRAND.md`, manual em PDF, pasta da marca no Drive (MCP do Google Drive, se existir: `search_files` pelo nome da marca).
3. Designs de exemplo: peças anteriores em `03-artes/finais/` de ciclos passados, publicações nas redes (abrir e olhar).
4. Site: medir cores e fontes reais no browser (`getComputedStyle` em `body`, `h1`, botão principal) — é token medido, não palpite.

Sem nada disto → inline, **pergunta** por `AskUserQuestion` (em modo agente não perguntas: `TODO: token em falta` no brief e a pergunta na lista `[por confirmar]` do retorno): «Há manual de marca ou exemplos aprovados?» (opções: «Sim, envio o caminho/link» · «Usar o que medi no site» · «Não há — fazer guidelines primeiro (skill `brand-guidelines`)» · «Não sei»). Nunca inventas cores, fontes ou logótipo: no brief fica `TODO: token em falta`. **Logótipo nunca gerado por IA** — usa-se o ficheiro original.

Grava o que encontraste (fonte + data) em `marca.md` → `## Identidade visual` só se o utilizador confirmar.

### 3. Um brief por peça
Nome da peça: `<plataforma>-<formato>-<tema>` em minúsculas (ex.: `meta-feed45-diagnostico`, `gads-pmax-quadrado-diagnostico`, `email-boas-vindas-1`, `flyer-a5-feira`).

`03-artes/briefs/<peca>.md`:
```markdown
# <peca>
- Objetivo da peça: <o que tem de fazer, ligado ao objetivo da campanha em 02-proposta.md>
- Plataforma · posicionamento · formato: <ex.: Meta · Reels Instagram · vídeo 9:16>
- Specs: <dimensões, rácio, peso, duração, limites de texto> — fonte: <linha de referencias/plataformas.md, com data>
- Zonas seguras: <ex.: 14% topo, 35% base, 6% lados livres de texto/logótipo> — fonte
- Copy aprovado (literal, com contagem): título (NN car.) · texto (NN car.) · descrição
- Texto na imagem: <literal, ou "nenhum">
- CTA: <botão/texto>
- Destino: <URL final da folha de UTMs (§Medição), validado pelo comando de `referencias/utm.md` §5>
- Identidade: cores <tokens com fonte> · fontes <com fonte> · logótipo <caminho do original>
- Referências: <URLs/ficheiros de peças da marca, prova social real com fonte>
- Restrições: <de marca.md §Restrições, políticas da plataforma, o que NÃO fazer>
- Gancho (vídeo/estático): visual 0-3 s · fala · legenda — os três diferentes entre si
- Prova (grounding): o que é real e de onde vem; o que for ilustrativo diz-se
- Modo: criar | exportar · Ferramenta: <skill/agente> · Estado: brief | final | aprovado
```
Regras do brief:
- Specs só de `plataformas.md`. Linha `[por confirmar]` → escreve-o no brief e diz que se confirma na pré-visualização da plataforma.
- Copy conta-se (`node -e 'console.log([...process.argv[1]].length)' "<texto>"`) e compara-se com o limite **máximo**; acima do **recomendado** → aviso no brief.
- Nenhum número, preço, prémio ou testemunho que não esteja nos factos aprovados da proposta.
- Ganchos: um por combinação segmento × motivação × formato; não 10 reescritas do mesmo.
- UTM em **todos** os destinos, copiados da folha de UTMs (Google Ads: sem UTMs manuais, etiquetagem automática). Peça sem linha na folha → pára e volta à F2 (`mkt-medicao`).

### 4. Modo: criar ou exportar
O modo decide-o o `marketeer` (CONTRATO §5.9) e vem **no brief** (`Modo: <criar|exportar>`, skill de produção e nº de
gerações autorizadas): usa-o, sem perguntar. Só se correres **inline sem modo** dado: `AskUserQuestion` uma vez por lote
«Criar as peças aqui ou exportar os briefs?» (Criar aqui · Exportar briefs para designer/IA · Misto — digo quais · Não sei);
«Não sei» → exportar.

**Criar** — antes de chamar qualquer skill do JOCA, `ls "<raiz do JOCA_Brain>/.claude/skills/<skill>.md"`; não existe → essa peça passa a modo exportar (CONTRATO §5.11), nunca falha em silêncio.

| Peça | Skill / agente do JOCA |
|---|---|
| Imagem de anúncio ou publicação | `img-gen` → agentes `img-gen-openai` (texto, marca, produto, rácio exato) ou `img-gen-google` (rascunhos, fundos) |
| Impresso (flyer, roll-up, cartaz, cartão) com QR | `graphic-design` (HTML/CSS → PDF) |
| Landing de campanha | `landing-page` (+ `copywriting`) |
| Email (template) | `react-email` |
| Vídeo (Reels, Shorts, YouTube) | `video` (router) → `remotion` ou `hyperframes` |
| Revisão de gosto | `design-review` |
| Texto | `stop-slop` → `pt-pt-translator` |

- ≥2 peças independentes → um `mkt-criativos-agent` por peça, no mesmo turno; cada um recebe o brief e grava em `03-artes/finais/`.
- Custo antes de gerar: diz quantas gerações vais fazer e em que motor; ferramenta paga (ex.: Picsart) só se pedida pelo nome.
- QR de impressos: aponta para a URL **com UTM** da folha (`utm_medium=offline`, um `utm_content` por suporte — `referencias/utm.md` §4).

**Exportar** — o brief já é o entregável. Junta `03-artes/briefs/LEIA-ME.md` com: lista das peças, onde gravar os finais (`03-artes/finais/<peca>.<ext>`), specs a cumprir e quem aprova.

### 5. Verificar cada final (antes de dizer «feito»)
Para cada ficheiro em `finais/`:
1. **Abre e olha** (Read da imagem / rasterizar o PDF / frames do vídeo com `ffmpeg -ss 1 -frames:v 1`). Compara com o brief: copy literal, sem erros de português, logótipo original, cores dos tokens.
2. **Mede** (em qualquer sistema): imagem → `magick identify -format '%w×%h\n' "<ficheiro>"` (ImageMagick; versão 6: `identify`) ou `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "<ficheiro>"`; no Mac também `sips -g pixelWidth -g pixelHeight "<ficheiro>"` · vídeo → `ffprobe -v error -show_entries stream=width,height,duration "<ficheiro>"` · peso → `ls -l` (Windows PowerShell: `(Get-Item "<ficheiro>").Length`). Nenhuma das ferramentas instalada → diz-o e marca a dimensão `[por confirmar]`; nunca a copias do brief. Rácio fora → corrige (corte com o rácio real do ficheiro), nunca aceitas o pedido como prova.
3. **Zonas seguras**: sobrepõe as margens da referência e confirma que texto e logótipo ficam dentro.
4. Links e QR: abrir a URL final (`curl -sI` → 200) e ler o QR (`zbarimg` se existir) — tem de dar a URL com UTM.
Falhou → corrige e volta a 1. Estado do brief passa a `final` só depois disto.

### 6. Página de aprovação
`03-artes/aprovacao.html`, um só ficheiro, sem rede (CSS e JS inline):
- Dados num `<script type="application/json" id="pecas">` (JSON válido; `<` escrito como `<` em todos os textos).
- Cabeçalho: marca, ciclo, data, nº de peças.
- Grelha de cartões, um por peça: imagem/vídeo de `finais/` por caminho relativo (ou placeholder com o gancho/prompt no modo exportar) · plataforma e formato · dimensões **medidas** · copy com contagem · CTA · destino com UTM · linha «o que é real» · caixa Aprovar / Alterar com campo de nota.
- Botão «Copiar decisões» que copia um JSON `{peca, decisao, nota}` para colar no chat.
- Estilo sóbrio, legível em telemóvel; cartões com contorno completo ou fundo — **nunca barra de acento à esquerda**.
- Abre-se no browser (`open "<caminho>"`). Não se publica.

### 7. Fecho
Mostra em 5-10 linhas: peças, modo, o que ficou `TODO: token em falta` ou `[por confirmar]`. Passa ao `chain:`.

## Próximo passo (chain)
- Sempre → `mkt-revisor-agent` (quem produziu não revê): brief + finais + `aprovacao.html` contra `02-proposta.md`, `marca.md` e `plataformas.md`; devolve achados por peça. Corrige e volta a pedir revisão até `aprovado: true`.
- Revisão limpa → `marketeer` conduz o **gate de aprovação das artes** (dono/cliente decide na página). Aprovado → F4 (`mkt-google-ads`, `mkt-meta-ads`, `mkt-linkedin-ads`, `mkt-email`, `mkt-gbp`, `mkt-organico`, um `mkt-plataforma-agent` por plataforma).
- Pedidos de alteração → volta ao passo 3 só das peças afetadas.

## Créditos
Adaptado (MIT) de:
- coreyhaines31/marketingskills — `skills/ad-creative/SKILL.md` (Grounded Inputs), `skills/ad-creative/references/hook-system.md` (gancho em 3 componentes, matriz), `skills/ad-creative/references/creative-review-page.md` (página de aprovação alimentada por JSON, escape de `<`, linha de grounding), `skills/ad-creative/references/short-form-video-specs.md` (zonas seguras como regra de composição).
- anthropics/knowledge-work-plugins — `small-business/skills/ad-manager/SKILL.md` Step 5 (brief criativo como entregável completo quando não há ferramenta de design).
