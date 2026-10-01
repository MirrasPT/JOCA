# Referência — convenção de UTM do marketeer

Usada pela `mkt-medicao` (define), pela `mkt-copy` e pela `mkt-criativos` (aplicam nos links e nos QR
codes) e pelas skills da F4 (montam os URLs finais). Uma marca = uma folha de UTMs no
`02-proposta.md` §Medição; nenhum link sai sem passar pela validação do fim desta página.

## 1. Regras de forma

1. Parâmetros obrigatórios: `utm_source`, `utm_medium`, `utm_campaign`. `utm_content` sempre que há
   mais do que uma peça ou variante no mesmo canal. `utm_term` só em pesquisa paga manual.
2. **Só minúsculas, algarismos, `_` e `-`. Sem espaços, sem acentos, sem maiúsculas.** O GA4 distingue
   maiúsculas de minúsculas (`Facebook` ≠ `facebook` → duas linhas no relatório).
3. Separadores: `_` entre campos, `-` dentro de um campo (`leads_diagnostico-gratuito_2026-10`).
4. `utm_medium` só com os valores da tabela §2 — são eles que põem o tráfego no canal certo do GA4.
5. Nunca dados pessoais nos UTMs (nome, email, telefone, ID de cliente).
6. O mesmo `utm_campaign` em todos os canais da mesma campanha; o que muda é `source`/`medium`/`content`.
7. Links internos do próprio site **nunca** levam UTMs (partem a sessão e roubam a origem).

## 2. Valores por canal

Regras dos agrupamentos de canais predefinidos do GA4 (verificado 2026-10-01,
support.google.com/analytics/answer/9756891):
- Paid Search / Paid Social / Paid Other: `utm_medium` casa `^(.*cp.*|ppc|retargeting|paid.*)$`
  (Search e Social exigem ainda que a origem esteja na lista de motores de pesquisa / redes sociais do GA4).
- Organic Social: origem na lista de redes sociais **ou** medium `social`, `social-network`,
  `social-media`, `sm`, `social network`, `social media`.
- Email: origem **ou** medium = `email`, `e-mail`, `e_mail`, `e mail`.
- Display: medium `display`, `banner`, `expandable`, `interstitial`, `cpm`.
- Referral: medium `referral`, `app` ou `link`.
- Organic Search: origem na lista de motores de pesquisa ou medium exatamente `organic`.
- Cross-network: nome da campanha contém `cross-network`.

| Canal | `utm_source` | `utm_medium` | Canal GA4 esperado | Notas |
|---|---|---|---|---|
| Google Ads (Search, PMax) | — | — | Paid Search / Cross-network | **Etiquetagem automática (gclid) ligada; sem UTMs manuais.** Confirma-se no relatório da `tracking prova` (item «Etiquetagem automática»). Só sem etiquetagem automática: `google` / `cpc` |
| Meta Ads (Facebook/Instagram) | `facebook` ou `instagram` | `paid_social` | Paid Social | Um anúncio pode correr nas duas; fixar `facebook` subnotifica o Instagram. Parâmetros dinâmicos do Meta para a origem: `[por confirmar]` |
| LinkedIn Ads | `linkedin` | `paid_social` | Paid Social | — |
| Display / remarketing fora do Google Ads | `<rede>` | `display` | Display | — |
| Post orgânico (Facebook, Instagram, LinkedIn) | `facebook` · `instagram` · `linkedin` | `social` | Organic Social | Link da bio: `utm_content=bio` |
| Google Business Profile (botão «Website») | `google` | `organic` | Organic Search | `utm_campaign=gbp`; separa o GBP da pesquisa orgânica dentro do mesmo canal |
| Email / newsletter | `<lista>` (ex.: `newsletter`, `clientes`) | `email` | Email | `utm_content=<n.º do email>-<link>` (ex.: `e2-cta`) |
| Parcerias, imprensa online, diretórios | `<dominio-sem-pontos>` (ex.: `jornal-xpto`) | `referral` | Referral | — |
| **Material offline com QR** (flyer, cartaz, roll-up, evento, anúncio em jornal) | `<suporte>` (ex.: `flyer`, `cartaz`, `feira-<nome>`, `jornal-<nome>`) | `offline` | **Unassigned** no agrupamento predefinido | Ver §4 |

## 3. `utm_campaign` e `utm_content`

- `utm_campaign` = `<objetivo>_<tema>_<aaaa-mm>` — objetivo ∈ `leads` · `chamadas` · `vendas` ·
  `notoriedade` · `lista` (captação de email). Ex.: `leads_cozinhas-por-medida_2026-10`.
  Liga ao nome da campanha na plataforma (o marketeer usa `GADS_Search_<Objetivo>_<Tema>_<AAAA-MM>`
  nas campanhas Google): o tema e o mês são os mesmos.
