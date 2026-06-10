# Auditoria JOCA_Logic — Gap Analysis vs Estado da Arte

## 1. Resumo executivo

O JOCA tem uma arquitectura validada pelo estado da arte — skills flat com lazy loading, soul.md como camada de personalidade, agents finos com procedimento nas skills, loop de self-improvement — mas a camada de **enforcement está toda morta**: os hooks nunca dispararam uma única vez (variável de ambiente que não existe), a recomendação do Stop hook nunca chega ao modelo, e as hard rules mais críticas (prod read-only, portas 7371/7372) existem só em prosa. O sistema confia 100% na memória do modelo para regras que deviam ser mecânicas. Em paralelo, a infraestrutura de dados degradou silenciosamente: metade do SKILL_INDEX.json sem triggers, 21 ficheiros de feedback por processar, credenciais em plaintext na memória, e referências quebradas no orquestrador do /one-shot. A boa notícia: quase tudo se corrige com edições cirúrgicas em Markdown/JSON/scripts — sem daemons, sem redesenho.

**Os 5 problemas mais importantes:**
- **Hooks inertes** — `$TOOL_INPUT_FILE_PATH` não é uma variável do Claude Code (o payload chega como JSON no stdin). track-changes.js e check-skill-paths.sh fazem no-op desde sempre; `.joca/` nem existe no disco. O pipeline de auto-test "3 camadas" é ficção.
- **Stop hook fala para o vazio** — auto-test-dispatch.js imprime para stdout com exit 0 (o modelo nunca vê) e apaga a queue. Mesmo com o stdin corrigido, a recomendação nunca chegaria ao Claude.
- **Hard rules sem enforcement** — `permissions.allow/deny` vazios. Editar a prod ou matar as portas 7371/7372 só é travado por prosa (~70% de adesão vs 100% com hooks). Já houve quase-incidente documentado.
- **Credenciais em plaintext na memória + corpus fora do git** — passwords reais em rate-it-plus.md e livro-de-elogios.md, carregadas em cada /resume, a um `git add` do repo público. E todo o memory/projects + feedback está untracked (zero durabilidade).
- **/one-shot estruturalmente inexecutável** — master-orchestrator despacha para 4 agents/skills que não existem (api-designer, frontend-dev, auth-security) e não há nenhum agent implementador no roster.

---

## 2. O que o JOCA já faz bem

Não tocar nestes pontos — estão ao nível ou acima do estado da arte:

- **Layout flat de skills + Read() on-demand + SKILL_INDEX.json** — exactamente o modelo de progressive disclosure da Anthropic; o paper do OpenHands SDK chega independentemente ao mesmo design. Não adicionar nesting, categorias nem pre-loading, nem vector DB.
- **soul.md como bloco de personalidade separado e pequeno (2.5KB)**, com parâmetros YAML de calibração — equivalente aos core-memory blocks do Letta, à frente da maioria dos sistemas de referência.
- **Agents finos + procedimento nas skills** — o contrato "Antes de iniciar: Read(skill)" replica a separação do wshobson/agents; allowlists de `tools:` em 26/28 agents implementam os privilege groups do AIOS (security-review só Read/Grep/Glob).
- **Brief obrigatório de 4 partes para sub-agents** + "sub-agents isolam contexto, não dividem papéis" + cap 3-5 workers — alinhado com AutoGen, OpenAI handoffs e os números publicados pela Anthropic.
- **Decision Filter** — 5 gates sequenciais em ~10 linhas; o design está certo, só falta enforcement.
- **Loop de self-improvement existe e captura de verdade** (21 ficheiros provam-no) — a maioria dos sistemas de referência nem tem loop; só falta fechar o consumo.
- **/save com destilação no momento da captura** e matriz de triagem de destino — "comprimir na captura, não na leitura" é a best practice principal e já está feito.
- **compile-bridges.sh** — idempotente (cmp -s), --dry-run, single source of truth; mirrors .agents/skills 102/102 e .codex/agents 28/28 em sync.
- **Review adversarial cross-model** (codex-review) com preflight, regra de no-fabrication e aviso de privacidade; separação geração/verificação nos testers ("report only, never auto-fix").
- **Economia de modelos no topo** — opus restrito aos 2 únicos raciocinadores multi-step; triggers bilingues PT/EN; pipelines como receitas de composição em zero código.
- **Arquitectura sem daemon** — correcta; tudo o que exigiria processo residente (AIOS scheduler, Letta server) está ausente de propósito.

