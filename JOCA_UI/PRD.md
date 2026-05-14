# PRD — JOCA_UI

**Versão:** 0.1
**Estado:** Draft
**Última actualização:** 2026-05-14
**North Star Metric:** N/A — projecto pessoal (uso próprio)

---

## 1. Visão Geral

### Problema

O Claude Code só é acessível via terminal CLI, o que dificulta gerir múltiplas sessões em paralelo e não tem interface visual. Abrir vários terminais manualmente é confuso e não tem contexto visual partilhado.

### Solução

UI browser que emula o terminal do Claude Code com fidelidade total (PTY real via `node-pty`), sidebar esquerda com múltiplos chats independentes (cada um = processo `claude` separado), e comunicação em tempo real via WebSocket.

### Fora de Scope

- Autenticação / multi-utilizador (uso pessoal)
- Deploy remoto / HTTPS
- Histórico persistente de sessões (além do que o Claude Code já faz)
- Customização de temas (pelo menos no MVP)

---

## 2. Métricas de Sucesso

Projecto pessoal — sem métricas formais. Critério subjectivo: substituir o terminal para trabalho com Claude Code.

---

## 3. Utilizadores-Alvo

| Persona | Descrição | Job-to-be-Done | Principal dor |
|---------|-----------|----------------|---------------|
| Utilizador | Designer + PM, usa Claude Code diariamente | Quando trabalho em vários projectos em simultâneo, quero gerir múltiplas sessões Claude num único ecrã organizado, para não perder contexto entre projectos | Trocar entre terminais é confuso, sem visão global |

---

## 4. Funcionalidades

### MVP — P0 (obrigatório para lançar)

| ID | Funcionalidade | Descrição | Persona |
|----|----------------|-----------|---------|
| F1 | Terminal browser | Emulação de terminal completa com xterm.js + node-pty — input/output idêntico ao CLI | Utilizador |
| F2 | Sidebar multi-sessão | Lista de chats activos à esquerda; cada item = processo `claude` independente | Utilizador |
| F3 | Criar nova sessão | Botão/atalho para abrir novo chat (spawna novo PTY + processo `claude`) | Utilizador |
| F4 | Fechar sessão | Fechar chat mata o processo PTY correspondente | Utilizador |
| F5 | Comunicação WebSocket | Backend Node.js + Express com WebSocket (`ws`) — bidirecional, baixa latência | Utilizador |
| F6 | Working directory por sessão | Cada sessão abre no directório escolhido (ou home por defeito) | Utilizador |

### Fase 2 — P1 (pós-MVP)

| ID | Funcionalidade | Descrição | Persona |
|----|----------------|-----------|---------|
| F-2-1 | Nome de sessão editável | Renomear chats na sidebar para contexto rápido | Utilizador |
| F-2-2 | Resize de painel | Arrastar divisor entre sidebar e terminal | Utilizador |
| F-2-3 | Tema dark/light | Toggle de tema visual | Utilizador |
| F-2-4 | Keyboard shortcuts | Atalhos para trocar entre sessões (Cmd+1, Cmd+2, etc.) | Utilizador |
| F-2-5 | Persistent session names | Guardar nomes de sessão entre reloads | Utilizador |

---

## 5. User Stories e Acceptance Criteria

### [F1] Terminal browser

**Como** Utilizador, **quero** um terminal funcional no browser **para** interagir com Claude Code sem abrir o terminal do sistema.

**Critérios de Aceitação:**
- Dado que o servidor está a correr, Quando abro o browser em `localhost:PORT`, Então vejo um terminal xterm.js activo
- Dado que escrevo um comando, Quando carrego Enter, Então o output aparece em tempo real (streaming)
- Dado que o Claude Code produz cores ANSI, Quando o output é enviado, Então as cores são renderizadas correctamente
- Dado que o processo `claude` termina inesperadamente, Quando isso acontece, Então o terminal mostra mensagem de sessão terminada

### [F2] Sidebar multi-sessão

**Como** Utilizador, **quero** ver todas as sessões activas na sidebar esquerda **para** trocar rapidamente entre projectos.

