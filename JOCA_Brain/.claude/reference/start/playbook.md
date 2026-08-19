# Playbook de arranque de projeto

**Contexto:** produto próprio · Laravel/Livewire · Next.js · Flutter · GitHub Issues · design feito com Claude
**Versão:** 2.0 — agosto de 2026 (portado para o JOCA: multi-stack, formulários interactivos, mockup como Artifact)

---

## O que este documento é

O método para arrancar **qualquer projeto novo**, desde a ideia até ao primeiro ciclo de desenvolvimento a rolar. Seis fases, ~1 a 2 semanas para um produto pequeno.

A regra que sustenta a sequência: **cada fase produz o input da seguinte.** Os fluxos revelam as entidades; o esqueleto técnico permite materializar o sistema visual; os ecrãs mostram que campos o modelo de dados precisa mesmo de ter.

## Como executar isto com o Claude Code

Não sigas o documento à mão. Copia o pacote para o projeto e corre:

```
/start
```

A skill lê o `PROGRESSO.md`, **confirma cada fase pelo critério de saída com um comando** (uma fase marcada como feita que não passe o critério é tratada como por fazer), determina em que fase estás, conduz-te por ela uma pergunta de cada vez, e **verifica os critérios de saída com comandos antes de deixar avançar**. Se retomares daqui a duas semanas, ela sabe onde ficaste.

### As três camadas — e o que cada uma garante

Vale a pena perceber o que cada mecanismo faz mesmo, porque só um deles garante alguma coisa:

| Camada | Mecanismo | O que faz |
|---|---|---|
| **Contexto** | `.ai/guidelines/`, `.claude/rules/`, `docs/` | *Inclina.* O Claude lê e tende a seguir — mas é contexto, não configuração. Sem garantias |
| **Orquestração** | `/start` + `PROGRESSO.md` | *Verifica.* Corre comandos e confirma critérios antes de avançar |
| **Enforcement** | hooks, CI, rulesets | *Impede.* Executa independentemente do que o Claude decida |

**A resposta honesta a "como garanto que é tudo feito como deve ser":** o `CLAUDE.md` não garante nada — é uma mensagem no contexto, não uma regra aplicada. O que garante é a terceira camada. Por isso o pacote traz hooks (`.claude/hooks/`), o CI bloqueia merges, e o ruleset bloqueia pushes.

Regra para decidir onde pôr cada coisa: **se o custo de ser ignorado for alto, não é contexto — é hook, CI ou ruleset.**

---

## Vista geral

| Fase | O que produz | Duração |
|---|---|---|
| **A — Enquadramento** | `PRODUTO.md` — o problema e as fronteiras | 2–3 h |
| **B — Fluxos** | Percursos do utilizador, lista de ecrãs e entidades | 3–4 h |
| **C — Esqueleto técnico** | Repo a correr, Boost, CI, issues configurados | 1 dia |
| **D — Sistema visual** | `DESIGN.md` + tokens + componentes base | 1 dia |
| **E — Ecrãs** | Mockups HTML/Tailwind revistos | 2–3 dias |
| **F — Arquitetura** | `ARCHITECTURE.md` + migrações | 1 dia |

> **Nota sobre a ordem.** O esqueleto técnico vem **antes** do design porque a Fase D configura tokens no Tailwind e cria componentes Blade — precisa do projeto a existir. E as migrações vêm **depois** dos ecrãs, porque são os ecrãs que revelam que campos são mesmo necessários.

---

# FASE A — Enquadramento

## Objetivo
Escrever o que o produto é, e sobretudo o que **não** é.

## Como fazer
Sessão com o Claude a produzir `docs/PRODUTO.md` (template no pacote). A skill `product-management:brainstorm` serve bem como ponto de partida.

## Benefício
A secção **"O que NÃO é" é a mais valiosa do documento inteiro**. Em produto próprio não há cliente a fechar o âmbito, e o âmbito cresce sozinho — cada boa ideia parece pequena isoladamente. Escrever as fronteiras no dia 1 dá-te algo a que voltar quando, no mês 3, aparecer a quarta boa ideia.