---

## 3. Melhorias por dimensão

### 3.1 Arquitectura / OS

**[ALTA] Hooks nunca dispararam — variável fantasma** *(= Automação gap 1)*
settings.json passa `"$TOOL_INPUT_FILE_PATH"` aos dois hooks PostToolUse; o Claude Code entrega o payload como JSON no stdin, não nessa variável. Ambos os scripts caem no guard de argumento vazio. Evidência: `.joca/` não existe.
*Inspiração:* docs oficiais de hooks + disler/claude-code-hooks-mastery — input lê-se do stdin (`JSON.parse(fs.readFileSync(0))` / `jq -r '.tool_input.file_path'`).
*Mudança:* `.claude/hooks/track-changes.js` (ler stdin), `.claude/settings.json` (remover o arg; pipe `jq … | xargs -r` para check-skill-paths.sh; usar `$CLAUDE_PROJECT_DIR` nos paths). ~20 linhas. Verificar end-to-end: editar ficheiro → `.joca/test-queue.jsonl` aparece.

**[ALTA] Stop hook descartado por design + queue apagada** *(= Automação gap 2)*
auto-test-dispatch.js imprime para stdout com exit 0 (vai para o transcript, não para o modelo) e depois trunca a queue — o sinal morre permanentemente.
*Inspiração:* docs oficiais — Stop hooks só influenciam o modelo via `{"decision":"block","reason":…}` ou exit 2 + stderr; "Stop-gate testing" da comunidade.
*Mudança:* `.claude/hooks/auto-test-dispatch.js` — emitir o JSON de block com a recomendação quando a queue não está vazia; sentinel por sessão (`.joca/dispatched-<session_id>`) para bloquear no máximo 1×; só limpar a queue ao emitir.

**[ALTA] Hard rules em prosa; permissions vazias** *(= Automação gap 6)*
*Inspiração:* OpenHands (SecurityAnalyzer + ConfirmationPolicy), AIOS access manager, Anthropic ("regra violada 2× → hook").
*Mudança:* (1) `~/.claude/settings.json` (nível user, cobre todos os projectos): deny `Edit(/Users/renatoferreira/JOCA/**)`, `Write(/Users/renatoferreira/JOCA/**)`; (2) hook PreToolUse(Bash) ~40 linhas que dá exit 2 + alternativa segura em comandos a tocar `:7371|:7372` ou a escrever na prod (escape hatch `JOCA_PROD_WRITE_OK=1` para /update-joca); (3) `timeout` em cada hook e allow para os scripts próprios do toolkit.

**[ALTA] ~11.5KB de rules/ sempre carregados, com duplicado de skill** *(= Skills gap 4)*
api-design.md (6.5KB) duplica skills/rest-api.md e auto-descreve-se como lazy; testing.md aponta para 10 `references/*.md` que não existem.
*Inspiração:* Letta (core memory com limite duro), Agent OS (só Standards universais ficam residentes), Anthropic ("removeria isto causaria erros?").
*Mudança:* apagar `.claude/rules/api-design.md` (fundir conteúdo único — Sunset, tabela de anti-patterns — em `skills/rest-api.md`); reduzir `rules/testing.md` aos MUST DO/MUST NOT (~20 linhas) ou mover para skill. Comentário de budget `<!-- budget: 10KB -->` nos ficheiros residentes + lint no compile-bridges.sh. Ganho: ~2.5-3k tokens por sessão, zero perda.

**[MÉDIA] Routing triplicado e SKILL_INDEX degradado** *(= Skills gap 2, Automação gap 7)*
65/130 entradas com triggers vazios, 107 descrições truncadas a meio de palavra (`desc[:200]`), artefactos `,,`, category morta. É a única superfície de discovery para ~60 skills fora do trigger map.
*Inspiração:* AIOS (uma syscall table, tudo derivado), OpenHands (registos gerados dos artefactos).
*Mudança:* `.claude/scripts/build-skill-index.py` — truncar em fronteira de frase / 1024 chars, corrigir `,,`, remover category; backfill de `triggers:` nos 65 ficheiros (passagem mecânica); modo `--strict`/`validate` que falha com triggers vazios e cruza o trigger map do CLAUDE.md contra o disco; chamar do compile-bridges.sh e do /save. Longo prazo: gerar a tabela do CLAUDE.md a partir do frontmatter entre marker comments.

