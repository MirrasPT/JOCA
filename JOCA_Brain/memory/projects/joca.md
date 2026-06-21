---
project: JOCA
type: toolkit-self-development
stack: Claude Code skills/agents/commands (Markdown) + JOCA_UI (Node/Express/WS + React/Vite)
repo: MirrasPT/JOCA (root = JOCA_FINAL, single git repo)
---

# JOCA — Toolkit Self-Development

## Estado actual
Repo em `master`, HEAD `4fa0bcc`. **Alterações de `/upgrade-joca`+`/sync-questionnaires` NÃO commitadas:** 3 skills novas (`content-calendar`, `lyric-align`, `browser-automate`), 1 comando novo (`/build-plan`), nova rule `workflows-and-tooling.md`, soul/api-design/frontend/deploy-cpanel reforçados, python3→python (stub Store), graph excludes, stop.bat `/T`, init-project real-vs-PLANEADO. Contadores realinhados: **106 skills · 28 agents · 20 commands (154 componentes)**.

**JOCA_OS apagado e recriado (2026-06-21)** — v1 (orquestrador Agent SDK) apagado; Renato recomeça de raiz. **Novo `JOCA_OS/` = cópia literal do `JOCA_UI/`** (robocopy, 226M, untracked) como base a repurposar. Memória da arquitectura v1 limpa intencionalmente. `FUTUROS.md` na raiz mantém a visão.

**Rename `JOCA_Logic` → `JOCA_Brain` em curso** — o Brain. Refs já actualizados em **28 ficheiros** (detecção sibling do JOCA_UI em `server.ts`/start scripts, cópia JOCA_OS, README, root+global CLAUDE.md, memória). **Rename físico da pasta PENDENTE** — bloqueado pelo cwd do Claude; corre `JOCA_FINAL\rename-to-brain.bat` com o Claude fechado, reabre em `JOCA_Brain`, reinicia JOCA_UI. Docs históricos (`AUDITORIA_LOGIC_*`, `migrate.md`) mantêm nome antigo de propósito.

**Perfil base do Renato criado** — `JOCA_Brain/memory/profile.md` (canónico, dados pessoais, fora de commits públicos) + auto-memória [[renato-profile]] + [[renato-design-prototype-fidelity]]. Via entrevista de 15 perguntas (interview mode). Captura: papel SetupTech (quer ser parceiro), produtos (livro de elogios, Bigorna 3D), filosofia AI-driven (design co-criado, resto 100% AI), meta €1500/mês, visão Jarvis, comms terso, pain points (drift protótipo→React, tarefas dispersas, marketing fraco).

