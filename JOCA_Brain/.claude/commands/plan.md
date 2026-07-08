# /plan — Planeamento e Arquitectura

Entrar em Plan Mode.

`Read(".claude/skills/plan.md")` — metodologia de planeamento (interrogar + OODA), a mesma que o `/autoplan` usa.

Analisar contexto:
- Ficheiros relevantes do projecto
- Stack detectada
- Objectivo declarado pelo utilizador

Produzir plano com:
- Abordagem proposta e alternativas consideradas
- Tradeoffs de cada opção
- Passos concretos e verificáveis
- Ficheiros que serão tocados

Não sair do Plan Mode sem aprovação explícita do utilizador.

## Próximo passo (chain)
- Plano aprovado → skill/agente do domínio para implementar (via Trigger Map do `CLAUDE.md`). Notificar `[chain → <x>]`. Ver `rules/chaining.md`.
