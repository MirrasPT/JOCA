{{FRONTMATTER}}
# {{CLIENTE}}: plano de medição

> Modelo do marketeer (`node "<MKT>/scripts/tracking/plano.mjs"`), a partir do que se montou à mão em dois
> sites de clientes em produção (setembro de 2026). **O frontmatter `tracking:` manda**: é
> dele que o `tracking/gtm.mjs` gera o contentor. As tabelas abaixo foram geradas a partir dele — se o
> mudares, actualiza-as. Nada inventado: sem fonte → `<sem fonte>`. As alterações ao site fazem-se
> no repo do site do cliente, nunca a partir do marketeer.

## 1. O que queremos saber

- Objectivos do cliente (dossier): {{OBJECTIVOS}}
- Pergunta principal: quantos pedidos (leads) e chamadas chegam, e de que canal/campanha vieram.
- Cada evento abaixo responde a uma decisão; evento que não muda nenhuma decisão não entra.

## 2. Eventos

| Evento | Parâmetros | Quando dispara | Evento-chave GA4 | Conversão Google Ads |
|---|---|---|---|---|
{{TABELA_EVENTOS}}

Nomes em minúsculas com `_` e fixos (o contentor GTM depende deles). O lead usa o evento recomendado do GA4
`generate_lead` (verificado 2026-10-01, support.google.com/analytics/answer/9267735); os restantes, em português.
Planos antigos com `lead_enviado` mantêm-no: o contentor sai do frontmatter deste ficheiro. **Nunca dados
pessoais** nos eventos nem nos parâmetros (nome, email, telefone do visitante, IDs de registo do CRM).

## 3. Contrato do dataLayer (o que o site do cliente tem de empurrar)

```js
// No sucesso do envio do formulário — SÓ quando o servidor responde 2xx (nunca no clique, nunca
// num 4xx/5xx). Se a página navega a seguir (ex.: /obrigado), esperar pelo GTM (máx. 1 s):
window.dataLayer.push({
  event: 'generate_lead',
  formulario: '{{FORMULARIO_EXEMPLO}}',   // valores: {{FORMULARIOS}}
  eventCallback: irParaObrigado,
  eventTimeout: 1000,
});

// No clique em qualquer <a href="tel:…"> — o número da EMPRESA, só algarismos, sem o 351:
window.dataLayer.push({ event: 'clique_telefone', numero: '{{TELEFONE_EXEMPLO}}' });   // valores: {{TELEFONES}}
```

Prova antes de publicar: `node "<MKT>/scripts/tracking/prova.mjs" <url> --formulario …` intercepta o POST (201 → 1 evento;
422 → 0). Nunca se envia um lead real.

## 4. Consentimento (Consent Mode v2)

- `gtag('consent', 'default', { …: 'denied' })` **inline no `<head>`, antes do snippet do GTM**.
- Estatística → `analytics_storage` (GA4) · Marketing → `ad_storage`, `ad_user_data`,
  `ad_personalization` (Google Ads). Necessários sempre activos.
- Todas as tags do contentor exigem consentimento (o `tracking/gtm.mjs` gera-as assim).
- Banner: Recusar com o mesmo peso que Aceitar; revogação no rodapé («Preferências de cookies») que
  apaga `_ga*` e `_gcl*` também com `domain=`. Guia e modelos: `modelos/tracking-banner.md`.
- Política de privacidade, secção de cookies: `modelos/tracking-politica-cookies.md`
  (**revisão jurídica obrigatória**).

## 5. Conversões Google Ads

{{TABELA_CONVERSOES}}

O valor nominal conta leads, não receita; muda-se no frontmatter se o cliente der um valor real.
O rótulo de cada conversão (Google Ads → Objectivos → Conversões → Configuração da tag) passa-se ao
`tracking/gtm.mjs` com `--rotulo <evento>=<rótulo>`.

## 6. Eventos-chave GA4

{{LISTA_CHAVE}}

Só se marcam como evento-chave (GA4 → Administrador → Eventos) **depois** de o 1.º evento chegar ao
GA4 — antes disso o evento não aparece na lista.

## 7. Contas e IDs

| O quê | Valor | Fonte |
|---|---|---|
| Propriedade GA4 (número) | {{GA4_PROPRIEDADE}} | dossier |
| ID de medição GA4 (`G-…`) | <sem fonte> | GA4 → Administrador → Streams de dados |
| Conta Google Ads | {{ADS_CONTA}} | dossier |
| ID da tag Google Ads (`AW-…`) e rótulos | <sem fonte> | Google Ads → Conversões → Configuração da tag |
| GTM: accountId, containerId e `GTM-…` | <sem fonte> | URL do GTM (`accounts/<n>/containers/<n>`) |

## 8. Passos

1. `node "<MKT>/scripts/tracking/gtm.mjs" {{SLUG}} --ga4 … --conta … --contentor … --gtm … [--ads AW-…/<rótulo>]` → JSON.
2. No **repo do site do cliente**: consentimento inline antes do GTM, banner, eventos do contrato (§3).
3. GTM → Importar contentor → **Substituir** (Juntar duplica) → Pré-visualizar.
4. `node "<MKT>/scripts/tracking/prova.mjs" <url> --cliente {{SLUG}} [--formulario …]` — 0 pedidos antes do consentimento e
   depois de Recusar; GA4 e Ads depois de Aceitar.
5. Publicar a versão do GTM (manual, pelo operador).
6. Checklist GA4/Ads (vai no relatório da prova): ligação GA4↔Ads, retenção de 14 meses, tráfego
   interno, eventos-chave depois do 1.º evento, objectivos de conversão por campanha.
