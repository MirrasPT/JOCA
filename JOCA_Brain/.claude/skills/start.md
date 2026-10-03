---
name: start
description: "O inicio de qualquer projeto e o router do trabalho: pergunta o tipo de trabalho (aplicacao, website, identidade/branding, marketing) e encaminha para o fluxo certo (executar-projeto, pipeline Website, pipeline Identidade, /marketeer com o marca.md pre-preenchido). Entrevista completa por formularios interactivos — tipo de produto (app movel, jogo, SaaS, software), fluxos, PRD inicial, stack por camadas, infraestrutura e direccao de design (com pagina interactiva de direccoes visuais) — e termina a engatar na execucao. Projectos existentes ligam-se ao JOCA com o mesmo questionario, pre-preenchido a partir do disco (PRD, README, manifestos, docs/) — o utilizador confirma em vez de escrever. MUST be invoked when the user says: /start, novo projeto, comecar projeto, arrancar projeto, criar produto novo, iniciar projeto. SHOULD also invoke when: comecar do zero, quero construir uma app, quero fazer um site, tenho uma ideia de produto, ligar projecto ao JOCA, init project."
triggers: start, novo projeto, comecar projeto, arrancar projeto, criar produto novo, iniciar projeto, comecar do zero, quero construir uma app, quero fazer um site, tenho uma ideia, ligar projecto ao JOCA, init project
argument-hint: "[nome-do-projeto]"
chain: executar-projeto, marketeer, prd
---
# /start — o inicio de qualquer projeto

Tipo de trabalho (1.0) → entrevista → PRD inicial → stack → infra → direccao de design → **engata
no primeiro workflow**. Esta skill **nao executa nada**: no fim tens os documentos e as decisoes; o
workflow seguinte constroi.

| Tipo de trabalho (1.0) | Destino |
|---|---|
| **Aplicacao / plataforma** (SaaS, ferramenta, app movel, jogo, API — e qualquer site com login, area reservada ou loja) | skill `executar-projeto` |
| **Website** (institucional, landing, portefolio; sem backend a serio) | pipeline **Website** do catalogo (`.claude/reference/pipelines-catalogo.md`) |
| **Identidade / branding** (logotipo, marca, manual, aplicacoes) | pipeline **Identidade/branding** do catalogo |
| **Marketing** (campanhas, redes sociais, ciclo de marca) | `/marketeer` — com `dossier.md` e `marca.md` pre-preenchidos (Fase 6.6) |

Mais de um tipo → pipeline **Projeto multi-tipo**, por esta ordem: branding → website/app → marketing.
Redes sociais sao sempre `/marketeer` (nao ha fluxo de redes). Nao existem skills `executar-*` alem
do `executar-projeto`: Website e Identidade sao linhas do catalogo, conduzidas pelo auto-runner.

> A **forma de trabalho** que esta skill instala (issue antes de codigo · design validado antes de
> UI · testes em sessao separada · `PROGRESSO.md` + `docs/DECISIONS.md` · ondas com portao) e
> **regra global** — vale em todos os projectos, com ou sem `/start`: `rules/pipelines.md`
> §Doutrina de projecto. O que so vive aqui e o **arranque**: entrevista, direccoes de design,
> scaffold e ponto de situacao.

**Referencias:** `<JOCA_ROOT>/JOCA_Brain/.claude/reference/start/` — daqui para a frente `$REF`.

# REGRAS

1. **Tudo por formulario.** **Qualquer** pergunta — fechada, aberta, ou um simples sim/nao — vai em
   `AskUserQuestion`. Nunca escrevas uma pergunta no chat a espera de resposta escrita. 2-4 opcoes
   concretas, `description` em cada, o **recomendado em primeiro**, `multiSelect` quando as opcoes
   nao se excluem. Resposta que so o utilizador sabe → mesma coisa: opcoes derivadas do que ja
   sabes + a opcao livre do formulario para ele escrever por cima.
2. **Uma decisao de cada vez.** Nunca despejes um questionario inteiro em texto.
3. **Nao pecas o que o disco responde — pre-preenche.** A Fase 0 corre antes de qualquer pergunta, e
   o que ela apurar entra nos formularios **como opcao recomendada em primeiro**, marcada
   `(do disco: <ficheiro>)`. Projecto com documentos leva as **mesmas** perguntas de um projecto
   novo — a diferenca e que ele confirma em vez de escrever.
4. **Nao pecas o que consegues propor.** Deriva sugestoes das respostas anteriores e apresenta-as
   como opcoes com um recomendado — o utilizador corrige mais depressa do que inventa.
5. **Insiste quando a resposta for vaga**, sobretudo no "o que NAO e".
6. **Nao inventes conteudo de produto.** O problema, o publico e as fronteiras sao do utilizador.
   Pre-preencher a partir de um ficheiro do projecto **nao e inventar** — mas cita a fonte na
   `description` da opcao, e se nao houver fonte a opcao nao existe.