**[MÉDIA] Sem event log — self-improvement corre a anedota**
*Inspiração:* OpenHands event sourcing (JSONL imutável), AIOS K-LRU (pruning por contagem de acessos, não vibes).
*Mudança:* estender o hook PostToolUse (já corrigido) para appendar 1 linha JSONL por evento em `.joca/log/YYYY-MM.jsonl` {ts, session, tool, file, domain}; matcher Read para logar leituras de `.claude/skills/*.md` (dá last-used por skill); secção em `upgrade-joca.md` para minerar: 0 reads em 90 dias → propor arquivo em `_archive/`.

**[MÉDIA] Bridges GEMINI.md/AGENTS.md compiladas de heredocs estáticos — já divergiram**
A bridge Gemini lista 4 rotas vs ~40 do mapa canónico; codex e agy correm com routing degradado.
*Inspiração:* Agent OS (outputs gerados de uma fonte canónica), AutoGen (camada derivada nunca restated à mão).
*Mudança:* `compile-bridges.sh` — gerar as secções de skills/agents dos heredocs a partir do trigger map (marker comments) e de `ls .claude/agents/`; drift check que falha se a contagem de rotas divergir.

**[BAIXA] /save sem contrato de retoma**
*Inspiração:* AIOS snapshot-and-restore, OpenHands Condenser (resumos como artefactos de primeira classe).
*Mudança:* bloco fixo de 4 campos no template do /save (`Next step:` / `Files touched:` / `Open decisions:` / `Verify with:`); /resume lê-o primeiro; 1 linha no CLAUDE.md: "Em compactação, preservar sempre: lista de ficheiros modificados, comandos de teste, next step."

### 3.2 Memória

**[ALTA] Loop de feedback nunca fecha** *(= Arquitectura gap 7)*
21 ficheiros desde 26-05, zero `processed: true`, archive/ não existe; /upgrade-joca é o único leitor e depende da memória do utilizador.
*Inspiração:* Letta sleep-time compute (consolidação é obrigação agendada), claude-mem (SessionStart injecta trabalho não consumido).
*Mudança:* (1) `resume.md` passo 4 — linha "Feedback pendente: N items (mais antigo <data>) → /upgrade-joca" quando N>0; (2) `save.md` PASSO 8 — recomendação explícita quando ≥8 pendentes ou crítico; (3) P2: run semanal headless `claude -p "/upgrade-joca"` na cópia de dev.

**[ALTA] Sem detecção de contradições — quase-incidente documentado**
joca-open-source.md tinha as portas invertidas (memória contradizia a hard rule); /resume reportou dev "ahead" quando estava 12 commits behind.
*Inspiração:* Graphiti (conflict detection no momento da escrita), Mem0 (fase UPDATE/DELETE vs append).
*Mudança:* `save.md` PASSO 2 — "antes de escrever um facto, grep ao ficheiro + ~/CLAUDE.md por factos sobre o mesmo assunto; conflito → UPDATE in place (git preserva o antigo); hard rule do CLAUDE.md ganha sempre"; `resume.md` passo 2 — factos operacionais (branch, portas, servidores) verificados com comando real (`git status -sb`, `lsof -i`), nunca reportados da memória.

**[ALTA] Credenciais em plaintext, carregadas em cada /resume**
rate-it-plus.md linhas 12-13 (Mailjet + seed password), livro-de-elogios.md linha 32 (admin Filament). Viola a soul.md e está a um commit do repo público.
*Inspiração:* claude-mem (`<private>` tags), Anthropic (memória auditável = segredos como ponteiros, nunca valores).
*Mudança:* scrub imediato dos 2 ficheiros (substituir por "ver backend/.env / seeder X"); regra "NUNCA escrever credenciais em memory/ — escrever onde encontrá-las" em `save.md` PASSO 2-3 e em `feedback-joca.md` "O que NÃO capturar".

**[ALTA] Ficheiros de projecto crescem sem limite**
livro-de-elogios.md = 12KB / ~3k tokens, 8+ blocos de sessão empilhados, 80% peso morto (detalhe já no git e nos docs/).
*Inspiração:* Anthropic auto-memory (cap 200 linhas/25KB), Letta (limites de bloco forçam curadoria).
*Mudança:* `save.md` PASSO 2 — máximo 3 blocos de sessão; a 4ª comprime para 1 linha em **Histórico**; alvo ≤120 linhas. Aplicar uma vez a livro-de-elogios.md.

