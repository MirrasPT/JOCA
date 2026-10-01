# Referência — specs por plataforma e formato

Tabela de consulta da F3 (`mkt-criativos`) e da F4 (`mkt-google-ads`, `mkt-meta-ads`,
`mkt-linkedin-ads`, `mkt-gbp`, `mkt-organico`). **Cada linha tem fonte oficial e data.** Linha sem
fonte oficial lida → `[por confirmar]`, e não se usa como limite duro (confirma-se na pré-visualização
da plataforma antes de exportar).

Regras de uso:
- As plataformas mudam specs sem aviso. Linha com mais de 6 meses → reabrir a fonte antes de a usar
  num brief, e atualizar a data aqui.
- **Máximo** = a plataforma recusa acima disto. **Recomendado** = a plataforma aceita mais, mas corta
  no ecrã. No brief escreve-se qual dos dois é.
- Espaços contam como caracteres. Acentos portugueses contam 1.
- Medir o ficheiro final (`sips -g pixelWidth -g pixelHeight <f>` no macOS, `ffprobe` para vídeo),
  nunca confiar no rácio pedido ao gerador.

Fontes (abreviaturas usadas na coluna «Fonte»):
- **G-RSA** https://support.google.com/google-ads/answer/7684791
- **G-PMAX** https://support.google.com/google-ads/answer/17091269
- **G-RDA** https://support.google.com/google-ads/answer/9823397
- **G-SITE** https://support.google.com/google-ads/answer/2375416
- **G-CALL** https://support.google.com/google-ads/answer/6079510
- **G-BUD** https://support.google.com/google-ads/answer/2375423
- **YT** https://support.google.com/youtube/answer/2375464
- **M-IGF** https://www.facebook.com/business/ads-guide/update/image/instagram-feed
- **M-FBF** https://www.facebook.com/business/ads-guide/update/image/facebook-feed
- **M-FBV** https://www.facebook.com/business/ads-guide/update/video/facebook-feed
- **M-IGS** https://www.facebook.com/business/ads-guide/update/image/instagram-story
- **M-IGR** https://www.facebook.com/business/ads-guide/update/video/instagram-reels
- **M-CAR** https://www.facebook.com/business/ads-guide/update/carousel/facebook-feed
- **M-API** https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group
- **LI-SI** https://www.linkedin.com/help/lms/answer/a426534
- **LI-LGF** https://www.linkedin.com/help/lms/answer/a423364 (e a427102, a425337)
- **LI-EU** https://www.linkedin.com/help/lms/answer/a426037
- **LI-OBJ** https://business.linkedin.com/marketing-solutions/success/best-practices/choose-your-objective
- **LI-POST** https://www.linkedin.com/help/linkedin/answer/a522483
- **IG-IMG** https://help.instagram.com/1631821640426723
- **IG-TAG** https://help.instagram.com/351460621611097
- **GBP-POST** https://support.google.com/business/answer/7342169
- **GBP-REV** https://support.google.com/business/answer/3474050 · 3474122 · 16816815
- **GMAIL** https://support.google.com/a/answer/81126
- **CNPD** Diretriz/2022/1 — https://www.cnpd.pt/umbraco/surface/cnpdDecision/download/121958

## Google Ads