7. **Assume sempre que ele quer avancar.** Fim de fase → passa a seguinte sem pedir licenca. Onde a
   fase seguinte for cara ou irreversivel e a confirmacao for mesmo precisa, e um formulario de
   **Sim/Nao com o "Sim, avancar" em primeiro** — nunca uma pergunta aberta em texto.

---

# FASE 0 — Levantamento (zero perguntas)

```bash
pwd && ls -A
git rev-parse --is-inside-work-tree 2>/dev/null && git remote -v && git log --oneline -3
test -f PROGRESSO.md && cat PROGRESSO.md
cat CLAUDE.md 2>/dev/null | head -30; cat README.md 2>/dev/null | head -20
ls package.json composer.json pubspec.yaml go.mod requirements.txt 2>/dev/null
gh auth status; gh --version; git config user.email
php -v 2>/dev/null | head -1; node -v 2>/dev/null; flutter --version 2>/dev/null | head -1
# ambiente local — nao perguntar o que isto responde
uname -s; sw_vers -productVersion 2>/dev/null; echo "${WSL_DISTRO_NAME:+WSL: $WSL_DISTRO_NAME}"
ls -d ~/Library/Application\ Support/Herd /Applications/Herd.app /c/laragon /opt/lampp /Applications/XAMPP /Applications/MAMP 2>/dev/null
command -v herd docker mysql mysqld psql valet 2>/dev/null
ls -d ~/.nvm ~/.asdf ~/.config/nvm 2>/dev/null
test -f docker-compose.yml && grep -nE "image:|mysql|pgsql|postgres" docker-compose.yml | head -5
grep -E "^(APP_URL|DB_CONNECTION|DB_HOST|DB_PORT)=" .env 2>/dev/null
# documentos que respondem a entrevista (fonte do pre-preenchimento)
ls docs/ 2>/dev/null
for f in docs/PRD.md PRD.md docs/DECISIONS.md docs/DESIGN.md docs/BRAND.md docs/ECRAS.md docs/ARCHITECTURE.md; do test -f "$f" && echo "--- $f" && head -60 "$f"; done
# memoria do Brain para esta pasta (exacta, mae e filhas) — so igualdade: caminho · slug · alias;
# o resto vem em quaseIguais e PERGUNTA-SE (nunca se escolhe). So pastas <slug>/index.md (a ficha plana antiga ja nao se le)
node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/lib/memoria-projecto.cjs resolver "$(pwd)"
grep -rln "$(pwd)" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null
# tipo de trabalho (0b): auth/BD num projecto Next · codigo vs so docs · estado do marketeer
grep -oE '"(next|next-auth|@auth/[a-z-]+|@clerk/[a-z-]+|@supabase/[a-z-]+|@prisma/client|prisma|drizzle-orm|mongoose|firebase|stripe)"' package.json 2>/dev/null | sort -u
ls -d middleware.ts src/middleware.ts app/api src/app/api app/login src/app/login 'app/(auth)' 2>/dev/null
grep -q '"laravel/framework"' composer.json 2>/dev/null && echo "laravel"; test -f pubspec.yaml && echo "flutter"
find . -maxdepth 3 \( -name '*.php' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.dart' -o -name '*.cs' \) -not -path '*/node_modules/*' 2>/dev/null | head -1
MKT=<JOCA_ROOT>/JOCA_Brain/.claude/marketeer
R=$(node "$MKT/scripts/raiz.mjs" 2>/dev/null) && echo "RAIZ marketeer: $R"   # sai 2 = raiz por definir (nao perguntar aqui)
# slug: marketeer_slug do index.md da memoria, senao o do nome da pasta (nunca de cabeca)
#   <slug-memoria> = o slug que o `resolver` acima devolveu (vazio se nao houver memoria)
S=$(sed -n 's/^marketeer_slug: *//p' <JOCA_ROOT>/JOCA_Brain/memory/projects/<slug-memoria>/index.md 2>/dev/null)
S=${S:-$(basename "$(pwd)" | node "$MKT/scripts/criar-dossier.mjs" --slug -)}
test -n "$R" && test -f "$R/clientes/$S/estado.json" && echo "marketing: clientes/$S/estado.json"
```
⚠ No levantamento **nunca** `estado.mjs ler`: o `ler` cria o `estado.json` por omissao quando falta,
e uma pasta passava a «marketing» so por ter sido inspeccionada. Aqui so `test -f`.

## Fase 0b — Derivar as respostas (zero perguntas)

Antes de abrir o primeiro formulario, converte o que a Fase 0 leu numa **tabela de respostas por
omissao**. Cada linha tem: campo · valor derivado · **ficheiro de onde saiu**. Sem ficheiro, nao ha
valor — fica `<sem fonte>` e a pergunta vai sem recomendado.

