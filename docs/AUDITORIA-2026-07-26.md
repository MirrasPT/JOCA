# Auditoria completa do JOCA — 2026-07-26

Auditoria a todo o sistema: JOCA_Brain (131 skills · 36 agents · 27 commands · 10 hooks · 8 rules · 21 scripts), JOCA_OS (backend ~4.400 linhas + frontend ~7.000 linhas), fluxos de instalação/actualização, questionários e bridges cross-CLI. Cinco auditores independentes (install/update · componentes Brain · backend · frontend · infra/hooks), achados verificados no código com file:linha. Só-leitura — nada foi corrigido nesta auditoria.

## Veredicto executivo

A **doutrina do JOCA é de alta qualidade e internamente consistente** — rules, soul, padrões de orquestração e as melhores skills (frontend, yagni, agent-sdk, automations) estão ao nível do melhor que há no ecossistema. As falhas concentram-se quase todas na **camada de ligação**: paths que não resolvem, índices que truncam, hooks que não disparam, documentação que divergiu do código. Em frase: *o sistema sabe o que devia fazer; frequentemente não consegue chegar aos ficheiros que o dizem.*

Os três problemas mais urgentes:
1. **Dois buracos de segurança reais no JOCA_OS** (DNS rebinding → RCE local; nó `llm` com ferramentas + bypass).
2. **O caminho de actualização está funcionalmente parado** (`origin/master` vs `main`) e o de instalação produz instalações silenciosamente incompletas (hooks inertes, frontend por compilar, portas erradas).
3. **Metade do sistema autónomo não dispara**: 43% das skills invisíveis ao índice de activação, pipeline de auto-teste morto, guard-rails inoperantes fora do repo JOCA.

---

## 🔴 CRÍTICOS (14)

### Segurança — JOCA_OS

**S1 · DNS rebinding anula o guard de origem → RCE local via browser.**
`security-fs.ts:125` + `server.ts:57-58`: o check "Origin == Host" compara o Origin com um Host que o atacante controla (rebinding evil.com→127.0.0.1). GETs nem passam pelo guard. Com auth OFF (modo default local), uma página maliciosa lê `/file-content`, `/runtime` e fala com o WS → input directo aos PTYs = shell arbitrário.
→ Validar o **Host** contra allowlist (loopback + hosts de `JOCA_HOST`/`JOCA_ALLOWED_ORIGINS`) em todos os métodos e no `verifyClient`; só depois aceitar Origin==Host.

**S2 · Nó `llm` das automações corre com TODAS as tools + `bypassPermissions`.**
`automations/runner.ts:90` não passa `noTools:true`; o provider aplica sempre bypass. Pipeline `[http]→[llm]→[message]`: conteúdo web injectado pode mandar o modelo executar Bash/Write, silenciosamente (sem terminal visível). Judge, heartbeat e /optimize-objective já estão correctos — só este caso ficou de fora.
→ `noTools: true` no case `'llm'`. Uma linha.

**S3 · Auth fail-open em runtime num VPS.**
`auth.ts:42-44,112-115`: `authEnabled()` relê `auth.json` a cada request; se o ficheiro desaparecer/corromper com o servidor em `0.0.0.0`, toda a gente passa a autenticada. O gate só corre no boot.
→ Cachear "auth estava configurada" no arranque e falhar fechado (401/503) depois disso.

**S4 · `SENSITIVE_HOME_SUBDIRS` não protege as credenciais dos próprios CLIs.**
`security-fs.ts:64-73`: faltam `.claude` (OAuth token!), `.claude.json`, `.codex`, `.gemini`. `GET /file-content` serve-os.
→ Adicionar à lista.

### Fluxo de instalação/actualização

**I1 · `/update-joca` está parado: tudo aponta para `origin/master`, a branch é `main`.**
`update.md:49,55,103,109` · `update-joca.md:70,85,209,219` · `sync-brain.md:29-56` · `migrate.md:148-149`. `git log HEAD..origin/master` morre com *unknown revision*.
→ `master`→`main` global (ou resolver via `git symbolic-ref refs/remotes/origin/HEAD`).