**[MÉDIA] Corpus de memória fora do git**
Só INDEX.md e SKILL_INDEX.json tracked; sem commits, a estratégia "supersede in place, git preserva história" é impossível.
*Mudança:* `save.md` PASSO 7b — `git add memory/… && git commit -m "memory: save <projecto>" || true`; commit one-time do corpus **depois** do scrub de credenciais (a ordem importa).

**[MÉDIA] Zero captura automática — sessão sem /save perde tudo**
*Inspiração:* claude-mem — hooks de lifecycle, não disciplina do utilizador, são o mecanismo de captura.
*Mudança:* `auto-test-dispatch.js` — antes de limpar a queue, escrever `{date, cwd, files[]}` em `.joca/last-session.json`; `resume.md` — se esse ficheiro for mais recente que a memória do projecto, avisar "última sessão terminou sem /save, ficheiros: …". ~15 linhas.

**[MÉDIA] Lições repetidas nunca promovem a regra**
Lição Filament v5 documentada 3×, nunca promovida.
*Inspiração:* Mem0 (ADD/UPDATE/NOOP), regra "second mistake" da Anthropic.
*Mudança:* `save.md` PASSO 4 — grep a memory/feedback/ antes de escrever; issue existente → `recorrencia: N`; ≥2 → `promover: true`, que o /upgrade-joca ordena primeiro.

**[MÉDIA] Quatro formatos de frontmatter divergentes**
*Inspiração:* Graphiti/Letta — schema explícito; Markdown sem schema é ok, inconsistente para máquinas não.
*Mudança:* schema canónico flat (name, type, directorio, status, last_session) declarado em save.md + init-project.md; migrar os 8 ficheiros; `validate-memory.py` ~25 linhas chamado do /save com `|| true`.

**[MÉDIA] Dual-store sem precedência (memory/ vs auto-memory ~/.claude)**
Mesmo facto nos dois sítios; funk_pop.md tem wiki-link morto para o outro store.
*Mudança:* secção de 4 linhas "Memory precedence" no CLAUDE.md do JOCA_Logic (memory/ canónico para projectos/toolkit; auto-memory só preferências do utilizador; conflito → memory/ ganha); corrigir funk_pop.md linha 15 inlining a lição.

**[BAIXA] INDEX.md desactualizado e mantido à mão**
Lista projecto inexistente, omite meta-poster, secção Feedback vazia apesar de mandato (21 ficheiros, 0 indexados).
*Mudança:* gerar a secção Projects do frontmatter (extensão ao build-skill-index.py ou script de 30 linhas chamado do /save); Feedback = 1 linha computada; apagar o mandato morto do feedback-joca.md passo 5.

### 3.3 Skills

**[ALTA] Activação de skills é só prompt — sem forcing function** *(= Automação gap 3)*
"#1 source of avoidable errors" por admissão própria, e nada o força.
*Inspiração:* obra/superpowers (skill-search scripted + injecção SessionStart "skill usage is mandatory"), padrão UserPromptSubmit da comunidade disler.
*Mudança:* (1) hook **UserPromptSubmit** que faz grep do prompt contra os triggers do SKILL_INDEX.json e injecta `additionalContext` "Skill relevante: Read(.claude/skills/X.md) antes de codificar" — converte o trigger map de exortação em enforcement; (2) hook PostToolUse(Read) que regista skills lidas em `.joca/skills-read.jsonl` + warning não-bloqueante quando um Write .php/Filament acontece sem a skill correspondente lida; (3) SessionStart com 2 linhas de lembrete. Depende do índice reparado (3.1).

**[ALTA] /create-skill quebrado contra o layout flat**
Template inexistente, `find -name 'SKILL.md'` apanha 0 ficheiros, output depth-3 viola a regra flat.
*Inspiração:* anthropics/skills skill-creator (modos Create/Eval/Improve/Benchmark), superpowers writing-skills ("NO SKILL WITHOUT A FAILING TEST FIRST").
*Mudança:* reescrever `create-skill.md` (ls *.md, output `.claude/skills/<name>.md`); criar `templates/skill-template.md`; passo RED obrigatório (baseline sem skill em subagent fresco; se já passa, abortar); passo final corre build-skill-index.py + actualiza INDEX.md.