| Campo da entrevista | Onde se le |
|---|---|
| Nome | `composer.json`/`package.json` `name` · `pubspec.yaml` `name` · titulo do `README.md` |
| Problema / 1-2 frases | 1o paragrafo do `README.md` · `description` do manifesto · `docs/PRD.md` |
| Publico | seccao de publico/utilizadores do `docs/PRD.md` ou `README.md` |
| O que NAO e | seccao "O que NAO e"/"Non-goals"/"Out of scope" do `docs/PRD.md` |
| Tipo de trabalho (1.0) | `laravel/framework` ou `pubspec.yaml` ou `ProjectSettings/` → **Aplicacao** · `next` **sem** auth/BD (nenhum pacote de auth/BD/pagamentos da lista, nem `middleware`/`api`/`login`) → **Website** · `next` **com** auth/BD → **Aplicacao** (site com login e app) · `docs/BRAND.md` e nenhum ficheiro de codigo → **Identidade/branding** · `<RAIZ>/clientes/<slug>/estado.json` → **Marketing** (soma-se aos outros: multiSelect) |
| Tipo de produto (1.1) | manifesto: `pubspec.yaml`→movel · `laravel/framework`→SaaS/API · `ProjectSettings/`→jogo |
| Stack (Fase 3) | dependencias reais do manifesto + `php -v`/`node -v`/`flutter --version` |
| Ambiente local (Fase 3.6) | Herd/Laragon/XAMPP/MAMP detectados · `docker-compose.yml` · `.env` (`APP_URL`, `DB_*`) · `uname -s` |
| Infra (Fase 4) | `git remote -v` (repo ja existe → nao se cria) · `.env.example` · `docs/DECISIONS.md` |
| Design (Fase 5) | `docs/DESIGN.md`/`docs/BRAND.md`/`tailwind.config`/`@theme`/`ThemeData` |

Regra: **cada valor derivado vira a 1a opcao do formulario dessa pergunta**, com a `description` a
citar o ficheiro (ex.: `"Gestores de frota — do docs/PRD.md, seccao Publico"`). As outras opcoes sao
alternativas plausiveis. Assim ele carrega uma tecla em vez de reescrever o projecto todo.

## As tres portas

| Estado da pasta | Via |
|---|---|
| **Vazia** (ou so `.git`) | Projecto novo → Fase 1 |
| **Tem `PROGRESSO.md`** | **Retoma** — com `## Workflows` (formato em `$REF/progresso-formato.md`), entra no **1.o workflow por fazer cujo «Comeca quando» esta cumprido**; dentro dele, le as fases, confirma cada uma pelo criterio de saida (tabela abaixo), entra na primeira por fazer. Nao repete a entrevista do que ja esta em `docs/PRD.md`. **Maquina cujo SO nao esta na tabela Ambiente local** → corre so a Fase 3.6 para essa maquina e acrescenta a linha; nao repete nada do resto |
| **Tem projecto, sem `PROGRESSO.md`** | **Ligar ao JOCA** — entrevista na mesma, **pre-preenchida** pela Fase 0b. Ver caixa |

> ### Ligar um projecto existente — questionario pre-preenchido
> **Nao saltas as perguntas: saltas o trabalho de as responder.** O `composer.json`/`package.json`/
> `pubspec.yaml` da a stack, o git da o historico, o `README.md` e o `docs/` dao o objectivo, o
> publico e as fronteiras. Corre as Fases 1-5 **na integra**, mas cada formulario abre com a
> resposta ja derivada em primeiro lugar e a `description` a citar o ficheiro — ele confirma em vez
> de escrever. Uma fase inteira cujos campos vieram todos do disco resolve-se num unico formulario
> de confirmacao em bloco ("Confirmas isto tudo?" → *Sim* · *Quero corrigir* → so entao as
> perguntas uma a uma).
> Nada derivado (`<sem fonte>`) → a pergunta corre normal, sem recomendado.
> No fim: escreve/actualiza a memoria do projecto no Brain (`memory/projects/<nome>/`) e cria o
> `PROGRESSO.md` com o estado real observado. Se ja existir memoria no Brain para a pasta (ou para a
> pasta-mae), **mostra-a primeiro** e pergunta — em formulario — se e *actualizar* · *area nova* ·
> *criar sub-entrada* · *guarda-chuva*. Nunca comecar como se fosse novo. Sem igualdade mas com
> `quaseIguais` → formulario «E o <a>» · «E o <b>» · «Projecto novo» · «Area nova de <x>».

## Criterios de saida por fase (usados na retoma)

