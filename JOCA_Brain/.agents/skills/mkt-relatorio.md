---
name: mkt-relatorio
description: "Monta os relatórios para pessoas do ciclo de marketing — 01-analise (F1), 02-proposta (F2) e 05-review (F5) — em .md com estrutura fixa e resumo executivo de 5 linhas, gera o .html a partir do modelo do pack e abre-o no browser. MUST be invoked when the user says: relatório de análise, relatório do marketeer, gerar o relatório, proposta em HTML, relatório de review, mkt-relatorio. SHOULD also invoke when: fecho da F1, fecho da F2 antes da aprovação, fecho da F5, o cliente pede o relatório."
triggers: relatório, relatório de marketing, gerar relatório, relatório html, proposta html, resumo executivo, report, marketing report
chain: mkt-estrategia, marketeer, marketeer-review
---
# mkt-relatorio

Fecha a **F1** (depois de `mkt-conectores` ∥ `mkt-marca` ∥ `mkt-mercado` ∥ `mkt-auditoria`), a **F2** (antes do
gate de aprovação) e a **F5**. Junta o que as frentes escreveram num documento que uma pessoa lê em 5 minutos:
**o que existe · a concorrência · o que se pretende**, com cada número a apontar para a fonte.
Não produz análise nova: se falta um dado, aponta a lacuna, não a preenche.

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md`, `conectores.md`, `estado.json` (via `estado.mjs ler`), `dossier.md`.
- `<RAIZ>/clientes/<slug>/ciclos/<ciclo>/01-analise.md` com as secções das frentes; para a F2 `02-proposta.md`
  (escrito pelas skills da F2); para a F5 os resultados, decisões e ações apurados pelo `marketeer-review` +
  `04-implementacao.md` + o baseline do `01-analise.md`.
- F2: `ciclos/<ciclo>/revisao-proposta.md` — resultado de cada volta do `mkt-revisor-agent`, gravado pelo `marketeer`
  (CONTRATO §2). Falta o ficheiro → a secção diz «revisão independente por fazer — brief em
  `revisao-brief-proposta.md`»; avançar sem revisão é decisão do humano no gate, pela regra única do `marketeer`
  §«Sem `Agent` ou sem o JOCA» (esta skill não decide nem bloqueia). Bloco `## Sem revisão` no ficheiro → a secção
  diz «aceite sem revisão independente por <quem>, <data>».
- `<MKT>/modelos/relatorio.html` — o modelo.

## Entrega
- F1: `ciclos/<ciclo>/01-analise.md` (secções de síntese) + `01-analise.html`.
- F2: `ciclos/<ciclo>/02-proposta.html` + a secção `## Revisão independente` do `02-proposta.md` (**só essa** — o resto
  do `.md` é do `mkt-estrategia` e das skills com marcadores; escrita por secções, CONTRATO §6).
- F5: `ciclos/<ciclo>/05-review.md` (gravado **antes** do revisor) + `05-review.html` (gerado **depois** da revisão,
  a partir do `.md` revisto), com os resultados e decisões que o `marketeer-review` apurou.
- Versão anterior de um `.html` → copiada para `ciclos/<ciclo>/.versoes/<nome>-<AAAA-MM-DD-HHMM>.html` antes de gerar de novo.
- O HTML abre-se no browser local. **Nunca se publica** (nem claude.ai, nem servidor) sem pedido explícito.

## Regras
1. **Números com fonte.** Cada número no relatório tem, na mesma linha ou na célula ao lado, a fonte (ficheiro do
   ciclo, URL ou comando) e a data/janela. Número sem fonte → sai do relatório e vai para «Lacunas».
2. **Etiquetas mantêm-se**: `[fonte]`/`[inferência]`/`[por confirmar]` passam para o HTML como `<span class="etq …">`.
3. **Ausente não é zero**: `não verificado` aparece escrito, nunca como 0 nem como célula vazia.
4. **Conversões de plataformas diferentes não se somam**; um total parcial não é denominador de outro canal.
5. **Copiar, não reinterpretar**: achados e números vêm das secções das frentes tal como estão; o resumo pode
   condensar, nunca mudar um valor ou promover uma inferência a facto.
6. Português de Portugal (AO90), € com vírgula decimal, datas `AAAA-MM-DD` no corpo e por extenso no título.
7. Cor da marca no HTML **só** se `marca.md` §Identidade visual a tiver medida ou lida no manual; senão neutro `#3f3f46`.

## Estrutura

