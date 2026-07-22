---
name: cloudflare-dns
description: Gerir registos DNS e Email Routing no Cloudflare por API, idempotente, por domínio. MUST invoke when user says Cloudflare DNS, cloudflare-dns, Email Routing, registo DNS, SPF merge, MX Cloudflare, reencaminhar email domínio, forward email domínio, DKIM Cloudflare. SHOULD invoke when: domínio novo no Cloudflare, configurar noreply@, verificar MX/TXT, zona Cloudflare, upsert DNS record, criar subdomínio DNS.
triggers: cloudflare dns, cloudflare-dns, email routing, registo dns, spf merge, mx cloudflare, reencaminhar email dominio, forward email dominio, dkim cloudflare, zona cloudflare, upsert dns, dns idempotente
origin: local
---

# Cloudflare DNS + Email Routing

Gerir registos DNS e Email Routing (forward-only) por API, **idempotente**, por domínio. Fluxo manual repete-se por domínio e tem 2 armadilhas (ver Gotchas). Nunca blind-POST — duplica registos.

## Setup (1x por conta)

Token vive **só** em ficheiro local, fora do git, nunca no chat:
```bash
mkdir -p ~/.cloudflare
cat > ~/.cloudflare/<account>.json <<'JSON'
{ "token": "<CF_API_TOKEN>", "account_id": "<CF_ACCOUNT_ID>" }
JSON
chmod 600 ~/.cloudflare/<account>.json
```
Token scope: Zone.DNS Edit + Account.Email Routing Addresses/Rules Edit, na zona/conta certa.
`account_id`: Cloudflare dashboard → domínio → Overview → coluna direita.

**Nunca** fazer `echo`/`cat`/print do token ou do header `Authorization` em stdout, logs, ou mensagens.

## Auth (base de toda a sessão)

```bash
CF_FILE=~/.cloudflare/<account>.json
CF_TOKEN=$(jq -r .token "$CF_FILE")
CF_ACCT=$(jq -r .account_id "$CF_FILE")
API=https://api.cloudflare.com/client/v4
AUTH=(-H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")
```

## 1. Zona por domínio

```bash
zone_id() { curl -s "${AUTH[@]}" "$API/zones?name=$1" | jq -r '.result[0].id'; }
ZONE=$(zone_id example.com)
```
Guardar `ZONE` por domínio numa sessão que toca vários — evita repetir o lookup.

## 2. Upsert DNS (idempotente) — A/CNAME/TXT

Sempre GET primeiro; `id` existe → `PATCH`, senão → `POST`. **Nunca POST sem GET antes.**
```bash
dns_upsert() { # zone type name content
  local zone=$1 type=$2 name=$3 content=$4
  local id=$(curl -s "${AUTH[@]}" "$API/zones/$zone/dns_records?type=$type&name=$name" | jq -r '.result[0].id // empty')
  local body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" '{type:$t,name:$n,content:$c,ttl:1}')
  if [ -n "$id" ]; then curl -s -X PATCH "${AUTH[@]}" "$API/zones/$zone/dns_records/$id" -d "$body" | jq -c '{success,errors}'
  else curl -s -X POST "${AUTH[@]}" "$API/zones/$zone/dns_records" -d "$body" | jq -c '{success,errors}'; fi
}
```

MX precisa de `priority` — variante dedicada (match por `type+name+content`, porque há 3 MX no mesmo `name`):
```bash
dns_upsert_mx() { # zone name content priority
  local zone=$1 name=$2 content=$3 prio=$4
  local id=$(curl -s "${AUTH[@]}" "$API/zones/$zone/dns_records?type=MX&name=$name&content=$content" | jq -r '.result[0].id // empty')
  local body=$(jq -n --arg n "$name" --arg c "$content" --argjson p "$prio" '{type:"MX",name:$n,content:$c,priority:$p,ttl:1}')
  if [ -n "$id" ]; then curl -s -X PATCH "${AUTH[@]}" "$API/zones/$zone/dns_records/$id" -d "$body" | jq -c '{success,errors}'
  else curl -s -X POST "${AUTH[@]}" "$API/zones/$zone/dns_records" -d "$body" | jq -c '{success,errors}'; fi
}
```

Confirmar `success:true` sempre — `errors:[]` vazio não garante nada se `success:false` passou despercebido. Se `success:false` → mostrar `errors[]` ao user e **parar a checklist** (não continuar como se tivesse passado).

## 3. Email Routing — activar + destino + regra

**GOTCHA 1 (auth scope):** `POST /zones/{zone}/email/routing/enable` devolve **erro 10000 (auth)** sob token account-scoped "all zones". Activar Email Routing pelo **dashboard** (1 clique, domínio novo) — não é falha, é esperado. Depois de activo, addresses/rules/DNS seguem por API normalmente.

Destino (se ainda não existir — o destino que É o email da conta CF auto-verifica):
```bash
curl -s -X POST "${AUTH[@]}" "$API/accounts/$CF_ACCT/email/routing/addresses" \
  -d "$(jq -n --arg e "<gmail@destino>" '{email:$e}')" | jq -c '{success,errors}'
```

