---
name: plan
description: "Planeamento estruturado em 7 fases (OODA, assumption surfacing, pre-mortem) antes de execução, e registo de decisões técnicas (formato ADR em docs/DECISIONS.md). Invoke on: planeia, planear, planning, arquitectura de, migra, reestrutura, ADR, regista esta decisão, porque escolhemos, tarefa multi-ficheiro/irreversível."
triggers: planear, planning, planeia o projecto, project planning, como comecar, how to start, antes de comecar, before coding, ADR, architecture decision, decisao arquitectural, regista esta decisao, porque escolhemos, why did we choose, record this decision, alternatives considered, planeia, arquitectura de, como fariamos, migra, reestrutura, refactora tudo, integra com
chain: design-review, frontend, laravel-specialist
metadata:
  type: skill
  category: base
---

# Skill: plan

## Quando auto-activar

Activar **antes de execução** quando a tarefa tiver >= 2 sinais — ou **imediatamente** com sinal ★:

| Sinal | Prioridade |
|-------|-----------|
| Operação irreversível: migration, delete dados, deploy, reset ★ | Máxima — sozinha activa |
| >= 3 ficheiros ou módulos envolvidos | Alta |
| Passos com dependências (falhar A → B falha) | Alta |
| Decisão de arquitectura com tradeoffs reais | Alta |
| Pedido com múltiplos sistemas ou stakeholders | Alta |
| Feature nova sem precedente no codebase | Média |
| Pedido ambíguo ou mais curto que a complexidade implicada | Média |
| Scope estimado > 5 passos atómicos ou > 20 min | Média |

**Sinais verbais:** "planeia", "arquitectura de", "como faríamos", "implementa X e Y e Z", "migra", "reestrutura", "refactora tudo", "integra com".

---

## Protocolo — 7 Fases Sequenciais

### Fase 0: Orient (OODA)

*Interno — não mostrar ao utilizador.*

Interpretar o pedido antes de planear:
- Qual é o problema real (não o pedido literal)?
- Que contexto do codebase é relevante mas não mencionado?
- Que informação implícita é relevante para sucesso?
- Se 2 formas radicalmente diferentes satisfazem o pedido → ambíguo → Fase 1.
- **Localizar a fonte** — pedido de «estender/evoluir/migrar X» começa por provar que X é **acessível e versionado**, antes de qualquer fase seguinte:
  ```bash
  find <pastas de projectos> -maxdepth 3 -iname "*<nome>*" 2>/dev/null
  git -C <dir> rev-parse --show-toplevel          # erro = sem git
  grep -n "<nome>" <script de backup/sync>        # se houver — tem cópia fora desta máquina?
  ```
  Código que só vive no servidor é **risco declarado no plano** (Fase 5), não nota de rodapé. Caso real: duas rondas de plano a «estender» um painel web que não tinha repositório local nem cópia de backup — só a VPS (2026-09-05).
- **Quem é o dono da definição?** — trabalho que toca um formulário, questionário ou fluxo cuja definição pode pertencer a outra pessoa ou a outro sistema (CRM, ERP, headless, backoffice de terceiro) → **a pergunta faz-se à cabeça, não a meio**, num só `AskUserQuestion`: onde se cria a estrutura (os campos), onde se edita o texto, onde vive a lógica (pontos, regras, validações), para onde vão os dados. Caso real: «formulário ligado ao CRM» mudou de modelo 4 vezes na mesma sessão e dois fan-outs de 4 agentes foram parados a meio — a pergunta do dono só apareceu à 3.ª volta (projecto de cliente, 2026-09-18).

---

### Fase 1: Ambiguidade Check

*Só se detectada ambiguidade na Fase 0.*

Fazer **2-3 perguntas específicas**. Foco em:
- Edge cases: "o que deve acontecer quando X?"
- Navegação: "qual é o módulo responsável por Y?"
- Abordagem: "preferes A ou B dado o tradeoff [...]?"

Limite: **3 ciclos de clarificação**. Depois avançar com assumptions explícitas.

---

### Fase 2: Assumptions Explícitas

**Bloqueante** — utilizador confirma antes de ver o plano.

