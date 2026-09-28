# /review-code — Code Review

Determina o alvo do review:
- Ficheiro(s) especificado(s) pelo utilizador
- Selecção IDE se existir
- Directório actual se nada especificado — confirmar antes de prosseguir

Invoca agente `tester-code` com o alvo determinado. O relatório tem de trazer a cobertura (ficheiros revistos/saltados) e aplicar as regras por tipo de `.claude/reference/review/`.

**Confirmação antes do relatório:** despacha um **segundo** `tester-code` (outra instância, não o mesmo) com o diff e os achados, em modo passe final. Só saem os achados `refutado` com prova no diff; `não verificável` fica marcado. Quem produziu não assina (`rules/chaining.md` §Verificação).

Após o review, perguntar:
> "Quer review adversarial adicional com Codex (OpenAI)? Nota: código sai da máquina para API OpenAI."

- Se sim: invocar agente `codex-review` e destacar onde diverge do tester-code
- Se não: apresentar só o relatório do tester-code