**[MÉDIA] Monólitos de 400-500 linhas sem progressive disclosure interna**
*Inspiração:* modelo oficial Anthropic (<500 linhas, references/ um nível), superpowers (budgets com wc -w).
*Mudança:* dividir só os 5-6 maiores (availability, saas-patterns, wp-performance-review, reverb-realtime, frontend): core <200 linhas + companion `<name>.ref.md` (preserva o flat depth-1; o index ignora *.ref.md). Não dividir os outros ~96.

**[MÉDIA] Sem validação/eval — rot não medido**
7 skills pinam "Laravel 11" com Bigorna em Laravel 13.
*Inspiração:* anthropics/skills skill-validator + GitHub Action de lint.
*Mudança:* `.claude/scripts/validate-skills.py` (frontmatter completo, descrição ≤1024 com what+when, corpo <500 linhas, sem Read targets mortos, flag de version pins); ligar ao hook PostToolUse filtrado a `.claude/skills/` e ao compile-bridges.sh.

**[MÉDIA] Long tail de ~60 skills só alcançável por recall**
*Inspiração:* superpowers skill-search CLI.
*Mudança:* `.claude/scripts/find-skill.py` (~30 linhas, grep PT+EN sobre o index); 1 linha no CLAUDE.md: "Sem match no trigger map? Correr find-skill.py antes de responder genericamente."

**[BAIXA] Descrições hostis à activação**
karpathy-guidelines dispara com "Behavioral, LLM" — termos que nenhum utilizador diz.
*Mudança:* passagem de auditoria por subagent às 102 descrições ("what + Use when <sintomas PT+EN>", nunca resumo de workflow); checklist absorvida pelo validate-skills.py.

### 3.4 Agents

**[ALTA] master-orchestrator despacha para 4 inexistentes**
api-designer, frontend-dev/frontend-design, auth-security não existem — o motor do /one-shot erra ou improvisa no ponto mais caro (opus).
*Inspiração:* wshobson/agents (validação mecânica de referências contra o registry).
*Mudança:* reescrever a tabela Phase 2 de `master-orchestrator.md` com nomes reais (rest-api, frontend, auth, security), marcando skill vs agent por linha. 10 min.

**[ALTA] Zero agents implementadores**
Roster só tem reviewers/testers/debuggers; os streams paralelos do /one-shot não têm worker concreto.
*Inspiração:* Anthropic research system (Opus lead + Sonnet workers), superpowers (implementador fresco por tarefa).
*Mudança:* criar `.claude/agents/laravel-implementer.md` e `frontend-implementer.md` (~30 linhas cada: skills obrigatórias, tools Read/Write/Edit/Bash/Glob/Grep, model: inherit, "touch only assigned files", protocolo de retorno); actualizar Phase 2.

**[MÉDIA] Cross-references estragadas sem drift check**
prd-reviewer `skills: planning-prd` (não existe), log-debugger recomenda `error-detective` (não existe), gemini-auditor usa path nested obsoleto.
*Mudança:* corrigir os 3; criar `.claude/scripts/validate-agent-refs.sh` (frontmatter `skills:` vs disco, menções de agents vs agents/) ligado ao PostToolUse + modo `--all` para /upgrade-joca.

**[MÉDIA] Reviewers com write access e custo de modelo imprevisível**
tester-code sem `tools:` herda Write/Edit e corre em opus quando despachado pelo orquestrador.
*Inspiração:* docs oficiais — "um reviewer que não pode escrever não pode 'corrigir prestavelmente'".
*Mudança:* `tools: Read, Grep, Glob, Bash` + `model: sonnet` em tester-code; allowlist em design-system-audit; 1 linha de política no CLAUDE.md: "Reviewers/auditors nunca recebem Edit."

**[MÉDIA] Brief de 4 partes sem formato de output nem protocolo de estado**
*Inspiração:* superpowers (DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED), Anthropic (output format é mandatório no brief).
*Mudança:* Rule 3 do master-orchestrator → brief de 5 partes; bloco "Return Protocol": todo o agent termina com `STATUS:`, resumo ≤15 linhas, lista de ficheiros. ~20 linhas.

