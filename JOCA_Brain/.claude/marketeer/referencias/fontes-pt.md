# Fontes portuguesas para a F1 (mercado, público, zona, notícias)

Lista de partida para `mkt-mercado` e `mkt-marca`. Cada URL foi pedido com `curl` (user-agent de
browser, `-L`) em **2026-10-01**; a coluna «Estado» diz o que respondeu. Uma fonte não prova nada
sozinha: cita sempre a página exata que leste (URL profundo + data), não esta raiz.

Regras de uso:
- Número tirado daqui → `[fonte]` com URL profundo e data de leitura; ano de referência do dado
  (ex.: «Censos 2021») escrito ao lado — um dado de 2021 não se apresenta como atual.
- `403`/`000` = o site recusa pedidos automáticos ou não respondeu; abre-se no browser (Chrome MCP)
  e, se nem assim abrir, a fonte fica `[por confirmar]`.
- Fonte que mudou de endereço → atualiza esta tabela (com a data) em vez de usar o URL antigo.

## 1. Estatística e dados de mercado

| Fonte | URL | Serve para | Estado (2026-10-01) |
|---|---|---|---|
| INE — Instituto Nacional de Estatística | https://www.ine.pt/xportal/xmain?xpgid=ine_main&xpid=INE | população por município/freguesia (Censos), empresas por CAE, consumo, turismo | 200 (GET; `HEAD` à raiz `www.ine.pt` não respondeu) |
| PORDATA | https://www.pordata.pt/ | séries por município e por país, comparação entre concelhos | 200 |
| Eurostat | https://ec.europa.eu/eurostat | comparação de Portugal com outros países da UE (mercados internacionais) | 200 |
| GEE / Estatística do Ministério da Economia | https://estatistica.dgeconomia.gov.pt/ | comércio internacional, setores (`www.gee.gov.pt` redireciona para aqui) | 200 |
| Marktest | https://www.marktest.com/wap/ | audiências de meios, estudos de consumo e internet (Bareme) | 200 |
| OberCom | https://obercom.pt/ | consumo de notícias e media digital em Portugal | 200 |
| Nielsen Portugal | https://www.nielsen.com/pt/ | audiências e retalho (muitos relatórios pagos → `[por confirmar]` se só houver resumo) | 200 |
| ACEPI — Economia Digital | https://www.acepi.pt/ | estudos de comércio eletrónico em Portugal | 200 |
| Turismo de Portugal | https://www.turismodeportugal.pt/ | dados de turismo e hotelaria por região | 200 |
| Google Trends (PT) | https://trends.google.com/trends/ | interesse relativo de pesquisa por região (índice 0-100, nunca volume) | 200 (GET); `explore?geo=PT` deu 429 a pedidos seguidos — usar no browser |

## 2. Meios de comunicação (notícias do setor, últimos 30 dias)

| Fonte | URL | Serve para | Estado |
|---|---|---|---|
| Google Notícias RSS pt-PT | `https://news.google.com/rss/search?q=<termos>+when:30d&hl=pt-PT&gl=PT&ceid=PT:pt-150` | varrimento de notícias dos últimos 30 dias por termo (o `when:30d` devolveu só itens de set. 2026 no teste) | 200 |
| Lusa | https://www.lusa.pt/ | agência noticiosa | 200 |
| ECO | https://eco.sapo.pt/ | economia, empresas, startups | 200 |
| Jornal de Negócios | https://www.jornaldenegocios.pt/ | economia e empresas | 200 |
| Dinheiro Vivo | https://dinheirovivo.dn.pt/ | economia (`dinheirovivo.pt` redireciona) | 200 |
| Público | https://www.publico.pt/ | generalista | 200 |
| Observador | https://observador.pt/ | generalista | 200 |
| Diário de Notícias | https://www.dn.pt/ | generalista | 200 |
| Jornal de Notícias | https://www.jn.pt/ | generalista, forte no Norte (bom para zona) | 200 |
| RTP Notícias | https://www.rtp.pt/noticias/ | generalista, inclui regiões | 200 |
| Expresso | https://expresso.pt/ | economia e generalista | 403 a curl — abrir no browser |
| Meios & Publicidade | https://meiosepublicidade.pt/ | marketing, publicidade e media em Portugal | 200 |
| Briefing | https://www.briefing.pt/ | marketing e comunicação | 200 |
| Hipersuper | https://hipersuper.pt/ | retalho e grande consumo | 200 |

Imprensa regional: não há diretório verificado nesta sessão. Procura por
`"<concelho>" jornal regional` e regista o título e o URL na secção de fontes do cliente.