Regra de forward (`noreply@domínio → gmail`):
```bash
curl -s -X POST "${AUTH[@]}" "$API/zones/$ZONE/email/routing/rules" \
  -d '{"matchers":[{"type":"literal","field":"to","value":"noreply@example.com"}],
       "actions":[{"type":"forward","value":["<gmail@destino>"]}],"enabled":true}' | jq -c '{success,errors}'
```

DNS de Email Routing (3x MX + 1 DKIM): o **enable pelo dashboard (Gotcha 1) já os cria automaticamente**. As chamadas abaixo são só para **re-afirmar/verificar** de forma idempotente (ou fallback se algum não ficou). Prioridades `85/45/38` = valores fixos do Cloudflare Email Routing (route1/2/3); o valor DKIM é gerado pelo Cloudflare — copiar do dashboard, não inventar:
```bash
dns_upsert_mx "$ZONE" example.com route1.mx.cloudflare.net 85
dns_upsert_mx "$ZONE" example.com route2.mx.cloudflare.net 45
dns_upsert_mx "$ZONE" example.com route3.mx.cloudflare.net 38
dns_upsert    "$ZONE" TXT "cf2024-1._domainkey.example.com" "<valor DKIM gerado pelo CF, copiar do dashboard>"
```

Só recebe (forward); o DKIM `cf2024-1._domainkey` é o do routing (criado pelo enable) — enviar "como" o domínio (SMTP Send-as, DKIM próprio) é passo à parte, não coberto aqui.

## 4. SPF — merge, nunca substituir

**GOTCHA 2 (SPF clobber):** o wizard de Email Routing **reescreve o TXT SPF da raiz e apaga includes existentes** (ex.: Mailjet). Depois de activar Email Routing, **sempre** re-mergir o SPF por API:
```bash
spf_current() { curl -s "${AUTH[@]}" "$API/zones/$1/dns_records?type=TXT&name=$2" \
  | jq -r '.result[] | select(.content | startswith("v=spf1"))'; }
spf_current "$ZONE" example.com   # confirmar o estado ANTES de decidir o merge — não assumir

spf_merge() { # zone txt_record_id novo_conteudo
  curl -s -X PATCH "${AUTH[@]}" "$API/zones/$1/dns_records/$2" \
    -d "$(jq -n --arg c "$3" '{content:$c}')" | jq -c '{success,errors}'
}
# exemplo: preservar Mailjet + adicionar Cloudflare
spf_merge "$ZONE" "<id do TXT SPF>" "v=spf1 include:spf.mailjet.com include:_spf.mx.cloudflare.net ~all"
```
Merge = concatenar `include:` existentes + `include:_spf.mx.cloudflare.net`, um único `~all` no fim. Nunca substituir sem ler o `content` actual primeiro.

## 5. Verificar (edge duplo)

```bash
dig @1.1.1.1 MX example.com +short
dig @8.8.8.8 MX example.com +short
dig @1.1.1.1 TXT example.com +short              # SPF merged, um único registo
dig @1.1.1.1 TXT cf2024-1._domainkey.example.com +short
```
Confirmar nos dois resolvers antes de declarar concluído — propagação assíncrona entre eles.

## Gotchas

| Sintoma | Causa | Fix |
|---|---|---|
| `enable` devolve erro 10000 (auth) | endpoint de settings não aceita token account-scoped "all zones" | Activar pelo dashboard (1 clique); API continua a servir addresses/rules/DNS |
| SPF perde `include:spf.mailjet.com` (ou outro) após activar Email Routing | wizard reescreve o TXT SPF da raiz | `spf_merge` — ler `content` actual, concatenar, `PATCH` (nunca `POST` um TXT SPF novo) |
| DNS duplicado (2 registos A/MX iguais) | `POST` sem `GET` prévio | Sempre `dns_upsert*` (GET → PATCH se existe, POST se não) |
| MX antigo ainda resolve num resolver | dig só num edge | Confirmar em `1.1.1.1` e `8.8.8.8` antes de fechar |

## Checklist — domínio novo

- [ ] Token em `~/.cloudflare/<account>.json` (scope Zone.DNS + Email Routing)
- [ ] `ZONE=$(zone_id <dominio>)`
- [ ] Email Routing activado pelo **dashboard** (Gotcha 1)
- [ ] Destino de email criado/verificado (`accounts/.../addresses`)
- [ ] 3x MX (`dns_upsert_mx`, prioridades 85/45/38) + TXT DKIM `cf2024-1._domainkey`
- [ ] Regra de forward criada (`noreply@` → destino)
- [ ] SPF lido e re-mergido por API (Gotcha 2) — includes antigos preservados
- [ ] `dig` confirmado em `1.1.1.1` e `8.8.8.8` (MX + TXT SPF + TXT DKIM)

## Irreversível

`PATCH`/`POST` em DNS ou email routing afecta tráfego/entrega em produção → **1 linha de confirmação** antes de correr (soul.md gate). Leitura (`GET zones`, `GET dns_records`, `dig`) → correr sem perguntar.