| Formato | Elemento | Limite | Tipo | Fonte |
|---|---|---|---|---|
| Search (RSA) | Títulos | 3 a 15, 30 car. cada | máximo | G-RSA (verificado 2026-10-01) |
| Search (RSA) | Descrições | 2 a 4, 90 car. cada | máximo | G-RSA (verificado 2026-10-01) |
| Search (RSA) | Caminhos (path 1 e 2) | 15 car. cada | máximo | G-RSA (verificado 2026-10-01) |
| Search (RSA) | RSAs por grupo | pelo menos 2 com força «Boa» ou «Excelente» | recomendado | G-RSA (verificado 2026-10-01) |
| Search (RSA) | Máximo de RSAs por grupo | `[por confirmar]` | — | — |
| Sitelink | Texto do link | 25 car. | máximo | G-SITE (verificado 2026-10-01) |
| Sitelink | Linhas de descrição 1 e 2 | `[por confirmar]` (a página não indica) | — | — |
| Callout | Texto | 25 car.; até 10 visíveis | máximo | G-CALL (verificado 2026-10-01) |
| Performance Max | Títulos | 3 a 15, 30 car.; pelo menos 1 com ≤15 | máximo | G-PMAX (verificado 2026-10-01) |
| Performance Max | Títulos longos | 1 a 5, 90 car. | máximo | G-PMAX (verificado 2026-10-01) |
| Performance Max | Descrições | 2 a 5, 90 car. | máximo | G-PMAX (verificado 2026-10-01) |
| Performance Max | Nome da empresa | 25 car. (obrigatório) | máximo | G-PMAX (verificado 2026-10-01) |
| Performance Max | Imagem horizontal 1,91:1 | 1200×628 rec.; 600×314 mín.; até 20; 5120 KB | rec./mín. | G-PMAX (verificado 2026-10-01) |
| Performance Max | Imagem quadrada 1:1 (obrigatória) | 1200×1200 rec.; 300×300 mín.; até 20 | rec./mín. | G-PMAX (verificado 2026-10-01) |
| Performance Max | Imagem vertical 4:5 | 960×1200 rec.; 480×600 mín.; até 20 | rec./mín. | G-PMAX (verificado 2026-10-01) |
| Performance Max | Logótipo 1:1 (obrigatório) | 1200×1200 rec.; 128×128 mín.; até 5; 5120 KB | rec./mín. | G-PMAX (verificado 2026-10-01) |
| Performance Max | Logótipo 4:1 | 1200×300 rec.; 512×128 mín. | rec./mín. | G-PMAX (verificado 2026-10-01) |
| Performance Max | Vídeo 16:9, 1:1, 9:16 | ≥10 s cada; até 15 por orientação | mínimo | G-PMAX (verificado 2026-10-01) |
| Display responsivo | Imagem 1,91:1 | 1200×628 rec.; 600×314 mín. | rec./mín. | G-RDA (verificado 2026-10-01) |
| Display responsivo | Imagem 1:1 | 1200×1200 rec.; 300×300 mín. | rec./mín. | G-RDA (verificado 2026-10-01) |
| Display responsivo | Imagem 9:16 | 900×1600 rec.; 600×1067 mín. | rec./mín. | G-RDA (verificado 2026-10-01) |
| Display responsivo | Total de imagens / peso | até 15 em 3 rácios; 5120 KB | máximo | G-RDA (verificado 2026-10-01) |
| Display responsivo | Limites de texto (títulos, descrição) | `[por confirmar]` (a página só fala de «80-character limit» na descrição como conselho) | — | — |
| YouTube | In-stream ignorável | sem máximo; <3 min recomendado | — | YT (verificado 2026-10-01) |
| YouTube | In-stream não ignorável | 15-60 s conforme subtipo | máximo | YT (verificado 2026-10-01) |
| YouTube | Bumper | 6 s (≥5 s) | máximo | YT (verificado 2026-10-01) |
| YouTube | In-feed | sem máximo | — | YT (verificado 2026-10-01) |
| YouTube | Shorts | <60 s recomendado | recomendado | YT (verificado 2026-10-01) |
| Orçamento | Gasto diário | pode chegar a 2× o orçamento diário médio num dia | regra | G-BUD (verificado 2026-10-01) |
| Orçamento | Gasto mensal | no máximo 30,4× o orçamento diário médio | regra | G-BUD (verificado 2026-10-01) |

## Meta (Facebook + Instagram) — anúncios

