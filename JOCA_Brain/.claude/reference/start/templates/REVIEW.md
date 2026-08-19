# Critérios de revisão

O que se procura ao rever código neste projeto.

Lido pelo subagente `revisor` (`.claude/agents/revisor.md`), que o carrega
explicitamente. Se um dia tiverem Claude Code Review — research preview, só em
subscrições Team ou Enterprise — este ficheiro também é lido por ele. O comando
local `/code-review` **não** o lê.

Manter curto: cada linha é lida em todas as revisões.

## Prioridades, por esta ordem

1. **Cumprimento do requisito** — o código faz o que o issue pede, e nada que
   estivesse declarado fora de âmbito?
2. **Correção** — casos limite: vazio, nulo, zero, negativo, muito grande,
   concorrente. Condições de erro sem tratamento.
3. **Segurança** — input não validado, segredos no código, injeção,
   autorização em falta em operações sensíveis.
4. **Convenções** — as que estão escritas em `.ai/guidelines/`,
   `.claude/rules/` e nos documentos de `docs/`. O `CLAUDE.md` também serve
   para ler (é onde o Boost junta tudo) — o que não se faz é **editá-lo**,
   porque é regenerado.
5. **Interface** — quando o diff toca em views: cumpre o `docs/DESIGN.md`?
   Usa os componentes existentes? Tem estado vazio e de erro?
6. **Qualidade dos testes** — derivam dos critérios de aceitação do issue, ou
   apenas confirmam o que o código já faz? Um teste que passaria com qualquer
   implementação não é um teste.

## Específico de Laravel

- **N+1 queries** — relações carregadas em ciclos sem `with()`
- **Mass assignment** — `$fillable`/`$guarded` coerentes com o que o request aceita
- **Autorização** — policies ou gates nas ações que tocam dados de outro utilizador
- **Validação** — form requests, não validação manual espalhada pelo controlador
- **Migrações** — reversíveis; nunca alterar uma migração já aplicada em produção
- **Trabalho pesado em request** que devia ser job em fila

## Não comentar

- Formatação e estilo — é trabalho do Pint
- Preferências pessoais sem justificação técnica
- Reescritas de código que está correto

## Formato

Para cada problema: ficheiro e linha, o que está errado, a consequência
concreta, e uma sugestão.

Classificar como **bloqueia** · **devia corrigir** · **nota**.

Se não houver nada que bloqueie, dizê-lo claramente. Uma revisão que encontra
sempre alguma coisa deixa de ser levada a sério.