- `utm_content` = `<formato>-<variante>` ou `<peça>-<posição>`: `carrossel-a`, `video-15s-b`,
  `flyer-a5-verso`, `e2-cta`. Uma variante de teste = um `utm_content` diferente — é isto que a F5 lê
  para comparar variantes.
- `utm_term` (só pesquisa paga sem etiquetagem automática): a palavra-chave, codificada no URL.

## 4. QR codes e material offline

- Cada suporte físico tem o seu URL com UTMs → o seu QR. Dois flyers diferentes = dois `utm_content`.
- O QR aponta para uma landing **própria da campanha** (ou a página da oferta), nunca para a homepage.
- Recomenda-se um URL curto legível impresso ao lado do QR (ex.: `marca.pt/inverno`) que redireciona
  (301) para o URL com UTMs — quem escreve o URL à mão também fica medido. O redirecionamento faz-se no
  site do cliente, por quem o mantém. Testar: `curl -sI <url-curto>` → `301` com `location` = URL com UTMs.
- `utm_medium=offline` cai em **Unassigned** no agrupamento predefinido do GA4 (nenhuma regra de §2 o
  apanha). Para o ver como canal próprio: grupo de canais personalizado no GA4 com a regra
  «Medium exatamente `offline`» `[por confirmar: passos na interface do GA4]`; sem ele, filtra-se por
  `utm_medium` nos relatórios de aquisição.
- Gerar o QR só depois de o URL passar na validação (§5) e de abrir com 200.

## 5. Validação (obrigatória antes de qualquer link sair)

Um URL por linha no stdin; sai 0 se todos passam, 1 se algum falha (testado com casos bons e maus):

```bash
printf '%s\n' "<url1>" "<url2>" | node -e '
const re=/^[a-z0-9]+([_-][a-z0-9]+)*$/, obrig=["utm_source","utm_medium","utm_campaign"];
const MEDIUM=new Set(["cpc","paid_social","display","email","social","organic","referral","offline"]);
let falhas=0;
for (const linha of require("fs").readFileSync(0,"utf8").split(/\r?\n/).filter(Boolean)) {
  const erros=[]; let u;
  try { u=new URL(linha.trim()); } catch { console.log("✗ URL inválido: "+linha); falhas++; continue; }
  for (const k of obrig) if (!u.searchParams.get(k)) erros.push(k+" em falta");
  for (const [k,v] of u.searchParams) if (k.startsWith("utm_") && k!=="utm_term" && !re.test(v)) erros.push(k+"=\""+v+"\" (minúsculas, algarismos, _ e -; sem espaços)");
  const m=u.searchParams.get("utm_medium"); if (m && !MEDIUM.has(m)) erros.push("utm_medium=\""+m+"\" fora da tabela");
  if (u.searchParams.has("gclid")) erros.push("gclid no URL de destino (o Google Ads põe-no sozinho)");
  console.log((erros.length?"✗ ":"✓ ")+linha+(erros.length?"\n    "+erros.join("\n    "):""));
  falhas+=erros.length?1:0;
}
process.exit(falhas?1:0);'
```

Depois da forma, o destino: `curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' -L "<url>"` →
`200` e o URL final **ainda com os `utm_*`** (um redirecionamento do site que os deite fora parte a
atribuição — é achado para o programador do site).

Prova no GA4 depois de publicar: abrir o URL num browser limpo, aceitar cookies, e confirmar a visita
em Tempo real com a origem/meio certos. Sem acesso ao GA4 → `não verificado`, nunca «ok».

## 6. Exemplos

```
Meta, carrossel A:   https://marca.pt/orcamento?utm_source=facebook&utm_medium=paid_social&utm_campaign=leads_cozinhas-por-medida_2026-10&utm_content=carrossel-a
Post orgânico LI:    https://marca.pt/guia?utm_source=linkedin&utm_medium=social&utm_campaign=lista_guia-remodelacao_2026-10&utm_content=post-1
GBP, botão site:     https://marca.pt/?utm_source=google&utm_medium=organic&utm_campaign=gbp
Email 2, CTA:        https://marca.pt/orcamento?utm_source=newsletter&utm_medium=email&utm_campaign=leads_cozinhas-por-medida_2026-10&utm_content=e2-cta
Flyer A5 (QR):       https://marca.pt/inverno?utm_source=flyer&utm_medium=offline&utm_campaign=leads_cozinhas-por-medida_2026-10&utm_content=flyer-a5-verso
```

## Créditos

- Synter-Media-AI/free-skills (MIT) — `skills/utm-builder/SKILL.md` (estrutura da convenção e regras de validação).
- coreyhaines31/marketingskills (MIT) — `skills/analytics/SKILL.md` §UTM Parameter Strategy.
