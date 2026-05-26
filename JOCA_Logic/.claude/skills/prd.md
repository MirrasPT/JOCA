---
name: prd
description: "Gera e mantém PRD.md — documento de requisitos vivo, optimizado para Claude Code parsing; activado no /init-project e actualizado em cada /save quando há mudanças de scope. MUST be invoked when the user mentions: Gera, PRD, Claude Code."
metadata:
  type: skill
  category: base
---

# Skill: prd

## Quando activar

- **Sempre** no `/init-project` — perguntar se o utilizador quer PRD
- Pedido explícito: "cria um PRD", "documento de requisitos", "especificação do produto"
- Nova feature/mudança de scope sem documentação
- `/save` quando `PRD.md` existe e houve mudanças de scope na sessão

---

## Estrutura do PRD.md

> Regra de parsing: headers únicos e hierárquicos — Claude navega por headers. User Stories atómicas (1 por story). Acceptance Criteria como bullets verificáveis. Constraints em secção separada (nunca enterradas em prosa).

```markdown
# PRD — [Nome do Projecto]

**Versão:** 0.1
**Estado:** Draft | Em desenvolvimento | Estável
**Última actualização:** [data]
**North Star Metric:** [1 métrica — o número que prova que o produto funciona]

---

## 1. Visão Geral

### Problema
[1-3 frases: que problema resolve, para quem, com que evidência]

### Solução
[1-3 frases: o que o produto faz — não como, o quê]

### Fora de Scope
- [o que explicitamente não vai ser feito nesta versão]
- [cada item numa linha — sem ambiguidade]

---

## 2. Métricas de Sucesso

**North Star:** [métrica única que define sucesso]

| Tipo | Métrica | Baseline | Target | Prazo |
|------|---------|----------|--------|-------|
| Leading | [métrica antecipada] | [actual] | [alvo] | [data] |
| Lagging | [métrica de resultado] | [actual] | [alvo] | [data] |

*Framework usado: AARRR | HEART | OKRs — [escolher e manter consistente]*

---

## 3. Utilizadores-Alvo

| Persona | Descrição | Job-to-be-Done | Principal dor |
|---------|-----------|----------------|---------------|
| [Persona 1] | [quem é] | Quando [situação], quero [motivação], para [outcome] | [dor] |
| [Persona 2] | [quem é] | Quando [situação], quero [motivação], para [outcome] | [dor] |

---

## 4. Funcionalidades

### MVP — P0 (obrigatório para lançar)

| ID | Funcionalidade | Descrição | Persona |
|----|----------------|-----------|---------|
| F1 | [nome] | [o quê, não o como] | [Persona] |
| F2 | [nome] | [o quê, não o como] | [Persona] |

### Fase 2 — P1 (pós-MVP)

| ID | Funcionalidade | Descrição | Persona |
|----|----------------|-----------|---------|
| F-2-1 | [nome] | [descrição] | [Persona] |

---

## 5. User Stories e Acceptance Criteria

> Formato: 1 story por item. Acceptance Criteria em Given/When/Then. Incluir happy path + edge case + error state.

### [F1] [Nome da Funcionalidade]

**Como** [persona], **quero** [acção] **para** [benefício].

**Critérios de Aceitação:**
- Dado que [contexto], Quando [acção], Então [resultado esperado]
- Dado que [edge case], Quando [acção], Então [resultado de erro esperado]
- Dado que [contexto de recuperação], Quando [acção], Então [resultado de recuperação]

### [F2] [Nome da Funcionalidade]

**Como** [persona], **quero** [acção] **para** [benefício].

**Critérios de Aceitação:**
- Dado que [contexto], Quando [acção], Então [resultado esperado]

---

## 6. Requisitos Não-Funcionais

| Categoria | Requisito | Threshold | Prioridade |
|-----------|-----------|-----------|------------|
| Performance | Tempo de resposta p95 | < 200ms | P0 |
| Performance | Throughput mínimo | [req/s] | P1 |
| Segurança | Autenticação | [standard] | P0 |
| Acessibilidade | Standard | WCAG 2.1 AA | P1 |
| Fiabilidade | Uptime | 99.9% | P0 |
| Manutenibilidade | Test coverage | > 80% | P1 |
| Compatibilidade | Browsers | [lista] | P1 |

---

## 7. Constraints Técnicas

- Stack: [detectada no projecto]
- [constraint adicional — ex: "deve usar API existente X"]
- [constraint de negócio — ex: "GDPR: sem dados de utilizador fora da UE"]
- [constraint de plataforma — ex: "máximo 5MB por request"]

---

## 8. Analytics & Telemetria

### Eventos a Rastrear

| Evento | Propriedades | Propósito |
|--------|-------------|-----------|
| [event_name] | [prop1, prop2] | [o que mede] |

### Dashboards

- [Dashboard X] — monitoriza [métricas Y e Z]

### Alertas

- Alert se [métrica] < [threshold] durante [período] → [acção]

---

## 9. Fases & Timeline

| Fase | Entregável | Critério de Conclusão | Data |
|------|-----------|----------------------|------|
| Fase 0 | Design / PRD | PRD aprovado, protótipo validado | [data] |
| Fase 1 | MVP | Features P0 em produção, métricas baseline definidas | [data] |
| Fase 2 | [nome] | [critério verificável] | [data] |

---

## 10. Rollout & Operações

### Plano de Rollout

| Fase | Audiência | Mecanismo | Duração |
|------|-----------|-----------|---------|
| Alpha | Equipa interna | Sem flag | [X dias] |
| Beta | [% early adopters] | Feature flag `[nome_flag]` | [X dias] |
| GA | 100% | Remover flag | — |

### Rollback Triggers

- Error rate > [X]% → rollback automático
- [Métrica crítica] < [threshold] → pausar rollout

### Comunicação

- Notificar utilizadores afectados [X] dias antes de mudanças breaking

---

## 11. Questões em Aberto

| # | Questão | Owner | Prazo | Estado |
|---|---------|-------|-------|--------|
| Q1 | [questão] | [quem] | [data/TBD] | Aberta |

---

## 12. Decision Log

| Data | Decisão | Alternativas Consideradas | Racional |
|------|---------|--------------------------|----------|
| [data] | [decisão tomada] | [alternativa A, alternativa B] | [porquê esta] |

---

## 13. Glossário

| Termo | Definição no contexto deste produto |
|-------|-------------------------------------|
| [termo] | [definição precisa — elimina ambiguidade] |

---

## 14. Histórico de Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| 0.1 | [data] | ADDED: draft inicial |

*Semântica: ADDED · CHANGED · REMOVED · DECIDED*
```

