---
name: start
description: "O inicio de qualquer projeto. Entrevista completa por formularios interactivos — tipo de produto (website, app movel, jogo, SaaS, software), fluxos, PRD inicial, stack por camadas, infraestrutura e direccao de design (com pagina interactiva de direccoes visuais) — e termina a engatar na execucao. Absorve o /init-project: projectos existentes ligam-se ao JOCA sem questionario, com as respostas derivadas do disco. MUST be invoked when the user says: /start, novo projeto, comecar projeto, arrancar projeto, criar produto novo, iniciar projeto. SHOULD also invoke when: comecar do zero, quero construir uma app, quero fazer um site, tenho uma ideia de produto, ligar projecto ao JOCA, init project."
triggers: start, novo projeto, comecar projeto, arrancar projeto, criar produto novo, iniciar projeto, comecar do zero, quero construir uma app, quero fazer um site, tenho uma ideia, ligar projecto ao JOCA, init project
argument-hint: "[nome-do-projeto]"
chain: executar-projeto, prd
---
# /start — o inicio de qualquer projeto

Entrevista → PRD inicial → stack → infra → direccao de design → **engata na execucao**
(`executar-projeto`). Esta skill **nao executa nada**: no fim tens os documentos e as decisoes; a
skill seguinte constroi.

**Referencias:** `<JOCA_ROOT>/JOCA_Brain/.claude/reference/start/` — daqui para a frente `$REF`.

# REGRAS

1. **Formularios, nao interrogatorios.** Toda a escolha fechada usa `AskUserQuestion` — 2-4 opcoes
   concretas, `description` em cada, um **recomendado em primeiro**, `multiSelect` quando as opcoes
   nao se excluem. Texto livre so para o que e mesmo aberto.
2. **Uma decisao de cada vez.** Nunca despejes um questionario inteiro em texto.
3. **Nao pecas o que o disco responde.** A Fase 0 corre antes de qualquer pergunta.
4. **Nao pecas o que consegues propor.** Deriva sugestoes das respostas anteriores e apresenta-as
   como opcoes com um recomendado — o utilizador corrige mais depressa do que inventa.