| Posicionamento | Elemento | Valor | Tipo | Fonte |
|---|---|---|---|---|
| Feed Instagram (imagem) | Ficheiro | JPG/PNG; 4:5; 1440×1800; máx. 30 MB; largura mín. 500 | rec./máx. | M-IGF (verificado 2026-10-01) |
| Feed Instagram (imagem) | Rácios aceites | de 400×500 (4:5) a 191×100 (1,91:1); tolerância 1% | máximo | M-IGF (verificado 2026-10-01) |
| Feed Instagram (imagem) | Texto principal · título | 125 car. · 40 car. | recomendado | M-IGF (verificado 2026-10-01) |
| Feed Facebook (imagem) | Ficheiro | JPG/PNG; 4:5; 1440×1800; máx. 30 MB; mín. 600×750; tolerância 3% | rec./máx. | M-FBF (verificado 2026-10-01) |
| Feed Facebook (imagem) | Texto principal · título | 50-150 car. · 27 car. | recomendado | M-FBF (verificado 2026-10-01) |
| Feed Facebook (vídeo) | Ficheiro | MP4/MOV/GIF; 4:5; 1440×1800; máx. 4 GB; 1 s a 241 min | rec./máx. | M-FBV (verificado 2026-10-01) |
| Feed Facebook (vídeo) | Texto principal · título | 50-150 car. · 27 car. | recomendado | M-FBV (verificado 2026-10-01) |
| Stories Instagram (imagem) | Ficheiro | JPG/PNG; 9:16; 1440×2560; máx. 30 MB; largura mín. 500 | rec./máx. | M-IGS (verificado 2026-10-01) |
| Stories Instagram (imagem) | Zona segura | livre de texto/logótipo: 14% em cima, 35% em baixo, 6% de cada lado | recomendado | M-IGS (verificado 2026-10-01) |
| Reels Instagram (vídeo) | Ficheiro | MP4/MOV; 9:16; 1440×2560; máx. 4 GB; 0 s a 15 min; H.264, AAC ≥128 kbps | rec./máx. | M-IGR (verificado 2026-10-01) |
| Reels Instagram (vídeo) | Texto principal | 44 car. | recomendado | M-IGR (verificado 2026-10-01) |
| Reels Instagram (vídeo) | Zona segura | 14% em cima, 35% em baixo, 6% de cada lado | recomendado | M-IGR (verificado 2026-10-01) |
| Carrossel (feed Facebook) | Cartões | 2 a 10; imagem 1:1 ≥1080×1080; 30 MB; vídeo 1 s a 240 min, 4 GB | máximo | M-CAR (verificado 2026-10-01) |
| Carrossel (feed Facebook) | Texto principal · título · descrição | 80 · 20 · 18 car. | recomendado | M-CAR (verificado 2026-10-01) |
| Campanha (API) | Objetivos | `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_APP_PROMOTION`, `OUTCOME_SALES` | lista | M-API (verificado 2026-10-01) |
| Campanha (API) | Estado na criação | só `ACTIVE` ou `PAUSED` | regra | M-API (verificado 2026-10-01) |
| Campanha (API) | Categorias especiais | `NONE`, `EMPLOYMENT`, `HOUSING`, `CREDIT`, `ISSUES_ELECTIONS_POLITICS`, `ONLINE_GAMBLING_AND_GAMING`, `FINANCIAL_PRODUCTS_SERVICES` | lista | M-API (verificado 2026-10-01) |
| Lead Ads (formulário instantâneo) | Limites de texto do formulário | `[por confirmar]` | — | — |
| Orçamento | Gasto diário acima do orçamento | `[por confirmar]` (fontes não oficiais falam de +75%/dia, ≤7×/semana) | — | — |
| Importação em massa | Formato e limites do ficheiro | `[por confirmar]` (a página oficial não abriu nesta sessão) | — | — |

## LinkedIn — anúncios

| Formato | Elemento | Valor | Tipo | Fonte |
|---|---|---|---|---|
| Imagem única | Texto de introdução | máx. 3000 car.; 150 recomendado; até 10 emojis | máx./rec. | LI-SI (verificado 2026-10-01) |
| Imagem única | Título | máx. 200; 70 recomendado | máx./rec. | LI-SI (verificado 2026-10-01) |
| Imagem única | Descrição | máx. 300; 100 recomendado | máx./rec. | LI-SI (verificado 2026-10-01) |
| Imagem única | Horizontal 1,91:1 | 1200×628 rec.; 640×360 mín.; 7680×4320 máx. | rec./mín. | LI-SI (verificado 2026-10-01) |
| Imagem única | Quadrada 1:1 | 1200×1200 rec.; 360×360 mín.; 4320×4320 máx. | rec./mín. | LI-SI (verificado 2026-10-01) |
| Imagem única | Vertical 4:5 | 720×900 rec.; 360×640 mín.; 2430×4320 máx. | rec./mín. | LI-SI (verificado 2026-10-01) |
| Imagem única | Ficheiro | JPG/PNG/GIF (≤250 frames); máx. 5 MB | máximo | LI-SI (verificado 2026-10-01) |
| Objetivos | Lista | Notoriedade: Brand Awareness · Consideração: Website Visits, Engagement, Video Views · Conversão: Lead Generation, Website Conversions | lista | LI-OBJ (verificado 2026-10-01) |
| Lead Gen Form | Campos | até 12 (inclui perguntas personalizadas); até 3 perguntas personalizadas | máximo | LI-LGF (verificado 2026-10-01, via resultados de pesquisa da página oficial) |
| Lead Gen Form | URL da política de privacidade | obrigatória, começa por http(s):// | regra | LI-LGF (verificado 2026-10-01, idem) |
| Lead Gen Form | UE | sem caixa de consentimento por omissão desde 21-04-2020; o anunciante acrescenta caixas por finalidade | regra | LI-EU (verificado 2026-10-01) |
| Orçamento | Mínimos por campanha/dia em EUR | `[por confirmar]` (só fontes não oficiais e em USD) | — | — |
| Carrossel, vídeo, documento, mensagem | Specs | `[por confirmar]` | — | — |