O `PRODUTO.md` é também o documento que o Claude lê para perceber o que estás a construir. Sem ele, cada sessão parte do zero.

## Feito quando
Consegues explicar o produto em duas frases, e a lista do "não é" tem pelo menos cinco pontos.

---

# FASE B — Fluxos

## Objetivo
Descrever os percursos principais do utilizador, em texto, antes de haver qualquer pixel.

## Como fazer
Para cada percurso essencial (tipicamente 3 a 6):

```markdown
## Fluxo: <nome>

**Quem:** <o utilizador>
**Quer:** <o objetivo dele>

1. Chega a <onde> vindo de <onde>
2. Vê <o quê>
3. Faz <ação>
4. O sistema <resposta>
5. Termina com <resultado>

**Correu mal:** <o que pode falhar, e o que acontece então>
```

Depois extrair duas listas, para `docs/PRODUTO.md`:
- **Ecrãs** necessários para suportar os fluxos
- **Entidades** que aparecem nos fluxos

## Benefício
Escrever fluxos em texto é a coisa mais barata que podes fazer e a que mais desperdício evita. Um fluxo mal pensado custa 20 minutos a corrigir aqui; custa três dias depois de haver ecrãs desenhados e tabelas criadas.

Resolve também o problema do ovo e da galinha entre design e arquitetura: **os fluxos são o antepassado comum dos dois.**

## Feito quando
Existem 3–6 fluxos escritos, e deles saiu uma lista de ecrãs e uma de entidades.

---

# FASE C — Esqueleto técnico

## C1 — Criar o projeto

O installer, se ainda não estiver instalado:

```bash
composer global require laravel/installer
```

Depois:

```bash
laravel new <projeto>
```

Escolher o starter kit conforme a stack de frontend:

| Starter kit | Stack |
|---|---|
| Livewire | Livewire 4 + Flux UI |
| React | React 19 + Inertia 3 + shadcn/ui |
| Vue | Vue 3 + Inertia 3 + shadcn-vue |
| Svelte | Svelte 5 + Inertia 3 + shadcn-svelte |

Todos trazem autenticação, **Tailwind 4**, Pint, Larastan (com `phpstan.neon`) e um workflow de CI de base.

Laravel 13 (março de 2026) suporta PHP 8.3–8.5.

## C2 — Laravel Boost

```bash
composer require laravel/boost --dev
php artisan boost:install
```

**É o passo com maior retorno de todo o playbook.** Dá ao Claude dez ferramentas MCP: ler o schema da base de dados, os modelos Eloquent, os logs da aplicação e do browser, o último erro, executar queries, e pesquisa semântica na documentação do Laravel.

O Boost traz também skills próprias (Pest, Tailwind, convenções) e usa `.ai/skills/` para skills personalizadas. Depois do install, correr `/context` e ver que skills ficaram disponíveis — se alguma cobrir o mesmo que as do pacote, escolher uma e apagar a outra em vez de manter as duas.

**Onde escrever o vosso contexto:** ver a secção "Estrutura de contexto" a seguir. Em resumo: nunca no `CLAUDE.md`, sempre em `.ai/guidelines/`.

## C3 — Testes e CI

Pest 5 exige PHP 8.4+ e PHPUnit 13, enquanto os starter kits vêm com PHPUnit 12 e `"php": "^8.3"`. **A instalação simples falha.** A sequência que resolve:

```bash
# 1. subir a constraint de PHP no composer.json para "^8.4"

# 2. substituir o PHPUnit do starter kit pelo Pest
composer remove phpunit/phpunit --dev
composer require pestphp/pest --dev -W
./vendor/bin/pest --init
```

O Pint e o Larastan **já vêm no starter kit** — não os voltar a instalar.

**O workflow de CI:** o starter kit já traz `.github/workflows/tests.yml`, que corre em PHP 8.3 e vai partir assim que o Pest 5 entrar. Substituir esse ficheiro pelo `ci.yml` do pacote — **apagar o do starter kit**, não deixar os dois.

> **Test impact analysis** (só voltar a correr os testes afetados) existe no Pest 5 mas é opt-in: exige `--tia` e um driver de cobertura instalado. Vale a pena quando a suite crescer; não é preciso no dia 1.

