---
name: mkt-auditoria
description: "Corre a auditoria técnica e de contas de uma marca com os scripts do pack (SEO técnico, tracking no chromium, presença e redes, Google Business Profile, GA4, diagnóstico Google Ads, prova de tracking) e regista o baseline de métricas com data e janela que a F5 vai comparar. Só leitura. MUST be invoked when the user says: auditar a marca, auditoria de marketing, baseline, estado atual das métricas, diagnóstico Google Ads, prova de tracking, mkt-auditoria. SHOULD also invoke when: F1 do /marketeer, F5 (medir o depois), acesso novo a uma conta."
triggers: auditoria, auditar, baseline, métricas atuais, diagnóstico ads, prova de tracking, SEO técnico, GBP, audit, baseline metrics
chain: mkt-relatorio
---
# mkt-auditoria

Frente da **F1 Análise** (paralela a `mkt-conectores`, `mkt-marca`, `mkt-mercado`); na **F5** corre outra vez em
modo leitura para medir o «depois». Não inventa módulos: corre o que o pack já tem, mostra o que eles imprimem e
escreve o **baseline** — a fotografia datada que a F5 compara.

## Recebe
- `<RAIZ>/clientes/<slug>/dossier.md` — site e canais (property ID GA4, `customer_id` Google Ads, Place ID GBP).
- `<RAIZ>/clientes/<slug>/conectores.md` — que acessos estão provados (se o `mkt-conectores` já acabou; senão, os scripts provam por si).
- Cofres (lidos **só pelos scripts**, nunca por ti): `~/.config/marketeer/<slug>.env`, `google-ads.env`, `google-places.env`.

## Entrega
- `<RAIZ>/clientes/<slug>/auditorias/<AAAA-MM-DD>.json` (+ `estado`/`actualizado` no dossier) — escrito por `auditoria/correr.mjs`.
- `<RAIZ>/clientes/<slug>/ads/diagnostico-<AAAA-MM-DD>.md` — se houver acesso Google Ads.
- `<RAIZ>/clientes/<slug>/tracking/relatorio-<AAAA-MM-DD>.md` — se correr a prova com `--cliente`.
- `<RAIZ>/clientes/<slug>/ciclos/<ciclo>/01-analise.md` → secções `## Auditoria` e `## Baseline` (só essas).
Todos os scripts nunca sobrescrevem: 2.ª corrida no mesmo dia → sufixo `-2`.

## Regras (herdadas do marketeer — não se negoceiam)
1. **Só leitura** sobre o site e as contas. Nenhuma escrita, publicação ou gasto. Nesta skill não se correm
   `ads/alterar.mjs`, `campanha/criar.mjs` nem nada com `--confirmar`.
2. **Credenciais nunca no chat**, em stdout, no disco da marca ou no git. Falta uma → o script deixa a área
   `nao-verificado` com o comando que o operador corre **no terminal dele**:
   `node "<MKT>/scripts/guardar-credencial.mjs" <slug> <CHAVE>` (GBP: `… google-places GOOGLE_PLACES_API_KEY`;
   GA4/Search Console: `GOOGLE_SERVICE_ACCOUNT` = **caminho** do JSON da service account). Nunca leias `~/.config/marketeer/`.
3. **Mostrar como está.** O resumo que o script imprime mostra-se tal como sai; não acrescentes achados nem
   estimes o que ficou `nao-verificado`.
4. **Ausente não é zero.** `nao-verificado` nunca vira 0 no baseline. Erro 403 numa conta = «sem permissão», não achado.
5. **A prova de tracking nunca cria um lead real**: o envio do formulário é intercetado (nenhum POST sai).
6. Saída 1 de um script = falhou; mostra a linha de erro e **não repitas às cegas**.

## Passos

### 0. Preparar (1× por máquina + raiz)
```bash
ls "<MKT>/scripts/auditoria"
export MARKETEER_RAIZ="$(node "<MKT>/scripts/raiz.mjs")"
# ciclo = campo `ciclo` do estado.json (CONTRATO §3) — nunca a data de hoje
CICLO="$(node "<MKT>/scripts/estado.mjs" ler <slug> | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).ciclo))')"
C="$MARKETEER_RAIZ/clientes/<slug>/ciclos/$CICLO"; mkdir -p "$C"
test -d "<MKT>/node_modules/playwright" || echo "falta npm ci"
```
Sem dependências → o operador corre `npm --prefix "<MKT>" ci` e `npx --prefix "<MKT>" playwright install --only-shell chromium`.
Sem `dossier.md` para o slug → pára e devolve «falta dossier (mkt-marca)».