| Fase | Prova — comando, nao opiniao |
|---|---|
| S1 Produto | `docs/PRD.md` existe; seccao "O que NAO e" com >= 5 pontos |
| S2 Fluxos | 3-6 fluxos no PRD + lista de ecras + entidades + capacidades marcadas |
| S3 Stack | seccao Stack do PRD preenchida, sem `<...>`, **incluindo a tabela Ambiente local** (1 linha por maquina) |
| S4 Infra | repo GitHub decidido (nome + visibilidade) + deploy decidido/adiado em `docs/DECISIONS.md` |
| S5 Design | direccao registada em `docs/DESIGN.md` (ou "existe em X" ou "explorar na execucao") |
| E* Execucao | ver `executar-projeto` — fases E1-E4 tem os seus criterios la |
| W* / B* | ver as linhas **Website** (W1-W7) e **Identidade/branding** (B1-B7) do catalogo de pipelines — cada passo tem a sua entrega |
| Marketing | `test -f <RAIZ>/clientes/<slug>/estado.json` (RAIZ e slug no frontmatter do `index.md` da memoria); a fase e a retoma sao do `/marketeer`, nunca do `PROGRESSO.md` |

Fase marcada como feita que **nao passa** a prova → por fazer, e diz-lo.

---

# FASE 1 — O produto

Se `$ARGUMENTS` trouxer um nome, usa-o. Senao, pede-o na primeira pergunta.

**1.0 — Tipo de trabalho** (`AskUserQuestion`, `multiSelect: true`, a primeira pergunta de todas):
as 4 opcoes da tabela do topo, **o tipo deduzido na 0b em primeiro** com `(do disco: <ficheiro>)`
na `description`. Sem deducao → ordem da tabela, sem recomendado.
- **Site com login, area reservada, loja ou BD propria → Aplicacao**, nao Website — mesmo que o
  utilizador diga «site». Se marcar Website e depois, na 2.2, marcar *Login/contas*, *Pagamentos* ou
  *Multiplos utilizadores*, o tipo passa a Aplicacao e di-lo numa linha.
- **Fases por tipo** (corre a **uniao** das marcadas; o resto salta-se sem perguntar):

| Fase | Aplicacao | Website | Identidade | Marketing |
|---|---|---|---|---|
| S1 Produto | completa (1.1 + 1.2) | 1.2 | 1.2 (1, 2, 4, 6) | 1.2 (1, 2, 4) + **1.3** |
| S2 Fluxos | completa | leve: paginas (vao para `docs/ECRAS.md`) + capacidades | — | — |
| S3 Stack | completa | **Next.js 16** pre-seleccionado (so confirmar) | — | — |
| S4 Infra | completa | completa | repo opcional | — |
| S5 Design | completa | completa, ou «vem do branding» | so a 5.1 (fonte existente) | — |

  «O que NAO e»: >= 5 pontos em Aplicacao e Website; >= 3 em Identidade e Marketing.

**1.1 — Tipo de produto** (so para **Aplicacao**; `AskUserQuestion` — afunila a stack e o design):

| Opcao | Consequencias a jusante |
|---|---|
| **SaaS / plataforma web** | multi-utilizador provavel; backoffice; Laravel+Livewire+Filament |
| **App movel** | Flutter + Laravel API; lojas; offline a considerar |
| **Jogo** | movel → Unity 6; web → a decidir na Fase 3 |
| **Software / ferramenta interna** | densidade compacta; menos marketing, mais dados |
| **So API / backend** | sem fase de design de ecras; contratos primeiro (`rest-api`) |

(5 opcoes nao cabem numa pergunta de 4 — usa as 4 mais provaveis + "Other".)

**1.3 — So para Marketing** (4 formularios, um de cada vez, opcoes derivadas do disco/site):
**objectivo de negocio** (leads, vendas, marcacoes, chamadas, notoriedade — deriva dos CTA do site) ·
**prazo** (data ou evento) · **aprovador** (nome/funcao; pode ser o operador) · **URL do site**.
Orcamento, valor de um cliente e resposta aos leads **nao se perguntam aqui** — sao da F0 do
`/marketeer` (ver 6.6).

**1.2 — Seis perguntas, seis formularios, uma de cada vez.** Nenhuma vai em texto solto: mesmo
onde o conteudo e do utilizador, o formulario abre com candidatos derivados (Fase 0b, ou da resposta
anterior) e ele escolhe ou escreve por cima na opcao livre.

| # | Pergunta | Como montar o formulario |
|---|---|---|
| 1 | **Nome** + 1-2 frases do problema | Opcoes: nome do manifesto/README (`(do disco: <ficheiro>)`) · nome da pasta · `$ARGUMENTS` · escrever outro |
| 2 | **Para quem** | Propoe 3 utilizadores **concretos** deduzidos do problema. "Empresas" nao e opcao; "o responsavel de operacoes numa equipa de 5-20 pessoas" e. Ele escolhe ou corrige |
| 3 | **Como e resolvido hoje** e porque e mau | Opcoes tipicas: Excel/folha de calculo · ferramenta generica mal encaixada · a mao/papel · concorrente directo · outro |
| 4 | **O que NAO e** — 5 pontos | `multiSelect: true` com 6-8 candidatos derivados do que ele ja disse (facturacao, app movel, multi-idioma, marketplace, chat, BI, offline…). **Nao avances com menos de cinco** — se o primeiro formulario der menos, abre um segundo com candidatos novos |
| 5 | **Primeira versao utilizavel** | Propoe 3 cortes de ambito, do mais pequeno ao mais completo, derivados dos fluxos ja falados; recomendado = o mais pequeno |
| 6 | **Ambito de distribuicao** | Opcoes: privado (so o dono/familia) · partilhado (grupo fechado) · publicado (gratis, publico) · vendido. Decide a regra de licenca de assets e codigo de terceiros — perguntado a meio, a pesquisa ja correu com a restricao errada |