## C3b — Estrutura de contexto

**Sim, tens `CLAUDE.md`** — e é lido em todas as sessões. O que não podes é escrevê-lo à mão, porque o Boost regenera-o. A solução é o mecanismo do próprio Boost.

| Ficheiro | Quem escreve | Vai ao git? | Para quê |
|---|---|---|---|
| `CLAUDE.md`, `AGENTS.md` | **Boost** (gerado) | não | Onde o Boost junta tudo. Ler sim, **editar nunca** |
| `.ai/guidelines/*.md` | **tu, à mão** | **sim** | O teu contexto. O Boost inclui-o no `CLAUDE.md` que gera |
| `.claude/rules/*.md` | **tu, à mão** | **sim** | Regras que só carregam ao ler certos ficheiros |
| `.ai/rules/` | só a ferramenta `record-rule` | **sim** | Regras que o Claude regista durante o trabalho |
| `docs/*.md` | tu | **sim** | Documentos longos, lidos a pedido |

**A peça que faltava:** ficheiros `.md` ou `.blade.php` colocados em `.ai/guidelines/` são **automaticamente incluídos** nas guidelines do Boost sempre que se corre `boost:install` ou `boost:update`. O teu conteúdo sobrevive à regeneração porque é a fonte dela.

> **`.ai/rules/` vs `.claude/rules/` — qual usar.** Parecem sobrepor-se; a divisão prática é a autoria. As regras que **tu** escreves vão para `.claude/rules/`, porque o Claude Code as carrega nativamente. A pasta `.ai/rules/` é do Boost e só deve ser escrita pela ferramenta `record-rule` — um ficheiro lá colocado à mão **não é descoberto** até o índice ser regenerado.

Copiar do pacote:

```
.ai/guidelines/00-projeto.md            → o que é, comandos, convenções, nunca fazer
.ai/guidelines/10-fluxo-de-trabalho.md  → branch, issue, testes, PR
.claude/rules/interface.md              → carrega ao editar views e CSS
.claude/rules/base-de-dados.md          → carrega ao editar migrações e modelos
```

**Porquê `.claude/rules/` com `paths:`** — o `CLAUDE.md` é lido inteiro em todas as sessões e come contexto. Regras de interface só interessam quando se mexe em views; regras de base de dados só quando se mexe em migrações. Com `paths:` no frontmatter, carregam apenas nesses momentos. Mantém o contexto permanente pequeno, que é o que faz o Claude segui-lo melhor.

> ⚠️ **Limitação a conhecer:** regras com `paths:` carregam quando o Claude **lê** um ficheiro que corresponde ao padrão — não a cada operação. Ao criar um ecrã de raiz, sem ler nenhuma view antes, a regra pode não estar em contexto. E não são reinjetadas depois de um `/compact`.
>
> Por isso as regras que **têm mesmo de valer sempre** ficam em `.ai/guidelines/` (contexto permanente) ou, se o custo de serem ignoradas for alto, num hook.

> **Regra prática de tamanho:** o contexto sempre-presente (guidelines + rules sem `paths`) deve ficar abaixo de ~200 linhas. Acima disso, a adesão cai. Detalhe longo vai para `docs/` e é referenciado, não colado.

**Verificar depois do `boost:install`:** abrir o `CLAUDE.md` gerado e confirmar que o conteúdo de `.ai/guidelines/` lá está. Dentro do Claude Code, `/context` mostra que ficheiros de memória foram mesmo carregados.

## C4 — GitHub Issues

```bash
gh label create "tipo: funcionalidade" --color 0052CC
gh label create "tipo: bug"           --color D93F0B
gh label create "tipo: técnico"       --color 5319E7
gh label create "área: design"        --color FBCA04
gh label create "prioridade: agora"   --color B60205
gh label create "bloqueado"           --color 000000
```

Copiar `.github/ISSUE_TEMPLATE/` do pacote. Criar um GitHub Project (board) ligado ao repositório.

Proteger a `main` em **Settings → Rules → Rulesets**: exigir PR, 1 aprovação e CI verde.