---

## Geração no /init-project

Após FASE 1 (contexto recolhido), antes de EXECUÇÃO:

1. Perguntar com `AskUserQuestion`:
   ```
   question: "Queres que eu gere um PRD.md para este projecto?"
   header: "PRD"
   options:
     - "Sim — gerar agora"
     - "Não / mais tarde"
   ```

2. Se sim, fazer as perguntas mínimas não cobertas pelo questionário:
   - "Qual o problema central que este produto resolve? (1-2 frases)"
   - "Quais as 3 funcionalidades obrigatórias para o MVP?"
   - "North Star Metric — o número que prova que funciona?"
   - "Quem são os utilizadores principais e o que tentam fazer?"

3. Gerar `PRD.md` na raiz do projecto com a estrutura acima, preenchida com o contexto.

4. Adicionar referência no CLAUDE.md do projecto:
   ```markdown
   **PRD:** [PRD.md](PRD.md)
   ```

5. Registar na entrada de memória do projecto:
   ```markdown
   **PRD:** PRD.md existe — actualizar via skill prd em /save
   ```

---

## Actualização do PRD

### Critérios para propor actualização

- Feature implementada ou descartada
- Mudança de scope (dentro ou fora)
- Fase concluída
- KPI ou North Star redefinido
- Questão em aberto respondida → mover para Decision Log
- Decisão técnica significativa tomada → registar em Decision Log
- Constraint nova descoberta

### Processo

1. Ler `PRD.md` actual
2. Identificar secções desactualizadas (diagnóstico em ≤ 3 linhas)
3. Propor em 1 linha: "PRD desactualizado em: [secções]. Actualizo?"
4. Se sim:
   - Editar cirurgicamente — só o que mudou
   - Mover questões resolvidas de Open Questions → Decision Log
   - Incrementar versão (0.1 → 0.2)
   - Actualizar data
   - Adicionar linha no Histórico com semântica ADDED/CHANGED/REMOVED/DECIDED

### Validação no /save

Se `PRD.md` existir, verificar e alertar se:
- Feature P0 sem Acceptance Criteria definida
- NFRs completamente vazios
- Open Questions sem owner ou sem prazo
- North Star Metric em branco
- Rollout plan em falta para feature prestes a ser lançada

Alertar em 1 linha por gap encontrado. Não bloquear o /save.

---

## Formatos alternativos

**Lean PRD (features pequenas, &lt; 1 semana de trabalho):**
Usar apenas: Problema · Solução · User Stories + AC · NFRs críticos · Definition of Done.
Omitir: Analytics, Rollout, Glossário, Personas completas.

**Technical PRD (sem PM, só eng):**
Enfatizar: NFRs · Constraints · Decision Log · Acceptance Criteria como testes.
Reduzir: Personas, JTBD, Métricas de negócio.

---

## Workflow

Pipeline desta skill na sequência JOCA:

→ **após gerar PRD**: `prd-reviewer` (agente) — valida completeness e AI-parsability
→ **após aprovação PRD**: `plan` — arquitectura técnica baseada nos requisitos
→ **validação contínua**: re-correr `prd-reviewer` após cada actualização major

Notificar ao concluir PRD: `→ próximo: prd-reviewer`