### 1. Auditoria do site e contas (≈1 min)
```bash
MARKETEER_RAIZ="$MARKETEER_RAIZ" node "<MKT>/scripts/auditoria/correr.mjs" <slug>
```
Corre os módulos e agrega em `auditorias/<data>.json`:
- **seo** — SEO técnico sobre o HTML estático (títulos, meta, dados estruturados, …).
- **tracking** — abre a página num chromium headless: GA4, GTM, Pixel, banner de consentimento e o que dispara **antes** do consentimento.
- **presenca** — perfis sociais ligados no site (só se existem e se se leem sem sessão; não extrai seguidores) e coerência do NAP.
- **gbp** — dados públicos do Google Business Profile pela Places API: estado, NAP, horário, categoria, média e nº de
  avaliações, nº de fotos, comparação com o site. Place ID do dossier; senão pelo link no site ou por pesquisa
  (aceita só a ≤ 250 m do `geo` do JSON-LD, ou nome + código postal). **Place ID encontrado por pesquisa → mostra-o ao
  operador para confirmar e pôr no canal `gbp` do dossier.** Em modo agente (`mkt-analista-agent`) não se pergunta
  (CONTRATO §5.9): o Place ID fica `[por confirmar]` e vai na lista do retorno.
- **contas** (`auditoria/contas.mjs`) — GA4 Data API com a service account do cofre: `activeUsers` e `eventCount`,
  **janela de 7 dias** até ontem. Search Console: **por implementar** no script (fica `nao-verificado`).
Área `erro` com «dependências em falta (npm ci)» → passo 0. `site: <sem fonte>` → áreas web `nao-verificado`.

### 2. Diagnóstico Google Ads (só se `google-ads` tiver acesso)
```bash
MARKETEER_RAIZ="$MARKETEER_RAIZ" node "<MKT>/scripts/ads/diagnostico.mjs" <slug> [--login mcc]
```
12 meses até ontem: campanhas (custo, cliques, impressões, conversões, CPC, parcela de impressões), termos com gasto
e sem conversão, palavras-chave com índice de qualidade, landing pages com o estado HTTP de hoje (apanha 404), ações e
objetivos de conversão, campanhas ativas. `USER_PERMISSION_DENIED` → repete com `--login mcc`. Timeouts a
`*.googleapis.com` → `node --network-family-autoselection-attempt-timeout=2000 …`. Sem `customer_id` no dossier → não
adivinhas; fica `não verificado` e a receita vai para o `conectores.md`.

### 3. Prova de tracking (só leitura; opcional na F1, obrigatória antes da F4)
```bash
MARKETEER_RAIZ="$MARKETEER_RAIZ" node "<MKT>/scripts/tracking/prova.mjs" <url> --cliente <slug> \
  [--formulario <url> [--abrir '<seletor>'] [--form '<seletor>'] [--enviar '<seletor>'] [--evento <nome>]]
```
Cenários: A sem interação e B depois de Recusar → 0 pedidos a GA/doubleclick/googleadservices; C depois de Aceitar →
hits GA4/Ads; D (`--formulario`) → envio respondido localmente (201 → 1 evento; 422 → 0), nada sai para a rede.
`--evento` omite-se: o default é `generate_lead` (evento de lead da casa, CONTRATO §5.5); só se passa quando o
`tracking/plano.md` da marca usa outro nome (plano antigo mantém o nome). Formulário em modal → `--abrir`; sem `<form>` → `--form`. Com `--cliente` grava a checklist GA4/Ads (lê o Google Ads
só por GAQL). Na F1, uma falha aqui **é um achado**, não um bloqueio: vai para a auditoria e para o `mkt-medicao` (F2).

