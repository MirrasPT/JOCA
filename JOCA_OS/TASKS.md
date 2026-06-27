# TASKS — JOCA_OS v2 (Master)

Decomposição faseada accionável. Compatível com `/build-plan` (loop por fase com gate) e `/one-shot` (orquestrador autónomo).

JOCA_OS v2 = camada **aditiva** sobre a base JOCA_UI já copiada. Não se reescreve nada. O Master é um chat NÃO-terminal, provider-agnóstico, que comanda N terminais Claude Code (workers) sem o humano tocar nos terminais. Workers correm na subscrição Anthropic (custo zero). O cérebro do Master usa provider barato/local com fallback Ollama.

## Convenções

- Ordem por dependência. Não saltar gate. Cada fase fecha só com TODOS os critérios de aceitação verdes.
- Caminhos verificados contra o código real (não fabricados). Onde a fonte (server.ts) discorda dos números de linha do plano de arquitectura, referir por NOME de estrutura, não por linha.
- Windows-first: `python` (não `python3`); matar portas com `taskkill /F /T /PID`; não renomear a pasta-raiz de dentro do Master a correr (cwd lock).
- **Pré-requisito de runtime — Node >= 22.5 (dura):** `getCodexLimits` (`server.ts` ~L1011-1020) usa `node:sqlite`, ausente em Node 20 / < 22.5. Outros projectos do Renato fazem gate em Node >= 20.17, logo uma instalação fresca pode cair abaixo do mínimo e **partir silenciosamente** a leitura de rate-limits do Codex (o sinal de quota que alimenta o fallback). Verificar/gate da versão de Node antes de qualquer fase.
- **Anti-fabricação (soul.md):** SDK/API/credencial em falta ou incerta → `TODO` explícito + reportar. NUNCA inventar key/endpoint/assinatura. Confirmar assinaturas de SDK contra doc oficial ao implementar.

## Estado base verificado (2026-06-21)

| Facto | Verificado |
|---|---|
| `backend/package.json` name | `joca-ui-backend`, deps só `express`/`node-pty`/`ws` (SEM SDK) |
| `frontend/package.json` name | `joca-ui-frontend`, deps inclui `marked`+`highlight.js` |
| Portas | backend `7371`, frontend `7372` (`start.bat`, `vite.config.ts`) |
| `server.ts` | 1703 linhas; `pty.spawn` (~L581), `BUFFER_MAX=5_000_000` (L142), `IDLE_DEBOUNCE_MS=1500` (L143), `DONE_MIN_WORK_MS=2000` (L144), idle→done heurística (L646-677), `collectToolkitItems` (L339), `getCliTools` (L442), `readClaudeToken` (L957), `RL_CACHE_DIR='joca-ui'` (L940), banner `JOCA_UI →` (L1697) |
| Frontend | `WS_URL` via `window.location.host` + proxy vite (L35); `MainView = 'dashboard'\|'project'\|'session'` (`types.ts` L95); switch em `App.tsx` (L644+) |
| `~/CLAUDE.md` | já documenta JOCA_OS UI em `localhost:7382` → repurpose deve alinhar frontend=7382 |

> NOTA: o WS não tem `WS_URL` hardcoded com porta — usa o host actual via proxy vite. Logo o repurpose de porta do frontend toca `start.bat` + `vite.config.ts`, não o `App.tsx`.

---

## Fase 0 — Estabilizar v1 (JOCA_UI)

**Goal:** base de terminais fiável antes de construir o Master por cima. Trabalho no JOCA_UI (origem), não no JOCA_OS.

- [ ] Reproduzir e corrigir quedas conhecidas de WebSocket/PTY em uso diário
- [ ] Corrigir bugs de sessão: reconexão WS sem duplicar handlers, resize, integridade do buffer
- [ ] Polir fricções do dashboard (criar/fechar/resize de múltiplas sessões)
- [ ] Registar os bugs corrigidos numa nota de sessão (`/save`)

**Aceitação / teste:**
- [ ] ~2 semanas de uso diário sem fricção/quedas
- [ ] Criar/fechar/resize de múltiplas sessões estável
- [ ] Reconexão WS recupera estado sem duplicar handlers (teste: matar ws, reconectar, confirmar 1 handler por sessão)

**Gate:** v1 estável em uso real. Só então clonar/evoluir o JOCA_OS.

---

## Fase 0.5 — Repurpose técnico do JOCA_OS

**Goal:** JOCA_OS arranca lado-a-lado com o JOCA_UI sob identidade própria, sem colisão de portas. NÃO mexer no JOCA_UI.

