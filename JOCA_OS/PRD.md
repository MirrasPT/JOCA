# PRD — JOCA_OS v2 ("Master")

**Versão:** 2.0
**Estado:** Draft
**Última actualização:** 2026-06-21
**North Star:** N/A — sistema pessoal (1 JOCA por pessoa, uso próprio)
**Substitui:** PRD v0.1 (JOCA_UI — wrapper de terminais). A v1 vive como fundação reutilizada, não como produto separado.

---

## 1. Visão & Problema

### Problema

O Claude Code só corre via terminal. Gerir trabalho em múltiplos projectos = abrir vários terminais à mão, escrever em cada um, vigiar cada output. O JOCA_UI (v1) deu interface visual aos terminais — mas a orquestração continua a ser **o humano a escrever no terminal**. Verificado no código: `server.ts` faz `pty.spawn(SHELL)` e escreve o binário `claude` no PTY (L622); não há cérebro orquestrador, só um wrapper de terminais.

Resultado: o utilizador continua a ser o cola entre tarefas. Não há ninguém a decidir *qual* worker abrir, *o quê* instruir, *quando* terminou, nem a agregar resultados.

### Solução

JOCA_OS v2 inverte o controlo. Um **chat orquestrador NÃO-terminal** (linguagem natural) sobre um **cérebro provider-agnóstico** que, via tool-calls, **abre / instrui / lê / fecha terminais Claude Code (workers)** reutilizando o session manager já auditado. O humano fala com o Master; o Master comanda N workers; o humano nunca toca nos terminais.

Princípio central: o Master é uma **camada aditiva** sobre o JOCA_UI existente. NÃO se reescreve a infra de terminais. Extraem-se primeiro os blocos estáveis do god-file para módulos, e só depois se constrói o Master por cima.

### Economia (premissa validada por probe real, não fabricada)

`@anthropic-ai/claude-agent-sdk` conduz o CLI `claude` **já logado** → corre na **subscrição Anthropic, SEM `ANTHROPIC_API_KEY`, custo zero**. O trabalho pesado fica nos workers Claude Code (cada um na sua quota Anthropic). O cérebro do Master usa um modelo barato/local. Quando a quota cloud esgota → fallback para **Ollama local**.

> AVISO CRÍTICO. A ordem de precedência de auth do SDK (`cloud creds > ANTHROPIC_AUTH_TOKEN > ANTHROPIC_API_KEY > apiKeyHelper > CLAUDE_CODE_OAUTH_TOKEN`) é **hipótese de trabalho a confirmar na implementação** — a doc oficial (`code.claude.com/docs/en/settings`) confirma que estes são métodos de auth reais, mas **não publica uma ordem de precedência explícita** (ver TECH_SPEC §3.1). O que **é** requisito DURO (e a acção segura independentemente da ordem): se `ANTHROPIC_API_KEY` existir no env pode vencer silenciosamente e facturar créditos — o Master TEM de limpar `ANTHROPIC_API_KEY` e `ANTHROPIC_AUTH_TOKEN` no env (`options.env`) antes de invocar, e correr um probe-diagnóstico de qual auth está a vencer.

---

## 2. Utilizador

| Persona | Descrição | Job-to-be-Done | Principal dor |
|---|---|---|---|
| Renato Ferreira (Setup Tech) | Designer + Product Manager, Portugal. Forte em design/produto/UX; a aprender backend/DevOps. Visão "Jarvis": parceiro autónomo, não assistente. | Quando trabalho em vários projectos, quero descrever o objectivo em linguagem natural e ter o sistema a abrir, instruir e coordenar os terminais Claude Code por mim — devolvendo-me só resumos. | Ser o cola manual entre N terminais; trocar de contexto; vigiar outputs; não ter continuidade de conversa entre sessões. |

Alinhamento (de `soul.md`): comunicação tersa, caveman-lite; máximo 1 confirmação por fluxo; design/UX → executar directo; backend/DevOps → 1 linha de explicação antes de implementar; mostrar output visual sempre que possível. Frustração: verbosidade, repetição, confirmações desnecessárias.

---

## 3. Objectivos & Não-objectivos

### Objectivos