> Rulesets em repositório **privado** exigem plano Pro ou Team. Em privado + Free não estão disponíveis, e a regra de merge passa a depender de disciplina.

## C5 — Deploy

Com o Ploi: criar servidor e site, ligar o repositório, ativar o quick deploy. Ambiente de staging antes de produção, se o projeto o justificar.

## Benefício desta fase
Feita agora e não no fim, esta fase dá às fases de design um sítio real onde materializar decisões — tokens no `app.css`, componentes em `resources/views/components/`. E o Boost, instalado antes do design, faz com que o Claude conheça o projeto desde a primeira conversa sobre interface.

## Feito quando
`php artisan serve` corre, `./vendor/bin/pest` passa, o CI está verde num PR de teste, e as labels e templates existem.

---

# FASE D — Sistema visual

> **A fase que não se salta.** Ler o aviso no fim antes de decidir saltá-la.

## Objetivo
Definir as restrições visuais **antes** de desenhar qualquer ecrã.

## Como fazer

**1. Decidir as poucas coisas que são realmente tuas.** Escolhe deliberadamente — não deixes ao Claude:
- Uma família tipográfica e uma escala
- Uma cor de marca e uma neutra
- Um raio de cantos e uma densidade (compacto vs. espaçoso)

São quatro decisões. É aqui que vive praticamente toda a identidade do produto.

**2. Escrever `docs/DESIGN.md`** com essas decisões e as regras de uso (template no pacote).

**3. Declarar os tokens.** Tailwind 4 configura-se em CSS, não em `tailwind.config.js`. No `resources/css/app.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #eef2ff;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;

  --font-sans: "Inter", sans-serif;
  --radius-card: 0.75rem;
}
```

**4. Criar os componentes base** em `resources/views/components/` — botão, input, card, badge, tabela, modal, estado vazio, alerta. Seis a dez chegam.

**5. Criar uma página que mostre todos os componentes juntos**, em `/design` (só em ambiente local). É onde se vê se o sistema é coerente.

## Benefício
Este é o `CLAUDE.md` do design, e o argumento é exatamente o mesmo.

Sem sistema definido, cada ecrã que o Claude gera é bonito isoladamente e **incoerente em conjunto** — três tons de azul, quatro tamanhos de botão, espaçamentos que não conversam. Cada ecrã parece bem quando o revês sozinho; só ao fim de dez é que se percebe que o produto parece feito por cinco pessoas diferentes. Nessa altura, corrigir é refazer.

Com o sistema definido, o Claude compõe dentro de restrições — que é exatamente onde ele é forte.

## Feito quando
Existe `DESIGN.md`, os tokens estão no `app.css`, os componentes existem, e a página `/design` mostra-os juntos.

---

# FASE E — Ecrãs

## Objetivo
Desenhar os ecrãs da primeira versão, iterando depressa.

## Como fazer
Para cada ecrã, com a skill `/preparar-design`:

1. O Claude gera um **mockup HTML+Tailwind 4 estático**, usando os tokens definidos.
2. Abres no browser e vês. Iteras em conversa — "a densidade está errada", "falta o estado vazio".
3. Aprovado, fica em `docs/mockups/<ecra>.html`, commitado.
4. Esse ficheiro passa a ser **a referência** para a implementação em Blade.

Pedir sempre os quatro estados, não só o ecrã feliz: **vazio, a carregar, erro, e com muitos dados**.

## Benefício
A vantagem grande de o design ser feito pelo Claude e não em Figma: **o artefacto de design já é código**. Não há handoff, não há tradução, não há "o dev implementou diferente do design". O mockup usa os mesmos tokens Tailwind que a aplicação usa.

O ciclo de iteração também é outro: mudar a densidade de uma tabela é uma frase, não trinta minutos de trabalho manual.

## Onde isto falha — e é importante
**O Claude produz design competente e convencional, não distintivo.** Layouts limpos, hierarquia correta, espaçamento sensato. Não produz uma identidade visual que faça alguém parar. Para produto próprio que compita pelo aspeto, é uma limitação real.