**Familia de N pecas** (o projecto gera varias pecas/produtos da mesma familia): o **texto canonico**
partilhado (campos, pontuacao, unidades, formato de datas/pesos) decide-se **uma vez**, aqui, com o
dono — nao por peca. Caso real: tres placas da mesma familia sairam com `2,120 kg` · `2.120kg` ·
`2.120 kg`, cada uma copiada da sua imagem de referencia (caso real, 2026-08-28).

O objectivo continua a ser ele **descrever o maximo possivel** — o campo livre de cada formulario
serve para isso, e regista-se tudo, mesmo o que nao couber nas opcoes; vai para o PRD.

---

# FASE 2 — Fluxos, capacidades e PRD inicial

**2.1 — Fluxos.** Pede 3 a 6 percursos principais. Para cada um: **quem** · **o que quer** · **os
passos** · **o que pode correr mal**. Escreve tu a versao estruturada, mostra para confirmacao.

**2.2 — Capacidades transversais** (`AskUserQuestion` com `multiSelect: true` — e uma checklist,
nao uma escolha). Pergunta so as plausiveis para o tipo de produto; assume por omissao as obvias e
di-lo:

| Capacidade | Se marcada, entra no PRD e na stack |
|---|---|
| **Login / contas** | skill `auth` na execucao; decide ja: email+password, social, magic link |
| **Multiplos utilizadores / equipas** | tenancy — `saas-patterns`; muda o modelo de dados |
| **Pagamentos** | `payment-integration` / `portugal-payments`; ⛔ passo irreversivel na execucao |
| **Notificacoes** (email/push) | `transactional-email`; push exige app movel |
| **Backoffice / administracao** | Filament v5 quase de graca com Laravel |
| **Multi-idioma** | i18n desde o dia 1 — retrofit e caro |
| **Offline / sincronizacao** | so movel; muda a arquitectura da app |
| **Uploads / ficheiros** | `file-storage` (S3/R2) |

**2.3 — Extrair e confirmar** duas listas: **ecras** e **entidades**. Confirma ambas — sao a
espinha do design e do modelo de dados.

**2.4 — Escrever o PRD inicial.** `Read(".claude/skills/prd.md")` e escreve `docs/PRD.md` com o que
existe ate aqui: problema, publico, "nao e", fluxos, capacidades, ecras, entidades, primeira versao.
Marca as seccoes por preencher (stack, design) com `<pendente: fase S3/S5>` — o PRD completa-se ao
longo do /start e fecha na execucao. **Conteudo real da entrevista, nao template.**

---

# FASE 3 — Stack

**A doutrina** (ver `rules/stack-padrao.md`): salvo impossibilidade real, todos os projectos usam o
stack da casa — **Next.js · Laravel + Livewire + Filament · MySQL (phpMyAdmin) ou PostgreSQL ·
Flutter · Unity 6 para jogos moveis**. As perguntas escolhem **que pecas entram**, nao pecas fora
da casa. Fora do stack so com razao registada em `docs/DECISIONS.md`.

Pre-seleccao pelo tipo (mostra ja o recomendado certo):

| Tipo | Recomendacao por omissao |
|---|---|
| Website (1.0) | **Next.js 16** (estatico/hibrido) · area reservada → era Aplicacao (volta a 1.0) |
| SaaS / plataforma | **Laravel + Livewire + Filament + MySQL** |
| App movel | **Flutter + Laravel API + MySQL** |
| Jogo movel | **Unity 6** (+ Laravel API se tiver backend) |
| Software interno | **Laravel + Livewire + Filament** |
| So API | **Laravel API + MySQL** |

Perguntas em cascata (`AskUserQuestion`, cada resposta fecha opcoes da seguinte — nao mostres
opcoes ja excluidas):

1. **Frontend web** (se ha web): Livewire 4 + Flux · Next.js 16 · ambos (site publico Next + app
   Livewire)