**I2 · Instalação produz setups silenciosamente incompletos.** Quatro causas combinadas:
- Portas erradas em todo o onboarding: docs dizem 7371/7381; reais são **7491/7492** (`install.md:942-1018`, `migrate.md:424-426`, `JOCA_OS/CLAUDE.md:31-35`).
- Bloco JSON de exemplo usa placeholder `<BRAIN>` que o passo de substituição (`<JOCA_ROOT>`) não trata (`install.md:888-929`) → hooks que falham em silêncio.
- `sed -i ''` rotulado "macOS/Linux" é sintaxe BSD — falha em Linux; `$0` não resolve em sessão de agente (`install.md:853-855`).
- **O frontend nunca é compilado** (`install.md:955-967`, `update-joca.md:269-271`): modo VPS/PWA fica sem `dist/` para servir.
→ Normalizar portas; colar o `settings.json` literal; substituição via `node -e` + `git rev-parse --show-toplevel`; acrescentar `npm run build` ao install e ao update.

**I3 · Protecção `origin: local` semanticamente quebrada.**
15 skills **oficiais do upstream** carregam `origin: local` (joca-os-windows, cloudflare-dns, woocommerce-elementor, …) → ficam congeladas para sempre pelo `/update-joca`. Pior: `upgrade-joca.md:234` marca `origin: local` também em `IMPROVE_SKILL` de skills upstream — cada melhoria local congela a skill contra updates futuros. E a "protecção" de `soul.md`/`settings.json` é declarativa: são ficheiros git-tracked que o install modifica → conflito de stash a cada pull.
→ Nova marca exclusiva de criação local (`origin: user`); limpar `origin: local` dos ficheiros publicados; separar template/instância (soul.template.md + gitignore da instância).

**I4 · `migrate.md` é perigoso: descreve um layout que já não existe e faz `rm -rf` sem guarda.**
`migrate.md:15-38,117-129`: assume `.claude/` na raiz (pré-JOCA_Brain), apaga ficheiros na raiz errada, referencia branch `v1-legacy` inexistente e placeholders de soul com nomes errados (`<USER_NAME>` vs `<YOUR_NAME>`).
→ Reescrever para o layout actual com gates por bloco destrutivo, ou arquivar o comando.

### Sistema de activação de skills (Brain)

**B1 · 43% das skills são invisíveis ao sistema de activação.**
`build-skill-index.py:70,91,107`: só lê o campo `triggers:` do frontmatter (56/131 skills não o têm → `triggers: []`), corta a 10 triggers (75 entradas truncadas) e a 200 chars de descrição (128/167 cortadas a meio dos gatilhos). O `task-router` e o `/goal` calculam o match ≥60% **a partir deste índice**.
→ Extrair triggers da description ("MUST be invoked when…"), remover caps, ler `metadata.category` (hoje: 131 skills na categoria "general").

**B2 · `/create-skill` produz skills invisíveis.**
`create-skill.md:116-172` manda escrever em `skills/created-skills/<n>/SKILL.md` e afirma que é "auto-discovered" — falso: o glob do indexador é não-recursivo (`build-skill-index.py:77`) e o CLAUDE.md exige flat depth-1. Toda a skill criada pelo pipeline oficial nasce fora do índice.
→ Alinhar: escrever flat + reindexar (ou glob recursivo — escolher um).

**B3 · 61 referências `rules/*.md` num path que não resolve (30 ficheiros).**
O directório real é `.claude/rules/`. Inclui o **Step 0 obrigatório do task-router** (`task-router.md:27,35`) e o `/goal` (`goal.md:22`) → o classificador cai sempre no fallback heurístico.
→ Substituição global `rules/` → `.claude/rules/`. Mecânico, 10 minutos.

### Hooks / loop autónomo