```
Assumptions a validar:

[ ] Assumption: [o que estou a assumir]
    Impacto se errada: [o que muda no plano]
    Como verificar: [como confirmar — agora ou durante execução]

[ ] Assumption: [...]
    Impacto se errada: [...]
    Como verificar: [...]
```

Aguardar confirmação. Assumption errada → corrigir antes de avançar.

---

### Fase 3: Abordagens e Tradeoffs

*Só para decisões de arquitectura com múltiplas opções válidas.*

Apresentar 2-3 abordagens com tradeoffs:

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

Decisão tomada com tradeoff real → propor a entrada em `docs/DECISIONS.md`: formato, numeração e revogação em `.claude/reference/adr-formato.md`.

---

### Fase 4: Plano Verificável

Cada passo no formato PAUL — sem verificação = passo incompleto:

```
Plano: [nome da tarefa]
Critério de sucesso: [verificável, não vago]

[ ] 1. [Acção]
       Ficheiros: [lista explícita]
       Verificar: [como confirmar]
       Done quando: [critério observável]

[ ] 2. [Acção]
       Ficheiros: [lista explícita]
       Verificar: [como confirmar]
       Done quando: [critério observável]
```

**Boundaries:**
- Sempre: [o que será feito]
- Perguntar primeiro se: [situações que requerem confirmação]
- Nunca tocar: [ficheiros/áreas fora de scope]

Tarefas atómicas completáveis em <= 15 min. Acima disso, subdividir.

---

### Fase 5: Pre-Mortem Mínimo

Duas perspectivas internas — resultado adicionado ao plano:

**Sabotador:** "Este plano falhou. O que correu mal?"
→ Failure mode mais provável + mitigação.

**Outsider:** "O que assume este plano que alguém sem contexto veria?"
→ Assumption mais perigosa não listada na Fase 2.

```
Riscos identificados:
- [risco 1] → Mitigação: [acção]
- [risco 2] → Mitigação: [acção]
```

---

### Fase 6: Calibração de Confiança

No fim do plano, antes de apresentar:

```
Incerteza máxima:
- [área 1]: [porquê baixa confiança] — reduziria com [X]
- [área 2]: [porquê baixa confiança] — reduziria com [Y]
```

Sinaliza onde o plano é mais frágil sem bloquear execução.

---

## Apresentação ao Utilizador

Formato compacto — artefacto verificável, não documento:

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

**Aprovação:** "ok" / "avança" / silêncio → executar. Feedback negativo → ajustar.

---

## Durante Execução

- Completar cada passo antes do seguinte
- Notificar: `✓ Passo 1 — [feito] — [critério verificado]`
- Assumption invalidada → **parar, reportar, pedir confirmação antes de adaptar**
- Tarefas > 5 passos: **checkpoint de re-planeamento** a ~50% dos passos

---

## Outros documentos de planeamento

Este plano é por sessão. Para outro artefacto, a skill certa:

| Pedido | Skill / referência |
|---|---|
| O QUE construir (requisitos) | `prd` → `prd-reviewer` |
| COMO construir (data model, API, fluxos) · proposta de mudança grande | `tech-spec` |
| Diagrama de arquitectura | `c4-diagram` |
| Partir em trabalho + ordem + estimativas | `novo-issue` (1 issue por passo) → `planear-ondas` |
| Registar uma decisão | `.claude/reference/adr-formato.md` |
| Rever os documentos em HTML | `html-review` |

Pedido genérico («planeia este projecto») sem artefacto claro → perguntar qual destes; projecto novo → `/start`.

---

## Distinção com /plan

| | `plan` skill | `/plan` comando |
|---|---|---|
| Activação | Auto — detecção de complexidade | Manual — utilizador invoca |
| Aprovação | Implícita (ok / silêncio) | Explícita obrigatória (ExitPlanMode) |
| Persistência | Inline na conversa | Ficheiro `.cursor/plans/` ou equivalente |
| Uso | Dev normal, features, refactors | Arquitectura crítica, produção, irreversível |

Operações em produção / dados / infraestrutura → preferir `/plan`.