- [ ] `backend/package.json`: name `joca-ui-backend` → `joca-os-backend`
- [ ] `frontend/package.json`: name `joca-ui-frontend` → `joca-os-frontend`
- [ ] `start.bat`: `BACKEND_PORT 7371→7381`, `FRONTEND_PORT 7372→7382`, `LOG_DIR %TEMP%\joca-ui→%TEMP%\joca-os`, banners `JOCA UI`→`JOCA OS`
- [ ] `frontend/vite.config.ts`: defaults `JOCA_FRONTEND_PORT 7372→7382`, `JOCA_BACKEND_PORT 7371→7381`
- [ ] `backend/src/server.ts`: `RL_CACHE_DIR 'joca-ui'→'joca-os'` (L940), banner `JOCA_UI →`→`JOCA_OS →` (L1697). Manter `listen` em `127.0.0.1`. PORT continua via `process.env.PORT` (definido no `start.bat`)
- [ ] Confirmar/actualizar `~/CLAUDE.md`: frontend JOCA_OS = 7382 (já documentado); JOCA_UI mantém 7371/7372
- [ ] `start.sh`/`stop.bat`/`stop.sh`/`.command`/`.vbs`: mesmas portas e nomes
- [ ] NÃO renomear a pasta-raiz; NÃO tocar no JOCA_UI

**Aceitação / teste:**
- [ ] `grep -rn 'joca-ui\|7371\|7372' JOCA_OS/{backend/src,frontend/src,*.bat,*.sh}` limpo nos identificadores do JOCA_OS (excepto markers de toolkit `JOCA_UI_TOOLKIT_*` se reaproveitados — decidir renomear ou manter)
- [ ] JOCA_OS (7381/7382) e JOCA_UI (7371/7372) correm em simultâneo, ambos respondem
- [ ] `start.bat` do JOCA_OS abre o frontend em 7382, frontend liga ao backend 7381 (WS via proxy ok)

**Gate:** dois apps lado-a-lado sem conflito. Paridade funcional com v1.

---

## Fase 0.7 — Extracção de módulos (pré-Master)

**Goal:** desmontar o god-file `server.ts` (1703 linhas) em módulos, para construir o Master sem regredir a infra de terminais já auditada. Refactor de paridade — zero alteração de comportamento.

- [ ] Extrair `SessionManager` (spawn/input/buffer/kill/resize/idle de N PTYs) para módulo próprio, com **API programática** para o Master:
  - `spawn(opts)`, `input(sessionId, text)`, `readBuffer(sessionId)` (com strip-ANSI opcional), `kill(sessionId)`, `resize`, e um **evento/subscrição de `done`** (working↔idle)
- [ ] Extrair `ProjectStore` + `ProjectMemory` (`projects.json`, `project-memory.json`, helpers `readJsonFile`/`writeJsonFile`)
- [ ] Extrair `RateLimits` (`readClaudeToken`, OAuth usage, Codex via `node:sqlite`)
- [ ] Extrair `ToolkitRegistry` (`collectToolkitItems`, `/joca-items`, `/knowledge-graph`)
- [ ] Extrair `SecurityFS` (allowlist roots, `isSensitivePath`, `safePath`, `requireSafeOrigin`)
- [ ] Extrair `CliCapabilities` (`getCliTools`)
- [ ] Reduzir `server.ts` a wiring (rotas + WS + imports dos módulos)
- [ ] Smoke test manual de toda a UI (terminais, dashboard, rate-limits, file browser)

**Aceitação / teste:**
- [ ] Paridade comportamental total com v1 (nenhuma regressão observável na UI)
- [ ] `SessionManager` importável e testável isoladamente (teste unitário: spawn → input → readBuffer contém eco → kill)
- [ ] Sem alteração de comportamento de terminais na UI

**Gate:** módulos limpos + paridade. Base pronta para o Master por cima.

---

## Fase 1a — Master MVP (1 worker)

**Goal:** chat NÃO-terminal comanda 1 worker Claude Code end-to-end, com provider único default (Claude Agent SDK na subscrição).

### Backend — cérebro

