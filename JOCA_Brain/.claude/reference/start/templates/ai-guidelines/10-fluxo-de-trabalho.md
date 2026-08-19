# Fluxo de trabalho

## Antes de escrever código

Todo o trabalho começa num issue do GitHub com critérios de aceitação
verificáveis. Se não existir, criar com `/novo-issue`.

Se o trabalho envolver interface que ainda não existe, o mockup vem primeiro:
`/preparar-design`, e o mockup passa por `/validar-design` antes de
se implementar.

## Branch

Uma branch por issue, criada a partir da `main` atualizada:

```bash
git status                              # tem de estar limpa
git checkout main && git pull
git checkout -b <tipo>/<nº>-<descricao>
```

Tipos: `feat`, `fix`, `chore`.

## Durante

- Um issue de cada vez. Máximo duas branches em curso.
- Issues que tocam nos mesmos ficheiros são sequenciados, nunca paralelos.
- Decisão estruturante tomada → entrada no `docs/DECISIONS.md`, no mesmo PR.

## Testes

Escritos em **sessão separada** da implementação, com `/escrever-testes <nº>`,
a partir dos critérios de aceitação do issue — nunca a partir do código.

Testes escritos logo a seguir ao código verificam o código, não o requisito:
passam sempre e não provam nada.

## Fechar

```bash
git push -u origin <branch>
```

PR com `Closes #<nº>` na descrição. Merge exige CI verde e uma aprovação.

Depois do merge:

```bash
git checkout main && git pull && git branch -d <branch>
```