2. **Backend**: Laravel 13 · nenhum (Next full-stack — so para sites sem logica de servidor real)
3. **Base de dados**: MySQL 8.4 (recomendado — producao cPanel/Ploi, gerida por **phpMyAdmin**) ·
   PostgreSQL 17 (tipos ricos/JSON pesado) · SQLite (so dev/prototipo)
   > ⚠ **Dev e producao em motores diferentes e a armadilha mais cara** — SQLite ignora `VARCHAR` e
   > o modo estrito do MySQL; os erros so aparecem no deploy. Se producao = MySQL, o CI corre MySQL.
4. **Backoffice**: Filament v5 (so com Laravel) · nenhum
5. **App movel** (se aplicavel): Flutter · nenhuma nesta versao
6. **Ambiente local** — onde e que isto corre na maquina de quem desenvolve. Nao e detalhe: decide o
   URL de dev, o motor de BD real e metade dos bugs de "so acontece aqui". A Fase 0 ja detectou o
   que da para detectar — **pergunta so o que faltar**, e mostra o detectado como recomendado.

| Sistema | Opcoes (recomendado primeiro) |
|---|---|
| macOS | **Laravel Herd** · Docker/Sail · nativo (`php artisan serve` + Homebrew) · MAMP |
| Windows | **Laragon** · Herd Windows · WSL2 (+ Sail) · XAMPP · nativo |
| Next.js / Flutter | nao ha "ambiente": `npm run dev` / `flutter run`. Perguntar so as versoes de Node/Flutter e o gestor (nvm · fnm · asdf · nenhum) |

   Perguntas em cascata (`AskUserQuestion`), so as que a Fase 0 nao respondeu:
   a) **Ambiente** da tabela acima.
   b) **Motor de BD local** — tem de ser **o mesmo motor da producao** (pergunta 3). Herd e Laragon
      trazem MySQL; Sail traz o que estiver no `docker-compose.yml`. SQLite em dev com MySQL em
      producao **so com decisao registada** em `docs/DECISIONS.md`.
   c) **Onde responde o servidor de dev** — `https://<nome>.test` (Herd/Laragon) · `http://localhost:8000`
      · `http://localhost:3000` · porta propria. Pergunta tambem se ha **portas reservadas** nesta
      maquina (outro projecto, outro servico) — colisao de porta e falha silenciosa.
   d) **Versoes de PHP e Node** e de onde vem (do ambiente, ou instaladas a parte com nvm/asdf).
   e) **Mais do que uma maquina?** Se sim: uma linha de ambiente **por maquina**, e o scaffold (E1)
      leva `.gitattributes` com `* text=auto eol=lf` — sem isso o mesmo commit produz builds
      diferentes em Windows e macOS.

   **Registo:** tabela **Ambiente local** em `docs/PRD.md` §Stack (a E1 propaga-a para
   `.ai/guidelines/00-projeto.md`) · divergencia dev↔producao em `docs/DECISIONS.md` · paths,
   portas e versoes exactas na memoria do Brain (Fase 6.4) — **nunca no `PROGRESSO.md`**.

**Jogos:** movel → **Unity 6** e a via da casa (as skills `unity-*` entram quando disponiveis na
instalacao — verifica `memory/SKILL_INDEX.json`; sem elas, a execucao trata o Unity como stack
manual documentada em `docs/DECISIONS.md`). Jogo **web** → conversa: Next.js+canvas/Phaser vs Unity
WebGL, regista a escolha.

Regista a stack no PRD (seccao Stack) e as razoes em `docs/DECISIONS.md`. Deltas tecnicos por stack:
`$REF/stacks/`.

---

# FASE 4 — Infraestrutura

Tudo `AskUserQuestion`:

1. **Repositorio GitHub** — propoe o nome derivado do projecto (kebab-case) e **verifica primeiro**:
   `gh repo view <owner>/<nome> 2>/dev/null` — se ja existir, pergunta se e para usar esse (e entao
   a execucao liga em vez de criar) ou outro nome. Visibilidade: publico · privado (avisa: rulesets
   em privado exigem plano Pro/Team) · org ou pessoal.
2. **Base de dados** — confirma a da Fase 3 em contexto de infra (onde vive: local · cPanel ·
   VPS/Ploi) e o cliente de gestao: **phpMyAdmin** (default da casa) · TablePlus/DBeaver · so CLI.
   Regista em `docs/DECISIONS.md`; nao entra no scaffold.
3. **Deploy** — **cPanel** (skill `deploy-cpanel`) · **Ploi** (`deploy-ploi`) · Vercel (so Next) ·
   Docker/VPS (`deploy-docker`/`deploy-vps`) · decidir depois. **Nao se configura no /start** —
   regista-se, e a execucao fecha na fase final ⛔.

---

# FASE 5 — Design

**5.1 — Ja existe alguma coisa?** (`AskUserQuestion`):

