# /review-code — Code Review

Determina o alvo do review:
- Ficheiro(s) especificado(s) pelo utilizador
- Selecção IDE se existir
- Directório actual se nada especificado — confirmar antes de prosseguir

Invoca agente `tester-code` com o alvo determinado.

Após o review, perguntar:
> "Quer review adversarial adicional com Codex (OpenAI)? Nota: código sai da máquina para API OpenAI."

- Se sim: invocar agente `codex-review` e destacar onde diverge do tester-code
- Se não: apresentar só o relatório do tester-code
