---
origin: local
name: cloudflare-analytics
description: "Ler tráfego e analytics de uma zona Cloudflare pela GraphQL Analytics API — visitas, bots, série diária, dimensões finas. MUST be invoked when user says cloudflare analytics, quantas visitas, isto são bots, tráfego do site, auditar tráfego, tráfego cloudflare. SHOULD also invoke when: zona a zero pedidos, threats/ameaças cloudflare, distinguir scanner de visita real, httpRequestsAdaptiveGroups, graphql cloudflare."
triggers: analytics cloudflare, quantas visitas, isto são bots, tráfego do site, auditar tráfego, tráfego cloudflare, httprequests cloudflare, zona sem tráfego, threats cloudflare, graphql analytics cloudflare
chain: cloudflare-dns
---

# Cloudflare Analytics (GraphQL)

Ler tráfego/analytics de uma zona Cloudflare pela **GraphQL Analytics API**. Não é DNS/Email
Routing (→ `cloudflare-dns`) nem logs de Workers (→ MCP `cloudflare-observability`, outro produto).

## Prior-art (verificado 2026-09-15)
O plugin `cloudflare@cloudflare` traz 5 MCP servers: `cloudflare-docs` (público), `cloudflare-api`,
`bindings`, `builds`, `observability`. Nenhum expõe analytics de zona por tool dedicada —
`cloudflare-api` dá acesso genérico à API (serve para correr a query GraphQL abaixo, se estiver
instalado nesta sessão), `cloudflare-observability` é só logs/métricas de **Workers**, não tráfego
de zona. Esta skill cobre o gap: qual dataset usar, os limites reais do Free, e como não confundir
atraso de pipeline com ausência de tráfego. Cobertura prior-art < 60% → skill nova justificada.

## Auth
Reutilizar o ficheiro de token da `cloudflare-dns` (mesma conta, scope de leitura já basta):
```bash
CF_FILE=~/.cloudflare/<account>.json
CF_TOKEN=$(jq -r '.api_token // .token // empty' "$CF_FILE")   # o nome do campo varia entre instalações — ver cloudflare-dns
```
Zona: `zone_id()` da `cloudflare-dns` (`GET /zones?name=<domínio>`), ou já guardado no ficheiro (ex.: uma chave `zone_<domínio>` — o nome exacto varia entre instalações; ler as chaves, não adivinhar).

## Datasets — qual usar

| Dataset | Para quê | Janela |
|---|---|---|
| `httpRequests1dGroups` | série diária (`sum{requests,pageViews,bytes,threats}`+`uniq{uniques}`) — quando um padrão começou | até ~30 dias por query |
| `httpRequestsAdaptiveGroups` | dimensões finas: `clientIP`, `userAgent`, `clientRequestHTTPHost`, `clientRequestPath`, `edgeResponseStatus`, `clientCountryName`, `datetimeMinute` | **Free: máx 1 dia por query** (ver Limites) |

```bash
curl -s -X POST https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"query($zone:String!,$since:Time!,$until:Time!){ viewer { zones(filter:{zoneTag:$zone}) { httpRequestsAdaptiveGroups(limit:100, filter:{datetime_geq:$since, datetime_leq:$until}) { dimensions{clientIP userAgent clientRequestPath edgeResponseStatus} count } } } }","variables":{"zone":"'"$ZONE_ID"'","since":"2026-09-05T00:00:00Z","until":"2026-09-06T00:00:00Z"}}'
```
Pedir vários agregados na mesma query com aliases → 1 chamada em vez de N.

## Limites do plano Free (verificado 2026-09-05, erro literal devolvido pela API — remedir se o plano mudar)

| Limite | Erro devolvido | Consequência |
|---|---|---|
| Janela do `httpRequestsAdaptiveGroups` | `cannot request a time range wider than 1d` | uma query por dia; encadear para janelas maiores |
| Campo `clientAsn` / `clientASNDescription` | `does not have access to the field` | sem ASN no Free — usar `userAgent`+`clientIP`+`clientCountryName` para identificar origem |

## Controlo com outra zona (obrigatório antes de concluir "sem tráfego")

O pipeline de analytics da Cloudflare atrasa **vários minutos** — "zero pedidos" é indistinguível de
"dados ainda não chegaram". Antes de reportar uma zona a zeros:
1. Correr a mesma query (`httpRequests1dGroups`, minutos mais recentes) numa **outra zona da mesma conta** com tráfego sabido, como controlo.
2. Controlo já tem dados até ao minuto N e o alvo pára em N-14 (ou mais) → o silêncio é real.
3. Sem este passo, "sucesso" ou "falha" pode ser só atraso de pipeline (incidente medido numa VPS própria, 2026-09-05).

## Perfil de ruído — o que NÃO é visita

Filtrar por `userAgent`/`clientRequestPath` antes de responder "tiveste X visitas" (perfil medido num domínio pessoal pequeno, 2026-09-05):
- Sondas próprias de monitorização (ex.: Uptime-Kuma self-hosted a testar os próprios domínios)
- Scanners de WordPress em site sem WP: `/wp-json/batch/v1`, `/wp/`, `/wordpress/`, `/blog/` (dão 404/403)
- `crusader-worker`, Palo Alto Xpanse (scanners de inventário/segurança)
- `Go-http-client` (bots genéricos sem UA de browser)
- ClaudeBot / Claude-SearchBot (crawler de IA)

Este perfil é o observado numa zona pequena; noutra conta/domínio o ruído dominante pode ser diferente — confirmar por amostragem antes de generalizar.

## Gotchas

| Sintoma | Causa | Fix |
|---|---|---|
| Zona a zeros logo após mudança recente | atraso do pipeline de analytics | comparar com outra zona (secção Controlo) antes de concluir |
| `httpRequestsAdaptiveGroups` falha com "wider than 1d" | limite do plano Free | 1 query por dia, encadear para janelas maiores |
| Campo de ASN ausente na resposta | Free sem acesso a `clientAsn` | usar UA+IP+país em vez de ASN |
| "100.000 visitas" alarmante | maioria é ruído de scanners/bots, não utilizadores | filtrar pelo perfil de ruído antes de concluir algo sobre tráfego real |

## Irreversível
Todos os passos aqui são leitura (`GET`/GraphQL query) — sem gate. Nunca fazer `POST`/`PATCH` de configuração de zona a partir desta skill (isso é `cloudflare-dns`).