| Opcao | O que acontece |
|---|---|
| **Sim — marca/manual/Figma/site** | Pergunta **o que e onde**. Pede o artefacto (ficheiro, URL, export). Os tokens **extraem-se e medem-se** dele na execucao — nunca se inventam. Regista a fonte em `docs/DESIGN.md` |
| **Sim — mas so referencias/gostos** | Pede os links. Extraem-se principios, nunca se copia |
| **Nao — quero escolher agora** | **Pagina de direccoes** (5.2) |
| **Nao — explorar na execucao** | Regista "exploracao livre"; a execucao corre `design-shotgun` a fundo |

**5.2 — A pagina de direccoes de design (HTML local interactivo).**

Nao e um questionario de texto — e uma pagina que **mostra** as direccoes:

1. Le o template `$REF/design-direcoes.html`.
2. **Personaliza-o com o que ja sabes**: substitui o token `{{PROJETO}}` pelo nome, e ajusta as
   direccoes ao produto (um SaaS de gestao nao mostra a direccao "playful arcade" em primeiro; um
   jogo mostra). Podes editar/trocar paletas e pares tipograficos dentro da estrutura existente —
   **nao reconstruas a pagina**.
3. Grava-a **dentro do projecto** em `docs/design-direcoes.html` (`test -f` antes; se existir,
   `design-direcoes-v2.html`), com `<!doctype html><meta charset="utf-8">` a abrir — o template
   nao traz `<head>` — e abre-a no browser: `open docs/design-direcoes.html`. **Publicar como
   `Artifact` so se o utilizador o pedir** (`soul.md`, Hard Limits).
4. O utilizador **ve e selecciona** na pagina: direccao geral, par tipografico, paleta, forma,
   densidade, e acrescenta links de referencia. No fim carrega em **"Gerar resumo"** e a pagina
   produz um bloco de texto para copiar.
5. Ele cola o bloco de volta no chat. Tu interpreta-lo e escreves `docs/DESIGN.md` com as escolhas
   — que a execucao transforma em tokens medidos e componentes.

**Se o produto for frontend-first (Website na 1.0):** a escolha aqui e uma **direccao**, nao o
design final — regista no `DESIGN.md` que a execucao deve abrir o leque (`design-shotgun` com
variantes dentro da direccao escolhida).

---

# FASE 6 — Gravar e engatar

1. **Completar `docs/PRD.md`** — stack e design ja decididos; tira os `<pendente>`. Identidade sem
   app/site → PRD so com o nucleo (S1) e a fonte da 5.1. So Marketing → sem PRD: o nucleo vai para
   o `marca.md` (6.6).
2. **`docs/DECISIONS.md`** — stack e razoes · BD e cliente · deploy · fora-da-casa se houver.
   Formato, numeração e revogação de cada entrada: `Read(".claude/reference/adr-formato.md")`.
3. **`PROGRESSO.md`** na raiz, no formato `$REF/progresso-formato.md` — **este ficheiro e a memoria
   PARTILHADA do projecto**: vai no git, qualquer pessoa que clone ve o estado. (A memoria do Brain
   e individual por utilizador; o PROGRESSO.md e a versao publica — as duas apontam uma para a
   outra, nunca duplicam conteudo.) Tipo que nao seja so Aplicacao → secção `## Workflows` antes
   de `## Fases` (formato em `$REF/progresso-formato.md`): uma linha por workflow, pela ordem
   branding → website/app → marketing, com «Comeca quando» (marketing: `W7 feito` com website, senao `E4 feito`). A linha de marketing leva **so**
   `marketeer: slug=<slug>` — o estado vive no `estado.json`, e a RAIZ (caminho da maquina) **nunca**
   entra no `PROGRESSO.md`. O que cada workflow entrega ao seguinte: `$REF/workflows-encadeamento.md`.