### 4. Ler o que saiu e escrever `## Auditoria`
Lê o resumo impresso e o JSON. Em `01-analise.md` (esqueleto em `mkt-relatorio`; cria-o com noclobber se faltar:
`( set -C; cat > "$C/01-analise.md" <<'MD' … MD ) 2>/dev/null || true`, e escreve **só** as tuas secções por Edit):
```markdown
## Auditoria
Corrida: <AAAA-MM-DD> · `auditorias/<AAAA-MM-DD>.json` · método <versão do JSON>
| Área | Estado | Achados (crítica/alta/média/baixa) | Nota |
### Achados críticos e altos
- [crítica] <regra> (<alvo>) — <evidência> → <recomendação> (skill: <skill>)
### Não verificado (e porquê)
```
Ordem dos achados = a do script (severidade). Não reescrevas a evidência por palavras tuas.

### 5. Baseline (a fotografia que a F5 compara)
Uma linha por métrica que **foi lida**; o que não foi lido aparece como `não verificado`, nunca 0.
Formato (os valores abaixo são só exemplo de forma):
```markdown
## Baseline
Registado: <AAAA-MM-DD> · rever na F5 com as **mesmas janelas e as mesmas vias**
| Canal | Métrica | Valor | Janela (datas exatas) | Via | Fonte (ficheiro/comando) |
|---|---|---|---|---|---|
| ga4 | activeUsers | 1 234 | 2026-09-24 → 2026-09-30 (7 dias) | api | auditorias/2026-10-01.json · contas.ga4 |
| google-ads | custo | 412,30 € | 2026-09-01 → 2026-09-30 | api | ads/diagnostico-2026-10-01.md |
| google-ads | conversões (Google Ads) | 9 | idem | api | idem |
| gbp | avaliações (média · nº) | 4,6 · 87 | instantâneo 2026-10-01 | público | auditorias/2026-10-01.json · gbp |
| meta-ads | resultados | não verificado | — | — | sem script de leitura nesta auditoria |
| search-console | cliques | não verificado | — | — | contas.mjs: por implementar |
```
Regras do baseline:
- Fontes de valores: **só os ficheiros desta auditoria** (`auditorias/<data>.json`, `ads/diagnostico-<data>.md`,
  `tracking/relatorio-<data>.md`) — o `conectores.md` pode ainda não existir (a `mkt-conectores` corre em paralelo).
  O cruzamento com `conectores.md` §Dados extraídos é da `mkt-relatorio`. Nunca números de memória.
- Janelas diferentes **não se misturam** numa linha; regista a janela real de cada script (GA4 = 7 dias, Ads = 12 meses e os meses que o diagnóstico separar).
- Conversões de plataformas diferentes **nunca se somam**; cada uma na sua linha com o nome da plataforma.
- Moeda em € com vírgula decimal; números como o script os deu (sem arredondar).
- Total que só cobre parte (ex.: só a loja online) passa como contexto, nunca como denominador de um rácio de outro canal.
- Métrica que a F5 vai precisar e que hoje não se consegue ler → linha `não verificado` com o que falta (é uma lacuna para a F2 resolver, não um zero).

### 6. Fechar
- Valida o dossier atualizado: `node "<MKT>/scripts/validar-dossier.mjs" "$MARKETEER_RAIZ/clientes"`.
- **Não fazes commit nem push.** Se a `<RAIZ>` for um repo git, mostra ao operador o comando para ele correr
  (branch + PR, nunca na `main`), como no marketeer.

## Próximo passo (chain)
- Sempre → **`mkt-relatorio`** quando as quatro frentes da F1 tiverem acabado (como frente paralela, devolve ao caller
  «auditoria feita» + caminhos + nº de achados por severidade, sem disparar o relatório sozinha).
- Achados de tracking/consentimento → alimentam o `mkt-medicao` (F2); achados de SEO local/GBP → `mkt-gbp` (F4).
- Na F5 (`marketeer-review`): corre os passos 1-3 e escreve o «depois» com as mesmas janelas; o `mkt-relatorio` compara com este baseline.

## Créditos
- Regras e scripts: a skill antiga de marketing (§auditar, §ads, §tracking), agora em `<MKT>/scripts/`.
- «Ausente não é zero» e «um total como contexto, nunca como denominador»: anthropics/knowledge-work-plugins (Apache-2.0) — `small-business/shared/absent-is-not-zero.md`, `small-business/shared/chain-seams.md`.
- Baseline que a corrida seguinte compara: `small-business/skills/marketing-monday/SKILL.md` (mesmo repo).