- **O1** — Chat NL comanda N terminais Claude Code (workers) sem o humano tocar no terminal.
- **O2** — Cérebro provider-agnóstico (Claude Agent SDK default; Gemini / Codex / Ollama) com troca em runtime e fallback automático.
- **O3** — Custo extra zero: workers na subscrição Anthropic; cérebro barato/local; fallback Ollama.
- **O4** — Memória própria do Master em 3 camadas (curta / longa / diário) para conversa potencialmente infinita.
- **O5** — Reutilizar a base JOCA_UI (não reescrever): preservar a infra de terminais já validada.
- **O6** — Local-first, Windows-first, loopback only.

### Não-objectivos (este ciclo)

- Não substituir os terminais visuais — coexistem; o humano pode abrir/assumir um worker.
- Não reescrever a infra de PTY/WS/segurança.
- Não construir os canais externos (WhatsApp, Automações, Acções, KB, Self-Learning) — são Fases 2-6, fora do MVP.
- Não introduzir auth multi-utilizador, deploy remoto, HTTPS, base de dados.
- Não confirmar "Gemini na subscrição Google" — **sem path SDK verificado** (ver §8 e §10).

---

## 4. Arquitectura (resumo)

Camadas, de baixo para cima. Detalhe e decisões em §8.

### 4.1 Infra reutilizada (existe — extrair para módulos, NÃO reescrever)

| Bloco | Origem (verificado) | Papel no Master |
|---|---|---|
| **SessionManager** | `server.ts` L569-687: spawn/kill/resize/input/buffer/idle de N PTYs | **Executor de workers** |
| **WS transport** | `/ws`, broadcast/send/reconnect | Canal UI↔backend; + novos tipos de mensagem |
| **ProjectStore + ProjectMemory** | `projects.json`, `project-memory.json`, `readJsonFile/writeJsonFile` L115-122 | Contexto p/ decidir delegação |
| **RateLimits** | `readClaudeToken` (`~/.claude/.credentials.json`), `getClaudeOAuthUsage`, `getCodexLimits` (`node:sqlite`) | Sinal de quota → fallback |
| **CliCapabilities** | `getCliTools` L442-509 | Descoberta de providers/workers no arranque |
| **ToolkitRegistry** | `collectToolkitItems`, `/joca-items`, `/knowledge-graph` | Skills/agents/commands do Brain p/ briefs |
| **Security FS** | allowlist roots, `isSensitivePath`, `safePath`, `requireSafeOrigin`, listen `127.0.0.1` (L1695) | Reusar tal-e-qual quando o Master ganhar file-ops |

### 4.2 Camada Master (NOVA — módulos novos no backend)

- **ProviderManager** — implementa `MasterProvider`; mantém a sessão de chat do cérebro, faz streaming de tokens, emite tool-calls, recebe tool-results; troca de provider em runtime; `available()` alimenta o fallback.
- **Orchestrator (control plane)** — NL do utilizador → ProviderManager → tool-calls (`spawn_worker`/`send_to_worker`/`read_worker`/`list_workers`/`interrupt_worker`) → executa contra SessionManager → `ToolResult` → provider continua → resume ao utilizador. Cap 3-5 workers. Verifica quota antes de spawn.
- **WorkerRegistry** — `{id, projectId, status(working/idle/done), brief, lastSummary}`. Subscreve `session_status`; no idle-após-trabalho-real lê o buffer (strip ANSI), pede resumo 2-3 linhas ao provider barato, guarda, e só apresenta o agregado.
- **MasterTools** — ferramentas do Master expostas ao provider. Claude SDK = in-process MCP via `createSdkMcpServer()`+`tool()`; Gemini/Ollama = `tools[]`; Codex = thread events.
- **MemoryManager** — 3 camadas próprias (§4.4).
- **WorkerBrief builder** — monta o brief carregando EXPLICITAMENTE as regras que sub-agentes NÃO herdam (anti-fabricação, verificar parser contra resposta real, importar componentes partilhados antes do fan-out) + objectivo 2 frases + paths + constraints + o-que-NÃO-fazer.

### 4.3 Camada UI (NOVA MainView, reusar shell)

- Nova `MainView 'master'` no switch de `App.tsx` (ao lado de dashboard/project/session), reutilizando NavRail/RightWorkspace/Toast/paleta do `DESIGN.md`.
- Painel de chat normal (`marked`+`highlight.js` já em deps) distinto dos painéis xterm.
- Vista de N workers: **cards de estado** (status glow + resumo inline) com botão "abrir terminal" que salta para a SessionView xterm existente.
- Cmd+K palette extensível com comandos do Master.

