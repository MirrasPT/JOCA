# Contexto do projeto

<!--
Este ficheiro é TEU e vai para o git.

O Laravel Boost inclui automaticamente tudo o que estiver em `.ai/guidelines/`
no CLAUDE.md que gera. Ou seja: escreves aqui, o Boost regenera o CLAUDE.md, e
o teu conteúdo continua lá. Nunca editar o CLAUDE.md à mão.

Manter curto — isto é lido em todas as sessões. Detalhe longo vive em docs/ e
é referenciado, não colado.
-->

## O que é

<uma ou duas frases: que problema resolve, para quem>

Detalhe em `docs/PRODUTO.md`.

## Comandos

<Apagar as linhas da stack que não é a deste projeto.>

**Laravel / Livewire**
- Testes: `./vendor/bin/pest` · um só: `--filter=<nome>`
- Formatação: `./vendor/bin/pint` · Análise: `./vendor/bin/phpstan analyse`
- Dev: `composer run dev`

**Next.js**
- Testes: `npm test` · Lint: `npm run lint` · Tipos: `npx tsc --noEmit`
- Dev: `npm run dev` · Build: `npm run build`

**Flutter**
- Testes: `flutter test` · Análise: `flutter analyze --fatal-infos`
- Formatação: `dart format .` · Dev: `flutter run`

## Ambiente local

Onde é que isto corre na máquina de quem desenvolve. Uma linha por máquina.

| Máquina / SO | Ambiente | BD local | URL de dev |
|---|---|---|---|
| macOS | Laravel Herd | MySQL 8.4 (do Herd) | https://<nome>.test |
| Windows | Laragon | MySQL 8.4 (do Laragon) | https://<nome>.test |

- **O motor de BD local é o mesmo da produção.** Divergência só com entrada em `docs/DECISIONS.md`.
- Versões: PHP `<v>` · Node `<v>`. Sem gestor declarado, é o que o ambiente traz.
- Máquina nova: acrescenta a tua linha, não substituas a de ninguém.
- **Sem paths pessoais nem portas de terceiros aqui** — isso vive na memória do JOCA de cada um.

## Documentos de referência

Ler quando o trabalho os tocar — não estão colados aqui de propósito:

- `docs/PRODUTO.md` — o problema, as fronteiras, os fluxos
- `docs/DESIGN.md` — sistema visual (obrigatório antes de mexer em views)
- `docs/ARCHITECTURE.md` — modelo de dados, módulos, packages
- `docs/DECISIONS.md` — porquê das decisões estruturantes
- `REVIEW.md` — critérios de revisão

## Convenções deste projeto

<Apenas o que se afasta do Laravel padrão. Se seguirem as convenções do
framework, esta secção fica quase vazia — e isso é bom sinal.>

## Nunca fazer

- Alterar migrações já aplicadas em produção — criar uma nova
- Introduzir cores, tamanhos ou raios fora do `docs/DESIGN.md`
- Escrever testes na mesma sessão em que se implementou o código
- Commitar diretamente na `main`