## Decisões tomadas
- 2026-05-30 — Arquitectura composável: skills específicos que se encaixam > monólitos generalistas. `frontend` vira director.
- 2026-05-30 — Criados 6 skills: `react-patterns`, `react-composition`, `tailwind`, `react-email`, `shadcn`, `design-review`.
- 2026-05-30 — Integração de skills externas: preferir fonte oficial/canónica (shadcn oficial, não Google Labs/Stitch que depende de MCP externo).
- 2026-05-30 — `design-review` é o dono do gosto/AI-slop/composição; `tester-ui-ux` (agente) = QA+WCAG; `design-system-audit` = tokens. Sem overlap.
- 2026-05-30 — `html-review` é conversor md→HTML, NÃO review de UI. Citações corrigidas.
- 2026-05-30 — Commit só do meu trabalho (lista explícita), em branch novo; UI/img-gen/memory deixados uncommitted.
- 2026-05-30 — Cluster backend (3 objectivos: admin/integração/hardening): NOVO `laravel-react` skill, `laravel-refactor` + `filament-builder` agents; `filament` aprofundado; `laravel-specialist` reforçado. Derivado de 8 skills externas Laravel/Filament.
- 2026-05-30 — Backend stacked no MESMO branch (`e0526d2`), não off-master: CLAUDE.md/SKILL_INDEX partilhados já tinham o design commitado → off-master ficaria entrelaçado. Lição: trabalho que edita ficheiros partilhados deve empilhar no branch onde esses ficheiros já foram tocados.
- 2026-05-30 — `INDEX.md` deixado sempre fora dos commits (tem entradas de projecto/feedback do Renato misturadas).
- 2026-05-31 — Consolidação de branches → único `master`. Estratégia: branches já-em-master apagados (`feat/frontend-design-skills`, `joca_ui_windows`); estruturas v1/fork divergentes (`v1-legacy` 613 ficheiros, `analyze-project-BBnm8` 790 ficheiros) **arquivadas como tags `archive/*` e apagadas** (merge destruiria o v2); `ana-lisa` reduzido ao seu único valor — `FUTUROS.md` — fundido e branch apagado. Workflow versionado: `.claude/scripts/consolidate-branches.sh` (idempotente, dry-run default, `RUN=1` executa).
- 2026-05-31 — Lição: "merge todos os branches" não é literal quando há histórias divergentes; verificar `git diff --stat` vs merge-base antes — fork antigo sobrepõe arquitectura nova. Arquivar via tag > apagar cego.
- 2026-05-31 — Rate limits do dashboard: backend tornado **auto-suficiente** (lê oauth/usage + `~/.codex/logs_2.sqlite` via `node:sqlite`) em vez de depender de ficheiros tmp escritos pelos statuslines. Bugs Windows corrigidos: token Claude em `~/.claude/.credentials.json` (não Keychain macOS); codex sem binário `sqlite3` → `node:sqlite`. AGY/Antigravity **não expõe limites temporais** — não fabricar barras. Detalhes em auto-memory [[joca-ui-rate-limits]].
- 2026-05-31 — Bug de navegação: `contextProjectId` preferia o projeto da sessão activa sobre o projeto clicado → em `mainView==='project'` usar sempre `activeProjectId`.
- 2026-05-31 — Auditoria multi-agente do JOCA_UI (workflow, 6 dims × verify adversarial): **backend passou 100% limpo** (security/correctness/path-traversal/injection resistiram); todos os 10 achados confirmados eram **frontend a11y + handlers optimistas recém-escritos**. Sinal claro: o código novo é o que precisa de afinação, não o estabelecido.
- 2026-05-31 — Padrão a11y: nunca montar controlos interactivos condicionados a estado JS de `hover` (mouse-only) nem `display:none`-até-hover (sai do tab order); usar `opacity:0` + `:focus-within` + `@media(hover:none)`. `role=button` em containers com botões aninhados = ARIA inválido → o elemento clicável deve ser um `<button>` real (nome/label), com os outros controlos como irmãos.
- 2026-05-31 — Workflow tool: mau fit para git destrutivo (sequência determinística, não paralelizável) → usei script versionado. Bom fit para auditoria (fan-out de revisão + verify adversarial). Distinguir os dois casos.
- 2026-06-20 — `/upgrade-joca` corrido via Workflow (research+draft+evaluate de 6 artefactos, todos PASS 9-9.5 à 1ª iteração) + edições mecânicas manuais nos ficheiros partilhados (resume/save/CLAUDE/soul) para evitar clobber em paralelo. Lição reforçada: trabalho que toca ficheiros canónicos partilhados fica sob controlo sequencial do main loop; o fan-out é para research/draft de ficheiros independentes.
- 2026-06-20 — Verificação anti-fabricação: a nota "graphify-deps.py já ignora vendor" era falsa → tornei-a verdadeira adicionando os patterns ao `IGNORE_DIRS` em vez de fabricar. Sempre verificar antes de afirmar (a própria regra que escrevi em `workflows-and-tooling.md`).
- 2026-06-21 — **JOCA_OS v1 apagado, recomeço de raiz.** App sibling untracked (205M) removido por decisão do Renato. Arquitectura/decisões antigas limpas da memória intencionalmente — partir de folha em branco. Lições técnicas que sobrevivem (validadas por probe real, reutilizáveis): (a) `@anthropic-ai/claude-agent-sdk` conduz o CLI `claude` logado → corre na **subscrição** sem `ANTHROPIC_API_KEY`, custo zero; (b) workflow dev→test→fix em loop (review paralelo read-only → fixer sequencial → re-verifica tsc, até 3 rondas) é óptimo para endurecer codebase novo.
- 2026-06-21 — **Perfil base do Renato via interview mode** (15 perguntas). Output: `memory/profile.md` (contexto estático canónico, tipo `user.md` do conceito Agentic OS) + 2 auto-memórias. Inspirado no vídeo Simon Scrapes "Creating Your Own Agentic OS" (memória 6-níveis, herança `claude.md`, acesso remoto — valida o roadmap FUTUROS). Pain point nº1 capturado como regra accionável: **fidelidade protótipo→React** (a AI diverge após a 1ª secção).
- 2026-06-21 — **`JOCA_Logic` renomeado para `JOCA_Brain`** (é o Brain). Refs em 28 ficheiros via `sed` scoped (excluídos docs históricos). **Lição (Windows):** não se renomeia a pasta-raiz do projecto de dentro do Claude — o cwd do próprio processo Claude segura-a (`Permission denied`). Padrão: actualizar refs in-session (ficheiros são graváveis; só o *rename do dir* bloqueia) → script `.bat` que o user corre com o Claude fechado → reabrir na nova pasta. JOCA_UI tem de ser parado antes (handles).
- 2026-06-21 — **Novo `JOCA_OS` = cópia do `JOCA_UI`** (robocopy `/E /MT:16`, 226M idêntico) como ponto de partida em vez de raiz. Por repurposar (renomear refs internas, mudar portas para não colidir com 7371/7372).

