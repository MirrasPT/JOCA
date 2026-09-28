---
name: google-analytics
description: "Google Analytics 4 — setup gtag em sites (snippet, eventos custom, consent mode), verificação (DebugView/Realtime) e query de dados via GA4 Data API REST. MUST be invoked when the user says: analytics, traffic, visitors, page views, sessions, GA4."
---

# Google Analytics 4

Conhecimento GA4: instalar tracking num site, verificar que dispara, e consultar dados via Data API REST.

## Setup — gtag.js num site

Snippet base no `<head>`, o mais cedo possível:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
- `G-XXXXXXXXXX` = Measurement ID (GA4 Admin → Data Streams → Web).
- SPAs: o `page_view` automático só dispara no load inicial — em route change enviar `gtag('event', 'page_view', {page_location, page_title})` ou usar o Enhanced Measurement (history changes).

### Eventos custom
```js
gtag('event', 'sign_up', { method: 'email' });
gtag('event', 'purchase', { currency: 'EUR', value: 49.90, transaction_id: 'T-1001' });
```
- Preferir nomes de eventos recomendados GA4 (`sign_up`, `login`, `purchase`, `generate_lead`, …) — ganham relatórios standard.
- Parâmetros custom só aparecem nos relatórios depois de registados como custom dimensions (Admin → Custom definitions).

### Consent mode (obrigatório com banner de cookies UE)
Antes do snippet gtag:
```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied'
  });
</script>
```
Após consentimento do user: `gtag('consent', 'update', { analytics_storage: 'granted' });`

## Verificação

- **DebugView** (Admin → DebugView): eventos em tempo real com `?debug_mode=1` no URL, `gtag('config', ID, {debug_mode: true})`, ou a extensão GA Debugger.
- **Realtime report**: confirma page_views ~30s depois do deploy.
- Sem dados? Confirmar Measurement ID, desligar ad-blockers no teste, e verificar que o consent mode concede `analytics_storage`.

## Query de dados — GA4 Data API (REST)

Precisa de OAuth ou service account com acesso à property (papel Viewer no GA4 Admin → Property access management). **Se a credencial faltar: deixar `TODO: credencial em falta` e reportar — nunca inventar chaves/IDs (Hard Limit soul.md).**

Com gcloud autenticado (ADC):
```bash
# 1x, para obter ADC com scope de leitura Analytics
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly

TOKEN=$(gcloud auth application-default print-access-token)
curl -s -X POST \
  "https://analyticsdata.googleapis.com/v1beta/properties/PROPERTY_ID:runReport" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
    "dimensions": [{"name": "pagePath"}],
    "metrics": [{"name": "screenPageViews"}, {"name": "totalUsers"}],
    "limit": 20
  }'
```
- `PROPERTY_ID` = número da property (Admin → Property details) — **não** é o Measurement ID `G-…`.
- Realtime: endpoint `:runRealtimeReport` (mesmo shape, sem `dateRanges`).
- Service account: key JSON no GCP + dar acesso Viewer ao email da SA na property; depois `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json gcloud auth application-default print-access-token`.

## Ler os números — ausente não é zero

Dados em falta lêem-se como boa notícia se ninguém avisar. Antes de reportar um número:
- **Resposta limitada descreve a sua fatia.** Com `limit` ou paginação, a soma das linhas não é o total: o total vem de um pedido sem essa dimensão, ou diz-se «parcial».
- **Zero ≠ ausente.** Métrica a `0`, linha que falta, data vazia: tracking partido, consentimento recusado ou property errada dão o mesmo «0» que um site sem visitas. Zero implausível → «desconhecido».
- **Vazio ≠ falhou.** Resultado vazio confronta-se com outra fonte (Realtime, DebugView) antes de afirmar «sem visitas».
- **Total é contexto, não denominador.** Uma percentagem de um subconjunto calcula-se sobre a base que ele pode atingir (conversões do tráfego pago ÷ sessões pagas, não ÷ sessões totais). O relatório nomeia as duas bases.
- Pergunta obrigatória: «o que faria isto parecer assim se o negócio estivesse bem, e se os dados estivessem partidos?» Se não se distingue, diz-se.

Adaptado de anthropics/knowledge-work-plugins `small-business/shared/absent-is-not-zero.md` + `chain-seams.md` (Apache-2.0, reescrito).

## Referência de métricas & dimensões (runReport)

**Metrics**: `totalUsers` `newUsers` `sessions` `screenPageViews` `averageSessionDuration` `bounceRate` `engagementRate` `conversions` `eventCount` `activeUsers`

**Dimensions**: `date` `pagePath` `pageTitle` `sessionSource` `sessionMedium` `country` `city` `deviceCategory` `browser` `operatingSystem` `landingPage` `sessionDefaultChannelGroup`