## 3. Diretórios, avaliações e reclamações (concorrentes, público, reputação)

| Fonte | URL | Serve para | Estado |
|---|---|---|---|
| Racius | https://www.racius.com/ | dados públicos de empresas (CAE, sede, data de constituição) | 200 |
| eInforma | https://www.einforma.pt/ | dados de empresas (parte paga) | 200 |
| Páginas Amarelas (PAI) | https://www.pai.pt/ | concorrentes locais por atividade e concelho | 200 |
| Portal da Queixa | https://portaldaqueixa.com/ | reclamações públicas por marca (linguagem real do cliente, dores) | 200 |
| Livro de Reclamações eletrónico | https://www.livroreclamacoes.pt/Inicio/ | enquadramento legal (as reclamações não são públicas) | 200 (GET; `HEAD` deu 405) |
| Zaask | https://www.zaask.pt/ | prestadores de serviços e avaliações por categoria/zona | 200 |
| Fixando | https://www.fixando.pt/ | idem | 200 |
| OLX | https://www.olx.pt/ | preços praticados e concorrência informal | 200 |
| CustoJusto | https://www.custojusto.pt/ | idem | 200 |
| Tripadvisor | https://www.tripadvisor.pt/ | avaliações de restauração e turismo | 403 a curl — abrir no browser |
| TheFork | https://www.thefork.pt/ | restauração | 403 a curl — abrir no browser |
| Trustpilot | https://www.trustpilot.com/ | avaliações de lojas online | 403 a curl — abrir no browser |
| Idealista | https://www.idealista.pt/ | imobiliário (preços por zona) | 403 a curl — abrir no browser |

## 4. Bibliotecas públicas de anúncios

| Fonte | URL | Serve para | Estado |
|---|---|---|---|
| Google Ads Transparency Center | https://adstransparency.google.com/?region=PT | anúncios Google (Pesquisa, YouTube, Display) por anunciante, região Portugal | 200 |
| Meta Ad Library | https://www.facebook.com/ads/library/ | anúncios ativos no Facebook/Instagram por página, país Portugal | 403 a curl — só no browser (Chrome MCP) |
| LinkedIn Ad Library | https://www.linkedin.com/ad-library/ | anúncios LinkedIn por empresa | 403 a curl — só no browser |

## 5. Associações setoriais e entidades públicas

| Fonte | URL | Setor / uso | Estado |
|---|---|---|---|
| IAPMEI | https://www.iapmei.pt/ | PME, apoios, estatística de empresas | 200 |
| AICEP — Portugal Global | https://www.portugalglobal.pt/ | exportação, mercados internacionais | 200 |
| Portugal 2030 | https://portugal2030.pt/ | fundos e avisos (oportunidades do setor) | 200 |
| CCP — Confederação do Comércio e Serviços | https://ccp.pt/ | comércio e serviços | 200 |
| AHRESP | https://ahresp.com/ | restauração e alojamento | 200 |
| AEP — Associação Empresarial de Portugal | https://www.aeportugal.pt/ | empresas, Norte | 200 |
| AIP | https://www.aip.pt/pt | indústria, feiras (FIL) | 200 (GET; `HEAD` deu 500) |
| CIP | https://cip.org.pt/ | indústria | 200 |
| APCMC | https://apcmc.pt/ | materiais de construção | 200 |
| ANECRA | https://www.anecra.pt/ | reparação automóvel | 200 |
| APCC | https://www.apcc.pt/ | centros comerciais | 200 |
| APAN — Anunciantes | https://apan.pt/ | publicidade, autorregulação | 200 |
| APAP — Agências de publicidade | https://www.apap.co.pt/ | publicidade | 200 |
| ERC | https://www.erc.pt/pt/ | regulação de media | 200 |
| CNPD | https://www.cnpd.pt/ | proteção de dados (RGPD) | 200 |
| Portal do Consumidor (DGC) | https://www.consumidor.gov.pt/ | direitos do consumidor, publicidade | 200 |
| Autoridade da Concorrência | https://www.concorrencia.pt/ | estudos de mercado setoriais | 200 (GET) |
| BASE — contratos públicos | https://www.base.gov.pt/ | concorrentes que vendem ao Estado, preços adjudicados | 200 |
| Banco de Portugal | https://www.bportugal.pt/ | indicadores económicos | 403 a curl — abrir no browser |
| ANACOM | https://www.anacom.pt/ | comunicações, uso de internet | 403 a curl — abrir no browser |

Associação do setor do cliente que não esteja aqui: procura-a, verifica o URL e acrescenta-a a esta
tabela com a data.
