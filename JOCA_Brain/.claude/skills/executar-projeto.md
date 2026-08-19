---
name: executar-projeto
description: "A execucao do /start: constroi o projecto do PRD ate producao — fundacao (scaffold, repo, CI, hooks), design por uma de duas vias (Claude Design externo com conversao para o stack, ou design directo no stack com design-shotgun), ponto de situacao, e desenvolvimento final em ondas com loops implementar/testar usando as skills e agentes do JOCA. MUST be invoked when the user says: executar projeto, /executar-projeto, avanca para a execucao, constroi o projecto, executa o plano do start. SHOULD also invoke when: comeca a construir, scaffold do projecto, fase de execucao, desenvolve a plataforma toda."
triggers: executar projeto, executar-projeto, avanca para a execucao, constroi o projecto, executa o plano do start, comeca a construir, scaffold do projecto, fase de execucao, desenvolve a plataforma
chain: planear-ondas, preparar-design, deploy-executor
---
# Executar projeto — do PRD a producao

Consome o que o `/start` decidiu (`docs/PRD.md` · `docs/DECISIONS.md` · `docs/DESIGN.md` ·
`PROGRESSO.md`) e constroi. Quatro partes, cada uma com criterio de saida:

```
E1 Fundacao ──► E2 Design (bifurca) ──► E3 Ponto de situacao ⏸ ──► E4 Desenvolvimento final ──► producao
```

**Referencias:** `$REF` = `<JOCA_ROOT>/JOCA_Brain/.claude/reference/start/`.
**Pre-requisito:** `docs/PRD.md` existe e a stack esta decidida. Sem isso → corre `/start` primeiro.
**Nao inventes scope**: o PRD e o contrato; ideia nova a meio vira issue, nao codigo.

## A regra desta skill: usar o JOCA, nao reinventa-lo

Cada passo nomeia as skills/agentes que o executam. Antes de fazer qualquer trabalho de dominio,
`Read()` a skill correspondente (activation rule dos 60%) ou despacha o agente com brief + Step 0.
O inventario vivo esta em `memory/SKILL_INDEX.json` — em caso de duvida, procura la antes de fazer
"a mao". Mapa completo passo→skill: `$REF/execucao-mapa-skills.md`.

---

# PARTE E1 — Fundacao

Actualiza o `PROGRESSO.md` no inicio e no fim de cada passo (e a memoria partilhada — quem clonar
ve onde isto esta).

| # | Passo | Skills / agentes JOCA |
|---|---|---|
| 1 | Scaffold da stack (`$REF/stacks/<stack>.md`) | `laravel-specialist` · `frontend` (Next) · delta Flutter/Unity |
| 2 | Laravel Boost ⏸ (interactivo — o utilizador corre `boost:install`) | — |
| 3 | Testes: Pest 5 / Vitest / flutter_test + smoke test | `test-master` |
| 4 | Contexto: `$REF/templates/` → `.ai/guidelines/`, `.claude/rules/`, hooks, `revisor` | — |
| 5 | Exportar skills de trabalho: `$REF/exportar-skills.sh . <JOCA_ROOT>/JOCA_Brain` | — |
| 6 | Docs de design (esqueleto): `docs/DESIGN.md` a partir da direccao do /start | `design-system` (le, nao executa ainda) |
| 7 | CI da stack (`$REF/templates/github/workflows/ci-<stack>.yml`) + issue forms | `github` |
| 8 | Repo: `git init` → commit → `gh repo create` ⛔ (1 confirmacao) → labels | `github` |
| 9 | PR de teste → CI verde → merge → **so agora** hooks + ruleset | `github` |
| 10 | Issues da 1a versao (dos ecras/fluxos do PRD, **com "Ficheiros provaveis"**) | `novo-issue` |

**Ordens que nao se trocam:** hooks so depois do merge do PR de teste (o `proteger-main.sh` bloqueia
a `main` onde o commit inicial e feito) · `--phpunit` no `laravel new` mesmo indo usar Pest ·
⚠ os hooks so disparam apos o dialogo de confianca da pasta — na 1a sessao a regra "commit so em
branch" es tu a cumpri-la, nao a rede.