### 4.4 Memória 3 camadas (separada da memória do JOCA_Brain)

Layout: `master-memory/curta.md`, `master-memory/longa/<ts>.md`, `master-memory/diario/<ts>.log`. Reusa o padrão `readJsonFile/writeJsonFile` e o padrão de índice lazy do `SKILL_INDEX.json`.

- **DIÁRIO** — log verbatim de cada janela de contexto, append-only, 1 `.log` por janela. Fonte de verdade; nunca sumarizado in-place.
- **LONGA** — 1 resumo detalhado por janela (`longa/<ts>.md`), indexado. Camada de pesquisa do meio.
- **CURTA** — resumo de continuação SÓ da janela imediatamente anterior (`curta.md`). NUNCA acumula; descartada e regenerada a cada arquivo. Semeia a próxima janela.

Gatilho de arquivo: por **% de uso de contexto** (boundary de compactação do SDK quando Claude; ~70-80% estimado nos restantes) + ao fechar a sessão. Passo atómico: flush verbatim → resumo longa → regenerar curta → abrir nova janela semeada.

Recall: pergunta recente → contexto vivo; dias/semanas → resumos LONGA; detalhe exacto → janela via LONGA, abrir o DIÁRIO. Indexação inicial: grep sobre `longa/*.md` + `longa/INDEX.json` leve; embeddings só se o grep falhar.

Isolamento: o Master PODE LER a memória do JOCA_Brain (`soul.md`, `projects/`, `INDEX.md`) como contexto de sistema, mas **escreve só em `master-memory/`** — nunca em `JOCA_Brain/memory`.

### 4.5 Fluxo comando / leitura / done (verificado contra o código)

- **COMANDO** a worker PTY: Orchestrator → `SessionManager.input(sessionId, texto)` → `session.pty.write(texto+'\r')` (path `input` já existe).
- **LEITURA**: `session.buffer` (ring RAM, `BUFFER_MAX = 5_000_000`) + evento `session_status`. Master lê no idle-após-trabalho.
- **DONE**: hoje é heurística por silêncio (`IDLE_DEBOUNCE_MS=1500`, `DONE_MIN_WORK_MS=2000`) — frágil (worker à espera de input parece "done"). **Melhoria:** instruir o worker a imprimir um marcador sentinela único no fim (`<<<JOCA_DONE:taskId>>>`) e detectar ESSE no buffer; manter o silêncio só como heurística de status, não de conclusão.

---

## 5. Funcionalidades do MVP

O MVP cobre **Fase 0 → Repurpose → Extracção → Fase 1a → Fase 1b → Fase 7 (memória, emparelhada cedo)**. O núcleo verificável: *chat orquestrador comanda terminais*.

### P0 — obrigatório

| ID | Funcionalidade | Descrição |
|---|---|---|
| M1 | Chat Master (MainView) | Painel de chat NL não-terminal, distinto dos painéis xterm, na nova `MainView 'master'`. |
| M2 | Cérebro single-provider | ProviderManager com 1 provider default (Claude Agent SDK na subscrição) + limpeza de `ANTHROPIC_API_KEY`/`AUTH_TOKEN` no env + probe de auth. |
| M3 | MasterTools básicas | `spawn_worker` / `send_to_worker` / `read_worker` via SessionManager. |
| M4 | Orchestrator loop | NL → tool-call → executa contra worker → lê output → resume ao humano. |
| M5 | WorkerBrief builder | Brief com regras não-herdadas (anti-fabricação / verify-parser / import-shared) + objectivo + paths + constraints + o-que-NÃO-fazer. |
| M6 | Detecção de done por sentinela | `<<<JOCA_DONE:taskId>>>` no brief + detecção no buffer. |
| M7 | Multi-worker + estado | WorkerRegistry (working/idle/done + lastSummary) + cap 3-5 + verificação de quota antes de spawn. |
| M8 | Agregação de resultados | Resumo 2-3 linhas por worker (provider barato) → vista agregada num só resumo. |
| M9 | Multi-provider + fallback | Gemini/Codex/Ollama + troca em runtime + fallback automático p/ Ollama na exaustão de quota (semeia com a curta). |
| M10 | Vista de N workers | Cards de estado (glow + resumo inline) + "abrir terminal" salta p/ SessionView xterm existente. |
| M11 | Memória 3 camadas | MemoryManager curta/longa/diário + gatilho de arquivo por % (+ session-close) + recall curta→longa→diário. |
| M12 | Repurpose técnico | Identidade própria, portas 7381/7382, sem refs `joca-ui`, arranque lado-a-lado com o JOCA_UI. |

