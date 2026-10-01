# Marketeer — contrato do pack

Fonte única dos nomes, ficheiros e regras partilhadas do workflow `/marketeer`. Todas as skills
`marketeer*` e `mkt-*` seguem este contrato; se uma skill o contradisser, ganha o contrato.
Língua do pack: **português de Portugal (AO90)**.

## 1. O ciclo

```
/marketeer <marca>
  F0 arranque  → F1 análise → F2 proposta → F3 artes → F4 implementação → (espera) → /marketeer-review <marca>
                                                                                      F5 review → novo ciclo (F1 só o delta)
```

| Fase | Skill que conduz | Skills de trabalho | Gate no fim |
|---|---|---|---|
| F0 arranque | `marketeer` | — | — |
| F1 análise | `marketeer` | `mkt-conectores` · `mkt-marca` · `mkt-mercado` · `mkt-auditoria` → `mkt-relatorio` | nenhum (relatório mostrado) |
| F2 proposta | `marketeer` | `mkt-estrategia` → (`mkt-copy` ∥ `mkt-medicao`) · `mkt-psicologia` (revisão) → `mkt-relatorio` | **aprovação da proposta** |
| F3 artes | `marketeer` | `mkt-criativos` (+ skills de imagem/design do JOCA quando existem) | **aprovação das artes** |
| F4 implementação | `marketeer` | `mkt-google-ads` · `mkt-meta-ads` · `mkt-linkedin-ads` · `mkt-email` · `mkt-gbp` · `mkt-organico` | **gate de medição** antes · **aprovação por escrita** |
| F5 review | `marketeer-review` | as mesmas de F1/F4 em modo leitura → `mkt-relatorio` | propostas vão ao gate da F2 |

Agentes do pack (despacháveis em paralelo): `mkt-analista-agent` (F1, um por frente),
`mkt-revisor-agent` (revisão adversarial, nunca o produtor), `mkt-criativos-agent` (F3, um por
peça), `mkt-plataforma-agent` (F4/F5, um por plataforma). Cada um lê como Step 0 a skill que o
brief lhe indica e este contrato.

## 2. Onde vive cada coisa

### Pack (instalado)
- Skills: `skills/marketeer.md`, `skills/marketeer-review.md`, `skills/mkt-*.md`.
- Comandos: `commands/marketeer.md`, `commands/marketeer-review.md`.
- Agentes: `agents/mkt-*-agent.md`.
- Motor: `marketeer/` (este diretório) — `scripts/`, `modelos/`, `referencias/`, `test/`, `package.json`.

`<MKT>` = caminho absoluto deste diretório `marketeer/`. Resolve-se assim, por ordem, e confirma-se com `ls "<MKT>/scripts"`:
1. variável `MARKETEER_HOME`, se existir;
2. no JOCA: `<raiz do JOCA_Brain>/.claude/marketeer`;
3. instalação autónoma: `~/.claude/marketeer`.
Dependências 1× por máquina: `npm --prefix "<MKT>" ci` e `npx --prefix "<MKT>" playwright install --only-shell chromium`.

### Dados das marcas (pasta de trabalho — nunca no pack)
`<RAIZ>` = pasta de trabalho que contém `clientes/`. Resolve-se assim, por ordem:
1. variável `MARKETEER_RAIZ`;
2. a pasta atual, se tiver `clientes/`;
3. `~/.config/marketeer/config.json` → campo `raiz`;
4. senão, pergunta-se por `AskUserQuestion` (recomendado `~/Marketeer`) e grava-se em `config.json`.
Os scripts recebem a raiz por `MARKETEER_RAIZ` (sempre exportada antes de os correr).