**Criterio de saida E1:** testes a passar · CI verde num PR real · labels e issues abertos ·
`PROGRESSO.md` com E1 fechado.

---

# PARTE E2 — Design (o workflow bifurca)

Primeiro, **as perguntas de design que faltem**: se o `/start` deixou "explorar na execucao" ou a
direccao veio incompleta, fecha-as agora (`AskUserQuestion`, ou a pagina de direccoes
`$REF/design-direcoes.html` se nunca foi mostrada).

Depois cria os `.md` que qualquer das vias consome:

| Documento | Skill que o produz |
|---|---|
| `docs/BRAND.md` — identidade, tom, logotipo se houver | `brand-guidelines` |
| `docs/DESIGN.md` — tokens, regras de composicao, 4 estados | `design-system` → `design-tokens` |
| `docs/ECRAS.md` — lista de ecras do PRD com proposito e estados | do PRD |

**Design existente (o /start registou a fonte):** os tokens **medem-se** do artefacto real —
`site-capture` + `getComputedStyle` num site vivo, export do Figma, `markitdown` num manual. Nunca
plausiveis. So depois se bifurca.

## A pergunta (`AskUserQuestion`)

> **Quem faz o design?**
> 1. **Claude Design** (claude.ai) — tu levas os `.md`, ele gera HTML/CSS/JS, eu converto para a stack
> 2. **Design directo** (recomendado) — eu construo o design system ja na stack real: os componentes
>    que saem sao os que o desenvolvimento usa, sem conversao

### Via 1 — Claude Design (externo)

1. **Gerar o pacote de handoff** (`$REF/claude-design-handoff.md` tem o formato): um zip/pasta com
   `BRAND.md`, `DESIGN.md`, `ECRAS.md`, `PRD.md` e um prompt pronto a colar que pede: design system
   + todos os ecras de `ECRAS.md`, **cada ecra com os 4 estados**, HTML/CSS/JS autonomo, tokens em
   custom properties.
2. ⏸ **Pausa.** O utilizador cria o design no Claude Design e poe os ficheiros exportados em
   `design/claude-design/`. Diz-lhe exactamente isso e espera.
3. **Validar o que chegou**: inventaria a pasta contra `ECRAS.md` (ecra a ecra — o que falta
   lista-se, nao se assume), e corre `validar-design` a cada ecra (tokens vs `DESIGN.md`, 4 estados,
   a11y).
4. **Converter para a stack**: `design-html` (limpeza) → componentes reais — `frontend`+`tailwind`
   (Next), `laravel-specialist`+Blade/Livewire (Laravel), tema Flutter. Os HTML originais ficam em
   `docs/mockups/` como referencia; **a conversao e re-implementacao fiel, nao copy-paste**.

### Via 2 — Design directo (no stack)

1. **Design system real**: pipeline `design-system` → `brand-guidelines` → `design-tokens` →
   `component-system`, materializada **na stack** (componentes Blade/Livewire ou React, tokens no
   `@theme`; Flutter → `ThemeData`). Pagina `/design` com todos os componentes juntos.
   Agentes: `design-system-agent`, `design-tokens-agent`; auditoria `design-system-audit`.
2. **Frontend publico (website/landing)** → **`design-shotgun`**: N variantes dentro da direccao
   escolhida no /start (nao do zero — a direccao e a restricao) → `design-review` para escolher →
   `design-html` → `frontend`. E o workflow de design do JOCA, corrido por inteiro.
3. **Ecras de aplicacao**: para cada ecra de `ECRAS.md`, `preparar-design` (mockup como Artifact,
   4 estados) → `validar-design` (porteiro) → implementar com os componentes do design system.
   Fan-out possivel: ecras com ficheiros disjuntos → `design-html-agent`/`frontend-agent` em
   paralelo (cap 3-5, briefs com Step 0).

**Criterio de saida E2:** design system a existir **na stack** (via 1 convertido, via 2 nativo) ·
pagina `/design` (web) · todos os ecras da 1a versao com mockup/implementacao validada por
`validar-design` · `DESIGN.md` fechado sem `<...>`.