- [ ] Adicionar dep `@anthropic-ai/claude-agent-sdk` ao `backend/package.json` (confirmar nome/versão exactos no npm ao instalar — NÃO assumir)
- [ ] `ProviderManager` (interface `MasterProvider`): `send(messages, tools, signal): AsyncIterable<ProviderEvent>`, `submitToolResults(results)`, `available()`. Implementar SÓ o provider `claude` nesta fase
  - **Auth subscrição:** limpar `ANTHROPIC_API_KEY` E `ANTHROPIC_AUTH_TOKEN` do `options.env` antes de `query()` — acção segura (requisito DURO) independentemente da ordem de precedência (a ordem exacta é hipótese a confirmar na implementação; a doc oficial não a publica). Estas chaves podem vencer silenciosamente o token de subscrição e facturar créditos
  - **Probe de auth:** diagnóstico ao arranque que confirma qual credencial está a vencer; logar resultado
  - Ferramentas do Master via `createSdkMcpServer()` + `tool()`, ligadas por `options.mcpServers`
  - **VERIFICAR contra doc oficial TS do SDK** as assinaturas exactas de `query`/`Options`/`streamInput`/`createSdkMcpServer`/`tool` — não copiar do plano. Detalhe incerto → `TODO` + reportar
- [ ] `MasterTools` (control plane): `spawn_worker(projectId, brief)`, `send_to_worker(workerId, text)`, `read_worker(workerId)` — executadas contra o `SessionManager`
- [ ] `Orchestrator`: NL do utilizador → `ProviderManager` → tool-calls → executa contra worker → lê output → continua → resume ao humano
- [ ] `WorkerBrief builder`: monta o brief carregando **explicitamente** as regras que sub-agentes NÃO herdam:
  - anti-fabricação · verificar parser contra resposta real · importar componentes partilhados antes de fan-out
  - \+ objectivo em 2 frases · paths relevantes · constraints do projecto · o-que-NÃO-fazer
  - **Sentinela com nonce + regra de própria-linha:** gerar um **nonce único por tarefa** para o `taskId` e instruir o worker a imprimir `<<<JOCA_DONE:<nonce>>>>` **sozinho na sua própria linha** no fim. O detector casa o nonce DESTA tarefa, anchored a linha inteira — evita o falso-positivo de o próprio brief conter a string literal do sentinela.
- [ ] **Marcador sentinela:** instruir o worker no brief a imprimir `<<<JOCA_DONE:taskId>>>` no fim; `Orchestrator` detecta ESSE no buffer (não só silêncio). Manter idle/silêncio só como heurística de status
  - **Desambiguação (obrigatória — o brief CONTÉM a string literal do sentinela, logo a 1.ª leitura do buffer daria falso-positivo "done"):**
    - **Nonce por tarefa** — o `taskId` é um nonce único gerado por tarefa (ex.: `<<<JOCA_DONE:7f3a9c2e>>>`), não um literal fixo; o matcher procura o nonce DESTA tarefa, não o padrão genérico.
    - **E/OU sentinela sozinho na sua própria linha** — só conta como done se a linha for **exclusivamente** o sentinela (anchored: `^<<<JOCA_DONE:<nonce>>>>$` após strip-ANSI/trim), nunca inline no meio de texto (como aparece dentro do próprio brief).
    - Documentar a regra de matching junto ao detector.

### Frontend — UI

- [ ] `types.ts`: `MainView = ... | 'master'`
- [ ] Nova `MainView 'master'` no switch de `App.tsx`, reutilizando `NavRail`/`RightWorkspace`/`Toast` + paleta `DESIGN.md`
- [ ] Painel de chat (usar `marked` + `highlight.js` já em deps), distinto dos painéis xterm
- [ ] Novos tipos de mensagem WS no MESMO socket: `master_message`, `orchestration_step`, `worker_summary`

**Aceitação / teste:**
- [ ] Pedido NL no chat abre 1 worker no projecto certo, instrui-o, e o Master devolve resumo coerente — humano NÃO toca no terminal
- [ ] Probe confirma auth de subscrição a vencer (`ANTHROPIC_API_KEY` ausente do env do worker → custo zero)
- [ ] Detecção de `done` via sentinela funciona quando o silêncio falharia (simular pausa de rede no worker)
- [ ] Assinaturas de `query`/`streamInput`/`createSdkMcpServer` confirmadas contra doc oficial (sem `TODO` por verificar nesta camada)

**Gate:** 1 worker comandado por NL, sem toque manual, custo zero confirmado.

---

## Fase 1b — Master multi-terminal

**Goal:** N workers em paralelo, estado por worker, agregação de resultados, troca de provider + fallback.

### Estado e agregação

- [ ] `WorkerRegistry`: `{id, projectId, status: working|idle|done, brief, lastSummary}`; subscreve `done`/`session_status` do `SessionManager`
- [ ] Agregação: numa transição idle-após-trabalho-real, lê buffer (strip ANSI), pede ao provider barato um resumo 2-3 linhas, guarda em `lastSummary`, e apresenta só o agregado ao humano
- [ ] Concurrency cap **3-5 workers** (CLAUDE.md) + verificação de quota ANTES de cada `spawn` (sinal do `RateLimits`)

