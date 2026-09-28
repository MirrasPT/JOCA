# Regras de review por tipo de ficheiro (on-demand)

Lido pelo `tester-code` no início da review. Cada ficheiro do diff escolhe as regras **pelo nome**
(1.ª linha da tabela que casa). Sem linha → só a checklist geral do agente.
Regras PHP e `composer.json` reescritas a partir de alibaba/open-code-review (Apache-2.0,
`internal/config/rules/rule_docs/`), com alterações e cortes.

| Glob | Regras |
|---|---|
| `**/*.php`, `**/*.phtml`, `**/*.blade.php` | §PHP abaixo + `skills/laravel-specialist.md` se for Laravel |
| `**/composer.json`, `**/composer.lock` | §composer abaixo |
| `**/package.json`, lockfile npm/pnpm/yarn | §package abaixo |
| `**/*.{ts,tsx,js,jsx,mjs,cjs}` | `skills/react-patterns.md` + `skills/frontend.md` (UI) |
| `.github/workflows/**/*.{yml,yaml}` | `skills/github.md` §Security |
| `**/*.{test,spec}.*`, `tests/**` | rever primeiro (passo 0 do agente) |

**Meta-regras (todos os tipos):** precisão antes de recall — só defeitos prováveis no código alterado.
Não repetir o que PHPStan, Pint, ESLint, `tsc` ou o compilador já apanham, salvo consequência concreta
que a ferramenta não mostra. Antes de afirmar algo fora do diff, ler quem chama e de onde vem o dado.
N+1 e performance só com prova de escala ou caminho quente.

## PHP

**Tipos e igualdade**
- `==`/`!=` onde a coerção iguala valores diferentes com peso de segurança ou de domínio → `===`.
- `empty()` ou truthiness a juntar `0`, `"0"`, `false`, `null` e vazio quando são estados diferentes.
- `isset()` quando o contrato é a **presença** da chave (chave com `null` ≠ chave ausente) → `array_key_exists()`.
- API que devolve `false`/`null` em falha e o valor segue para código que assume objecto ou escalar.

**Arrays e iteração**
- Chave lida sem tratar o caso ausente (request, JSON descodificado, linha de BD, config opcional).
- `foreach ($a as &$v)` sem `unset($v)` depois → `$v` fica ligado ao último elemento.
- `+`, `array_merge` ou spread com semântica de sobreposição/ordem diferente da pretendida.

**Erros e excepções**
- `Throwable`/`Exception` apanhado e descartado, convertido em sucesso ou num default enganador.
- `catch` largo à volta de operações sem relação: não distingue a falha esperada de um bug.
- Limpeza/rollback que esconde a excepção original ou devolve sucesso depois da falha.
- `@` a suprimir um erro que deixa estado inválido.

**Recursos e transacções**
- Transacção com `return` antecipado ou excepção que a deixa aberta; efeitos laterais que o rollback não repõe.
- Escrita em vários passos que tem de ser atómica e não está numa transacção.
- cURL/stream/HTTP sem timeout num pedido ou worker.
- Lock de sessão mantido durante trabalho lento.

**BD e segurança**
- SQL montado com valores não confiáveis. Nomes de coluna/ordenação não fazem bind → allowlist.
- `unserialize()` em dados do utilizador; segredos comparados sem `hash_equals`; tokens sem `random_bytes`;
  hashing de password à mão em vez de `password_hash`/`password_verify`.
- Mass assignment só quando o `$fillable`/`$guarded` não trava os campos vindos do request.
- `eval`, `include` dinâmico ou shell com input não confiável sem allowlist.
- Segredos, tokens ou dados pessoais em logs, mensagens de erro ou código.

## composer

- Plugin novo sem decisão explícita em `config.allow-plugins`, ou autorização larga.
- `secure-http` desligado, repositório em HTTP, credenciais no manifesto.
- Pacote ou extensão `ext-*` usada no código e ausente de `require` → instalação de produção falha.
- Classe de produção só em `autoload-dev`; o mesmo pacote em `require` e `require-dev`.
- `minimum-stability` baixado sem `prefer-stable`.
- `composer.json` mudou e o `composer.lock` não (ou o inverso) → rever o diff do lock.

## package

- Dependência nova com `latest` ou `*`.
- O mesmo pacote em `dependencies` e `devDependencies`.
- Ferramenta usada em `scripts` (eslint, jest, prettier…) sem estar em `devDependencies`.
- `package.json` mudou e o lockfile não → rever o diff do lockfile, não só o manifesto.