### 01-analise.md (F1) — esqueleto
As frentes criam o ficheiro se faltar (atomicamente, `set -C`) com exatamente estes cabeçalhos; cada uma escreve
só as suas secções. Este é o esqueleto canónico:
```markdown
# Análise — <marca> — <ciclo>
## Resumo executivo
## O que existe
## Acessos
## Auditoria
## Baseline
## Mercado
## O que se pretende
## Lacunas e por confirmar
## Fontes
```
| Secção | Quem escreve | Conteúdo |
|---|---|---|
| Resumo executivo | **mkt-relatorio** | 5 linhas (abaixo) |
| O que existe | **mkt-relatorio** | negócio, ofertas, canais ativos e voz em 6-10 linhas, a partir de `marca.md` (cita as secções) |
| Acessos | **mkt-relatorio** | contagem por estado + tabela curta do `conectores.md` (canal · acesso · via) + receitas pendentes + **cruzamento com o baseline**: métricas de `conectores.md` §Dados extraídos que não estão no `## Baseline` (citadas, com janela e via) e valores que divergem entre os dois (vão também para «Lacunas»). A `mkt-auditoria` não faz este cruzamento — corre em paralelo com a `mkt-conectores` |
| Auditoria | mkt-auditoria | áreas, achados críticos/altos, não verificado |
| Baseline | mkt-auditoria | tabela métrica · valor · janela · via · fonte |
| Mercado | mkt-mercado | concorrentes, anúncios ativos, tendências 30 dias, público, zona recomendada |
| O que se pretende | **mkt-relatorio** | objetivos e orçamento de `marca.md` §Objetivos e orçamento + `estado.json` |
| Lacunas e por confirmar | **mkt-relatorio** | todos os `[por confirmar]`, `não verificado` e `<sem fonte>` das secções, deduplicados |
| Fontes | **mkt-relatorio** | lista única de URLs/ficheiros citados, com data de leitura |

**Resumo executivo — exatamente 5 linhas:**
1. O que existe — a marca numa frase + o canal que hoje mais pesa (com o número e a fonte, se houver).
2. O estado técnico — o achado mais grave da auditoria (ou «sem achados críticos»).
3. A concorrência — quem disputa e o que está a fazer que a marca não faz (com fonte).
4. O mercado — o sinal mais forte dos últimos 30 dias e a zona recomendada (etiquetados).
5. O que se pretende e o que falta para lá chegar — objetivo + a maior lacuna (acesso, dado, medição).

### 02-proposta.md (F2) — estrutura do relatório
O `.md` é do **`mkt-estrategia`** (esqueleto no passo «Gravar» dessa skill; `mkt-copy`, `mkt-medicao` e
`mkt-psicologia` escrevem entre os seus marcadores). As secções citam-se **pelo título** (o esqueleto não tem números).
Esta skill **não muda essa estrutura**: gera o HTML pela mesma ordem e põe no topo o resumo executivo de 5 linhas,
derivado do «Resumo executivo» do `.md` e das secções — 1 objetivo e métrica («Objetivos e KPIs») · 2 ponto de partida,
do baseline («Ponto de partida») · 3 aposta e canais («Estratégia e canais») · 4 orçamento em € por dia e por mês
(«Orçamento») · 5 o que o cliente tem de aprovar («Decisões pedidas»).
**«Revisão independente»** — escreve-a esta skill no `.md` (por Edit, só essa secção; re-ler antes) e copia-a para o
HTML, a partir de `ciclos/<ciclo>/revisao-proposta.md`: quem reviu (agente, nunca o produtor) · data e nº de voltas ·
achados por gravidade · o que mudou na proposta por causa deles · o que ficou em aberto (também em «Lacunas») ·
veredicto final (`aprovado: true|false`). Copiar, não reinterpretar (regra 5).
Secção que a F2 deixou vazia → «não incluído nesta proposta», nunca inventada.

### 05-review.md (F5) — estrutura do relatório
O conteúdo é do **`marketeer-review`**; a ordem do relatório segue a dessa skill (passo 7, «Propostas, gravar e revisão»):
`## Resumo executivo` (cabeçalho de **exatamente 5 linhas**: o que importa neste ciclo · resultado vs objetivo · o que
funcionou e o que não · as ações propostas · próxima revisão) · `## Implementado vs aprovado` (de `04-implementacao.md` vs `02-proposta.md`) ·
`## Resultados por canal` (baseline [janela, fonte] · objetivo · resultado [janela, fonte] — comparação só quando janela
e via são comparáveis; senão «não comparável» e porquê; conversões de cada plataforma na sua linha) ·
`## Decisões` (com a regra que disparou) · `## Ações` (no máximo 3) · `## Ainda por rever` (só na review parcial:
`canal · data`; vai para `{{CORPO}}`) · `## Não verificado` · `## Fontes`.

**Mapeamento para o modelo (os três relatórios):** «Resumo executivo» → `{{RESUMO}}` · «Lacunas e por confirmar»
(F1/F2) **e** «Não verificado» (F5) → `{{LACUNAS}}`, com `{{TITULO_LACUNAS}}` = «Lacunas e por confirmar» ou
«Não verificado» (o título igual ao do `.md`) · «Fontes» → `{{FONTES}}` · o resto, pela ordem do `.md` → `{{CORPO}}`.

## Passos