### Multi-provider + fallback

- [ ] `ProviderManager` multi-provider, todos atrás da MESMA interface `MasterProvider`:
  - [ ] `ollama` (dep `ollama`): `ollama.chat({model, messages, stream:true, tools})`; daemon local `127.0.0.1:11434`, sem auth
  - [ ] `codex` (dep `@openai/codex-sdk`): `Codex().startThread()`, `thread.runStreamed()`, `resumeThread()`; auth herdada do CLI Codex (`~/.codex/auth.json`). Confirmar assinaturas contra doc
  - [ ] `gemini` (dep `@google/genai`): `ai.chats.create` + `sendMessageStream`; auth = API key (`GEMINI_API_KEY`)
        **TODO/AVISO:** "Gemini na subscrição Google" NÃO tem path SDK verificado. Manter `gemini` DESACTIVADO por default até verificar; documentar como API-key-only. NÃO assumir quota-de-subscrição
- [ ] Wiring de ferramentas por família: in-process MCP (Claude) · `tools[]` (Gemini/Ollama) · thread events (Codex)
- [ ] Troca de provider em runtime
- [ ] **Fallback automático:** `Orchestrator` observa `available()` + sinais de rate-limit → na exaustão cloud troca para Ollama, semeando a nova sessão com o resumo da memória curta (depende da Fase 7; até lá, semear com resumo da conversa em RAM)

### UI

- [ ] Vista de N workers: cards de estado (status glow + resumo 2-3 linhas, padrão bento `DESIGN.md`) + botão "abrir terminal" que salta para a `SessionView` xterm existente
- [ ] Cmd+K palette com comandos do Master

**Aceitação / teste:**
- [ ] Master coordena 3-5 workers paralelos e agrega num só resumo
- [ ] Trocar provider a meio da conversa mantém continuidade
- [ ] Quota Claude esgota → fallback Ollama sem perder o fio; workers continuam na quota Anthropic (independentes do cérebro)
- [ ] `spawn` bloqueado/diferido quando quota insuficiente (sem saturar)

**Gate:** orquestração multi-worker estável + fallback funcional.

---

## Fase 7 — Memória 3 camadas (emparelhada cedo)

**Goal:** continuidade do Master em conversa potencialmente infinita. Memória PRÓPRIA do Master, SEPARADA da memória do JOCA_Brain.

Layout: `master-memory/curta.md`, `master-memory/longa/<ts>.md`, `master-memory/longa/INDEX.json`, `master-memory/diario/<ts>.log`. Reusar padrão `readJsonFile`/`writeJsonFile` + padrão de índice lazy do `SKILL_INDEX.json`.

- [ ] `MemoryManager`:
  - **Diário** — log verbatim append-only, 1 `.log` por janela de contexto (fonte de verdade, nunca sumarizado in-place)
  - **Longa** — 1 resumo detalhado por janela (`longa/<ts>.md`), decisões/resultados no INÍCIO (U-curve)
  - **Curta** — resumo de continuação SÓ da janela imediatamente anterior; NUNCA acumula; descarta a antiga a cada arquivo
- [ ] **Gatilho de arquivo** por % de contexto + session-close:
  - Claude: usar o boundary de compactação automática do CLI / `usage` do `SDKResultMessage` (CONFIRMAR nome/forma do evento e campo contra doc — `TODO` se incerto)
  - Gemini/Ollama/Codex: estimar tokens pelo tamanho das mensagens, arquivar a ~70-80% da janela do modelo
- [ ] **Passo de arquivo atómico** (no gatilho): (1) flush verbatim → `diario/<ts>.log`; (2) resumo detalhado → `longa/<ts>.md`; (3) regenerar `curta.md`; (4) abrir nova janela semeada com `curta.md`
- [ ] **Pesquisa/recall** curta→longa→diário: recente = contexto vivo; dias/semanas = grep nos `longa/*.md`; detalhe exacto = via `longa` encontrar a janela → abrir `diario/<ts>.log`
- [ ] **Indexação:** grep/full-text sobre `longa/*.md` + `longa/INDEX.json` leve (`ts, title, tags, token-count`). Embeddings SÓ se o recall por grep falhar
- [ ] **Isolamento:** o Master PODE LER `JOCA_Brain/memory` (soul.md, projects/, INDEX.md) como contexto de sistema, mas escreve as suas janelas SÓ em `master-memory/`. Namespace separado p/ WhatsApp futuro (`master-memory-whatsapp/`)

