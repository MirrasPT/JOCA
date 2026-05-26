---
name: plan
description: Planeamento estruturado em 7 fases antes de execução — auto-activado em tarefas complexas; incorpora OODA orient, assumption surfacing bloqueante, ambiguidade check, pre-mortem, e calibração de confiança
metadata:
  type: skill
  category: base
---

# Skill: plan

## Quando auto-activar

Activar **antes de qualquer execução** quando a tarefa tiver ≥ 2 destes sinais — ou **imediatamente** se detectar o sinal ★:

| Sinal | Prioridade |
|-------|-----------|
| Operação irreversível: migration, delete de dados, deploy, reset ★ | Máxima — sozinha activa |
| ≥ 3 ficheiros ou módulos envolvidos | Alta |
| Passos com dependências (falhar A → B falha) | Alta |
| Decisão de arquitectura com tradeoffs reais | Alta |
| Pedido que menciona múltiplos sistemas ou stakeholders | Alta |
| Feature nova sem precedente no codebase | Média |
| Pedido ambíguo ou mais curto que a complexidade implicada | Média |
| Scope estimado > 5 passos atómicos ou > 20 min | Média |

**Sinais verbais directos:** "planeia", "arquitectura de", "como faríamos", "implementa X e Y e Z", "migra", "reestrutura", "refactora tudo", "integra com".

---

## Protocolo — 7 Fases Sequenciais

### Fase 0: Orient (OODA)

*Não mostrar ao utilizador — processo interno antes das outras fases.*

Interpretar o pedido antes de qualquer plano:
- Qual é o problema real (não apenas o pedido literal)?
- Que contexto do codebase é relevante mas não foi mencionado?
- Que não foi dito mas provavelmente é relevante para o sucesso?
- Se há 2 formas radicalmente diferentes de implementar isto que ambas satisfazem o pedido → o pedido é ambíguo → avançar para Fase 1.

---

### Fase 1: Ambiguidade Check

*Só se detectada ambiguidade na Fase 0.*

Fazer **2-3 perguntas específicas** ao utilizador antes de continuar. Não mais.
Foco em:
- Comportamento em edge cases: "o que deve acontecer quando X?"
- Navegação no codebase: "qual é o módulo responsável por Y?"
- Decisão de abordagem: "preferes A ou B dado o tradeoff [...]?"

Limite: **3 ciclos de clarificação máximo**. Depois avançar com assumptions explícitas.

---

### Fase 2: Assumptions Explícitas

**Bloqueante** — o utilizador confirma antes de ver o plano.

Para cada assumption relevante:

```
Assumptions a validar:

[ ] Assumption: [o que estou a assumir]
    Impacto se errada: [o que muda no plano]
    Como verificar: [como confirmar — agora ou durante execução]

[ ] Assumption: [...]
    Impacto se errada: [...]
    Como verificar: [...]
```

Aguardar confirmação. Se uma assumption estiver errada → corrigir antes de avançar.

---

### Fase 3: Abordagens e Tradeoffs

*Só para decisões de arquitectura com múltiplas opções válidas.*

Apresentar 2-3 abordagens com tradeoffs explícitos:

```
Abordagem A: [descrição]
  + [vantagem 1]
  - [desvantagem 1]
  Trade-off: [X vs Y]

Abordagem B: [descrição]
  + [vantagem 1]
  - [desvantagem 1]
  Trade-off: [X vs Y]

→ Recomendo A porque [razão em 1 linha]
```

---

### Fase 4: Plano Verificável

Cada passo no formato PAUL — sem verificação definida = passo incompleto:

```
Plano: [nome da tarefa]
Critério de sucesso: [o que significa "feito" — verificável, não vago]

[ ] 1. [Acção]
       Ficheiros: [lista explícita]
       Verificar: [como confirmar que está correcto]
       Done quando: [critério observável]

[ ] 2. [Acção]
       Ficheiros: [lista explícita]
       Verificar: [como confirmar]
       Done quando: [critério observável]
```

**Boundaries:**
- Sempre: [o que será sempre feito]
- Perguntar primeiro se: [situações que requerem confirmação]
- Nunca tocar: [ficheiros/áreas fora de scope]

**Nota:** tarefas atómicas devem ser completáveis em ≤ 15 min. Qualquer passo acima disso deve ser subdividido.

---

### Fase 5: Pre-Mortem Mínimo

Duas perspectivas internas — resultado adicionado ao plano:

**Sabotador:** "Assume que este plano falhou. O que correu mal?"
→ Identificar o failure mode mais provável e como mitigar.

**Outsider:** "O que assume este plano que alguém sem contexto veria imediatamente?"
→ Identificar a assumption mais perigosa que ainda não está na lista da Fase 2.

Adicionar ao plano:
```
Riscos identificados:
- [risco 1] → Mitigação: [acção]
- [risco 2] → Mitigação: [acção]
```

---

### Fase 6: Calibração de Confiança

No fim do plano, antes de apresentar ao utilizador:

```
Incerteza máxima:
- [área 1]: [porquê baixa confiança] — reduziria com [X]
- [área 2]: [porquê baixa confiança] — reduziria com [Y]
```

Isto sinaliza ao utilizador onde o plano é mais frágil sem bloquear a execução.

---

## Apresentação ao Utilizador

Formato compacto — não um documento, um artefacto verificável:

```
Plano: [nome]

Assumptions confirmadas: [lista ou "nenhuma — pedido claro"]
Critério de sucesso: [verificável]

Passos:
1. [acção] | Ficheiros: [lista] | Done: [critério]
2. [acção] | Ficheiros: [lista] | Done: [critério]
...

Boundaries:
  Sempre: [lista]
  Perguntar: [situações]
  Nunca tocar: [lista]

Riscos: [lista com mitigações]
Incerteza: [áreas com baixa confiança]
```

**Aprovação:** "ok" / "avança" / silêncio → executar. Feedback negativo → ajustar primeiro.

---

## Durante Execução

- Completar cada passo antes do seguinte
- Notificar ao completar: `✓ Passo 1 — [o que foi feito] — [critério verificado]`
- Algo inesperado que invalida uma assumption → **parar, reportar, pedir confirmação antes de adaptar**
- Em tarefas com > 5 passos: **checkpoint de re-planeamento** a meio (após ~50% dos passos) para ajustar se necessário

---

## Distinção com /plan

| | `plan` skill | `/plan` comando |
|---|---|---|
| Activação | Auto — detecção de complexidade | Manual — utilizador invoca |
| Aprovação | Implícita (ok / silêncio) | Explícita obrigatória (ExitPlanMode) |
| Persistência | Inline na conversa | Ficheiro `.cursor/plans/` ou equivalente |
| Uso | Desenvolvimento normal, features, refactors | Arquitectura crítica, produção, irreversível |

Operações em produção / dados / infraestrutura → preferir `/plan`.