---

# PARTE E3 — Ponto de situacao ⏸ (ultimo gate antes do desenvolvimento)

Apresenta, **com provas** (links/paths, nao afirmacoes):

- ✅/❌ PRD completo (`docs/PRD.md` sem pendentes)
- ✅/❌ Brand + design system (`BRAND.md`, `DESIGN.md`, pagina `/design`, componentes no stack)
- ✅/❌ Ecras desenhados e validados (lista de `ECRAS.md` vs `docs/mockups/`, um a um)
- ✅/❌ Fundacao (CI verde, hooks, issues abertos)
- ⚠ Riscos e decisoes em aberto (de `docs/DECISIONS.md`)

**Espera pela confirmacao explicita.** E o ultimo momento barato para mudar de ideias — depois disto
e desenvolvimento a fundo. Regista a confirmacao no `PROGRESSO.md`.

---

# PARTE E4 — Desenvolvimento final (ondas + loops)

O motor e o que o JOCA ja tem — esta parte **conduz**, nao reinventa:

1. **`planear-ondas`** sobre os issues abertos → milestones, `blocked-by`, `docs/ONDAS.md`. A onda 1
   e a mais curta e valida o que e caro reverter (schema, auth, URLs publicas).
2. **Por onda, o loop** (adopta o playbook `master-orchestrator` — o main loop despacha, agentes nao
   fazem spawn de agentes):

```
para cada onda:
  para cada issue (paralelo SO com "Ficheiros provaveis" disjuntos, cap 3-5):
    branch <tipo>/<n>-<desc>
    implementar  → agente de dominio (laravel-specialist-agent · frontend-agent ·
                   filament-builder · payment-integration ⛔ · auth · rest-api · mysql …)
    testar       → escrever-testes (AGENTE/SESSAO SEPARADA — nunca quem implementou)
    rever        → tester-code; endpoints → tester-api; UI → tester-ui-ux
    PR "Closes #n" → CI verde → merge (o issue fecha sozinho)
  fim da onda:
    varredura transversal (1 agente audita a juncao, nao os ambitos)
    gate de RUNTIME da onda (rules/pipelines.md — screenshot/login real/fluxo vivo,
                             nao so build verde)
    portao de validacao humana da onda (o que o planear-ondas definiu)
  PROGRESSO.md actualizado (log da onda: o que fechou, o que ficou)
```

3. **Regras do loop** (as do JOCA, nao opcionais): gate estatico minimo em cada PR (`tsc`/build/
   lint/`php -l` **+ eslint em JS**) · gate de runtime por categoria antes de fechar fase ·
   travao anti-loop (`loop_max_iterations`, 3x-sem-progresso → parar e reportar) · `git add` por
   caminho explicito com agentes vivos · custo anunciado antes de fan-outs grandes (>=6 agentes).
4. **Seguranca antes de producao**: `security-review` + `tester-security`; pagamentos → tambem
   `tester-api` aos webhooks.
5. **Logs**: `PROGRESSO.md` (estado por onda, partilhado por git) + issues/PRs fechados (historia) +
   `docs/DECISIONS.md` (porques). O utilizador — ou outro colaborador — ve o estado sem te
   perguntar.
6. **Deploy** ⛔: `deploy-executor` com a skill do alvo (`deploy-cpanel` · `deploy-ploi` · Vercel ·
   `deploy-docker`), health-check derivado do HTML publicado, matriz de URLs se houver subpasta/
   multi-idioma. 1 confirmacao antes.

**Criterio de saida E4 (= da skill):** todos os issues da 1a versao fechados por PR com CI verde ·
gates de runtime passados · security review sem Critical · deploy feito (ou entregue pronto-a-
-deployar, se o utilizador adiar) · `PROGRESSO.md` a dizer "producao" com a data.

## Proximo passo (chain)

- Backlog vivo → `planear-ondas` re-corre quando o plano deixar de reflectir a realidade.
- Ecras novos → `preparar-design` → `validar-design`.
- Publicacao → `deploy-executor` ⛔.
- No fim de cada sessao → `/save` (actualiza Brain **e** `PROGRESSO.md`).