### 1. Verificar que as frentes acabaram (F1)
```bash
export MARKETEER_RAIZ="$(node "<MKT>/scripts/raiz.mjs")"
# ciclo = campo `ciclo` do estado.json (CONTRATO §3) — nunca a data de hoje
CICLO="$(node "<MKT>/scripts/estado.mjs" ler <slug> | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).ciclo))')"
C="$MARKETEER_RAIZ/clientes/<slug>/ciclos/$CICLO"
test -f "$MARKETEER_RAIZ/clientes/<slug>/marca.md" && test -f "$MARKETEER_RAIZ/clientes/<slug>/conectores.md" && test -f "$C/01-analise.md" && echo ok
grep -n "^## " "$C/01-analise.md"
```
Secção de uma frente vazia → não a escrevas tu: escreve em «Lacunas» «<frente> não correu / falhou: <motivo>» e segue
(a F1 não tem gate; mostra-se o que há).

### 2. Escrever as secções de síntese no `.md`
Por Edit, só nas secções da tua coluna. Para as que copias de outros ficheiros (`marca.md`, `conectores.md`), cita a
secção de origem em vez de reescrever o conteúdo todo. O resumo executivo é o último a ser escrito.

### 3. Gerar o HTML
1. Lê `<MKT>/modelos/relatorio.html`.
2. Converte o `.md` em HTML semântico à mão (sem bibliotecas): `##` → `<section><h2>`, `###` → `<h3>`, tabelas →
   `<table>` (números em `<td class="num">`), citações → `<blockquote>`, listas → `<ul>`, etiquetas → `<span class="etq …">`
   (`fonte`, `inferencia`, `confirmar`, `nv`). O resumo, as lacunas e as fontes vão para os seus marcadores; o resto para `{{CORPO}}`.
   KPIs do baseline (até 4) podem ir em `<div class="grelha"><div class="cartao"><div class="valor">…</div><div class="rotulo">… · janela · fonte</div></div></div>`.
3. Substitui **todos** os marcadores (`{{TITULO}}`, `{{MARCA}}`, `{{TIPO}}`, `{{CICLO}}`, `{{DATA}}`, `{{COR_MARCA}}`,
   `{{RESUMO}}`, `{{CORPO}}`, `{{TITULO_LACUNAS}}`, `{{LACUNAS}}`, `{{FONTES}}`; `{{CICLO}}` = o campo `ciclo` do estado) e **apaga o comentário de instruções** do topo do modelo.
   Escapa `<`, `>` e `&` vindos de texto citado.
4. Não sobrescrever às cegas:
   ```bash
   H="$C/01-analise.html"
   test -f "$H" && mkdir -p "$C/.versoes" && cp "$H" "$C/.versoes/01-analise-$(date +%Y-%m-%d-%H%M).html"
   ```
   Depois grava o `.html` novo.
5. Verificar o artefacto (não o relatório que escreveste sobre ele):
   ```bash
   grep -c "{{" "$H"                                   # tem de dar 0
   grep -Eic "<script|<link|@import|url\(" "$H"        # tem de dar 0 (autónomo)
   grep -ic "border-left" "$H"                         # tem de dar 0
   ```
   Abre-o e confirma visualmente que o resumo tem 5 linhas e que as tabelas não partem a largura.

### 4. Abrir no browser
`open "$H"` (Mac) · `start "" "$H"` (Windows) · `xdg-open "$H"` (Linux). Para PDF: imprimir no browser (o modelo tem
estilos de impressão A4). Diz ao operador o caminho do ficheiro.

### 5. Estado
Atualiza o estado só pelo script do pack (`node "<MKT>/scripts/estado.mjs" …`, ver CONTRATO §3; confirma o uso nas
primeiras linhas do ficheiro antes de o correr). Esta skill não edita `estado.json` à mão.

## Próximo passo (chain)
- **Depois do 01-analise (F1)** → mostra o relatório (sem gate) e segue para **`mkt-estrategia`** (F2), conduzido pelo `marketeer`.
- **Depois do 02-proposta (F2)** → volta ao **`marketeer`** para o gate «aprovação da proposta» (`AskUserQuestion`); a
  proposta passa antes pelo `mkt-revisor-agent` (quem produz não revê).
- **Depois do 05-review (F5)** → volta ao **`marketeer-review`**: as propostas de alteração vão ao gate da F2 e, se a review foi completa, abre-se o ciclo seguinte (F1 só o delta); review parcial não abre ciclo.
- Lacunas de acesso no relatório → lembra a receita do `conectores.md` numa linha; não as resolve aqui.

## Créditos
- Merge num documento único, «não agrafar relatórios», saída disciplinada e factos vs inferências separados:
  anthropics/knowledge-work-plugins (Apache-2.0) — `small-business/skills/marketing-monday/SKILL.md`, `small-business/skills/growth-pulse/SKILL.md`.
- Secção de limitações obrigatória num relatório: coreyhaines31/marketingskills (MIT) — `skills/aso/references/report-template.md`.