**H1 · O pipeline de auto-teste está morto ponta-a-ponta.** Três falhas independentes:
- `auto-test-dispatch.js:32` imprime a recomendação em stdout de um hook **Stop** — que nunca é injectado no contexto do modelo. A doutrina "Stop lê e recomenda testers → despachar sem perguntar" não acontece.
- `check-skill-paths.sh` (settings.json:62) recebe `"$TOOL_INPUT_FILE_PATH"` — variável que o Claude Code não define → no-op em todos os SO.
- `stop-checkpoint.js:20-22` lê a queue em `cwd/.joca/` mas `track-changes.js:19-21` escreve-a em `<JOCA_Brain>/.joca/` → auto-checkpoints quase nunca disparam.
→ Stop hook com `{"decision":"block","reason":"AUTO-TEST: …"}`; wrapper stdin para o .sh; unificar o path da queue.

**H2 · Guard-rails (/freeze, /careful, /tdd) não protegem nada fora do repo JOCA.**
O `settings.json` com os hooks é project-scope do JOCA_Brain; o install nunca faz merge em `~/.claude/settings.json`. Em qualquer projecto-alvo (ou via JOCA_OS), as 5 skills guard-rail são prosa sem enforcement. Agravante: no checkout público, o placeholder `<JOCA_ROOT>` deixa os 10 hooks inertes até ao /install (o joca-doctor já detecta isto).
→ Instalar o bloco hooks em `~/.claude/settings.json` (paths já são absolutos) e documentar o scope.

---

## 🟠 ALTOS (selecção — 18)

### Backend JOCA_OS
- **Leak de PTYs por automação:** cada run de worker node abre uma sessão que nunca fecha (`runner.ts:73-84`) → automação horária esgota as 30 sessões em ~30 runs e TUDO pára de criar workers. Reutilizar worker por automação ou fechar após N runs.
- **Enter puro não conta como resposta** (`session-manager.ts:334`): responder a um menu de confirmação só com Enter não arma `notifyOnIdle` → `waitForUserAnswer` só resolve no timeout de 24h com o trabalho já feito.
- **Done-por-silêncio sem juiz nas automações:** o runner captura tail parcial em pausas >1,5s e segue pipeline como "ok" (`runner.ts:80-84`) — o engine tem juiz, o runner não.
- **`moveTask` nunca re-compacta a coluna de origem** (`tasks/store.ts:143-149`, código morto confirmado) → orders duplicados → ordenação ambígua da fila.
- **Scheduler decide retry/nextRun com snapshot stale** (`scheduler.ts:30-59`): editar/desactivar uma automação durante um run longo é pisado no fim; PATCH não faz reset de retryCount.
- **`/cli-tools` bloqueia o event loop até ~45s** (`cli-capabilities.ts`: até 9 execSync com shell interactivo, sem cache) — WS e PTYs congelam.
- **`pty.write` em timers sem guarda** (`session-manager.ts:113,209,337`): sessão morta entre agendamento e callback → uncaughtException → backend abaixo com todos os PTYs.
- **Estado zombie pós-restart:** tarefas `em-execucao` e automações `running` ficam assim para sempre após crash — o boot não as varre.
- **SSRF no nó http + injecção shell via `{{input}}`** (`runner.ts:94-108`): em VPS o http alcança metadata endpoints; input remoto interpolado na linha shell.

### Frontend JOCA_OS
- **Token expirado → white-screen crash:** fetches fazem `r.json()` sem `r.ok` (`App.tsx:124` e mais 4) → `{error}` entra em `setProjects` → `.filter` rebenta. Precisa de `fetchJson` central + 401 → LoginScreen.
- **WS rejeitado por auth → loop infinito de reconnect a 2s** sem backoff nem saída (`useSessionSocket.ts:205-211`).
- **Reconnect não re-sincroniza terminais** — output emitido durante a desconexão desaparece do xterm; em mobile (socket suspenso em background) é o caso normal, não o excepcional.
- **Input descartado em silêncio** com socket fechado (`send()` é no-op sem indicação).
- **Drag-and-drop 100% inoperável em touch** — Kanban e reordenação usam HTML5 `draggable` → mover tarefas em telemóvel é impossível.
- **Painel direito inexistente <860px** (`App.css:5640-5644`): Settings, Files, Toolkit — incluindo o heartbeat UI — não existem em telemóvel.