A mitigação é a Fase D: **investe a diferenciação nas quatro decisões do sistema** — tipografia, cor, forma, densidade — e deixa a composição dos ecrãs ao Claude. É aí que a relação esforço/resultado é melhor.

Não uses os mockups como componentes finais. São referência; a implementação em Blade faz-se a sério, com os componentes reais.

## Feito quando
Os ecrãs da primeira versão têm mockup aprovado, incluindo estados vazios e de erro.

---

# FASE F — Arquitetura

## Objetivo
Definir o modelo de dados e a estrutura, com os ecrãs já conhecidos.

## Como fazer

**1. Modelo de dados.** As entidades saíram da Fase B; os ecrãs da Fase E mostram que campos são mesmo precisos. Escrever as migrações — são o artefacto de design, não apenas código.

**2. `docs/ARCHITECTURE.md`:** módulos e fronteiras, packages escolhidos e porquê, integrações externas, o que fica fora do Laravel padrão.

**3. `docs/DECISIONS.md`:** as decisões estruturantes, com alternativas descartadas. Duas ou três linhas cada.

## Benefício
Fazer o modelo de dados **depois** dos ecrãs evita o erro clássico de modelar em abstrato: tabelas elegantes que não suportam o que o ecrã precisa de mostrar, ou campos criados "por precaução" que nunca são usados.

O `DECISIONS.md` responde à pergunta que o código nunca responde: *porque é que isto está assim?* Daqui a seis meses, é a diferença entre confiar numa decisão antiga e refazê-la por não a perceber.

## Feito quando
Migrações escritas e a correr, `ARCHITECTURE.md` e `DECISIONS.md` commitados.

---

# O ciclo, depois do arranque

```
ideia
  │
  ▼
/novo-issue ──► issue no GitHub com critérios de aceitação
  │
  ├─ precisa de ecrã novo? ──► /preparar-design ──► mockup aprovado, ligado ao issue
  │
  ▼
git checkout -b <tipo>/<nº>-<descricao>
  │
  ▼
implementar com Claude (Boost dá-lhe schema, modelos, logs, docs)
  │
  ▼
/escrever-testes <nº>   ← sessão separada, a partir dos critérios
  │
  ▼
git push -u origin <branch>  ──►  PR com "Closes #<nº>"
  │
  ▼
CI (Pint · Larastan · Pest) ──► revisor ──► revisão humana ──► merge
                                                                 │
                                                                 ▼
                                                    o issue fecha sozinho
```

**Convenção de branch:** `feat/12-exportar-relatorio`, `fix/34-erro-no-login`, `chore/56-atualizar-deps`.

**Fechar o issue:** escrever `Closes #12` na descrição do PR. Nativo do GitHub, sem integração para configurar.

---

# As cinco regras

1. **A Fase D antes da Fase E.** Sistema visual antes de ecrãs, sempre.
2. **Nenhum issue entra em implementação sem critérios de aceitação verificáveis.**
3. **Quem implementou não escreve os testes na mesma sessão.** Testes escritos a seguir ao código verificam o código, não o requisito — passam sempre e não provam nada.
4. **Nenhum PR faz merge sem CI verde e uma aprovação.**
5. **Uma decisão estruturante que não fica no `DECISIONS.md` perde-se.**

---

# O que isto custa

- **1 a 2 semanas de arranque** antes da primeira linha de funcionalidade. Parece muito; é menos do que refazer o modelo de dados no mês 2.
- **Disciplina nas fases A, B e D**, que são as que menos parecem trabalho e mais determinam o resultado.
- **Tokens.** Design iterativo e implementação assistida consomem bastante.
- **Uma limitação assumida:** o design será competente, não distintivo (ver Fase E).

**Onde não compensa:** protótipos descartáveis e provas de conceito. O playbook paga-se em produto que vai ser mantido.

---

# Checklist