### Repurpose técnico (passos verificados)

1. `package.json`: `joca-ui-backend`→`joca-os-backend`; `joca-ui-frontend`→`joca-os-frontend`.
2. `start.bat`: `BACKEND_PORT 7371→7381`, `FRONTEND_PORT 7372→7382`, `LOG_DIR %TEMP%\joca-ui→%TEMP%\joca-os`, banners "JOCA UI"→"JOCA OS".
3. `frontend/vite.config.ts`: portas default 7371/7372→7381/7382.
4. `frontend` `WS_URL` (App.tsx ~L35): apontar p/ a porta backend nova 7381.
5. `backend/server.ts`: `PORT` default + refs internas (`RL_CACHE_DIR`, `LOG_DIR`, banners). Manter `listen('127.0.0.1')`.
6. Resolver discrepância: o `CLAUDE.md` raiz refere **7382** para a "UI". Recomendado: 7382 passa a ser o frontend do JOCA_OS; actualizar a doc. JOCA_UI mantém 7371/7372; JOCA_OS usa 7381/7382 (sem colisão).
7. Deps de provider SÓ na Fase MVP: `@anthropic-ai/claude-agent-sdk` (default), depois `@google/genai`, `@openai/codex-sdk`, `ollama`. Confirmar nomes/versões no npm ao instalar (hoje o backend só tem `express`/`ws`/`node-pty` — verificado).
8. Windows-first: matar processos por porta com `taskkill /F /T /PID`; NÃO renomear a pasta-raiz de dentro do Master a correr (cwd lock); `python` não `python3`.
9. Validação final: grep por `joca-ui`/`7371`/`7372` limpo nos identificadores; arrancar JOCA_OS e JOCA_UI em simultâneo, ambos respondem.
10. NÃO mexer no JOCA_UI durante o repurpose — JOCA_OS é a cópia a evoluir.

> NOTA: o `CLAUDE.md` raiz refere `JOCA_OS\backend\.env` com o provider default, mas o ficheiro **não existe hoje** no repo (verificado). `TODO`: criar `backend/.env` com o provider default na Fase MVP.

---

## 6. Requisitos Funcionais & Não-Funcionais

### 6.1 Funcionais

| ID | Requisito |
|---|---|
| RF1 | O Master recebe instruções em linguagem natural num chat dedicado; nunca exige que o humano escreva no terminal. |
| RF2 | O Master abre workers no projecto correcto, instrui-os, lê o output e devolve um resumo coerente. |
| RF3 | O cérebro do Master é provider-agnóstico, com troca em runtime e fallback automático para Ollama. |
| RF4 | O env passado aos workers Claude e ao SDK limpa `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` antes de invocar; corre um probe de auth. |
| RF5 | Cada brief de worker carrega explicitamente as regras não-herdadas (anti-fabricação, verify-parser, import-shared). |
| RF6 | Concorrência limitada a 3-5 workers; spawn bloqueado/diferido quando a quota é insuficiente. |
| RF7 | Conclusão de worker detectada por marcador sentinela, não só por silêncio. |
| RF8 | O Master mantém continuidade de conversa via memória 3 camadas, atravessando arquivos de janela. |
| RF9 | A memória do Master lê o JOCA_Brain como contexto, mas nunca lhe escreve. |

### 6.2 Não-funcionais