**[MÉDIA] Viés Laravel em agents stack-genéricos**
tester-security/log-debugger assumem Laravel; em Next.js/Remotion/Node produzem relatórios magros silenciosamente.
*Inspiração:* VoltAgent (escada de granularidade), wshobson (procedimento por stack em skills condicionais).
*Mudança:* preâmbulo de detecção de stack (~10 linhas) em tester-security e log-debugger: detectar composer.json/package.json/pyproject.toml; fora de Laravel, correr fases genéricas e reportar explicitamente "fases Laravel saltadas — stack é X".

**[BAIXA] Sem tier haiku, sem maxTurns, findings duplicados, descrição de 1.5KB**
*Mudança:* `model: haiku` nos wrappers CLI (img-gen-google, img-gen-openai, video-gen, watch); `maxTurns` em deep-research e testers; cortar a Phase 6 do tester-security (duplica security-review) para um ponteiro; descrição do log-debugger de ~40 para ~8 triggers distintos.

### 3.5 Automação / Hooks

Os gaps maiores (stdin, Stop block, permissions, router UserPromptSubmit, triggers vazios) já estão fundidos em 3.1/3.3. Restantes:

**[MÉDIA] check-skill-paths.sh explica violações no stream errado**
Com exit 2, o Claude só lê stderr — a explicação vai para stdout.
*Mudança:* embrulhar o bloco de echo em `{ … } >&2`. 5 min.

**[MÉDIA] Regeneração de índice/bridges depende de o modelo lembrar-se dos passos do /save**
*Inspiração:* Anthropic — "instruções são advisory, hooks são determinísticos"; padrão lint-on-write.
*Mudança:* hook PostToolUse(Write|Edit) que, em paths `.claude/skills/|agents/|commands/`, corre build-skill-index.py + compile-bridges.sh com `"async": true`; apagar os passos de prosa correspondentes de save.md/upgrade-joca.md.

**[MÉDIA] Artefactos stale que contradizem a configuração viva**
*Mudança:* apagar hooks/track-changes.sh, hooks/auto-test-dispatch.sh, scripts/statusline-command.sh; arquivar consolidate-branches.sh; reescrever hooks/README.md (~15 linhas) com a wiring real (stdin JSON, exit codes) depois das correcções.

**[MÉDIA] Locator do /upgrade-joca resolve para directório pré-split**
`*/JOCA/CLAUDE.md` → /Users/renatoferreira/JOCA, cujo memory/ já não existe.
*Mudança:* corrigir para `*/JOCA_Logic/CLAUDE.md` em upgrade-joca.md linha 24; grep aos 19 commands por `JOCA/memory` e corrigir help-joca.md/resume.md na mesma passagem.

**[BAIXA] Graphify via API privada silenciada em 4 call sites**
*Mudança:* rotear tudo por `joca-graphify.sh`; dentro dele, em falha, imprimir "graphify rebuild failed — graph may be stale" para stderr em vez de engolir.

**[BAIXA] Sem SessionStart — /resume é manual e opcional**
*Inspiração:* SessionStart oficial com matchers startup|resume|compact.
*Mudança:* hook SessionStart que emite ~5 linhas (branch + dirty count, ponteiro para INDEX.md, projecto correspondente ao cwd, staleness do graph); matcher `compact` re-injecta só as hard rules (prod read-only, portas). /resume mantém-se para o deep-load.

---

## 4. Quick wins (todos <30 min)

**Hooks / enforcement**
1. Patch stdin em track-changes.js + pipe jq para check-skill-paths.sh em settings.json; testar que `.joca/test-queue.jsonl` aparece (~20 min)
2. auto-test-dispatch.js → `{"decision":"block","reason":…}`; queue só limpa ao emitir (~15 min)
3. check-skill-paths.sh: bloco de violação para stderr (~5 min)
4. Deny rules `Edit/Write(/Users/renatoferreira/JOCA/**)` em ~/.claude/settings.json (~10 min)
5. `timeout` nos 3 hooks + allow para scripts próprios do toolkit (~10 min)
6. Apagar duplicados stale (.sh dos hooks, statusline-command.sh) + arquivar consolidate-branches.sh (~10 min)

**Memória**
7. Scrub de credenciais em rate-it-plus.md e livro-de-elogios.md → ponteiros (~10 min)
8. Regra "NUNCA credenciais em memory/" em save.md + feedback-joca.md (~5 min)
9. git add + commit do corpus de memória (depois do scrub) + passo de commit no save.md (~10 min)
10. Corrigir INDEX.md (remover meu-site-github, adicionar meta-poster) (~5 min)
11. Contador de feedback pendente em resume.md + save.md (~10 min)
12. Cap de 3 blocos de sessão + fold Histórico em save.md; aplicar a livro-de-elogios.md (~25 min)
13. Secção "Memory precedence" (4 linhas) no CLAUDE.md + corrigir wiki-link morto em funk_pop.md (~10 min)

