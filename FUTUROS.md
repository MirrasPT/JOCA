# FUTUROS — Visão de Futuro do JOCA

Documento vivo com a direcção estratégica do JOCA.
Ferramenta interna da Setup Tech, desenvolvida por Renato Ferreira.

> **Última actualização:** 2026-05-28

---

## Índice

- [Sumário Executivo](#sumário-executivo)
- [Visão Final](#visão-final)
- [Princípios Fundamentais](#princípios-fundamentais)
- [Roadmap](#roadmap)
- [Fase 0 — Estabilização do v1](#fase-0--estabilização-do-v1)
- [Fase 1 — Master](#fase-1--master)
- [Fase 2 — WhatsApp (o telemóvel do JOCA)](#fase-2--whatsapp-o-telemóvel-do-joca)
- [Fase 3 — Automações](#fase-3--automações)
- [Fase 4 — Acções](#fase-4--acções)
- [Fase 5 — Knowledge Base](#fase-5--knowledge-base)
- [Fase 6 — Self-Learning](#fase-6--self-learning)
- [Fase 7 — Sistema de Memória](#fase-7--sistema-de-memória-do-master)
- [Como as Fases se Cruzam](#como-as-fases-se-cruzam)
- [Glossário](#glossário)

---

## Sumário Executivo

O JOCA evolui de **wrapper de terminais** (estado actual) para **assistente pessoal completo** — um colega digital com identidade própria que cada funcionário tem na sua máquina.

**Estado actual (v1):**
- JOCA_UI: interface browser para gerir múltiplos terminais Claude Code
- JOCA_Logic: skills, agents, commands, memória persistente
- Suporte cross-CLI (Claude Code, Codex, Gemini)

**Para onde vai:**
1. **Estabilizar** o v1 actual
2. Adicionar **Master** — chat orquestrador que comanda os terminais
3. Dar **WhatsApp** ao JOCA — canal assíncrono fora do computador
4. **Automações** — tarefas recorrentes (cron inteligente)
5. **Acções** — tarefas manuais formalizadas (templates)
6. **Knowledge Base** — segundo cérebro pessoal (`/know`)
7. **Self-Learning** — auto-melhoria oportunista
8. **Sistema de Memória** — três camadas para conversa infinita

**Resultado final:** cada pessoa tem um assistente digital com nome, telemóvel e email próprios, que gere trabalho e vida pessoal, aprende sozinho, e nunca esquece nada.

---

## Visão Final

O JOCA completo, na sua forma final, é:

```
┌──────────────────────────────────────────────────────────────────┐
│                      JOCA (assistente pessoal)                    │
│                                                                  │
│  ┌────────────────┐  Identidade:                                 │
│  │ Nome: "Jarvis" │  • Email: jarvis@setuptech.pt                │
│  │ ou o que       │  • WhatsApp: +351 91X XXX XXX                │
│  │ quiseres       │  • Personalidade calibrada (soul.md)         │
│  └────────────────┘                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Canais de comunicação                                  │    │
│  │  • Master chat (presencial, no JOCA_UI)                 │    │
│  │  • WhatsApp (remoto, async)                             │    │
│  │  • Email (relatórios, notificações)                     │    │
│  │  • SMS / Push (alertas)                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Capacidades                                            │    │
│  │  • Orquestrar N terminais Claude Code                   │    │
│  │  • Executar automações (cron)                           │    │
│  │  • Executar acções (templates manuais)                  │    │
│  │  • Guardar e pesquisar conhecimento (/know)             │    │
│  │  • Aprender e melhorar-se a si próprio                  │    │
│  │  • Memória infinita (curta + longa + diário)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Integrações                                            │    │
│  │  Email • Calendário • Workspace • Git • Web • WhatsApp  │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

Cada funcionário da Setup Tech tem o seu próprio JOCA. Não há servidor central, não há partilha forçada. É pessoal, na máquina de cada um (PC ou VPS).

---

## Princípios Fundamentais

Princípios transversais a todas as fases — definem o que o JOCA é.

### 1. Um JOCA por pessoa

O JOCA não é uma ferramenta central da empresa — é um **assistente pessoal por funcionário**. Cada pessoa tem o seu JOCA, com:

- Nome personalizado (definido na instalação — JOCA, Jarvis, ou o que quiser)
- As suas contas de email e calendário
- As suas automações, acções e preferências
- A sua Knowledge Base
- Os seus projectos

O JOCA gere trabalho e vida pessoal. A empresa fornece a ferramenta, cada um configura o seu.

### 2. Identidade digital

Cada JOCA tem identidade própria, como um funcionário real:

| Recurso | Descrição |
|---------|-----------|
| Nome | Personalizável na instalação |
| Número de telemóvel | WhatsApp próprio — o "telemóvel" do JOCA |
| Email | Endereço dedicado (ex: joca@setuptech.pt) |
| Personalidade | Calibrada via `soul.md` |

O email do JOCA permite-lhe enviar notificações, relatórios e resumos ao utilizador, enviar emails a terceiros (se autorizado), e receber/processar emails.

### 3. Integrações via MCP / CLI

Todas as ligações a serviços externos são preferencialmente via **MCP servers** ou **ferramentas CLI existentes** — sem APIs custom sempre que possível.

| Serviço | Uso | Via |
|---------|-----|-----|
| Email (Gmail, Outlook, etc.) | Ler, enviar, resumir emails | CLI / MCP |
| Calendário (Google, Outlook) | Consultar, criar, modificar eventos | CLI / MCP |
| Google Workspace | Docs, Sheets, Drive | CLI / MCP |
| Git / GitHub | Repos, PRs, issues | CLI (gh, git) — já integrado |
| Monitorização de sites | Uptime, performance | CLI (curl, etc.) |
| Notícias / Web | Pesquisa, scraping de fontes | CLI / MCP |
| WhatsApp | Enviar, receber mensagens | WhatsApp Business API |
| Instagram, YouTube, etc. | Extracção de conteúdo (Knowledge Base) | CLI / MCP |

### 4. Modelo económico — zero custos extra

| Camada | Ferramenta | Custo |
|--------|-----------|-------|
| Master (orquestração) | Gemini / Codex / Llama / Qwen | Incluído nas subscrições ou grátis (local) |
| Workers (execução) | Claude Code CLI nos terminais | Incluído na subscrição Anthropic |

O Master usa SDKs incluídos nas subscrições existentes (Google, OpenAI) ou modelos locais gratuitos (Ollama). O trabalho pesado fica no Claude Code, já pago pela subscrição Anthropic.

**Fallback natural:** se o limite cloud esgotar, mudar para modelo local e continuar a trabalhar.

### 5. Local-first, privacidade total

- Tudo corre na máquina do utilizador (PC ou VPS pessoal)
- Sem servidor central da empresa
- Sem partilha de dados entre JOCAs
- Cada pessoa controla os seus próprios dados

---

## Roadmap

```
Fase 0      Fase 1      Fase 2      Fase 3       Fase 4      Fase 5      Fase 6      Fase 7
Estabilizar Master      WhatsApp    Automações   Acções      Knowledge   Self-       Memória
v1 wrapper  chat        telemóvel   trigger      trigger     Base        Learning    3 camadas
            orquestrador do JOCA    automático   manual      /know       oportunista (Master)
```

### Dependências entre fases

```
Fase 0 ─→ Fase 1 ─┬─→ Fase 2 (WhatsApp usa Master para responder)
                  ├─→ Fase 3 (Automações disparam via Master)
                  ├─→ Fase 4 (Acções correm via Master)
                  ├─→ Fase 5 (Knowledge Base alimenta o Master)
                  ├─→ Fase 6 (Self-Learning melhora o Master)
                  └─→ Fase 7 (Memória do Master)
```

O **Master (Fase 1)** é o pivô — quase tudo depende dele. As Fases 2-7 podem ser desenvolvidas em paralelo após o Master estar funcional.

---

## Fase 0 — Estabilização do v1

Consolidar o JOCA_UI como wrapper organizado de terminais e projectos.

### Objectivos

- Corrigir bugs existentes
- Estabilizar WebSocket e gestão de sessões PTY
- Polish da UI (dashboard, file browser, toolkit)
- Garantir fiabilidade em uso diário

### Critério de conclusão

Uso diário sem fricção durante 2 semanas.

### Pendente

- [ ] Lista de bugs conhecidos
- [ ] Testes automatizados para componentes críticos
- [ ] Documentação de troubleshooting

---

## Fase 1 — Master

### Visão

Chat orquestrador integrado no JOCA_UI que controla terminais Claude Code sem interacção manual. Interface de chat normal (não terminal) com controlo total sobre o ecossistema JOCA.

### Problema que resolve

Gerir múltiplos terminais Claude Code exige context-switching manual: abrir terminal, navegar ao projecto, dar a instrução, esperar, ler a resposta, repetir. O Master elimina isso — uma conversa única orquestra N terminais/projectos em paralelo.

### Arquitectura

```
┌─────────────────────────────────────────────┐
│              MASTER (Chat UI)               │
│                                             │
│  Interface de chat normal no JOCA_UI        │
│  Provider agnóstico (seleccionável)         │
│                                             │
│  Capacidades:                               │
│  • Criar/fechar terminais                   │
│  • Enviar instruções ao Claude Code         │
│  • Ler output dos terminais                 │
│  • Resumir o que foi feito                  │
│  • Gerir múltiplos terminais em paralelo    │
└──────────┬──────────┬───────────┬───────────┘
           │          │           │
     ┌─────▼──┐  ┌────▼───┐  ┌───▼────┐
     │ Term 1 │  │ Term 2 │  │ Term N │
     │ Claude │  │ Claude │  │ Claude │
     │ Code   │  │ Code   │  │ Code   │
     │(proj A)│  │(proj B)│  │(proj C)│
     └────────┘  └────────┘  └────────┘
```

### Providers suportados

O Master não está preso a nenhum modelo. O utilizador escolhe ao iniciar ou troca durante a conversa.

| Provider | Tipo | SDK |
|----------|------|-----|
| Gemini | Cloud (subscrição Google) | Gemini SDK |
| Codex | Cloud (subscrição OpenAI) | OpenAI SDK |
| Llama | Local (grátis) | Ollama |
| Qwen | Local (grátis) | Ollama |
| Outros LLMs | Local (grátis) | Ollama / API compatível |

### Fluxo

1. Utilizador abre o Master no JOCA_UI
2. Escolhe o provider/modelo
3. Descreve a tarefa em linguagem natural
4. Master decide o projecto e a abordagem
5. Master abre terminal(ais) automaticamente nos projectos certos
6. Claude Code executa o trabalho no terminal
7. Quando Claude Code pára, Master lê o output
8. Master dá feedback/resumo ao utilizador
9. Utilizador nunca precisa de tocar nos terminais directamente

### Gestão multi-terminal

- Distribuir tarefas independentes por terminais paralelos
- Monitorizar o estado de cada terminal (working/idle/done)
- Agregar resultados de múltiplos terminais numa resposta coerente
- Reencaminhar o utilizador para um terminal específico se necessário

### Decisões pendentes

- [ ] Qual provider default na primeira instalação?
- [ ] Como apresentar visualmente N terminais em paralelo no Master chat?
- [ ] Quanto contexto do projecto o Master deve carregar antes de delegar?

---

## Fase 2 — WhatsApp (o telemóvel do JOCA)

### Visão

O JOCA ganha um número de telemóvel próprio com WhatsApp — como se fosse o telemóvel pessoal dele. **Não é uma extensão do Master chat.** São duas coisas distintas:

| | Master chat (Fase 1) | WhatsApp (Fase 2) |
|--|---------------------|-------------------|
| **Analogia** | Estar na sala com o JOCA, frente a frente | Mandar mensagem quando saíste da sala |
| **Quando** | Ao computador, a trabalhar | Fora do computador, em trânsito |
| **Conversa** | Sessão de trabalho contínua | Mensagens pontuais, assíncronas |
| **Contexto** | Rico — acesso total ao JOCA_UI | Leve — texto e media |
| **Histórico** | Fica no Master chat | Fica no WhatsApp |
| **Misturam-se?** | Não | Não |

O JOCA sabe de tudo internamente, mas cada canal tem a sua conversa independente. Como um colega que sabe tudo do trabalho mas tem conversas separadas presencial vs WhatsApp.

### Fluxo

1. Utilizador sai do computador
2. Envia mensagem WhatsApp: "Como está o projecto X?"
3. JOCA recebe, lê, verifica o estado do projecto
4. JOCA responde por WhatsApp: "O projecto X está em Y, falta Z"
5. Conversa fica no WhatsApp, não entra no Master chat

### O JOCA como colega da empresa

Com número próprio, o JOCA é contactável como qualquer outro funcionário:

- Pessoas da empresa podem mandar mensagem ao JOCA
- Responde a perguntas, dá status de projectos, executa tarefas
- Regras de permissão: quem pode pedir o quê

### Notificações proactivas

O JOCA também pode iniciar conversa:

- Tarefa concluída → mensagem ao utilizador
- Erro crítico → alerta imediato
- Deploy feito → confirmação
- Canal configurável: WhatsApp, SMS, push, email

### Decisões pendentes

- [ ] Provider WhatsApp: Twilio, Meta Business API, ou outro?
- [ ] Custos do número e da API?
- [ ] Como gerir contactos autorizados (quem pode falar com o JOCA)?
- [ ] Limites de mensagens automáticas para evitar spam

---

## Fase 3 — Automações

### Visão

Automações simples ao estilo cron — o JOCA executa tarefas repetitivas automaticamente, sem o utilizador pedir. Não é um n8n ou Zapier complexo. É: "todos os dias às 9h, faz isto."

### Conceito

Uma automação tem três partes:

1. **Quando** — horário ou trigger (às 9h, a cada 2h, início do mês)
2. **O quê** — tarefa em linguagem natural
3. **Reportar como** — onde entregar o resultado (WhatsApp, JOCA_UI, email)

### Tipos de automação

**Simples** — faz X no horário Y:

| Quando | O quê | Reportar |
|--------|-------|----------|
| Todos os dias às 9h | Verificar emails não lidos de todas as contas, fazer resumo | WhatsApp |
| Todos os dias às 8h | Pesquisar notícias sobre temas definidos (ex: AI), compilar resumo com links | WhatsApp / email |
| A cada 4h | Verificar se os sites estão online | WhatsApp só se houver problema |
| Todos os dias às 18h | Resumo do que foi feito hoje nos terminais | JOCA_UI |
| Segunda às 8h | Resumo semanal do estado de todos os projectos | WhatsApp + email |
| Sexta às 17h | Gerar relatório semanal de horas/tarefas | Email |

**Com lógica condicional** — verifica Y, se Z então faz X:

| Quando | Lógica | Acção |
|--------|--------|-------|
| Início de cada mês | Consultar calendário. Verificar se há marcação de cabeleireiro. Se não há, verificar quando foi o último corte (últimos 60+ dias). | Se ≥60 dias sem corte → perguntar se quer marcar |
| Todos os dias às 8h | Pesquisar nos sites de notícias configurados (ou default). Filtrar por temas do utilizador. | Compilar resumo com destaques + links. Entregar pelo canal preferido. |

### Como criar automações

**1. Linguagem natural** (via Master chat ou WhatsApp)

> "Todos os dias às 9h verifica os meus emails e manda-me um resumo por WhatsApp"

O JOCA interpreta, cria a automação, e confirma.

**2. Editor visual** (JOCA_UI)

Interface para criar, editar, activar/desactivar e ver histórico. Campos estruturados: nome, horário/trigger, tarefa, condições, canal de report.

### Arquitectura

```
┌────────────────────────────────────────┐
│          Motor de Automações           │
│                                        │
│  ┌──────────┐  ┌───────────────────┐   │
│  │ Scheduler │  │  automações.json  │   │
│  │ (cron)    │──│  (lista tarefas)  │   │
│  └─────┬─────┘  └───────────────────┘   │
│        │                                │
│        ▼ dispara no horário             │
│  ┌──────────────┐                       │
│  │    MASTER     │                      │
│  │  (executa)    │                      │
│  └──────┬────────┘                      │
│         │                               │
│         ▼                               │
│  ┌──────────────┐                       │
│  │  Resultado    │──→ WhatsApp          │
│  │               │──→ JOCA_UI           │
│  │               │──→ Email             │
│  │               │──→ SMS / Push        │
│  └──────────────┘                       │
└────────────────────────────────────────┘
```

### Gestão

- **Listar** — ver todas as automações activas e histórico
- **Activar/desactivar** — parar temporariamente sem apagar
- **Editar** — alterar horário, tarefa, condições, ou canal
- **Histórico** — quando correu, o que fez, se teve erros
- **Logs** — resultado de cada execução guardado para consulta

### Decisões pendentes

- [ ] As automações correm em background com o JOCA_UI fechado? Daemon/serviço?
- [ ] Limites de execução paralela (evitar saturar a quota Claude)
- [ ] O que acontece se uma automação falhar? Retry? Notificação?

---

## Fase 4 — Acções

### Visão

Acções são processos formalizados com trigger manual. A diferença para automações:

| | Automações (Fase 3) | Acções (Fase 4) |
|--|---------------------|-----------------|
| **Trigger** | Automático (horário/cron) | Manual (o utilizador pede) |
| **Frequência** | Recorrente, programada | Quando for preciso |
| **Definição** | Quando + O quê + Reportar | O quê + Como + Input/Output |

Uma acção é uma tarefa que o utilizador faz regularmente, formalizada para ser sempre igual, custo-eficiente, e com resultado previsível. Em vez de explicar o processo cada vez, o utilizador invoca a acção e o JOCA executa da forma definida.

### Conceito

Uma acção tem:

1. **Nome** — identificador curto (ex: "Upscale")
2. **Input** — o que o utilizador fornece (ficheiro, texto, parâmetros)
3. **Processo** — os passos que o JOCA executa, sempre iguais
4. **Output** — o resultado esperado

### Exemplos

| Acção | Input | Processo | Output |
|-------|-------|----------|--------|
| Upscale imagem | Ficheiro de imagem | Aplicar upscale com ferramenta/parâmetros definidos | Imagem em alta resolução |
| *(mais exemplos a definir)* | | | |

### Como invocar

- **Master chat:** "Faz upscale desta imagem" + arrastar ficheiro
- **JOCA_UI:** botão/painel de acções rápidas
- **WhatsApp:** enviar ficheiro + nome da acção

### Vantagens sobre pedir ad-hoc ao JOCA

- **Consistência** — processo sempre igual, sem variação
- **Eficiência** — sem necessidade de explicar passos cada vez
- **Previsibilidade** — resultado esperado, sem surpresas
- **Reutilização** — criar uma vez, usar sempre

### Gestão

- **Criar** — via linguagem natural ou editor visual
- **Biblioteca** — lista de todas as acções disponíveis no JOCA_UI
- **Editar** — ajustar processo, parâmetros, ferramentas

### Decisões pendentes

- [ ] Catálogo de acções a desenvolver (lista do utilizador)
- [ ] Como o utilizador descobre acções existentes (UI de descoberta)
- [ ] Versionamento de acções (rollback se uma alteração piorar o resultado)

---

## Fase 5 — Knowledge Base

### Visão

Uma base de conhecimento pessoal onde o utilizador guarda tudo o que vê, aprende, ou acha interessante — e depois encontra quando precisa. Como um segundo cérebro gerido pelo JOCA.

### Problema que resolve

O utilizador vê um vídeo no Instagram, lê um artigo, descobre um truque — e depois esquece onde guardou ou que existia. Com a Knowledge Base, tudo fica catalogado, pesquisável, e acessível em linguagem natural.

### Conceito

```
Utilizador encontra algo ──→ /know + link/conteúdo ──→ JOCA analisa, 
                                                        classifica, 
                                                        gera tags
                                                            │
                                                            ▼
                                                    Knowledge Base
                                                    (árvore de tags
                                                     tipo Obsidian)
                                                            │
                                                            ▼
Utilizador pergunta ────────────────────────────→ JOCA pesquisa 
"tenho truques sobre fraldas?"                    e devolve o conteúdo
```

### Como guardar

**Comando `/know`** — via Master chat, WhatsApp, ou JOCA_UI:

```
/know https://instagram.com/reel/xyz
/know https://youtube.com/watch?v=abc
/know https://artigo-interessante.com/como-fazer-x
/know "O truque para fazer Y é Z" (texto livre)
```

O JOCA:
1. Abre o link / lê o conteúdo
2. Analisa o que é (vídeo, artigo, imagem, texto)
3. Gera um resumo
4. Atribui tags automaticamente (ex: `#parentalidade #truques #fraldas`)
5. Guarda na Knowledge Base com link original, resumo, e tags

### Como pesquisar

Linguagem natural — não é preciso saber as tags exactas:

- "Tenho truques sobre fraldas?" → JOCA pesquisa e devolve o vídeo do Instagram
- "Mostra-me o que guardei sobre AI esta semana"
- "Aquele artigo sobre produtividade que guardei no mês passado"
- "Tudo o que tenho sobre design"

### Estrutura (tipo Obsidian)

Árvore de tags hierárquica, gerada automaticamente:

```
Knowledge Base
├── #trabalho
│   ├── #design
│   ├── #programação
│   └── #produtividade
├── #pessoal
│   ├── #parentalidade
│   │   └── #truques
│   ├── #saúde
│   └── #finanças
├── #aprendizagem
│   ├── #ai
│   ├── #ferramentas
│   └── #tutoriais
└── ...
```

As tags são sugeridas pelo JOCA e podem ser editadas pelo utilizador. Com o tempo, a árvore cresce e reflecte os interesses do utilizador.

### Fontes suportadas

| Fonte | O que o JOCA extrai |
|-------|-------------------|
| Instagram (reel/post) | Vídeo, descrição, transcrição |
| YouTube | Vídeo, título, transcrição, descrição |
| Artigos web | Texto, imagens, título |
| PDFs | Conteúdo do documento |
| Texto livre | O que o utilizador escrever |
| Imagens | Descrição visual, OCR se tiver texto |
| Tweets / posts | Texto, media |

### Gestão

- **Navegar** — explorar por tags no JOCA_UI (vista árvore)
- **Pesquisar** — linguagem natural ou por tags
- **Editar** — corrigir tags, resumo, ou adicionar notas
- **Apagar** — remover entradas
- **Exportar** — backup ou migração da base

### Decisões pendentes

- [ ] Storage: ficheiros markdown locais (estilo Obsidian) ou base de dados?
- [ ] Indexação para pesquisa rápida (vector embeddings?)
- [ ] Como lidar com conteúdo que muda no original (link morto, post apagado)?

---

## Fase 6 — Self-Learning

Auto-melhoria oportunista.

### Visão

O JOCA aproveita o tempo desperdiçado no fim dos limites de uso do Claude Code para se melhorar a si próprio. Em vez de deixar os últimos minutos do ciclo de 5h irem para o lixo, o JOCA corre o `/upgrade-joca` automaticamente — lê feedback acumulado e implementa melhorias nas suas memórias, skills e agents.

### Problema que resolve

O Claude Code tem limites de 5h (e semanais). É comum chegar aos últimos 15-30 minutos com quota sobrante que vai expirar sem ser usada. Ao mesmo tempo, o JOCA acumula feedback de todas as conversas que nunca é processado até alguém manualmente correr o upgrade. O self-learning resolve os dois problemas: usa tempo que ia ser perdido para processar melhorias que iam ficar pendentes.

### Lógica de activação

```
A cada X minutos, verificar:

1. Quanto tempo falta para o fim do ciclo de 5h?
2. Qual a % do limite já consumida?

SE tempo_restante ≤ 15 min
E  limite_consumido < 70%    (sobram ≥30% que vão expirar)
ENTÃO
   → correr /upgrade-joca automaticamente
```

| Condição | Valor |
|----------|-------|
| Tempo restante no ciclo | ≤ 15 minutos |
| Limite consumido | < 70% (≥30% sobrante, vai ser desperdiçado) |
| Acção | Correr `/upgrade-joca` |

### O que o /upgrade-joca faz

1. Lê todo o feedback acumulado (de todas as conversas)
2. Identifica padrões, lacunas, e melhorias
3. Implementa alterações em:
   - Memórias (soul, projectos, INDEX)
   - Skills (corrigir, expandir, criar novas)
   - Agents (melhorar workflows, adicionar capacidades)
4. Limpa o feedback processado

### Fluxo

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Monitor de  │────→│  Condições   │────→│  /upgrade-joca   │
│  rate limits │     │  cumpridas?  │     │  (auto-melhoria) │
│  (periódico) │     │              │     │                  │
└──────────────┘     │  ≤15 min     │     │  • Ler feedback  │
                     │  <70% usado  │     │  • Melhorar skills│
                     │              │     │  • Actualizar mem.│
                     │  Não → espera│     │  • Optimizar agents│
                     └──────────────┘     └──────────────────┘
```

### Salvaguardas

- Nunca corre se o utilizador estiver a usar o JOCA activamente
- Não interfere com trabalho em curso nos terminais
- Log de todas as alterações feitas (reversíveis)
- Pode ser desactivado pelo utilizador

### Decisões pendentes

- [ ] Como detectar fiavelmente "utilizador inactivo"?
- [ ] Limite mínimo de feedback acumulado para justificar a corrida (não correr para 1 feedback)
- [ ] Notificar o utilizador depois do upgrade ou ficar silencioso?

---

## Fase 7 — Sistema de Memória do Master

### Visão

O Master chat é uma conversa contínua — potencialmente infinita. Mas os modelos têm limites de contexto. O sistema de memória resolve isto com três camadas que espelham a memória humana, permitindo ao JOCA manter continuidade sem perder nada.

### As três camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   MEMÓRIA CURTA                                                 │
│   "O que estamos a falar agora"                                 │
│                                                                 │
│   Resumo do último log. É o que inicia cada nova janela         │
│   de contexto. Só refere o log imediatamente anterior —         │
│   não acumula resumos anteriores.                               │
│                                                                 │
│   Analogia: a conversa que estou a ter agora com o JOCA.        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   MEMÓRIA LONGA                                                 │
│   "O que fizemos na semana passada"                             │
│                                                                 │
│   Resumos detalhados de todos os logs. O JOCA lê estes          │
│   resumos para encontrar o log certo, sem carregar              │
│   conversas inteiras.                                           │
│                                                                 │
│   Analogia: perguntar ao JOCA o que fez na semana passada       │
│   e ele dizer "fiz X, Y e Z".                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   DIÁRIO (Arquivo)                                              │
│   "Mostra-me exactamente o que aconteceu"                       │
│                                                                 │
│   Gravação completa de cada conversa. O registo total,          │
│   sem resumos nem cortes. O JOCA só acede aqui quando           │
│   precisa de detalhe exacto.                                    │
│                                                                 │
│   Analogia: perguntar "mas o que foi o X exactamente?"          │
│   e ele puxar a gravação que mostra tudo.                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ciclo de arquivo

A cada X tokens / tempo / % de contexto usado, o Master:

```
Janela de contexto actual
         │
         ▼ (limite atingido)
         │
    ┌────┴─────────────────────────────────────┐
    │                                          │
    ▼                  ▼                       ▼
┌────────┐     ┌──────────────┐     ┌──────────────────┐
│ DIÁRIO │     │ MEM. LONGA   │     │ MEM. CURTA       │
│        │     │              │     │                  │
│ Grava  │     │ Gera resumo  │     │ Gera resumo de   │
│ a      │     │ detalhado    │     │ continuação      │
│ conversa│    │ desta janela │     │ (só desta janela,│
│ completa│    │ → adiciona   │     │  não acumula)    │
│         │    │ ao índice    │     │                  │
└────────┘     └──────────────┘     └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ NOVA JANELA      │
                                    │ de contexto      │
                                    │                  │
                                    │ Começa com a     │
                                    │ memória curta    │
                                    │ → conversa       │
                                    │   continua       │
                                    └──────────────────┘
```

### Como o JOCA responde a perguntas do passado

**Pergunta recente** (memória curta):
> "O que estávamos a falar?" → Já está no contexto actual. Responde directamente.

**Pergunta de dias/semanas atrás** (memória longa):
> "O que fizeste na semana passada?" → Lê os resumos da memória longa. Responde com base nos resumos.

**Pergunta de detalhe exacto** (diário):
> "Mas o que foi exactamente o X?" → Encontra o log certo via resumo da memória longa → abre o diário → puxa a conversa completa.

```
Pergunta ──→ Memória Curta (está no contexto?)
                 │ não
                 ▼
             Memória Longa (está nos resumos?)
                 │ sim → encontra o log
                 ▼
             Diário (lê a conversa completa desse log)
                 │
                 ▼
             Resposta com detalhe exacto
```

### Estrutura de ficheiros

```
master-memory/
├── curta.md                    ← resumo de continuação (último log)
├── longa/
│   ├── 2026-05-27_09h30.md    ← resumo detalhado de cada janela
│   ├── 2026-05-27_14h15.md
│   ├── 2026-05-28_10h00.md
│   └── ...
└── diario/
    ├── 2026-05-27_09h30.log   ← conversa completa de cada janela
    ├── 2026-05-27_14h15.log
    ├── 2026-05-28_10h00.log
    └── ...
```

### Regra da memória curta

A memória curta **nunca acumula**. Contém apenas o resumo da janela imediatamente anterior. Quando o contexto arquiva:

- O resumo de continuação anterior é descartado
- Um novo resumo é gerado apenas da janela que acabou
- Este novo resumo inicia a próxima janela

Isto evita que a memória curta cresça infinitamente e polua o contexto com informação cada vez mais antiga e diluída.

### Decisões pendentes

- [ ] Qual o trigger ideal de arquivo? % de contexto, tokens, tempo?
- [ ] Compressão do diário (logs antigos podem ser zipados)
- [ ] Pesquisa no diário: indexar (embeddings) ou grep simples?
- [ ] Privacidade: encriptar o diário?

---

## Como as Fases se Cruzam

O JOCA não é uma lista de funcionalidades isoladas — é um sistema integrado. Exemplos de como as fases interagem:

### Exemplo 1: Automação de notícias que alimenta a Knowledge Base

```
Automação (Fase 3) ──→ todos os dias procura notícias sobre AI
        │
        ▼
Master (Fase 1) ──→ executa a pesquisa
        │
        ▼
Compila resumo + links
        │
        ├──→ Envia por WhatsApp (Fase 2) ao utilizador
        │
        └──→ Guarda na Knowledge Base (Fase 5) com tag #ai #notícias
```

### Exemplo 2: WhatsApp aciona uma acção

```
Utilizador envia foto por WhatsApp (Fase 2)
        │
        ▼
JOCA reconhece: "Faz upscale"
        │
        ▼
Executa Acção "Upscale" (Fase 4)
        │
        ▼
Master (Fase 1) coordena com ferramenta de upscale
        │
        ▼
Devolve imagem pelo WhatsApp
```

### Exemplo 3: Self-Learning melhora o Master

```
Master (Fase 1) acumula feedback ao longo do dia
        │
        ▼
Self-Learning (Fase 6) detecta janela de oportunidade
        │
        ▼
Corre /upgrade-joca → melhora skills, agents, memória
        │
        ▼
Master (Fase 1) na próxima sessão usa as melhorias
```

### Exemplo 4: Memória permite continuidade

```
Conversa de hoje no Master (Fase 1)
        │
        ▼ contexto cheio
        │
Sistema de Memória (Fase 7) arquiva:
  • Diário: conversa completa
  • Memória longa: resumo detalhado
  • Memória curta: resumo de continuação
        │
        ▼
Nova janela inicia com memória curta → conversa continua sem ruptura
        │
        ▼ semana depois
Utilizador: "O que decidimos sobre X?" → Memória longa encontra
        │
        ▼
Detalhe exacto → Diário recupera a conversa completa
```

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **JOCA** | Joint Orchestrator of Cognitive Agents. O assistente pessoal completo. Nome personalizável por utilizador. |
| **JOCA_Logic** | Motor do JOCA: skills, agents, commands, memória |
| **JOCA_UI** | Interface browser do JOCA: multi-terminal, file browser, toolkit |
| **Master** | Chat orquestrador (Fase 1). Comanda os terminais. |
| **Worker** | Terminal Claude Code controlado pelo Master |
| **Automação** | Tarefa recorrente com trigger automático (cron) |
| **Acção** | Tarefa formalizada com trigger manual (template) |
| **Knowledge Base** | Segundo cérebro pessoal. Comando `/know` |
| **Self-Learning** | Auto-melhoria oportunista do JOCA |
| **Memória Curta** | Resumo de continuação (última janela) |
| **Memória Longa** | Resumos detalhados de todas as janelas |
| **Diário** | Arquivo completo de todas as conversas |
| **MCP** | Model Context Protocol. Forma padrão de o JOCA integrar com serviços externos. |
| **Provider** | Modelo de AI usado pelo Master (Gemini, Codex, Llama, etc.) |
| **Subscrição** | Plano pago Claude/OpenAI/Google que inclui SDK e quota |

---

## Notas finais

Este documento é **vivo**. Cada conversa de visão adiciona, refina, ou reorganiza fases. As fases não estão necessariamente em ordem cronológica de implementação — algumas podem ser desenvolvidas em paralelo após o Master (Fase 1) estar estável.

**Para adicionar uma nova fase:**
1. Discutir a visão em conversa com o JOCA
2. Formalizar com: visão, problema que resolve, arquitectura, fluxo, decisões pendentes
3. Adicionar ao índice e roadmap
4. Actualizar a secção "Como as Fases se Cruzam" se relevante
