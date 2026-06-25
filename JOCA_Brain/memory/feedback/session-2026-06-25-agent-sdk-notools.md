---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-25
project: JOCA
---

# Feedback JOCA — sessão 2026-06-25 (cont.5): Agent SDK tem ferramentas por default

**Categoria:** skill-improvement | **Severidade:** medium | **Descrição:** Ao usar o `@anthropic-ai/claude-agent-sdk` (`query()`) como um simples "LLM call" para REESCREVER texto (feature "Optimizar" do JOCA_OS), descobriu-se em runtime que o SDK traz as **ferramentas built-in ligadas por default** (Bash, Read, etc.) mesmo SEM se passar `mcpServers`. Resultado: dar-lhe uma instrução imperativa ("lê os meus emails com o gws e resume") fê-lo **EXECUTAR a tarefa de verdade** (correu o `gws`, devolveu emails reais) em vez de reescrever a instrução. Um system prompt a dizer "não executes" NÃO chega — o modelo usa as ferramentas. | **Componente afectado:** skill `agent-sdk` (e qualquer código que use o Agent SDK para completação de texto pura). | **Fix sugerido:** documentar na skill `agent-sdk`: para uma **completação de texto pura (sem efeitos secundários)**, passar nas `Options` **`tools: []`** (array vazio = desliga TODOS os built-ins; confirmado no `sdk.d.ts`) e, defensivamente, **`maxTurns: 1`**. Sem isto, o agente tem shell/ficheiros e pode agir. Confirmar sempre a opção no `.d.ts` instalado (a doc online não realça isto). Regra geral: Agent SDK ≠ Messages API — o Agent SDK é um AGENTE com ferramentas, não um completador; restringir `tools` quando só se quer texto.