## Pendente
- **AGORA (ordem):** (1) fechar Claude → correr `JOCA_FINAL\rename-to-brain.bat` → reabrir em `JOCA_Brain` → reiniciar JOCA_UI → apagar o `.bat`. (2) Repurposar `JOCA_OS` (cópia do UI): renomear refs internas JOCA_UI→JOCA_OS, mudar portas (7371/7372 → ex. 7381/7382). (3) Desenhar arquitectura do JOCA_OS v2 (Jarvis) — usar `profile.md` + ideias do vídeo Simon Scrapes.
- **Commit por fazer:** `/upgrade-joca`+`/sync-questionnaires` + rename refs (28 ficheiros) uncommitted. Memória pessoal fica sempre fora: `memory/INDEX.md`, `memory/projects/*.md`, `memory/soul.md`, `memory/profile.md`, `memory/feedback/archive/`.
- JOCA_UI **parado** (7371/7372 mortos para libertar handles do rename).
- `~/CLAUDE.md` linha 22 descreve o JOCA_OS v1 (apagado) — desactualizada; corrigir quando o v2 estabilizar.
- Graph build de `4fa0bcc` — stale; rebuild após o rename (paths mudam) via Python API.

## Recuperar branches arquivados (se preciso)
```bash
git branch v1-legacy archive/v1-legacy          # restaura branch v1
git checkout archive/analyze-project            # inspecciona fork JOCA_Optimized
```

## Última sessão
2026-06-21 (tarde) — (1) **JOCA_OS v1 apagado**, novo `JOCA_OS` criado como cópia do `JOCA_UI`. (2) **Perfil base do Renato** via interview mode → `memory/profile.md` + auto-memórias. (3) **`JOCA_Logic` → `JOCA_Brain`** (o Brain): refs em 28 ficheiros feitos, rename físico da pasta PENDENTE (`rename-to-brain.bat`, Claude fechado). Próximo: rename → repurposar JOCA_OS → desenhar v2.