```
FASE A — Enquadramento
[ ] docs/PRODUTO.md, com "o que NÃO é" (5+ pontos)

FASE B — Fluxos
[ ] 3-6 fluxos escritos
[ ] Lista de ecrãs + lista de entidades

FASE C — Esqueleto técnico
[ ] laravel new + starter kit escolhido
[ ] Laravel Boost instalado; verificado o que gerou
[ ] .ai/guidelines/ preenchido e incluído no CLAUDE.md gerado
[ ] .claude/rules/ copiado; hooks copiados e executáveis
[ ] CLAUDE.md, .mcp.json e boost.json no .gitignore
[ ] PHP ^8.4 no composer.json; PHPUnit removido; Pest 5 instalado
[ ] tests.yml do starter kit apagado; ci.yml do pacote no lugar
[ ] CI verde num PR de teste
[ ] Labels, issue templates e Project criados
[ ] Ruleset a proteger a main
[ ] Deploy configurado (Ploi)

FASE D — Sistema visual
[ ] Tipografia, cor, forma e densidade decididas
[ ] docs/DESIGN.md
[ ] Tokens em @theme no app.css
[ ] Componentes base + página /design

FASE E — Ecrãs
[ ] Mockup por ecrã, com os quatro estados
[ ] Commitados em docs/mockups/

FASE F — Arquitetura
[ ] Migrações escritas e a correr
[ ] docs/ARCHITECTURE.md
[ ] docs/DECISIONS.md
[ ] Issues da primeira versão abertos
```

---

## Ficheiros do pacote

```
ORQUESTRAÇÃO
.claude/skills/start/  → /start — conduz e verifica as 6 fases

CONTEXTO (lido pelo Claude em todas as sessões)
.ai/guidelines/00-projeto.md            → o Boost inclui isto no CLAUDE.md gerado
.ai/guidelines/10-fluxo-de-trabalho.md  → idem
.claude/rules/interface.md              → carrega só ao editar views/CSS
.claude/rules/base-de-dados.md          → carrega só ao editar migrações/modelos

ENFORCEMENT (executa independentemente do Claude)
.claude/settings.json             → liga os hooks
.claude/hooks/proteger-main.sh    → bloqueia commit/push na main
.claude/hooks/avisar-design.sh    → avisa se se editam views sem DESIGN.md
.github/workflows/ci.yml          → Fase C3 (substitui o tests.yml do starter kit)

DOCUMENTOS (lidos a pedido)
docs/PRODUTO.md               → Fase A (template)
docs/DESIGN.md                → Fase D (template)
docs/ARCHITECTURE.md          → Fase F (template)
docs/DECISIONS.md             → Fase F (template)
docs/mockups/                 → Fase E (destino dos mockups)
REVIEW.md                     → critérios de revisão

TRABALHO DIÁRIO
.claude/skills/novo-issue/        → criar issues no GitHub
.claude/skills/preparar-design/     → mockups na Fase E
.claude/skills/escrever-testes/   → testes a partir dos critérios
.claude/agents/revisor.md         → revisão antes do PR
.github/ISSUE_TEMPLATE/*.yml      → Fase C4
```

Mais o `PROGRESSO.md`, que a skill `/start` cria na raiz e mantém atualizado. Commitar também.

**Instalar:**

```bash
# copiar o pacote para a raiz do repositório, depois:
chmod +x .claude/hooks/*.sh
printf 'CLAUDE.md\nAGENTS.md\n.mcp.json\nboost.json\n' >> .gitignore
git add -A && git commit -m "chore: método de trabalho e contexto do projeto"
```

Ao abrir o Claude Code no projeto pela primeira vez, **aceitar o diálogo de confiança da pasta** — sem isso os hooks de `.claude/settings.json` não correm, e a camada de enforcement fica inativa sem aviso.

Depois é só: `/start`.

## Referências

- [Laravel 13 — releases](https://laravel.com/docs/13.x/releases)
- [Laravel — Starter Kits](https://laravel.com/starter-kits)
- [Laravel Boost](https://laravel.com/docs/13.x/boost)
- [Claude Code — memória e CLAUDE.md](https://code.claude.com/docs/en/memory)
- [Claude Code — hooks](https://code.claude.com/docs/en/hooks)
- [Pest — instalação](https://pestphp.com/docs/installation)
- [Tailwind 4 — tema e tokens](https://tailwindcss.com/docs/theme)
- [Larastan](https://github.com/larastan/larastan)
- [GitHub — issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [GitHub — rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
