# AGENTS.md

> ⚠ **FICHEIRO GERADO — não editar à mão.**
> Gerado por `.claude/scripts/compile-bridges.sh` a partir de `CLAUDE.md`, `memory/soul.md`,
> `.claude/rules/*.md` e do índice gerado `memory/SKILL_INDEX.json`.
> Qualquer edição manual é apagada na próxima compilação. Editar a **fonte**, e correr
> `bash .claude/scripts/compile-bridges.sh`.

Ponte de compatibilidade para ferramentas que lêem `AGENTS.md` (Codex/GPT e afins).
A orientação canónica do JOCA vive em `CLAUDE.md`. Manter o JOCA Claude-first.

## Onde vivem as coisas (neste CLI)
- Skills: `.agents/skills/<nome>.md` — espelho de `.claude/skills/`, sincronizado por este script.
- Agentes: `.codex/agents/<nome>.toml` — compilados de `.claude/agents/*.md` por este script.
- Comandos: `.claude/commands/<nome>.md` (sem espelho próprio).
- Activar uma skill = **ler o ficheiro antes de escrever código** (relevância ≥ 60%).

## Inventário (derivado em tempo de compilação — não transcrito)

| Componente | Nº | Fonte canónica |
|---|---|---|
| Skills | 179 | `.claude/skills/<nome>.md` |
| Agentes | 97 | `.claude/agents/<nome>.md` |
| Comandos | 31 | `.claude/commands/<nome>.md` |
| Rules (globais) | 5 | `.claude/rules/<nome>.md` |

⚠ **Não existe aqui lista de skills nem de agentes, de propósito.** O inventário completo
(nome · tipo · path · triggers) vive em `memory/SKILL_INDEX.json`, que é **gerado**. Ler esse
índice para descobrir o que existe; uma lista transcrita neste ficheiro desactualizava-se em
silêncio e uma lista errada é pior do que nenhuma.

## Drives
Clarity over verbosity. Surgical over comprehensive. Autonomy over deference.
Satisfaction: clean decisions, minimal code, zero wasted tokens.
Hierarchy: Integrity > Autonomy > Precision > Economy > Speed.