```
<RAIZ>/clientes/<slug>/
  dossier.md            # perfil da marca (frontmatter YAML validado por scripts/validar-dossier.mjs)
  marca.md              # contexto partilhado: negócio, ofertas, público, zona, voz, guidelines, objetivos, orçamento
  conectores.md         # matriz de acessos (formato §4)
  estado.json           # estado do ciclo (formato §3)
  auditorias/<AAAA-MM-DD>.json      # auditoria técnica (scripts/auditoria)
  ads/ · campanhas/ · tracking/     # artefactos dos módulos já existentes
  exports/                          # CSV exportados à mão das plataformas (via csv/manual)
  ciclos/<ciclo>/                   # <ciclo> = campo `ciclo` do estado.json (AAAA-MM, ou AAAA-MM-N se abrir 2.º ciclo no mesmo mês)
    mercado/                        # dados brutos da F1 (perfis de concorrentes, anúncios, tendências)
    .versoes/                       # versões anteriores (.html e o .md da review parcial), guardadas antes de reescrever
    revisao-<fase>.md               # resultado de cada volta do mkt-revisor-agent (fase ∈ proposta|artes|implementacao|review) — escreve quem despacha o revisor (`marketeer`; `marketeer-review` na fase review)
    revisao-brief-<fase>.md         # brief de revisão exportado quando não há agentes (§5.11)
    01-analise.md   + 01-analise.html
    02-proposta.md  + 02-proposta.html
    03-artes/briefs/<peca>.md · 03-artes/finais/ · 03-artes/aprovacao.html
    04-implementacao.md
    05-review.md    + 05-review.html
```
`marca.md` é o ficheiro de contexto que **todas** as skills de marketing leem primeiro (substitui o
`product-marketing-context.md` que as skills genéricas pedem). Secções fixas:
`## Negócio` · `## Ofertas` · `## Público` · `## Zona` · `## Concorrentes` · `## Voz` (com 3-5 amostras
reais citadas com URL) · `## Identidade visual` (guidelines: caminho/URL ou `<sem fonte>`) ·
`## Objetivos e orçamento` · `## Restrições`.

## 3. `estado.json`

```json
{
  "slug": "padaria-exemplo",
  "ciclo": "2026-10",
  "fase": "F2",
  "passos": {"F0": "feito", "F1": "feito", "F2": "em_curso", "F3": "pendente", "F4": "pendente", "F5": "pendente"},
  "aprovacoes": {"proposta": null, "artes": null},
  "proxima_accao": "rever a proposta com o cliente",
  "revisoes": [{"canal": "google-ads", "data": "2026-10-15", "motivo": "fim da aprendizagem (14 dias)"}],
  "actualizado": "2026-10-01"
}
```
Lê e escreve-se só por `node "<MKT>/scripts/estado.mjs" <ler|marcar|aprovar|revisao|ciclo-novo> <slug> …`
(sintaxe exata: cabeçalho de uso do script).

Regras do estado:
- **O ciclo lê-se sempre do `estado.json`** (`estado.mjs ler` → `.ciclo`); nenhuma skill o calcula pela data.
  `ciclo-novo` no mesmo mês abre `AAAA-MM-2` (depois `-3`, …).
- **Cada fase marca-se `feito` por quem a fecha:** F0 no fim da entrevista; F1 depois do relatório;
  F2 e F3 no «Sim» da aprovação (logo a seguir a `aprovar`); F4 depois do registo; F5 pela review antes de `ciclo-novo`.
- **Datas de revisão só as regista a F4** (o `marketeer`, depois da implementação). A F2 propõe-nas no `.md`.
  `revisao` **substitui** a entrada do mesmo canal; `ciclo-novo` move as já passadas para `revisoes_anteriores`.

## 4. `conectores.md`

Tabela única, uma linha por canal:
`| canal | conta/id | acesso | via | dados que dá | verificado em | como ligar |`
- `canal` ∈ `google-ads` · `ga4` · `search-console` · `gbp` · `meta-ads` · `facebook` · `instagram` · `linkedin` · `linkedin-ads` · `email` · `trypost` · `gtm` · `site` · `seo` · `offline` (os dois últimos só para datas de revisão).
- `acesso` ∈ `sim` · `não` · `parcial` · `não verificado`.
- `via` ∈ `api` · `mcp` · `cli` · `csv` · `manual` · `público`.
- `verificado em` = data + o comando ou a chamada que o provou. Sem prova → `não verificado`.
- `como ligar` = a receita para o operador (instalar MCP, dar acesso, exportar CSV) — nunca pedir a credencial no chat.