5. **Insiste quando a resposta for vaga**, sobretudo no "o que NAO e".
6. **Nao inventes conteudo de produto.** O problema, o publico e as fronteiras sao do utilizador.

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
# memoria do Brain para esta pasta (exacta, mae e filhas)
grep -rln "$(pwd)" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null
grep -rn "^directorio" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null | grep -F "$(basename "$(pwd)")"
```

## As tres portas

| Estado da pasta | Via |
|---|---|
| **Vazia** (ou so `.git`) | Projecto novo → Fase 1 |
| **Tem `PROGRESSO.md`** | **Retoma** — le as fases, confirma cada uma pelo criterio de saida (tabela abaixo), entra na primeira por fazer. Nao repete a entrevista do que ja esta em `docs/PRD.md` |
| **Tem projecto, sem `PROGRESSO.md`** | **Ligar ao JOCA** (o antigo `/init-project`) — ver caixa |

> ### Ligar um projecto existente — sem questionario
> As perguntas do antigo `/init-project` (tipo, stack, estado) **respondem-se do disco**: o
> `composer.json`/`package.json`/`pubspec.yaml` diz a stack, o git diz o historico, o README diz o
> objectivo. Faz o levantamento, escreve/actualiza `memory/projects/<nome>.md` no Brain, cria o
> `PROGRESSO.md` com o estado real observado, e pergunta **uma** coisa so: *"o que queres fazer a
> seguir neste projecto?"*. Se ja existir memoria no Brain para a pasta (ou para a pasta-mae),
> **mostra-a primeiro** e pergunta se e actualizar, criar sub-entrada, ou guarda-chuva — nunca
> comecar como se fosse novo.

## Criterios de saida por fase (usados na retoma)

| Fase | Prova — comando, nao opiniao |
|---|---|
| S1 Produto | `docs/PRD.md` existe; seccao "O que NAO e" com >= 5 pontos |
| S2 Fluxos | 3-6 fluxos no PRD + lista de ecras + entidades + capacidades marcadas |
| S3 Stack | seccao Stack do PRD preenchida, sem `<...>` |
| S4 Infra | repo GitHub decidido (nome + visibilidade) + deploy decidido/adiado em `docs/DECISIONS.md` |
| S5 Design | direccao registada em `docs/DESIGN.md` (ou "existe em X" ou "explorar na execucao") |
| E* Execucao | ver `executar-projeto` — fases E1-E4 tem os seus criterios la |

Fase marcada como feita que **nao passa** a prova → por fazer, e diz-lo.

---

# FASE 1 — O produto

Se `$ARGUMENTS` trouxer um nome, usa-o. Senao, pede-o na primeira pergunta.

**1.1 — Tipo de produto** (`AskUserQuestion`, a primeira pergunta de todas — afunila tudo o resto):

| Opcao | Consequencias a jusante |
|---|---|
| **Website / landing** | frontend-first; design explora-se a fundo; stack Next.js ou Livewire |
| **SaaS / plataforma web** | multi-utilizador provavel; backoffice; Laravel+Livewire+Filament |
| **App movel** | Flutter + Laravel API; lojas; offline a considerar |
| **Jogo** | movel → Unity 6; web → a decidir na Fase 3 |
| **Software / ferramenta interna** | densidade compacta; menos marketing, mais dados |
| **So API / backend** | sem fase de design de ecras; contratos primeiro (`rest-api`) |

(6 opcoes nao cabem numa pergunta de 4 — divide em 2 perguntas ou usa as 4 mais provaveis + "Other".)

**1.2 — Texto livre, uma de cada vez** (aqui nao ha opcoes a propor):
1. **Nome** e, em 1-2 frases, que problema resolve.
2. **Para quem** — insiste num utilizador concreto. "Empresas" nao serve; "o responsavel de
   operacoes numa equipa de 5-20 pessoas" serve.
3. **Como e resolvido hoje**, e porque e que isso e mau.
4. **O que NAO e** — pede 5 pontos. Menos que isso: propoe candidatos a partir do que ja disse
   ("presumo que nao leve facturacao nem app movel — confirmas?") e valida-os um a um. **Nao avances
   com menos de cinco.**
5. **Primeira versao utilizavel** — a menor coisa que alguem usaria a serio.

O objectivo desta fase e o utilizador **descrever o maximo possivel** — regista tudo, mesmo o que
nao couber nas perguntas; vai para o PRD.

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
| Website / landing | **Next.js 16** (estatico/hibrido) · Laravel so se houver area reservada |
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

**5.2 — A pagina de direccoes de design (Artifact interactivo).**

Nao e um questionario de texto — e uma pagina que **mostra** as direccoes:

1. Le o template `$REF/design-direcoes.html`.
2. **Personaliza-o com o que ja sabes**: substitui o token `{{PROJETO}}` pelo nome, e ajusta as
   direccoes ao produto (um SaaS de gestao nao mostra a direccao "playful arcade" em primeiro; um
   jogo mostra). Podes editar/trocar paletas e pares tipograficos dentro da estrutura existente —
   **nao reconstruas a pagina**.
3. Publica com a ferramenta `Artifact` e da o URL.
4. O utilizador **ve e selecciona** na pagina: direccao geral, par tipografico, paleta, forma,
   densidade, e acrescenta links de referencia. No fim carrega em **"Gerar resumo"** e a pagina
   produz um bloco de texto para copiar.
5. Ele cola o bloco de volta no chat. Tu interpreta-lo e escreves `docs/DESIGN.md` com as escolhas
   — que a execucao transforma em tokens medidos e componentes.

**Se o produto for frontend-first (website/landing):** a escolha aqui e uma **direccao**, nao o
design final — regista no `DESIGN.md` que a execucao deve abrir o leque (`design-shotgun` com
variantes dentro da direccao escolhida).

---

# FASE 6 — Gravar e engatar

1. **Completar `docs/PRD.md`** — stack e design ja decididos; tira os `<pendente>`.
2. **`docs/DECISIONS.md`** — stack e razoes · BD e cliente · deploy · fora-da-casa se houver.
3. **`PROGRESSO.md`** na raiz, no formato `$REF/progresso-formato.md` — **este ficheiro e a memoria
   PARTILHADA do projecto**: vai no git, qualquer pessoa que clone ve o estado. (A memoria do Brain
   e individual por utilizador; o PROGRESSO.md e a versao publica — as duas apontam uma para a
   outra, nunca duplicam conteudo.)
4. **Memoria do Brain** — cria/actualiza `memory/projects/<nome>.md` com `directorio:`, stack,
   estado "entrevista feita, execucao por comecar" e o ponteiro `**Fase de arranque:** ver
   PROGRESSO.md`. (E isto que o `/init-project` fazia — aqui sai de graca, sem perguntas.)
5. **Resumo final** ao utilizador: o que ficou decidido, o que a execucao vai fazer, e a pergunta
   unica: **"Avanco para a execucao?"**

## Proximo passo (chain)

- Confirmado → **`executar-projeto`** (scaffold → design → gate → desenvolvimento final).
- So queria o plano → fica tudo em `docs/` + `PROGRESSO.md`; a execucao corre quando ele quiser.
- Backlog a organizar antes → `planear-ondas` depois de a execucao abrir os issues.
