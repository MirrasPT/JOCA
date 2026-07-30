---
project: JOCA
path: <JOCA_ROOT>
stack: Node.js + Express + WebSocket + node-pty · React + Vite + xterm.js · Claude Agent SDK
repo: MirrasPT/JOCA (branch de trabalho: claude/joca-repository-w36c9k)
updated: 2026-07-30
---

# JOCA — memória do projecto

Toolkit centralizado para Claude Code: `JOCA_Brain/` (motor — skills, agentes, comandos, memória) +
`JOCA_OS/` (interface — terminais multi-sessão, tarefas, automações).

## Estado actual

O JOCA_OS deixou de ser só uma grelha de terminais e passou a ter **um gestor de projecto por
projecto**: um agente conversacional que recebe o pedido, parte-o em trabalho, entrega-o a workers
(terminais reais) e reporta. O utilizador fala com o gestor, não com os terminais.

O JOCA_Brain passou a poder **paralelizar por omissão**: 65 agentes de execução gerados a partir das
skills, mais uma triagem que avalia cada pedido e recomenda a via sem ser preciso pedir.

Nada disto foi visto a correr na máquina do utilizador — ver "Pendente".

## Decisões tomadas

### 2026-07-30 — Gestor de projecto
- **O gestor é in-process (SDK), não um terminal.** Responde de imediato e não consome nenhuma das
  30 sessões. Os *workers* é que são PTYs. Consequência: dar-lhe capacidades = dar-lhe ferramentas
  MCP, não abrir-lhe um terminal.
- **Um worker por ÁREA** (design, backend, conteúdo…), reutilizado entre trabalhos. É o que permite
  paralelismo sem dois agentes a escrever no mesmo ficheiro, e a segunda tarefa de uma área arranca
  com o contexto já carregado.
- **Continuidade por `options.resume` do SDK**, nunca por transcript colado no prompt. Foi o erro
  que tornou o "Master" anterior caro e frágil.
- **Fila de despertares serializada por projecto**, com debounce e orçamento de 6 despertares
  automáticos consecutivos. As guardas fazem parte do desenho, não são um remendo posterior.
- **As tarefas nunca arrancam sozinhas.** O engine deixou de drenar a coluna; só corre por ordem do
  utilizador ou do gestor (`dispatchTask`).
- **O gestor vê mas não toca:** `tools: []` (sem Bash/Write/Edit) + ferramentas de leitura
  (`ver_ficheiro`/`ver_imagem`/`listar_pasta`/`ver_pagina`). É o que garante a separação
  gestor/worker. Sem olhos, só repetia o que os workers alegavam.

### 2026-07-30 — Agentes e escalada
- **Agentes de execução gerados a partir das skills** (`<skill>-agent`), com Step 0 obrigatório de
  `Read()` da skill. Não são cópias: a skill continua fonte de verdade e editá-la actualiza os dois.
- **Só skills de execução directa** (~65). Doutrina, guard-rails e routers ficaram de fora: não
  produzem trabalho isolável e como agentes seriam ruído na lista de escolha.
- **Threshold de fan-out: ≥2 partes independentes.** Dois domínios mencionados numa frase NÃO são
  duas tarefas — conta-se o número de acções pedidas, não de palavras técnicas.
- **Custo de contexto é critério de desenho.** name+description de todos os agentes entram no system
  prompt de todas as sessões: a primeira versão custava 9.5k tokens/sessão, apertada para 2.9k.

### 2026-07-30 — Segurança
- **Host validado em todos os métodos** (não só escritas): o same-origin check aceitava o payload de
  um ataque de DNS rebinding, e o rebinding serve para LER.
- **`permissionMode: 'default'` para agentes sem ferramentas de filesystem.** `bypassPermissions`
  traduz-se em `--dangerously-skip-permissions`, que o CLI recusa sob root — e é desnecessário para
  quem corre com `tools: []`.

## Pendente

- **A interface do gestor nunca foi aberta num browser.** Validou-se a API e o build, não o ecrã.
- **Nenhum worker completou trabalho ponta-a-ponta** — o Claude Code dentro dos PTYs não estava
  autenticado no container de desenvolvimento. Validou-se o mecanismo do gestor, não o ciclo inteiro.
- **Os 65 agentes gerados nunca foram despachados a sério.** Estrutura, índice e custo validados;
  calibração dos briefs por confirmar no primeiro fan-out real.
- Decidir se o trabalho vai para `main` (PR não aberto — regra: só com pedido explícito).

## Última sessão

**2026-07-30** — Gestor de projecto por projecto (backend + frontend), 4 correcções da auditoria
(DNS rebinding, nó `llm` com ferramentas activas, `/update-joca` preso em `origin/master`, 43% de
skills sem gatilhos), 65 agentes de execução + escalada automática por sinal, olhos do gestor,
CLI `joca` corrigida e alargada, notificações com prioridade e agrupamento.
