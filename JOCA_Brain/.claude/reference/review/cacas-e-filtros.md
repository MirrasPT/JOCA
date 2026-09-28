# Caças da review e filtro de achados (on-demand)

Lido pelo `tester-code` (passos de caça e passe final). Listas adaptadas de affaan-m/ECC
`agents/silent-failure-hunter.md` (MIT) e addyosmani/agent-skills `constraint-driven-development` §Floor (MIT);
filtro assimétrico com a ideia de alibaba/open-code-review `review_filter_task_system.md` (Apache-2.0, reescrito).

## Falhas silenciosas

Cada caso: local · severidade · impacto · correcção.
- `catch {}` vazio, ou `catch` que só regista e continua como se nada fosse.
- Erro convertido em `null`, `[]`, `false` ou `0` sem contexto — `.catch(() => [])`, `?? []` sobre uma falha.
- Default ou fallback que esconde a falha e empurra o diagnóstico para jusante.
- Recurso a dados falsos fora de testes: mock, fixture, placeholder ou "dados de exemplo" quando a fonte real falha.
- `?.` que salta uma operação que devia falhar alto.
- Stack trace perdido; `throw new Error('erro')` genérico em vez de propagar a causa.
- Promessa sem `await` nem `.catch`; retry que esgota sem avisar ninguém.
- Rede, ficheiro ou BD sem timeout; trabalho transaccional sem rollback.
- Log sem contexto (sem id, sem entrada) ou com severidade errada.

## Fasquia a baixar

Tudo isto no diff é achado (**Important** no mínimo), mesmo que o resto esteja certo. Só passa com razão escrita no commit ou no código.
- Supressões novas: `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `@phpstan-ignore`, `# noqa`, `# type: ignore`.
- Testes saltados ou apagados: `.skip`, `xit`, `markTestSkipped`, ficheiro de teste removido.
- Asserts removidos ou enfraquecidos (`toEqual` → `toBeDefined`, `assertSame` → `assertNotNull`).
- Stubs: `throw new Error("Not implemented")`, `TODO` no lugar do código, `return true` provisório.
- Config de qualidade alterada: `eslint.config.*`, `.eslintrc*`, `tsconfig` (`strict`, `noImplicitAny`),
  `phpstan.neon*` (nível, `ignoreErrors`, `baseline`), `pint.json`, `.prettierrc*`, limiares de cobertura.
- Hooks contornados: `--no-verify`, `core.hooksPath`, `|| true` ou `continue-on-error` a esconder um passo que falha.

## Comentário que afirma

Comentário que afirma um mecanismo («isto impede X», «garante Y», «nunca é null») cruza-se com o código.
O código não o faz → achado Important (o comentário mente e sobrevive a revisões). Também: comentário
desactualizado face à assinatura, `TODO` já resolvido, caso-limite descrito que o código não trata.

## Não-achados (lista fechada)

Não entram no relatório:
1. Problema **pré-existente** em linhas que o diff não tocou (excepção: código novo que leva dados a um sink antigo).
2. O que o linter, formatter, `tsc`, PHPStan ou o compilador já apanham.
3. Preferência de estilo sem regra escrita no projecto (`CLAUDE.md`, config de lint, skill da stack).
4. Linha silenciada de propósito com razão escrita ao lado.
5. «Qualidade geral» ou «podia ser mais limpo» sem defeito concreto.
6. Violação de `CLAUDE.md` sem citar a regra, ou de um `CLAUDE.md` que não cobre o caminho do ficheiro.

## Passe final (verificador)

Corre noutro agente, com o diff e a lista de achados. A tarefa é estreita: tirar **só** o que o diff **prova** errado.
- Manter um achado errado custa segundos ao leitor. Tirar um certo apaga-o sem ninguém saber.
- «Suspeito», «não consigo verificar», «pouco valor», «eu não o levantaria» → **fica**.
- Cada achado sai com um de três estados: `confirmado` · `refutado` (com a linha do diff que o prova) · `não verificável`.
- Só `refutado` sai do relatório. `não verificável` fica, marcado.