### Brain / docs
- **Bridges GEMINI.md/AGENTS.md estáticos e errados:** listam MCPs que já não existem (blender/firecrafl/huggingface), "Caveman-full" vs o real "Caveman Lite", pipelines v1; o gerador calcula o inventário real e nunca o usa (`compile-bridges.sh:156-159`, código morto). Commands (27) não são espelhados em bridge nenhum.
- **Referências fantasma em massa:** `.claude/product-marketing-context.md` (14 skills de marketing), 9 scripts/templates do `deep-research` (o agente vai invocar Python inexistente), `memory/knowledge/` (destino do /know), `memory/feedback/{archive,proposals}/` (destino do /upgrade-joca), `memory/profile.md` (referenciado pelo soul.md em TODAS as sessões).
- **9 agentes carregam skills que instruem `Agent(spawn)`** — impossível a partir de subagente (regra 1-nível). Reformular para o padrão dual "main loop: Agent(...) / subagente: devolve sugestão" que o chaining.md já define.

---

## 🟡 MÉDIOS (selecção — 15)

1. **Clusters de colisão de triggers** (activação ≥60% ambígua): email (10 skills, postmark↔transactional-email com 77% de sobreposição), deploy (11 skills — `deploy-ploi` reclama os termos genéricos "deploy/server/production"), landing page (5), guard-rails (5 skills quase idênticas com hooks mortos → colapsar em 1), filas Laravel/Node (bullmq↔queues 62%), design-system (6), plan↔planning, analytics (4). Falta um `deploy-router`; o `email` precisa de decision table.
2. **`rules/testing.md` não é uma rule** — é uma skill genérica de 4,9 KB auto-carregada em toda a sessão, com 10 referências a `references/*.md` que não existem. Mover para skills/ ou reference/.
3. **Redundância nas 4 rules de orquestração** (~4,9k tokens): auto-runner/steward/travões repetidos 3-4×. Fundível em ~1,5k tokens + catálogos em reference/.
4. **Contradições doutrinais:** CLAUDE.md "Fragments OK" vs soul.md "no fragments"; Decision Filter 4 ">100 tokens → delegate" vs custo real ~15x; `goal.md:4` "dispara o master-orchestrator" vs `goal.md:38-50` "NÃO se faz Agent(master-orchestrator)"; `laravel-specialist` com "Quality gate: perguntar?" adjacente ao chain "sem perguntar"; `plan` Fase 2 bloqueante vs autonomy 0.95.
5. **22 de 36 agentes sem Step 0** (Read das skills no corpo) — o frontmatter `skills:` não carrega nada, pela própria doutrina.
6. **33 de 46 skills com `chain:` sem a secção de condições/gates** — incluindo as 4 `deploy-*` que encadeiam para acção irreversível sem gate declarado.
7. **3 agentes "FUTUROS" no trigger map como operacionais** (automation-builder, personal-comms, tech-debt-auditor); o automation-builder até contradiz a própria skill (já implementada).
8. **check-tdd bypass estrutural:** tocar 1 char num teste abre janela global de 30 min; escritas via Bash escapam aos 3 guards.
9. **check-careful:** `\bDROP\s+/i` casa `git stash drop` e afins (falso positivo); faltam `find -delete`, `git branch -D`, `rsync --delete`.
10. **track-changes não mapeia .py/.go/.rb/.cs/.mjs/.astro** → alterações nessas linguagens nunca recomendam testers.
11. **Questionários:** 14 skills e 24 agents invisíveis a /install e /init-project; `/sync-questionnaires` com alvos incompletos, Fase 1 bash-only, ordem python3→python invertida.
12. **`/upgrade-joca --auto` e joca-doctor não estão ligados ao onboarding** — o doctor converteria a maioria dos findings de docs em falhas auto-detectadas; devia ser gate final do /install e do /update-joca.
13. **package-lock.json no .gitignore** + `npm install` no update → dependências não-determinísticas a cada update. Versionar locks + `npm ci`.
14. **sw.js:** cache cresce sem limite entre deploys (versão manual); update passivo (nunca chama `registration.update()`); iOS sem ícone (apple-touch-icon aponta para SVG).
15. **Heartbeat:** alerta repetido a cada ciclo sem memória do último alerta (nag loop); beat manual ignora o flag `running`; erros antigos contam como anomalia para sempre.