**Aceitação / teste:**
- [ ] Conversa atravessa um arquivo e o Master continua coerente a partir da `curta.md`
- [ ] Pergunta de dias atrás respondida via `longa`; detalhe exacto recuperado via `diario`
- [ ] Memória do Master NUNCA escreve em `JOCA_Brain/memory` (teste: monitor de escrita)
- [ ] Arquivo dispara no boundary correcto (compact do SDK no Claude; ~70-80% nos outros)

**Gate:** continuidade infinita + isolamento de memória garantidos.

---

## Fases 2-6 — Canais e capacidades (após Master + Memória estáveis)

**Goal:** canais e capacidades que disparam/executam através do Master. Cada sub-fase entra sem regredir Master/Memória.

- [ ] **Fase 2 — WhatsApp:** thread + namespace de memória separado (`master-memory-whatsapp/`); contexto NÃO se mistura com o chat Master.
      *Decisão em aberto:* provider Twilio vs Meta Business API (avaliar custo de número + limites anti-spam na altura)
- [ ] **Fase 3 — Automações:** gatilhos agendados.
      *Decisão em aberto:* daemon sempre-on vs só-com-app-aberta (recomendação MVP: só com app aberta + cap de execução paralela + retry p/ não saturar quota Anthropic)
- [ ] **Fase 4 — Acções:** file-ops reusando `SecurityFS` (allowlist/safePath) + gate de irreversíveis (confirmação obrigatória mesmo com workers em skip-permissions — soul.md Hard Limits)
- [ ] **Fase 5 — Knowledge Base `/know`:** backend de ingestão (o command `/know` já existe no Brain)
- [ ] **Fase 6 — Self-Learning:** gatilho oportunista de `/upgrade-joca` por inactividade/rate-limit

**Aceitação / teste:**
- [ ] Cada sub-fase entra sem regredir Master/Memória
- [ ] Acções irreversíveis exigem confirmação mesmo com workers skip-permissions
- [ ] WhatsApp não mistura contexto com o chat Master

**Gate:** por sub-fase, regressão zero no núcleo Master/Memória.

---

## Decisões em aberto (recomendações)

| Decisão | Recomendação |
|---|---|
| Provider default do cérebro | **Claude Agent SDK na subscrição** (único path de subscrição confirmado + in-process MCP type-safe). Fallback = Ollama. Gemini desactivado até verificar path de subscrição |
| Invocação dos workers | **MVP: reusar PTY existente** (visíveis, humano pode assumir). SDK-headless (`SDKResultMessage`, done determinístico) só p/ fan-out crítico de fundo, fase posterior |
| Detecção de `done` | **Sentinela `<<<JOCA_DONE:taskId>>>`** no brief + buffer; silêncio só como status. SDK-headless reservado p/ fan-out crítico |
| Contexto de projecto antes de delegar | **Estado-índice** (barato); o WORKER carrega o contexto pesado via `/resume` (lê CLAUDE.md+memory+graph) |
| Apresentação de N terminais | **Cards de estado** + "abrir terminal" → `SessionView` xterm |
| Arquivo de memória + indexação | Arquivar por **%** (compact do SDK no Claude; ~70-80% nos outros) + session-close. Grep + `INDEX.json`; embeddings só se falhar. Diário não encriptado no MVP |

## Avisos críticos (confirmados, não fabricados)

1. **`ANTHROPIC_API_KEY` no env VENCE silenciosamente o token de subscrição e factura créditos.** O Master DEVE limpar `ANTHROPIC_API_KEY` e `ANTHROPIC_AUTH_TOKEN` do env passado a `query()` antes de invocar, e correr probe-diagnóstico de qual auth está a vencer.
2. **"Gemini na subscrição Google" NÃO tem path SDK verificado.** `@google/genai` usa API key. Marcar `TODO`; não assumir quota-de-subscrição.
3. **Assinaturas de SDK não verificadas no plano.** Confirmar `query`/`Options`/`streamInput`/`createSdkMcpServer`/`tool` (Claude), `Codex/startThread/runStreamed/resumeThread` (Codex), `ai.chats.create/sendMessageStream` (Gemini), `ollama.chat` (Ollama) contra doc oficial ao implementar.
4. **`done` por silêncio é frágil** (worker à espera de input parece done). Usar sentinela.
5. **Workers correm na quota Anthropic, independentes do cérebro** — a economia depende de manter o env limpo.