## 5. Regras que valem em todas as skills

1. **Nada inventado.** Sem fonte → `<sem fonte>`. Cada número leva fonte e data; etiqueta
   `[fonte]` (lido, com URL/comando) · `[inferência]` (raciocínio explícito) · `[por confirmar]`.
2. **Ausente não é zero.** Canal sem acesso → "não verificado", nunca 0.
3. **Credenciais nunca no chat, no disco da marca, em stdout ou no git.** Cofre:
   `~/.config/marketeer/<slug>.env` (chmod 600), escrito pelo operador no terminal dele com
   `node "<MKT>/scripts/guardar-credencial.mjs" <slug> <CHAVE>`. Nunca ler o cofre com `cat`.
4. **Aprovar ≠ ativar.** Tudo o que se cria nas contas nasce em pausa ou rascunho. Antes de qualquer
   escrita: ensaio (validateOnly / dry-run), custo em **€ por dia e por mês** à vista, e
   `AskUserQuestion` Sim/Não. **Ativar campanhas é sempre manual, pelo dono da conta, fora do marketeer.**
5. **Medição antes de lançar.** A F4 só começa com o plano de medição da F2 verificado
   (`mkt-medicao`: eventos, conversões, UTMs, consentimento). Falha → volta à F2.
   O `marketeer` corre o gate G1-G9 **uma vez** no início da F4 e grava a tabela (item · ✓/✗ · data ·
   evidência) em `04-implementacao.md` §Gate de medição. As skills de plataforma, em modo agente, leem
   essa tabela e só repetem as provas automáticas (G1, G2, G4, G6); não perguntam.
   **Evento de lead da casa:** `generate_lead` com parâmetro **`formulario`** (o nome do formulário).
   Plano antigo com outro nome mantém-se — o plano da marca (`tracking/plano.md`) manda.
6. **Quem produz não revê.** A proposta (F2) e as artes (F3) passam por `mkt-revisor-agent` antes do gate.
7. **Conversões de plataformas diferentes não se somam** (cada uma atribui à sua maneira).
8. **Portugal primeiro.** € (não $), RGPD e Lei 41/2004 (comunicações eletrónicas), fontes e meios
   portugueses; benchmarks só com fonte e data `(verificado AAAA-MM-DD)`.
9. **Uma pergunta = um `AskUserQuestion`**, 2-4 opções derivadas de fonte, recomendada primeiro, sempre "Não sei".
   **Em modo agente não se pergunta:** o que precisava de resposta fica `[por confirmar]` e volta na
   lista do relatório do agente; o `marketeer` pergunta depois. O modo das artes (criar/exportar) e o
   lembrete de calendário decidem-se só no `marketeer`.
10. **Relatórios para pessoas** saem em `.html` local (modelo de `mkt-relatorio`) e abrem-se no browser; nunca publicados sem pedido.
11. **Sem o JOCA:** quando uma skill chama uma skill do JOCA que não está instalada, segue o modo
    "exportar brief" (gera o brief em ficheiro para outra pessoa/IA) — nunca falha em silêncio.

## 6. Encadeamento

Nomes de campanha: `<PLAT>_<Tipo>_<Objetivo>_<Tema>_<AAAA-MM>` com `PLAT` ∈ `GADS` · `META` · `LINK`
(ex.: `GADS_Search_Leads_Software_2026-10`, `META_Leads_Formulario_Obras_2026-10`).
Ficheiro partilhado escrito por secções marcadas (`01-analise.md`, `02-proposta.md`) pode ter vários
escritores em paralelo, cada um só na sua secção; qualquer outro ficheiro tem um dono só.

Cada skill declara no frontmatter `chain:` e no corpo `## Próximo passo (chain)` com a condição.
Cada skill de trabalho tem as secções: `## Recebe` (ficheiros que lê) · `## Entrega` (ficheiros que
escreve, com caminho do §2) · `## Passos` · `## Próximo passo (chain)`.