## 🔵 BAIXOS (amostra)

Lockout de login global (DoS barato) e sem flag Secure opt-in; `readJsonFile` engole corrupção e a primeira mutação persiste `[]` (perda silenciosa — fazer .bak); `rotateRuns` só no boot; regex greedy do juiz; inbox `slice(-200)` vs unread de 500; scrollback 2M linhas × sessões montadas; buffers de output sem tecto; 10 duplicações de tipos/helpers no frontend; textos EN/PT misturados; `master-orchestrator` com `model: opus` + `tools: Agent` sendo playbook; `self-improver` opus→sonnet; `tester-code` inherit→sonnet; scripts órfãos (agy-statusline, consolidate-branches, statusline bash legacy); `.claude/workflows/analisar-plataforma.js` depende de tool inexistente; skill `plan` refere `.cursor/plans/`; contraste do accent #ff4500 com texto pequeno (3.1:1, falha AA); contagens 127/26 remanescentes em JOCA_Brain/README.md e install.md.

---

## Custo de contexto por sessão (medido)

| Componente | ~Tokens |
|---|---|
| CLAUDE.md (Brain) | ~3.475 |
| soul.md | ~990 |
| rules/ (8 ficheiros) | ~6.695 |
| session-intake (1×) | ~195 |
| **Total fixo** | **~11.4k** |

**Poupanças identificadas (~5k tokens/sessão):** fundir as 4 rules de orquestração (−2,5-3k), mover rules/testing.md (−1,2k), reduzir o Trigger Map do CLAUDE.md às ~20 linhas de maior frequência com o resto no índice lazy (−1-1,2k), remover o prompt-triage (redundante com rules auto-carregadas, −60/turno).

---

## Plano de acção recomendado

**Fase 0 — Segurança (meio-dia):** S1 Host-validation, S2 noTools no llm node, S3 fail-closed, S4 dirs sensíveis. ~40 linhas no total.

**Fase 1 — Religar o sistema autónomo (~2h):** B3 sed rules/→.claude/rules/ · B1 build-skill-index (triggers da description, sem caps, categorias) · H1 três fixes dos hooks · B2 create-skill flat · mkdir dos 6 paths fantasma + product-marketing-context template.

**Fase 2 — Desbloquear install/update (1 dia):** I1 master→main · I2 portas + settings literal + node -e + build do frontend · I3 redesenho origin:local/user + templates soul/settings · joca-doctor como gate final dos dois fluxos · correr /sync-questionnaires com alvos alargados · I4 migrate.md.

**Fase 3 — Robustez runtime (1-2 dias):** leak de PTYs das automações · Enter-como-resposta · juiz no runner · moveTask · snapshot stale do scheduler · cli-tools async+cache · guards nos pty.write · varrimento zombie no boot · SSRF/stdin no shell node.

**Fase 4 — Frontend mobile-ready (2-3 dias):** fetchJson central + 401→login · backoff do WS + resync de buffers + estado connected · painel direito em bottom-sheet <860px · touch no Kanban · ícones PNG · sw.js update activo.

**Fase 5 — Consolidação (contínuo):** desambiguar clusters de triggers (email/deploy/landing) · fundir rules (−5k tokens/sessão) · Step 0 nos 22 agentes · secções chain nas 33 skills · regenerar bridges do inventário real · resolver contradições doutrinais.

**Esforço total estimado: ~7-9 dias de trabalho focado.** As Fases 0-2 (~2 dias) eliminam todos os críticos.