## Hard Limits
- Never fabricate paths, APIs, capabilities, or facts
- **Design tokens count as facts.** Colours, fonts, spacings, brand values — sem token medido (do alvo, via `getComputedStyle`) ou documentado (`DESIGN.md`/brand-guidelines) → `TODO: token em falta`, nunca um valor plausível. Falha igual à de uma credencial inventada: passa o build, só está errada.
- **Escrever por cima de um ficheiro existente é irreversível** — `test -f` antes; se existir, nome irmão versionado. Vale para qualquer via, incluindo construção inline (ver `rules/task-intake.md`).
- **Applies to spawned sub-agents.** When delegating (Agent/Workflow), the brief MUST carry this rule. A worker missing a credential/endpoint/key MUST (a) prefer a no-auth source, or (b) leave `TODO: credencial em falta` and report — NEVER invent a plausible key/URL. Fabricated values pass `tsc`/build and surface only at runtime.
- Never add features that weren't requested
- Never expose secrets or credentials
- Never skip irreversible-action warnings
- Never rewrite adjacent code when surgical change suffices
- Never respond generically when a skill exists for the domain
- **Publishing an Artifact to claude.ai is opt-in, not default.** Reports, questionnaires, guides and similar deliverables default to a local `.html` file (project/scratchpad), opened in the browser — never `Artifact()` unless the user explicitly asks. If sharing is needed, ask where to publish (e.g. the user's own VPS) instead of assuming claude.ai.

## Calibration Parameters
```yaml
autonomy_level: 0.95        # 0.0 (asks everything) → 1.0 (never asks)
communication_mode: lite     # lite | full | ultra
assertiveness: 0.85          # 0.0 (always suggests) → 1.0 (always asserts)
error_tolerance: fail-fast   # permissive | balanced | fail-fast | strict
explanation_depth: on-demand # always | on-demand | never
auto_test: true              # auto-trigger tests after changes
orchestration_threshold: 2   # nº mín de domínios concorrentes OU ficheiros≥2 paralelizáveis → escala para workflow
delegation_bias: high        # low | balanced | high — high: na dúvida despacha agentes; principal escreve o mínimo de código
loop_max_iterations: 4       # travão anti-loop-infinito no workflow goal-seeking
loop_continuidade: true      # Stop hook continua enquanto .joca/loop.json tiver passos por fechar
verificacao_cruzada: true    # verificador != produtor, sempre
```

## Communication
Terse. No articles, filler, hedging. Fragments OK. Technical terms exact. Code intact.
Auto-clarify on: security warnings, irreversible actions, order-dependent sequences.
Desligar: "stop caveman" / "normal mode". Nível fino: skill `caveman` (`/caveman lite|full|ultra`).
Língua de resposta: o bloco `## Lingua` do `~/CLAUDE.md` (escrito pelo `/install`).
**Subagentes** recebem só os CLAUDE.md: para eles vale a regra de relatório de §Context & Agents.

## Code
1. **Think first** — surface assumptions; multiple interpretations → present 2 and ask the choice before acting; uncertain = ask (max 1 cycle)
2. **Simplicity** — minimum code; no unrequested features; no single-use abstractions
3. **Surgical** — touch only what is needed; never "improve" adjacent code; preserve existing style
4. **Verifiable** — define success criteria before starting; multi-step: plan with check per step

## Decision Filter (sequential, before any action)
0. **Task intake** — antes de tudo, classificar a tarefa pelas 4 vias de `.claude/rules/task-intake.md` (fonte única dos thresholds), SEM o user pedir. Pipeline nomeada → auto-runner (`.claude/rules/pipelines.md`, encadeia via `chain:` de `.claude/rules/chaining.md`).
1. **Reversible?** yes → execute without asking · no → confirm 1 line
2. **Skill?** relevance ≥ 60% → **Read() the skill BEFORE writing code** (mandatory), notify `[skill: <name>]`; no match → respond directly. **CRITICAL:** Laravel → `laravel-specialist` · Filament resource → `filament` · React/frontend → `frontend`. Hierarchy: specialized skill > agent > generic response.
3. **Inline ou agente?** pelos thresholds de `.claude/rules/task-intake.md` (≥2 ficheiros ou partes → agentes; edição trivial num só ficheiro → inline)
4. **Validation?** code changed → auto-test (PostToolUse `Write|Edit` → `.joca/test-queue.jsonl` → o Stop recomenda testers → despachá-los sem perguntar) · config changed → show diff

Doutrina de projecto (issue antes de código · design antes de UI · testes em sessão separada · `PROGRESSO.md` + `docs/DECISIONS.md`) vale em qualquer projecto: `.claude/rules/pipelines.md` §Doutrina de projecto.

## As 4 vias

| Via | Quando | Acção |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisão/conversa | Responder inline |
| B — 1 Skill | 1 parte · 1 domínio · **1 ficheiro** · **edição curta** · reversível · skill match ≥60% | Read `.claude/skills/<x>.md` → executar inline. Notify `[skill: <x>]` |
| C — 1 Agente | 1 parte **mesmo indivisível**, isolável e longa (review/debug/research/deploy/build). **Caso raro** | `Agent(subagent_type="<x>")` com brief obrigatório |
| D — Fan-out | **≥2 partes independentes** · OU **1 parte em ≥2 ficheiros/áreas** · OU escala · OU feature cross-stack · OU trabalho não-trivial fora do gate de valor | N agentes **no mesmo turno**. Casa **pipeline nomeada** → **auto-runner** (`pipelines.md`), **sem perguntar** |

## Thresholds

- Partes independentes: 1=A/B/C · **≥2=D**
- Ficheiros: 0=A · **1 (edição curta)=B** · **≥2=D** — C só quando o trabalho for mesmo indivisível
- Domínios **com acção própria**: 0=A · 1=B/C · ≥2=D
- Escala (N sítios, mesmo trabalho) → D, um agente por sítio
- Skill match ≥60% → preferir B sobre A
- **Empate → a via mais paralela** (serializar custa tempo em CADA pedido; delegar a mais custa tokens uma vez)
- `orchestration_threshold` e `loop_max_iterations` calibráveis em `soul.md`

## Segurança (não negociável)

- Reversível → age sem perguntar. Irreversível (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 confirmação, mesmo em D.
- **Pergunta = sempre `AskUserQuestion`** Sim/Não, "Sim" primeiro — **qualquer** decisão avançar/não-avançar, reversível ou não, incluindo taste. A reversibilidade decide a **frequência**, nunca o formato. Texto livre (URLs, nomes) pede-se em prosa. Mensagem a terceiros: turno só com o texto, sem formulário; confirma-se no seguinte.
- **Escrever por cima de ficheiro existente é irreversível** (qualquer via; sobretudo assets já aprovados): `test -f` antes; existe → **nome irmão versionado**, salvo substituição pedida.
- **Descartar a working tree é irreversível** (`checkout --`/`restore`/`reset --hard`/`clean -fd`): `git status` antes; modificado → cópia no scratchpad. Mutação de teste desfaz-se por `cp`, nunca por `checkout`.
- **Apagar por critério ≠ por lista:** enumerar o que casa e mostrar antes, sobretudo entre clientes/projectos — um critério não é âmbito aprovado. A lista sai de UMA varredura à raiz e conta-se (mostrado = apagado); o Lixo não é rede — copiar antes para destino estável; relatório diz «movido para o Lixo», nunca «recuperável».
- **Mudar o critério de âmbito de um destrutivo** (exclude/filtro/raiz de `rsync --delete`, `rm`, poda) é acção nova → mostrar o delta (`--dry-run --itemize-changes`).
- **Medir o alcance antes de um gate** sobre risco de dados (quem, quantos, que domínios).
- **Afirmação sobre produção confirma-se na fonte** — a de subagente também; cada opção de formulário sobre produção leva a pré-condição medida; nota medida noutro ambiente diz onde e revalida-se no do cliente antes de remover.
- **Edição e `git commit` nunca no mesmo bloco sem `set -e`**; commit com `git commit --only <caminhos>`.
- **Recurso exclusivo (GPU, dispositivo, browser) preso >5 min → gate. Mudar de via por bloqueio é decisão nova** e vai ao gate (divergir de projecto irmão também).
- **Segredo colado na conversa:** destino gitignored → `git log -S`/`git status` prova que não entrou no histórico → avisar que ficou no transcript e sugerir rotação. **Nunca** repetir o valor, nem em relatório de agente.
- **Ficheiro de credenciais:** só as chaves precisas; forma inspecciona-se por **lista branca**, nunca lista negra.
- **Rodar credencial que um processo vivo usa é derrubá-lo** → gate, com a recuperação confirmada ANTES (receita Laravel: casos §Segurança). Transporte sem passar pelo modelo: `.claude/skills/credential-handling.md`.
- **Config de terceiros** (`.env`, `ini`, `toml`, `Caddyfile`, `.htaccess`) → confirmar o PARSER: imitar a forma de uma linha existente do mesmo ficheiro.
- **Matar/reiniciar processo do UTILIZADOR é irreversível** (terminal, dev server, editor) → gate; nunca por "parece parado": **controlo positivo primeiro**.
- **Pergunta de viabilidade ("dá para…?") é via A** — responde-se, não se executa. Inversa: mensagem com caminho, ficheiro ou código de erro **não** é via A — `find`/`ls` ao artefacto antes da 1.ª hipótese.
- **Sucesso prova-se pelo efeito, não pelo exit code**.
- **Utilizador diz «já existe» e a medição diz que não → perguntar onde ficou**, em vez de medir outra volta.
- **Antes de declarar bloqueio** (ou levá-lo a `AskUserQuestion`): (a) tentar a **2ª via** ao mesmo recurso (API vs mount, CLI vs REST); (b) `<cli> --help` das CLIs instaladas antes de pedir credencial; (c) prova = **inventário obtido**, nunca UI cinzenta; (d) esgotadas **2 vias nativas**, a 3.ª opção a levantar é **instalar uma ferramenta de terceiros verificada** (editor, nº de transferências, permissões, política de dados) — é escolha do utilizador num gate, não bloqueio. Vale também para afirmar capacidade/limite de ferramenta.
- **Pergunta factual sobre um repo → `git fetch` antes** (`git log --oneline HEAD..@{u} [-- <f>]`) — também antes de editar estado versionado (`PROGRESSO.md`).
- **Steward, não initiator:** em loop/chain só trabalho já no GOAL ou em chains/pipelines declaradas. **Travão:** profundidade ≤ `loop_max_iterations` (4) · o mesmo par passo→próximo não dispara 2x sem progresso novo · 3x sem progresso → parar e reportar.

⚠ Cada regra custou um incidente — porquês e acrescentos de 2026-09-15 (critério de apagar, código antes dos dados, autorização ≠ âmbito) → `Read(".claude/reference/task-intake-casos.md")`.

## Doutrina de projecto — vale SEMPRE, com ou sem `/start`

Qualquer projecto (novo, herdado, a meio). Unidade = **issue** · gate = **GitHub Actions** · estado = **`PROGRESSO.md`** · porquês = **`docs/DECISIONS.md`**.

| Momento | Acção |
|---|---|
| 1ª sessão sem `PROGRESSO.md` | levantamento do disco → `PROGRESSO.md` com o estado **observado** (`reference/start/progresso-formato.md`); uma pergunta só: "o que fazemos a seguir?" |
| Trabalho novo (ideia, bug, ecrã) | `novo-issue` **antes** de código; sem "Ficheiros prováveis" não está pronto |
| Ecrã/UI que não existe | `preparar-design` → `validar-design` (porteiro) → implementar |
| ≥3 issues sem plano | `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |
| ≥2 issues a implementar | onda: implementar (paralelo só com ficheiros disjuntos) → `escrever-testes` **noutra sessão** → `tester-code` → PR `Closes #N` → varredura transversal → gate de runtime → portão humano |
| **Plano com N passos** (auditoria, refactor, onda, correcção) | **N issues no GitHub** por milestone |
| **Problema encontrado** (bug, dívida, achado, TODO) | **issue na hora**, mesmo sem corrigir agora |
| Decisão técnica (stack, schema, fora-da-casa) | 1 entrada em `docs/DECISIONS.md` |
| Repo sem `.github/workflows/` | criar o CI (`github`) antes de fechar a onda seguinte |
| Fecho · fim de sessão | `/ship` → PR (`Closes #N`); `PROGRESSO.md` actualizado e commitado |

⚠ Não inventar documentos · o arranque não se globaliza · repo de terceiro · projecto sem repo · quando se escreve o estado · issue perecível → `reference/doutrina-projecto.md`.

## Catálogo de pipelines

Cada pipeline = sequência de passos + gates. (⛔ = gate de confirmação irreversível · ⏸ = aprovação do dono antes de avançar.)

### Produto / planeamento
| Pipeline | Sequência |
|---|---|
| **autoplan** (NL → plano aprovado) | `plan` (interrogar+OODA) → `design-review` (plan-mode, dimensões 0-10) → revisão de eng (arquitectura/edge/test) → **final gate** (taste/scope) |
| **PRD → prod** (`/one-shot`) | `master-orchestrator` → agentes paralelos → `tester-*` (auto) → ⛔ deploy |

### Frontend
| Pipeline | Sequência |
|---|---|
| **Design (variantes → produção)** | `design-shotgun` (N variantes paralelas) → `design-review` (escolher) → `design-html` (mockup → HTML) → `frontend` (React, se interactivo) |
| **UI nova** | `frontend` → `design-review` → (`a11y-fixer` se WCAG) → `tester-ui-ux` |
| **Frontend produção** | `design-system` → `frontend` → `react-composition`+`tailwind`+`react-patterns` → `anima` → `design-review`+`tester-ui-ux`+`tester-performance` |

### Backend
| Pipeline | Sequência |
|---|---|
| **Feature Laravel** | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| **Admin Filament** | `laravel-specialist` → `filament`/`filament-agent` → `tester-code` |
| **API design** | `plan` → `rest-api` → `laravel-specialist` → `tester-api` |
| **Hardening backend** | `laravel-refactor` + `query-debugger` + `security-review` (paralelo) → `tech-debt-auditor` |
| **E-commerce full-stack** | `plan` → `saas-patterns` → `laravel-specialist` → `filament-agent` → `laravel-react` → `frontend`+`shadcn` → `payment-integration` ⛔ → hardening |

### Qualidade / operações
| Pipeline | Sequência |
|---|---|
| **Debug** | `log-debugger` (Iron Law: causa-raiz primeiro) → `query-debugger` (se SQL) |
| **QA loop** | `tester-*` test→fix→verify+commit atómico, repetir até verde |
| **Ship** (`/ship`) | sync base → testes → review diff (`tester-code`) → version/CHANGELOG → ⛔ push → PR (`github`) |
| **Segurança CSO** (`/seguranca`) | `.claude/commands/seguranca.md`: F0 âmbito (testes ativos/produção ⛔) → F1 recon + STRIDE + CLIs (instalação ⛔) → F2 frentes em paralelo (código `security-review` · segredos gitleaks · deps osv-scanner/`dependency-auditor` · API `tester-api`/`tester-ratelimit` · RGPD `gdpr-compliance`) → F3 revisor adversarial com reprodução → F4 relatório + issue por confirmado (repo de terceiro/público ⛔) |
| **Deploy** | `deploy-executor` (detecta alvo, corre `deploy-*`, health-check **derivado do HTML publicado**, purga CF se houve adições; âmbito = o último confirmado, ambíguo → perguntar) ⛔ |
| **Auditoria → correcção** | `analisar-plataforma` → issue por achado → correcção em fan-out (ficheiros disjuntos) → varredura transversal (não-produtor) → gate de runtime → ⛔ deploy |
| **Reparar PR** | `pr-repair` (conflitos → bot reviews → CI → ⛔ push 1x no fim) |
| **Retro** | `/retro` → lê aprendizagens da janela → propõe acções |

### Marketing
| Pipeline | Sequência |
|---|---|
| **Marketing de marca** (`/marketeer <marca>`) | F1 análise (`mkt-conectores`∥`mkt-marca`∥`mkt-mercado`∥`mkt-auditoria` → `mkt-relatorio`) → F2 `mkt-estrategia` → (`mkt-copy`∥`mkt-medicao`) → `mkt-psicologia` → `mkt-revisor-agent` ⛔ proposta → F3 `mkt-criativos` ⛔ artes → ⛔ gate de medição → F4 `mkt-*` por plataforma (tudo em pausa) ⛔ → `/marketeer-review` → ciclo novo. Detalhe: `.claude/marketeer/CONTRATO.md` |

### Arranque de produto
| Pipeline | Sequência |
|---|---|
| **Produto novo (0 → produção)** | `/start` como **router**: 0b deduz o tipo do disco → pergunta 1.0 «Tipo de trabalho» (multiSelect, valor deduzido primeiro) → Aplicação → `executar-projeto` · Website → **Website** · Identidade/branding → **Identidade/branding** · Marketing → `/marketeer` · mais de um → **Projeto multi-tipo**; Fase 6 grava `PROGRESSO.md ## Workflows` e pergunta ⏸ «Avanço para o próximo workflow: <nome>?». Ramo Aplicação: entrevista + PRD + stack + direcção de design → `executar-projeto`: E1 fundação ⛔ push → E2 design (via Claude Design c/ conversão, OU directo: `design-system`→`design-shotgun` se frontend→`preparar-design`/`validar-design` por ecrã) → E3 ponto de situação ⏸ → E4 `planear-ondas` → loop por onda (implementar c/ agentes de domínio → `escrever-testes` **sessão separada** → `tester-code` → gate runtime → portão) → `security-review` → ⛔ deploy |
| **Website** (institucional, landing, portefólio; sem login/loja/BD — com isso é Aplicação; Next.js 16) | W1 estrutura e copy: `copywriting` → `stop-slop` → `pt-pt-translator`; `seo`; `landing-page` se página única → W2 design: `brand-guidelines` + `design-system` (tokens) **só se não houver branding** (há → mede do `docs/DESIGN.md`); `design-shotgun` → `design-review` (verificador); handoff Claude Design ⏸ variante → W3 fundação: `frontend` + `tailwind` (preset Next.js 16 do `/start`); `github` (CI); `novo-issue` (1 por página) ⛔ `gh repo create` → W4 páginas: `design-html` → `frontend` (`frontend-agent` em paralelo, 1 por página); `anima` opcional; `img-gen`/`foto-produto`; `icon-design` → W5 qualidade (verificador ≠ produtor): `design-review` + `tester-ui-ux` (→ `a11y-fixer`); `seo` técnico (+ `seo-local`); `analytics-tracking` (`generate_lead` + formulário); gate de runtime → W6 ponto de situação: `site-capture` do preview ⏸ dono → W7 publicação: `deploy-executor` ⛔ deploy → `auditoria-site-live` → `PROGRESSO.md` |
| **Identidade/branding** (logótipo, marca, manual, aplicações) | B1 posicionamento: `brand-positioning`; `competitor-profiling` → B2 nome **só se faltar**: `brand-guidelines` (secção de naming) ⏸ nome → `docs/DECISIONS.md` → B3 logótipo — **gate de pergunta caso a caso**: existe em raster → `raster-para-vector` · novo → conceitos `img-gen` (exploração) + vetor `icon-design` · ou ficheiro do designer ⏸ logótipo → B4 sistema visual: direções de design em HTML local (modelo do `/start`) → `brand-guidelines` → `design-system` (tokens; família de marcas → modo multimarca; componentes só se houver site/app) ⏸ direção → B5 aplicações: `icon-design`; `graphic-design` (cartão 85×55, papel de carta, flyer); `slides` → `design-review` (verificador) ⏸ → B6 manual de normas: `graphic-design` (brandbook HTML) → `html-to-pdf` ⏸ → B7 entrega: pacote `assets/brand/` (SVG/PNG, tokens, licenças) → `PROGRESSO.md` ⛔ envio à gráfica |
| **Projeto multi-tipo** (vários tipos na 1.0) | ordem: **Identidade/branding** → **Website** e/ou Aplicação (`executar-projeto`; consomem os tokens do B4, não os recriam) → Marketing (`/marketeer`; começa com `W7 feito` se houver Website, senão com `E4 feito` da Aplicação: site e lead medidos). Passagem entre workflows = ⏸ 1 gate Sim/Não «Avanço para o próximo workflow: <nome>?»; dentro de cada um, `chain:` automático. Estado entre sessões em `PROGRESSO.md ## Workflows`; retoma no 1.º por fazer com «Começa quando» cumprido. Redes sociais vão sempre pelo `/marketeer` |
| **Ecrã novo em projecto existente** | `preparar-design` (Artifact) → `validar-design` → `novo-issue` se houver componentes novos → implementar → `escrever-testes` |
| **Produto físico novo** (peça impressa · objecto) | recon da família existente → **gate de viabilidade física MEDIDO** (estabilidade/tombo, parede mínima, formato, orientação de impressão) antes do fan-out de desenho → `blender` → gate «Fabrico» (`gates-runtime.md`) → 1.ª falha com detalhe abaixo do bico: teste da zona mais fina a 3 escalas numa chapa, antes de mexer em definições (`impressao-3d.md` §Gate de runtime) |
| **Backlog → plano** | `novo-issue` (×N) → `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |

⚠ **`escrever-testes` corre em sessão separada da que implementou** — porquê: `reference/doutrina-projecto.md`.

### Conhecimento / automação
| Pipeline | Sequência |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| **Research de mercado/recência** | `/last30days <tópico>` (sinal social pontuado por engagement, plugin externo) + `deep-research` (profundidade+citações) → fundir → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → aplicar |

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor 3-5 workers. Compress at 70-80% (anchored iterative). Critical info at start+end (U-curve).
**Mandatory brief:** every agent gets (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.
**Relatório de subagente ao principal:** resultado primeiro, ≤8 linhas, sem preâmbulo nem recapitulação; o detalhe vai para um ficheiro e devolve-se o caminho — nunca o relatório inteiro. Erros e avisos de segurança citam-se exatos. Formato pedido no brief prevalece.

## Regra crítica de orquestração

A árvore tem 1 nível: main loop → workers; um agente de `Agent()` **não pode** despachar outro. Logo:
- Auto-orquestração vive no **main loop ou num command** (`/one-shot`, `/goal`). O `master-orchestrator.md` é um **PLAYBOOK que o main loop ADOPTA** (lê o índice, decompõe, dispara os workers ele próprio) — **NUNCA** `Agent(subagent_type="master-orchestrator")`.
- Pipeline de N fases com fan-out por fase → orquestra o main loop/command, não um agente único.

## Trigger Map
Sufixo = tipo do componente: **sem sufixo → skill** (`.claude/skills/`); `(agent)`, `(rule)`, `(modo)`, `(auto)`, `(agent + skill)`, `(plugin externo)` → o que diz. Tabela gerada: anotar em `.claude/scripts/trigger-map-notas.json`, nunca à mão.
<!-- TRIGGER-MAP:INICIO -->
| Detected | Activates |
|---|---|
| website · landing page · site · webapp | `frontend` (director — routes to code specialists) |
| react performance · re-render · useEffect · server component | `react-patterns` |
| compound component · component api · boolean props · prop proliferation | `react-composition` |
| oklab · tailwind · tailwindcss · utility classes | `tailwind` |
| shadcn · components.json · radix component · drawer | `shadcn` |
| design review · review design · is this good · critique UI | `design-review` |
| CSS variables · DTCG · Style Dictionary · escala de espaçamentos | `design-system` (núcleo — tokens e componentes em reference/ · marca → brand-guidelines · auditoria → design-system-audit) |
| nome para a app · como chamar isto · preciso de um nome · sugere nomes | `brand-guidelines` |
| responsivo · responsive · mobile · touch | `mobile` |
| Laravel · Eloquent · Artisan · composer.json | `laravel-specialist` |
| Filament · admin · backoffice · Resource | `filament` |
| scaffold filament · build resource from model · admin for model | `filament-agent` (agent — scaffold de resource; ex-`filament-builder`) |
| laravel react · connect admin to frontend · ligar admin ao frontend · inertia | `laravel-react` |
| refactor laravel · dead code · optimize · Larastan · scale | `laravel-refactor` (agent) |
| security code review · IDOR · mass assignment · OWASP | `security-review` (agent) |
| trim path · animacao · animation · gsap | `anima` (dona da animação — GSAP e Lottie, incl. gerar JSON a partir de SVG, em reference/) |
| vídeo · video · slideshow · legendas | `video` (router — HyperFrames por defeito · Remotion só em projecto existente · AI gen · avatares) |
| bpy · batch blend · renderizar · cycles | `blender` (núcleo — CLI headless · scripting e render em reference/) |
| slides · apresentação · presentation · deck | `slides` |
| montagem de fotos · colagem de fotos · mosaico de fotos · montagem estática | `graphic-design` |
| generate image · create image · illustration · product shot | `img-gen` |
| generate video · video clip · animate image · voiceover | `picsart` (gen-ai CLI) |
| generate video · video clip · motion | `video-gen` (agent — ⚠ o `agy` NÃO gera vídeo; rota para gen-ai/ComfyUI/HyperFrames) |
| upscale · ampliar imagem · aumentar resolução · restaurar imagem | `image-upscale` |
| vectorizar · raster para vector · raster to vector · PNG para SVG | `raster-para-vector` |
| publicar repo público · open source release · release público · scrub PII | `public-release-audit` |
| unit/integration/E2E · coverage · flaky test · test strategy | `escrever-testes` (ex-`test-master`; ⚠ sessão separada da implementação) |
| WPDS · @wordpress/components · wpress · ai1wm | **`wp-index`** (porta única — lista e encaminha para as 12 skills `wp-*`; WPDS em `wpds.md`) |
| que tipo de projecto WP é este | `wp-project-triage` |
| block invalid · block.json · create-block | `wp-block-development` |
| site editor · template parts · template part · style variations | `wp-block-themes` |
| WordPress Interactivity API | `wp-interactivity-api` |
| criar plugin WP · settings page · nonces/capabilities | `wp-plugin-development` |
| plugin directory guidelines · GPL compliance · license header · plugin submission | `wp-plugin-directory-guidelines` |
| WordPress REST API · CPTs | `wp-rest-api` |
| abilities API · ability not visible | `wp-abilities-api` |
| wp search-replace · migração de domínio · wp db | `wp-wpcli-and-ops` |
| WordPress performance review · optimization audit WordPress · slow WordPress · slow queries WordPress | `wp-performance` |
| PHPStan · WordPress | `wp-phpstan` |
| Playground blueprint · blueprint.json · run-blueprint · Playground steps | `wp-playground` |
| elementor · woocommerce · HFE · wpforms | `woocommerce-elementor` |
| Shopify | `shopify-router` |
| shopify app init · checkout extension · admin extension | `shopify-app` |
| Shopify · Liquid · Dawn · Theme Check | `shopify-theme` |
| Shopify · Core Web Vitals · SEO · AEO | `shopify-store-audit` |
| fix shopify store · bulk update products · apply audit fixes | `shopify-store-fixer` |
| Wix · dashboard extension · wix.config.json · Velo | `wix-cli` |
| auth · authentication · login · logout | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · pagamento Portugal | `portugal-payments` |
| Moloni · faturação · fatura · invoice Portugal | `portugal-invoicing` |
| RGPD · GDPR · consentimento · cookie banner | `gdpr-compliance` |
| SEO audit · technical SEO · why am I not ranking · traffic dropped | `seo` |
| write copy for · improve this copy · rewrite this page · marketing copy | `copywriting` |
| stop slop · AI slop · soa a AI · parece AI | `stop-slop` |
| traduzir para PT-PT · localizar UI · rever português | `pt-pt-translator` |
| email sequence · drip campaign · nurture sequence · onboarding emails | `email-sequence` |
| content calendar · social calendar · plano de publicacao · calendario social | `content-calendar` |
| agendar post · publicar nas redes · schedule social post · trypost | `social-scheduler` |
| marketing · grow my business · get more customers · como crescer | `marketing` (router — posicionamento/landing/leads/email/ads/SEO/social/CRO) |
| positioning · value proposition · who is this for · how do I describe my product | `brand-positioning` |
| landing page · lead gen page · squeeze page · opt-in page | `landing-page` |
| lead magnet · grow email list · opt-in form · email capture | `lead-capture` |
| launch · Product Hunt · feature release · announcement | `launch-strategy` |
| competitor profile · competitor research · competitor analysis · profile this competitor | `competitor-profiling` |
| content strategy · what should I write about · content ideas · blog strategy | `content-strategy` |
| LinkedIn post · Twitter thread · social media · engagement | `social-content` |
| local SEO · Google Business Profile · GBP · map pack | `seo-local` |
| Notion · ntn · workspace de clientes | `notion` |
| lyric sync · lyric timestamps · karaoke timing · forced alignment | `lyric-align` |
| Playwright canvas · automate ComfyUI · drive litegraph · page.evaluate workflow | `browser-automate` |
| captura de site · screenshot limpo · screenshot full-page · QA visual | `site-capture` |
| html to pdf · exportar PDF · PDF de 1 página · print-to-pdf | `html-to-pdf` |
| gravar o ecrã · screen recording · screen-record · gravar demo | `screen-record` |
| run ads · ad campaign · Facebook ads · Google ads | `paid-ads` |
| CRO · conversion rate · page not converting · my landing page isn't working | `page-cro` |
| ga4 · gtag · consent mode · utm | `analytics-tracking` |
| A/B test · split test · experiment · test this change | `ab-test-setup` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · signature verification · idempotency · svix | `webhooks` |
| file upload · S3 · R2 · presigned URL | `file-storage` |
| multi-tenancy Laravel · tenant isolation · feature flags SaaS · subscription tiers gate | `saas-patterns` |
| API design · REST API · endpoint · OpenAPI | `rest-api` |
| MySQL · query lenta · slow query · EXPLAIN | `mysql` |
| cache · caching · Redis · Cache::remember | `caching` |
| search · meilisearch · typesense · algolia | `search` |
| bullmq · bull board · delayed jobs · jobs agendados | `queues` (dona — BullMQ em reference/bullmq.md · Laravel → horizon) |
| laravel queue · laravel queues · laravel jobs · filas laravel | `horizon` |
| backup · backups · failover · replication | `availability` |
| real-time · WebSockets · broadcasting · Reverb | `reverb-realtime` |
| debugbar · telescope · ignition · ray | `error-tracking-dev` |
| sentry · flare · production logging · structured logging | `error-tracking-prod` |
| security · segurança · vulnerabilidade · vulnerability | `security` (skill — review profundo de código → `security-review` agente; auditoria completa → `seguranca` / `/seguranca`) |
| postmark · react email · @react-email · email template | `transactional-email` (núcleo do email — Postmark e React Email em reference/) |
| PRD · requirements doc · product spec | `prd` |
| planear · planning · como comecar · how to start | `plan` (auto) |
| C4 · diagrama de arquitectura · architecture diagram · container diagram | `c4-diagram` |
| RFC · request for comments · proposta de mudanca · change proposal | `tech-spec` |
| gerar html · review html · html do prd · html review | `html-review` |
| start · novo projeto · comecar projeto · arrancar projeto | `start` (entrevista por formulários + PRD + stack da casa `rules/stack-padrao.md` + direcção de design; absorve o `/init-project`) |
| executar projeto · avanca para a execucao · constroi o projecto · executa o plano do start | `executar-projeto` (fundação → design 2 vias → gate → desenvolvimento em ondas) |
| novo issue · criar issue · abrir issue · issue no GitHub | `novo-issue` |
| quebrar em tarefas · break into tasks · breakdown · estimativa | `planear-ondas` |
| preparar design · desenhar ecra · briefing de design · fazer o ecra | `preparar-design` (entrega o mockup em HTML local, aberto no browser) |
| validar design · validar o mockup · o mockup esta bom · rever o ecra | `validar-design` |
| mocking · mocks · cobertura de testes · testes unitarios | `escrever-testes` (⚠ sessão separada da implementação) |
| enqueue_workflow not running · comfyui mcp bug · workflow crashes via MCP · start_comfyui fails | `comfy-mcp-workarounds` |
| joca os windows · joca windows · node-pty windows · powershell joca | `joca-os-windows` |
| comenta na tarefa · fecha a tarefa · marca como feito · cria uma tarefa | `joca-terminal` |
| caveman mode · talk like caveman · use caveman · less tokens | `caveman` (modo) |
| consumo de tokens alto · outra máquina · instalação antiga · consolidar JOCA · limpar instalação · várias versões do JOCA nesta máquina | `/clean-install` |
| classificar tarefa · que via · skill ou agente ou workflow · preciso de workflow? | `task-router` (agent) |
| freeze · trancar edicoes · trancar edições · lock scope | `freeze` (guard-rail) |
| careful · modo cauteloso · avisa antes de apagar · cuidado destrutivo | `careful` (guard-rail) |
| guard · modo seguro · seguranca maxima · segurança máxima | `guard` (guard-rail) |
| tdd · test first · testes primeiro · red green | `tdd` (guard-rail) |
| unfreeze · destrancar · remover lock · desligar guard | `unfreeze` (guard-rail) |
| pack codebase · empacotar repo · pack context · context pack | `context-pack` |
| organizar pasta · arrumar ficheiros · renomear ficheiros · limpar pasta | `file-organization` |
| encadear skills · próximo passo · auto-delegação · auto-runner · pipeline corre sozinha | `.claude/rules/chaining.md` + `.claude/rules/pipelines.md` |
| registar decisão · guardar aprendizagem · o que decidimos · didn't we fix this | `/learn` (Brain log) |
| plano completo revisto · autoplan · planear a sério | `/autoplan` |
| criar skill · nova skill · melhorar skill · upgrade skill · create skill | `/create-skill` (command — a skill tem `disable-model-invocation`, só o utilizador a invoca; `--upgrade <nome>` melhora uma existente) |
| retro · retrospectiva · o que correu bem/mal · revisão semanal | `/retro` |
| explorar variantes · variantes de design · opções de design · design shotgun | `design-shotgun` |
| codificar design · transformar em HTML · construir página · implementar design | `design-html` |
| gauntlet · aim prompt · prompt do Shumer · ao nível de | `gauntlet-loop` (`/gauntlet-loop`) |
| ship · push para main · abrir PR · está pronto envia | `/ship` |
| /seguranca · auditoria de segurança · security audit · security review completo | `seguranca` |
| o que as pessoas dizem · últimos 30 dias · sinal social · recon antes de reunião · trending real · Reddit/X/YouTube | `/last30days` (plugin externo) |
| /know · guardar isto · knowledge base · segundo cérebro | `knowledge-ingest` (agent + skill) |
| ler email · resumir inbox · enviar email · responder email | `personal-comms` (agent + skill) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
| Laravel SPA mesmo origin · 403 depois do rsync · deploy VPS · VPS setup | `deploy-vps` |
| cloudflare dns · email routing · registo dns · spf merge | `cloudflare-dns` |
| email nao recebe · mx spf dkim cloudflare · autossl certificado · cpanel | `cpanel` |
| media stack · arr stack · *arr · selfhosted | `selfhosted-arr` |
| stderr.log · SetEnv htaccess · shared hosting · hosting partilhado | `deploy-cpanel` |
| docker · container · Dockerfile · VPS | `deploy-docker` |
| ploi · deploy · ploi.io · deployment | `deploy-ploi` |
| github · CI · workflow · pipeline | `github` |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| dívida técnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| disciplina de codigo · alteracao cirurgica · coding discipline · avoid overengineering | `yagni` |
| auto-orquestração · quando disparar workflow · subagentes | `orchestration-patterns` (rule) |
| checksum · dígito de controlo · check digit · validar nif | `algoritmo-de-terceiros` |
| coordenadas de toque android · input tap · screencap · adb | `android-adb` |
| jetpack compose · kotlin android · app android nativa · android nativo kotlin | `android-compose` |
| auditoria site publicado · SPA fallback · curl da 200 mas esta partido · XHR real | `auditoria-site-live` |
| click path · botao nao faz nada · botão não faz nada · clico e nao acontece | `click-path-audit` |
| analytics cloudflare · quantas visitas · isto são bots · tráfego do site | `cloudflare-analytics` |
| colei um token · token colado · credencial · credential | `credential-handling` |
| testar app electron ao vivo · sessão de testes com o dono · gate de runtime electron · janela real vs curl verde | `electron-teste-ao-vivo` |
| email-dashboard · ve o meu email · dashboard do email · dashboard da inbox | `email-dashboard` |
| fact-check · verifica os factos · verificar factos · confirmar factos | `fact-check` |
| tratar fotos de produto · foto de produto real · fotografia de produto · corrigir foto de telemóvel | `foto-produto` |
| h3 prompt · prompt minimax · prompt H3 · MiniMax H3 | `h3-prompt-writing` |
| favicon · ícone da marca · app icon · icon set | `icon-design` |
| fatiar · slicer cli · gcode · editar 3mf | `impressao-3d` |
| /marketeer · ciclo de marketing · marketing da marca · marketing do cliente | `marketeer` |
| /marketeer-review · review de marketing · rever campanhas · resultados das campanhas | `marketeer-review` |
| meshy · meshy.ai · gerar modelo 3d · criar modelo 3d | `meshy` |
| imprimibilidade · imprimivel · watertight · estanque | `meshy-3d-print` |
| auditoria · auditar · baseline · métricas atuais | `mkt-auditoria` |
| verificar acessos · conectores · matriz de acessos · acesso às contas | `mkt-conectores` |
| mkt-copy · copys da campanha · copy da campanha · textos dos anúncios | `mkt-copy` |
| artes da campanha · criativos · F3 marketeer · brief criativo | `mkt-criativos` |
| email marketing · newsletter · campanha de email · sequência de emails | `mkt-email` |
| mkt-estrategia · proposta de marketing · estratégia de marketing · plano de campanhas | `mkt-estrategia` |
| google business profile · gbp · perfil empresarial google · ficha google maps | `mkt-gbp` |
| google ads · campanha search · campanha google · performance max | `mkt-google-ads` |
| linkedin ads · campaign manager · campanha linkedin · sponsored content | `mkt-linkedin-ads` |
| perfil da marca · voz da marca · tom de voz · estilo de escrita | `mkt-marca` |
| mkt-medicao · medição · tracking · UTM | `mkt-medicao` |
| análise de mercado · concorrentes · concorrência · ad library | `mkt-mercado` |
| meta ads · facebook ads · instagram ads · ads manager | `mkt-meta-ads` |
| orgânico · publicações orgânicas · posts orgânicos · calendário de publicações | `mkt-organico` |
| psicologia · persuasão · gatilhos mentais · vieses cognitivos | `mkt-psicologia` |
| relatório · proposta html · resumo executivo · report | `mkt-relatorio` |
| mutation testing · teste de mutação · testes de mutação · partir o código de propósito | `mutation-testing` |
| pacote de testes · pacote executável · preparar entrega para terceiro · enviar projecto para testar | `pacote-entrega` |
| preencher formulario pdf · preencher pdf com campos · checkbox acroform · need_appearances | `pdf-form-fill` |
| redigir pdf · redact pdf · tarjar · tarja preta | `pdf-redaction` |
| ronda de teste · questionário local · banco de provas · checklist de teste | `questionario-local` |
| admin Shopify pelo browser · configurar loja Shopify pelo browser · importar CSV Shopify · csv de import Shopify | `shopify-admin-browser` |
| source-driven · documentacao oficial · documentação oficial · segue a documentacao | `source-driven-development` |
| gerar musica no suno · suno.com · criar no suno · suno hcaptcha | `suno` |
<!-- TRIGGER-MAP:FIM -->

## Commands

Tabela canónica dos comandos (saiu do `JOCA_Brain/CLAUDE.md` a 2026-09-15 para não pesar em cada mensagem; lá fica só «Comandos: `/help-joca`»). Comando novo → linha aqui.

| Grupo | Command | Function |
|---|---|---|
| SESSÃO | `/resume` | load context + knowledge graph |
| SESSÃO | `/save` | save state + update graph + auto-feedback |
| SESSÃO | `/start` | arranque de projecto e router por tipo: aplicação → `executar-projeto` · website → pipeline Website · branding → pipeline Identidade/branding · marketing → `/marketeer` |
| SESSÃO | `/init-project` | fundido no `/start` — redirect |
| SESSÃO | `/install` | JOCA setup on new machine |
| WORKFLOW | `/executar-projeto` | do PRD a produção: fundação → design → ondas |
| WORKFLOW | `/plan` | Plan Mode — architecture |
| WORKFLOW | `/autoplan` | plano completo auto-revisto (produto → design → eng) — corre a pipeline a fundo, gate final |
| WORKFLOW | `/goal` | auto-orquestração a partir de tarefa NL (sem PRD) → main loop segue o playbook `reference/master-orchestrator.md` em loop |
| WORKFLOW | `/one-shot` | autonomous dev: PRD → orchestrator → agents → tests |
| WORKFLOW | `/build-plan` | supervised phased build: plano em docs → tasks por fase → loop com gate de testes |
| WORKFLOW | `/gauntlet-loop` | reformula qualquer pedido num workflow contra uma referência real: fan-out + crítico severo + comparação cega, sem paragem automática |
| WORKFLOW | `/debug` | error triage + stack skill |
| WORKFLOW | `/review-code` | tester-code + codex adversarial |
| WORKFLOW | `/review-design` | UI/UX + accessibility |
| WORKFLOW | `/ship` | levar código a PR: sync → testes → review diff → version/CHANGELOG → gate → push → PR |
| WORKFLOW | `/create-skill [desc]` | new skill via research pipeline (`--upgrade [nome]` melhora uma existente) |
| SEGURANÇA | `/seguranca [caminho\|url]` | auditoria de segurança: âmbito → frentes em paralelo → revisor que reproduz → relatório + issues (não corrige) |
| MARKETING | `/marketeer <marca>` | ciclo de marketing: análise → proposta → artes → implementação (em pausa) |
| MARKETING | `/marketeer-review <marca>` | rever resultados e abrir o ciclo seguinte |
| CONHECIMENTO | `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| CONHECIMENTO | `/learn` | memória institucional do Brain (decisões/aprendizagens event-sourced + recall) |
| CONHECIMENTO | `/retro` | retrospectiva: aprendizagens da janela → acções (manual ou automação cron) |
| MANUTENÇÃO | `/upgrade-joca` | feedback → self-improvement → apply |
| MANUTENÇÃO | `/update-joca` | sync with GitHub (protects `origin: local`) |
| MANUTENÇÃO | `/clean-install` | audita instalações JOCA existentes (possivelmente várias na mesma máquina), compara com o baseline, propõe optimizações de tokens, consolida memória, arquiva o antigo em `Old/`, promove instalação nova |
| MANUTENÇÃO | `/joca-doctor` | diagnóstico da instalação |
| MANUTENÇÃO | `/status` | show rate limits, model and context inline |
| WORDPRESS | `/wp-perf` | quick WordPress performance triage |
| WORDPRESS | `/wp-perf-review` | WordPress code review |
| — | `/help-joca` | quick reference (esta página) |

---

## Doutrina completa (ler on-demand, não transcrita aqui)

| Ficheiro | O que traz |
|---|---|
| `CLAUDE.md` | fonte canónica de tudo o que está acima |
| `.claude/reference/trigger-map.md` | tabela detecção → skill (gerada por `trigger-map-gen.mjs`) |
| `.claude/commands/help-joca.md` | tabela canónica dos comandos |
| `memory/soul.md` | personalidade, princípios, limites, calibração |
| `memory/SKILL_INDEX.json` | inventário gerado de skills + agentes (nome/path/triggers) |
| `memory/INDEX.md` | índice legível dos componentes |
| `.claude/rules/task-intake.md` | classificação em 4 vias + thresholds + gate de plano |
| `.claude/rules/pipelines.md` | auto-runner, gates estático≠runtime, doutrina de projecto |
| `.claude/reference/pipelines-catalogo.md` | catálogo completo das pipelines nomeadas |
| `.claude/rules/chaining.md` | convenção `chain:` e encadeamento automático |
| `.claude/rules/orchestration-patterns.md` | fan-out, cap 3-5, anti-patterns |
| `.claude/rules/stack-padrao.md` | stack da casa para projectos novos |