| Categoria | Requisito | Threshold | Prioridade |
|---|---|---|---|
| Custo | Workers na subscrição (sem `ANTHROPIC_API_KEY`); cérebro barato/local | Custo extra = 0 | P0 |
| Local-first | Tudo corre na máquina do utilizador; fallback Ollama em `127.0.0.1:11434` | Sem dependência cloud obrigatória | P0 |
| Segurança | Listen só em loopback (`127.0.0.1`); Security FS reusado em file-ops | Sem binding externo | P0 |
| Plataforma | Windows-first (`python` não `python3`; `taskkill /F /T`; creds em `~/.claude/.credentials.json`) | Funciona no Windows do utilizador | P0 |
| Não-regressão | Paridade comportamental dos terminais após extracção de módulos | Zero mudança observável na UI de terminais | P0 |
| Performance | Latência terminal (input→output) herdada da v1 | < 100ms p95 | P1 |
| Fiabilidade | Reconexão WS recupera estado sem duplicar handlers | Sem fugas/duplicação | P0 |
| Isolamento | Broadcast WS não vaza estado de orquestração entre abas | Sem cross-talk | P1 |

---

## 7. Critérios de Sucesso

Por fase, verificáveis (espelham `acceptance` da arquitectura).

**Fase 0 — Estabilizar v1**
- ~2 semanas de uso diário sem fricção/quedas.
- Criar/fechar/resize de múltiplas sessões estável.
- Reconexão WS recupera estado sem duplicar handlers.

**Repurpose técnico**
- JOCA_OS e JOCA_UI correm em simultâneo sem conflito de porta.
- Grep limpo de `joca-ui` em package names/identificadores.
- `start.bat` abre o JOCA_OS na porta nova; frontend liga ao backend novo.

**Extracção de módulos**
- Toda a funcionalidade existente preservada (paridade com v1).
- SessionManager importável e testável isoladamente.
- Sem mudança observável de comportamento de terminais.

**Fase 1a — Master MVP (1 worker)**
- Pedido NL abre 1 worker no projecto certo, instrui-o, e o Master devolve resumo coerente sem o humano tocar no terminal.
- Probe confirma auth de subscrição a vencer (`ANTHROPIC_API_KEY` ausente do env do worker).
- Detecção de done via sentinela funciona quando o silêncio falharia (worker em pausa de rede).
- Assinaturas de `query`/`streamInput`/`createSdkMcpServer` verificadas contra a doc oficial do SDK.

**Fase 1b — Master multi-terminal**
- Master coordena 3-5 workers paralelos e agrega resultados num só resumo.
- Trocar provider a meio da conversa mantém continuidade.
- Quota Claude esgota → fallback Ollama sem perder o fio; workers continuam na quota Anthropic.
- Spawn bloqueado/diferido quando a quota é insuficiente.

**Fase 7 — Memória 3 camadas**
- Conversa atravessa um arquivo e o Master continua coerente a partir da curta.
- Pergunta de dias atrás respondida via longa; detalhe exacto via diário.
- A memória do Master nunca escreve em `JOCA_Brain/memory`.
- Arquivo dispara no boundary correcto (compact do SDK no Claude; ~70-80% nos outros).

---

## 8. Decisões em Aberto

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Provider default do cérebro | **Claude Agent SDK na subscrição** — único com path de subscrição confirmado E in-process MCP type-safe; alinha com o ecossistema JOCA. Fallback = Ollama. Gemini desactivado até verificar. |
| D2 | Caminho de invocação dos workers | MVP: **reusar o PTY existente** (workers visíveis, humano pode assumir). SDK-headless (`SDKResultMessage`, done determinístico) como opção posterior p/ tarefas autónomas de fundo. |
| D3 | Detecção de done | **Sentinela `<<<JOCA_DONE:taskId>>>`** no brief; silêncio só como status. SDK-headless reservado a fan-out crítico. |
| D4 | Contexto de projecto carregado antes de delegar | **Só o estado-índice** (lista+estado); o WORKER carrega o contexto pesado via `/resume` (já lê CLAUDE.md+memory+graph). Economiza tokens do cérebro. |
| D5 | Apresentação de N workers | **Cards de estado** (glow + resumo 2-3 linhas) com "abrir terminal" → SessionView xterm. Reusa o padrão bento do DESIGN.md. |
| D6 | Gatilho/indexação/encriptação da memória | Arquivar por **%** (compact do SDK no Claude; ~70-80% nos outros) + session-close. Indexar com grep + `INDEX.json`; embeddings só se falhar. Diário **não encriptado** no MVP (local-first); reavaliar com WhatsApp. |