**Critérios de Aceitação:**
- Dado que tenho 3 sessões abertas, Quando olho para a sidebar, Então vejo 3 items com identificador único
- Dado que clico numa sessão na sidebar, Quando a sessão muda, Então o terminal mostra o estado dessa sessão (sem reset)
- Dado que uma sessão está activa, Quando troco para outra, Então a sessão anterior mantém o processo PTY vivo em background

### [F3] Criar nova sessão

**Como** Utilizador, **quero** criar novas sessões com um clique **para** começar trabalho num novo projecto sem perder os anteriores.

**Critérios de Aceitação:**
- Dado que clico em "Nova Sessão", Quando a sessão é criada, Então um novo processo `claude` é spawnado e aparece na sidebar
- Dado que crio a 5ª sessão, Quando a sidebar fica cheia, Então faz scroll sem perder items

### [F4] Fechar sessão

**Como** Utilizador, **quero** fechar sessões que já não preciso **para** libertar recursos.

**Critérios de Aceitação:**
- Dado que fecho uma sessão, Quando isso acontece, Então o processo PTY é terminado (SIGTERM) e a sessão desaparece da sidebar
- Dado que fecho a sessão activa, Quando isso acontece, Então outra sessão é seleccionada automaticamente (ou estado vazio se era a última)

---

## 6. Requisitos Não-Funcionais

| Categoria | Requisito | Threshold | Prioridade |
|-----------|-----------|-----------|------------|
| Performance | Latência terminal (input → output) | < 100ms p95 | P0 |
| Performance | Tempo de startup do servidor | < 3s | P1 |
| Compatibilidade | Browser | Chrome/Safari/Firefox modernos | P0 |
| Fiabilidade | PTY não crashar em idle | Indefinidamente | P0 |
| Segurança | Acessível só em localhost | Sem binding externo | P0 |

---

## 7. Constraints Técnicas

- Stack: React + Vite + TypeScript (frontend) · Node.js + Express + `ws` (backend) · `xterm.js` (terminal UI) · `node-pty` (PTY nativo)
- `node-pty` requer compilação nativa (node-gyp) — macOS com Xcode tools
- Processo `claude` deve ser encontrado no PATH do sistema
- Sem base de dados — estado em memória no servidor
- Local apenas — sem HTTPS, sem auth

---

## 8. Analytics & Telemetria

N/A — projecto pessoal.

---

## 9. Fases & Timeline

| Fase | Entregável | Critério de Conclusão |
|------|-----------|----------------------|
| Fase 0 | Setup + PRD | PRD criado, estrutura do projecto definida |
| Fase 1 | MVP | Terminal funcional + sidebar multi-sessão no browser |
| Fase 2 | Refinamento | Shortcuts, resize, nomes de sessão |

---

## 10. Rollout & Operações

Local only — sem rollout formal. Iniciar com `npm run dev` (dev) ou `npm start` (prod local).

---

## 11. Questões em Aberto

| # | Questão | Owner | Prazo | Estado |
|---|---------|-------|-------|--------|
| Q1 | Usar Socket.io em vez de `ws` raw para reconexão automática? | Utilizador | — | Aberta |
| Q2 | Porto padrão — 3000, 7080, ou configurável via env? | Utilizador | — | Aberta |
| Q3 | Working directory inicial — home, JOCA, ou picker no UI? | Utilizador | — | Aberta |

---

## 12. Decision Log

| Data | Decisão | Alternativas Consideradas | Racional |
|------|---------|--------------------------|----------|
| 2026-05-14 | React + Vite + TypeScript | Vue, Vanilla JS | Melhor ecossistema para xterm.js, tipagem forte |
| 2026-05-14 | node-pty para PTY | child_process.spawn | PTY real suporta cores ANSI, resize, pseudo-tty |
| 2026-05-14 | Local only | VPS, Electron | Simplicidade; sem necessidade de acesso remoto |

---

## 13. Glossário

| Termo | Definição |
|-------|-----------|
| PTY | Pseudo-terminal — emula um terminal físico, permite cores ANSI e controlo de processo |
| xterm.js | Biblioteca JS que renderiza um terminal no browser |
| node-pty | Binding Node.js para criar PTYs nativos no sistema operativo |
| Sessão | Par PTY + processo `claude` + estado de terminal no frontend |

---

## 14. Histórico de Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| 0.1 | 2026-05-14 | ADDED: draft inicial via /init-project |
