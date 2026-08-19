# Delta — Laravel 13 + Livewire 4 + Flux UI (+ Filament v5)

Versoes verificadas Agosto 2026: Laravel 13.26.1 · Livewire 4.4.1 · Flux UI 2.17.0 ·
Filament 5.7.6 · Pest 5.1.1.

Esta e a via **por omissao** do `executar-projeto` — a Parte E1 da skill descreve ja esta stack.
Aqui ficam so os extras.

## Filament v5

```bash
composer require filament/filament:"^5.0" -W
php artisan filament:install --panels
php artisan make:filament-user
```

**Criar o utilizador nao e opcional.** Uma BD com 0 users devolve `/admin/login → 200` na mesma — a
porta esta la, falta a chave. Ja houve documentacao a anunciar durante meses um admin que nao
existia. Verificar pelo **efeito**: fazer login a serio, nao so ver o formulario.

Gate de runtime do painel: submeter o login **e** confirmar que `window.Livewire` inicializa.
Renderizar o formulario nao e prova. Pos-deploy, verificar o `content-type` dos assets JS servidos.

## Flux UI

O Flux e **so Blade** — nao renderiza em HTML solto. Os mockups aproximam-no com HTML+Tailwind e
marcam em comentario o componente real (`<!-- flux:button variant=primary -->`). Sem essas marcas,
quem implementa reconstroi a decisao a partir do aspecto.

A versao paga (Flux Pro) tem componentes que a gratuita nao tem — confirmar qual esta licenciada
antes de a listar no `docs/DESIGN.md` como disponivel.

## Armadilhas

- **`--phpunit` no `laravel new`** e obrigatorio mesmo indo usar Pest (senao instala Pest 4 e o
  upgrade entra em conflito).
- **`php -d memory_limit=1G`** se a suite crescer — o Larastan e a suite estouram o default.
- **SQLite em dev, MySQL em producao** e a armadilha mais cara: `VARCHAR`, modo estrito e tipos de
  data so falham no deploy. Correr migrations+seeders contra o motor de producao antes de publicar.