> **TODO (anti-fabricação)** — "Gemini na subscrição Google" **não tem path SDK verificado** equivalente ao Claude. `@google/genai` usa **API key** (`GEMINI_API_KEY`/`GOOGLE_API_KEY`); o antigo `@google/generative-ai` está deprecated (não usar). Opções: (a) free-tier por API key, ou (b) spawn do CLI `gemini`/`agy` p/ reusar o login Google. Marcado como TODO; NÃO assumir quota-de-subscrição via `@google/genai`.
>
> **TODO (verificação)** — confirmar contra a doc oficial TS, ao implementar, os nomes/assinaturas exactos de: `query`/`Options`/`streamInput`/`createSdkMcpServer` (Claude SDK); evento de compactação automática e campo `usage`/`SDKResultMessage.usage`; `Codex().startThread()`/`thread.run()`/`resumeThread()` (Codex SDK); `ai.chats.create`/`sendMessageStream` (Gemini); `ollama.chat({stream, tools})`. Não assumir do contexto — o JOCA_OS hoje NÃO usa nenhum SDK (verificado: `server.ts` escreve o binário no PTY, L622).

---

## 9. Fora de Scope (Fases futuras)

Só entram após Master + Memória estáveis. Cada sub-fase entra sem regredir o Master/Memória.

| Fase | Âmbito | Decisão em aberto |
|---|---|---|
| **Fase 2 — WhatsApp** | Thread + namespace de memória separado (`master-memory-whatsapp/`) p/ não misturar contexto | Provider WhatsApp (Twilio vs Meta Business API) — diferido; ambos têm custo de número/API e limites anti-spam |
| **Fase 3 — Automações** | Gatilhos agendados | Daemon sempre-on vs só-com-app-aberta — MVP só com app aberta; daemon depois, com cap e retry p/ não saturar a quota |
| **Fase 4 — Acções** | File-ops reusando Security FS + gate de irreversíveis | — (acções irreversíveis exigem confirmação mesmo com workers em skip-permissions) |
| **Fase 5 — Knowledge Base `/know`** | Backend de ingestão (`/know` já existe como command) | — |
| **Fase 6 — Self-Learning** | Gatilho oportunista de `/upgrade-joca` por inactividade/rate-limit | — |

Excluído do produto inteiro: auth multi-utilizador, deploy remoto, HTTPS, base de dados, temas (herdado do escopo v1).

---

## 10. Constraints Técnicas

- Stack herdada (verificada): backend Node + Express + `ws` + `node-pty` (`server.ts` ~1703 linhas); frontend React 18 + Vite 5 + xterm.js; `marked`+`highlight.js` já em deps.
- Deps de provider a adicionar na Fase MVP — confirmar versões no npm ao instalar.
- `node-pty` requer compilação nativa (node-gyp).
- CLI `claude` (e `codex`/`gemini` se usados) devem estar no PATH e logados.
- Workers correm na subscrição Anthropic — **sem `ANTHROPIC_API_KEY` no env**.
- Estado em memória + ficheiros JSON/MD locais; sem base de dados.
- Loopback only; sem HTTPS, sem auth.

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Master | O cérebro orquestrador NÃO-terminal; conversa em NL e comanda workers via tool-calls. |
| Worker | Um terminal Claude Code (PTY + processo `claude`) instruído pelo Master; corre na subscrição Anthropic. |
| ProviderManager | Camada de inferência provider-agnóstica do cérebro do Master. |
| Orchestrator | Control loop NL → tool-call → executa contra SessionManager → resume. |
| Sentinela | Marcador único (`<<<JOCA_DONE:taskId>>>`) impresso pelo worker p/ done fiável. |
| Memória 3 camadas | curta (continuação) / longa (resumos indexados) / diário (verbatim) do Master. |
| JOCA_Brain | O motor (skills/agents/commands/memory) que Master e workers consomem; read-only p/ o Master. |

---

## 12. Histórico de Versões

| Versão | Data | Mudanças |
|---|---|---|
| 0.1 | 2026-05-14 | Draft inicial JOCA_UI (wrapper de terminais). |
| 2.0 | 2026-06-21 | REESCRITO para JOCA_OS v2 "Master": chat orquestrador comanda terminais; provider-agnóstico; memória 3 camadas; fases Fase 0→Repurpose→Extracção→1a→1b→7→2-6. PRESERVA da v1: persona/local-first/loopback/constraints de stack/glossário PTY. |
