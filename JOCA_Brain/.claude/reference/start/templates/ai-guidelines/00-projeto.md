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