4. **Memoria do Brain** — pasta `memory/projects/<nome>/` (`<nome>` = `normalizeSlug(basename(pwd))`).
   Projecto novo → cria `index.md` (frontmatter `name: <nome>` = pasta · `description` · `type: project` ·
   `directorio_win`/`directorio_mac` · `directorio_estado`; corpo ≤40 linhas: estado global "entrevista
   feita, execucao por comecar" + §Ficheiros + §Areas) · `pastas.md` (caminhos do levantamento) ·
   `config.md` · `geral.md` (stack e o ponteiro `**Fase de arranque:** ver PROGRESSO.md`). Areas so
   quando houver trabalho. Ja existe → actualiza-a: le so o `index.md`, grava so na area da tarefa +
   as suas ≤3 linhas no index; area nova = `<area>.md` + linha em §Ficheiros + bloco em §Areas; nunca
   escreve no `arquivo.md` (arquivar so quando o utilizador diz que acabou). Nome parecido sem
   igualdade → formulario, nunca o mais parecido. (Sai de graca do levantamento, sem perguntas.) A linha
   `**Maquina:** <SO> · <ambiente> · PHP <v> · Node <v> · BD local <motor> · dev em <URL> · portas
   reservadas <lista>` vai para o `config.md` — **e aqui que vivem os paths e as portas**, porque o
   `PROGRESSO.md` os proibe. Segunda maquina = segunda linha, nao substituicao. Com Marketing, o
   frontmatter do `index.md` ganha `marketeer_raiz: <RAIZ>` e `marketeer_slug: <slug>` (6.6) — a RAIZ
   e desta maquina; na outra, o `raiz.mjs` manda e o campo actualiza-se.
5. **Resumo final** ao utilizador: o que ficou decidido e o que o primeiro workflow vai fazer. **O
   avanco e assumido** — nao perguntes se ele quer continuar. O unico gate e um `AskUserQuestion` de
   duas opcoes, com a primeira em recomendado:
   > **Avanço para o próximo workflow: <nome>?**
   > 1. **Sim, avancar** (recomendado) — Aplicacao: `executar-projeto` a partir da E1 · Website: W1
   >    da pipeline **Website** · Identidade: B1 da pipeline **Identidade/branding** · Marketing: `/marketeer <marca>`
   > 2. **Nao — so queria o plano** — fica tudo em `docs/` + `PROGRESSO.md` (+ dossier na RAIZ)
   Sem resposta util, a via 1 e a que vale. `<nome>` = 1.a linha por fazer de `## Workflows`.
6. **Passagem ao `/marketeer`** (so com Marketing; **o pack nao se toca** — so se correm os scripts dele):
   ```bash
   MKT="<JOCA_ROOT>/JOCA_Brain/.claude/marketeer"; ls "$MKT/scripts"
   test -d "$MKT/node_modules" || npm --prefix "$MKT" ci          # o criar-dossier precisa do yaml
   node "$MKT/scripts/raiz.mjs"     # 0 → a linha e a RAIZ · 2 → AskUserQuestion «Onde guardo os dados das
                                    # marcas?» (~/Marketeer recomendado) + raiz.mjs --definir "<pasta>" · 1 → mostra e para
   node "$MKT/scripts/criar-dossier.mjs" --slug - <<'NOME'
   <nome da marca>
   NOME
   ls "<RAIZ>/clientes"             # slug parecido → AskUserQuestion «E esta marca?» (parecidas / Marca nova / Nao sei)
   MARKETEER_RAIZ="<RAIZ>" node "$MKT/scripts/criar-dossier.mjs" "<RAIZ>" <<'JSON'
   {"nome": "<nome>", "site": "<url da 1.3>"}
   JSON
   ```
   `criar-dossier`: 0 criado · 2 ja existe (le-o e segue, nao reescreve) · 1 → mostra o `✗` e para.
   URL nao respondido → o campo `site` fica fora do JSON. Depois o **`marca.md`** em
   `<RAIZ>/clientes/<slug>/` (`test -f` antes; existe → nao se toca, so se diz), com as 9 secções do
   `CONTRATO.md` §2, **nomes exactos com acentos**, por esta ordem: `## Negócio` (problema/1-2 frases da 1.2) · `## Ofertas` ·
   `## Público` (1.2 #2) · `## Zona` · `## Concorrentes` · `## Voz` · `## Identidade visual` (caminho
   do `docs/BRAND.md`/`docs/DESIGN.md` ou da fonte da 5.1) · `## Objetivos e orçamento` · `## Restrições`
   («O que NAO e» da 1.2). As 4 preenchidas levam `[fonte: operador (entrevista /start), AAAA-MM-DD]`;
   as outras ficam `<sem fonte>`. Em `## Objetivos e orçamento` escreve **so** o que a 1.3 perguntou,
   com os rotulos exactos da F0 do `marketeer` (`- Objetivo de negócio:` · `- Prazo:` · `- Aprovador:`)
   e **omite** orcamento, valor de um cliente e resposta aos leads — linha `<sem fonte>` conta como
   respondida e a F0 deixava de perguntar. Fecha com a prova e grava RAIZ+slug na memoria (6.4):
   ```bash
   MARKETEER_RAIZ="<RAIZ>" node "$MKT/scripts/estado.mjs" ler <slug>   # cria o estado com F0 pendente
   ```
   Saida != 0 → mostra o `✗` e para. A F0 do `/marketeer` corre a seguir e so pergunta orcamento,
   valor de um cliente e quem responde aos leads.

## Proximo passo (chain)

- Confirmado → o **primeiro workflow** de `## Workflows`: **`executar-projeto`** (Aplicacao) · pipeline
  **Website** ou **Identidade/branding** pelo auto-runner (`rules/pipelines.md`) · **`marketeer`**.
  Passagem entre workflows = 1 gate Sim/Nao «Avanço para o próximo workflow: <nome>?»; dentro de cada um, chain automatico.
- So queria o plano → fica tudo em `docs/` + `PROGRESSO.md`; a execucao corre quando ele quiser.
- Backlog a organizar antes → `planear-ondas` depois de a execucao abrir os issues.