**Skills / contexto residente**
14. Apagar rules/api-design.md (fundir conteúdo único em skills/rest-api.md) — ~1.5k tokens/sessão (~20 min)
15. Trim de rules/testing.md para MUST DO/MUST NOT, apagar tabela de references mortas (~10 min)
16. build-skill-index.py: truncar em frase, corrigir `,,`, remover category, warning de triggers vazios (~25 min)
17. find-skill.py (~30 linhas) + 1 linha na Activation Rule (~25 min)
18. Corrigir descrição da karpathy-guidelines com triggers reais (~5 min)
19. Substituir os 7 pins "Laravel 11" por "Laravel 11+" (~10 min)
20. Patch mínimo ao create-skill.md (ls *.md, output flat) + criar skill-template.md (~25 min)

**Agents**
21. Tabela Phase 2 do master-orchestrator com nomes reais (~10 min)
22. prd-reviewer `skills: prd`; remover error-detective do log-debugger; path flat no gemini-auditor (~10 min)
23. tools + model:sonnet em tester-code; allowlist em design-system-audit (~10 min)
24. Brief de 5 partes + protocolo STATUS no master-orchestrator (~15 min)
25. model:haiku nos 4 wrappers CLI; trim da descrição do log-debugger (~10 min)
26. Corrigir locator do upgrade-joca.md + grep-fix de "JOCA/memory" nos commands (~15 min)
27. Corrigir CLAUDE.md "Source of Truth" (`skills/` → `.claude/skills/`) + 1 linha de guidance de compactação (~10 min)

---

## 5. Roadmap proposto

### P0 — Esta semana (reanimar o enforcement + estancar riscos)
Quick wins 1-10, 14-15, 21-22, 26-27. Foco: hooks vivos, hard rules mecânicas, credenciais fora, memória no git, /one-shot resolúvel, ~3k tokens/sessão recuperados.
**Critério de sucesso (verificável):**
- Editar um ficheiro → `.joca/test-queue.jsonl` ganha 1 linha; terminar a sessão → o modelo recebe o block AUTO-TEST.
- Tentar `Edit` em /Users/renatoferreira/JOCA → negado pelas permissions.
- `grep -ri "pass\." memory/` devolve zero credenciais; `git ls-files memory/projects | wc -l` ≥ 8.
- /one-shot dry-run: todos os nomes da Phase 2 resolvem para ficheiros em disco.

### P1 — Este mês (routing fiável + loop de memória fechado)
Índice reparado com backfill de triggers nos 65 ficheiros; hook UserPromptSubmit de routing; validate-skills.py + validate-agent-refs.sh ligados ao PostToolUse e ao compile-bridges.sh; agents implementadores + protocolo STATUS; regras de contradição/verificação real/dedup/schema em save.md e resume.md; captura de last-session.json; SessionStart hook; event log JSONL; create-skill reescrito com passo RED; quick wins restantes.
**Critério de sucesso:**
- `build-skill-index.py --strict` passa com 0 triggers vazios e 0 descrições truncadas a meio de palavra.
- Prompt com "Filament" numa sessão nova → additionalContext aponta a skill antes de qualquer código.
- /resume mostra contagem de feedback pendente e verifica branch/portas com comandos reais.
- validate-agent-refs.sh --all devolve 0 referências mortas.

### P2 — Depois (consolidação contínua + derivação total)
Run semanal headless de /upgrade-joca (cron/scheduled agents); bridges GEMINI.md/AGENTS.md geradas do canónico com drift check; split dos 5-6 monólitos em core + .ref.md; mining do event log para arquivar skills mortas (0 reads/90 dias); detecção de stack nos testers; geração do INDEX.md de memória; auditoria das 102 descrições; trigger map do CLAUDE.md gerado do frontmatter.
**Critério de sucesso:**
- Backlog de feedback mantém-se ≤5 ficheiros durante 4 semanas sem intervenção manual.
- Drift check das bridges verde no compile-bridges.sh (contagem de rotas = mapa canónico).
- /upgrade-joca apresenta pelo menos 1 proposta de arquivo baseada em dados de uso, não anedota.