## Orgânico

| Plataforma | Elemento | Valor | Tipo | Fonte |
|---|---|---|---|---|
| Instagram | Foto | largura até 1080 px; rácio entre 1,91:1 e 4:5 (fora disso, corta) | regra | IG-IMG (verificado 2026-10-01) |
| Instagram | Hashtags | até 30 por publicação | máximo | IG-TAG (verificado 2026-10-01, via resultado de pesquisa da página oficial) |
| Instagram | Legenda | `[por confirmar]` (2200 car. em fontes não oficiais) | — | — |
| Instagram | Reels (orgânico) | `[por confirmar]` | — | — |
| Facebook | Texto da publicação | `[por confirmar]` | — | — |
| LinkedIn | Publicação | 3000 car.; artigo 125 000 car. | máximo | LI-POST (verificado 2026-10-01) |
| Google Business Profile | Tipos de publicação | Atualização, Oferta, Evento | lista | GBP-POST (verificado 2026-10-01) |
| Google Business Profile | Arquivo | publicações com mais de 6 meses arquivam-se, salvo se tiverem intervalo de datas | regra | GBP-POST (verificado 2026-10-01) |
| Google Business Profile | Telefone no texto | pode ser rejeitada se não se confirmar que é da empresa | regra | GBP-POST (verificado 2026-10-01) |
| Google Business Profile | Limite de texto e specs de foto/vídeo | `[por confirmar]` (a página não indica) | — | — |
| Google Business Profile | Respostas a avaliações | só com perfil verificado; revisão da Google em ~10 min, até 30 dias | regra | GBP-REV (verificado 2026-10-01) |
| Google Business Profile | Pedir avaliações | link e QR em «Ler avaliações → Obter mais avaliações» (QR só no computador); incentivos proibidos | regra | GBP-REV (verificado 2026-10-01) |

## Email

| Tema | Regra | Fonte |
|---|---|---|
| Remetentes em massa para Gmail (5000+/dia) | SPF e DKIM; DMARC publicado (pode ser `p=none`); domínio do `From:` alinhado com SPF ou DKIM; PTR válido; TLS | GMAIL (verificado 2026-10-01) |
| Cancelamento | um clique (`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, RFC 8058) e link visível no corpo | GMAIL (verificado 2026-10-01) |
| Taxa de spam | abaixo de 0,30% no Postmaster Tools (alvo 0,10%) | GMAIL (verificado 2026-10-01) |
| Consentimento (pessoas singulares) | prévio e expresso; ato positivo; caixa nunca pré-marcada (art. 13.º-A, n.º 1, Lei 41/2004) | CNPD §§30-31 (verificado 2026-10-01) |
| Clientes atuais | produtos/serviços análogos: sem consentimento, com oposição na recolha **e** em cada mensagem; diferentes: consentimento | CNPD §83 (verificado 2026-10-01) |
| Prova | lista atualizada de consentimentos e de clientes que não se opuseram; ónus da prova é do responsável | CNPD §§84-85 (verificado 2026-10-01) |
| Pessoas coletivas (B2B) | regime dos arts. 13.º-A e 13.º-B fora da Diretriz — `[por confirmar]` com jurista | CNPD nota 2 (verificado 2026-10-01) |
