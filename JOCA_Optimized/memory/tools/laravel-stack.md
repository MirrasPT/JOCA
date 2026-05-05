# Laravel Stack — Filament + Lunar PHP

## Filament PHP

Admin panel + form builder para Laravel. Versão 4.x.

**AI integration:**
- `llms.txt` em `https://filamentphp.com/docs/llms.txt` — índice completo da documentação
- **Laravel Boost** — gera `CLAUDE.md` e `AGENTS.md` no projecto com convenções Filament:
  ```bash
  composer require laravel/boost --dev
  php artisan boost:install
  ```
  Correr em cada projecto Laravel+Filament novo. Claude passa a escrever código idiomático Filament.
- **Filament Blueprint** (premium) — planning agent com specs estruturadas (modelos, resources, forms, tables, authorization)

## Lunar PHP

E-commerce headless para Laravel. Versão 1.x.

**AI integration:**
- MCP server: `https://docs.lunarphp.com/mcp` (já no `.mcp.json` do JOCA como `lunar-docs`)
- `llms.txt`: `https://docs.lunarphp.com/llms.txt`
- `llms-full.txt`: `https://docs.lunarphp.com/llms-full.txt` — documentação completa num ficheiro
- Qualquer página da doc: adicionar `.md` ao URL para versão markdown token-efficient

## Stack típica

```
Laravel 11+
├── Filament 4.x     — admin panel, forms, tables
├── Lunar PHP 1.x    — e-commerce (produtos, pedidos, checkout)
├── PostgreSQL       — base de dados principal
└── Livewire         — reactivity no frontend
```

## Workflow para projectos novos

1. `composer create-project laravel/laravel`
2. `composer require filament/filament`
3. `composer require lunarphp/lunar`
4. `composer require laravel/boost --dev && php artisan boost:install`
5. Correr `/init-project` do JOCA
