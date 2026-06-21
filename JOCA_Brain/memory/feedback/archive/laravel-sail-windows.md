---
name: laravel-sail-windows
description: Scaffold e correr Laravel/Sail no Windows sem PHP no host — usar Docker compose directamente, não o script sail
metadata:
  type: feedback
---

Scaffold de Laravel + Filament em Windows quando **não há PHP/composer no host** (só Docker): usar a imagem `composer` em Docker para `create-project`/`require`, e correr o app via `docker compose` — **não** via `./vendor/bin/sail` (é bash, não corre em PowerShell nativo).

**Why:** O Sail assume WSL2/Linux/macOS. Em PowerShell nativo o wrapper `sail` falha. O Sail só publica o `compose.yaml`; tudo o resto é `docker compose`.

**How to apply:**
1. Pasta com ficheiros pré-existentes (CLAUDE.md/PRD.md) → scaffold para subpasta e `Move-Item -Force` para a raiz (`create-project` exige dir vazio).
2. Imagem `composer` mínima **não tem `intl`** → Filament v4/v5 falha no require. Instalar Filament **dentro do container Sail** (PHP completo), não na imagem composer.
3. Sempre `$env:WWWUSER=1000; $env:WWWGROUP=1000` antes de `docker compose up -d` (senão warnings + perms erradas).
4. **PHP 8.5 + Sail:** `storage/` e `bootstrap/cache/` ficam owned by root → web (user `sail`) não escreve → 500 `tempnam(): file created in the system's temporary directory`. Fix: `docker compose exec -u root laravel.test chown -R sail:sail storage bootstrap/cache`. Repetir após cada rebuild da imagem.
5. Pôr `APP_PORT=8080` no `.env` para evitar conflito com porta 80 no Windows.

Cross-CLI: comandos artisan/composer → `docker compose exec laravel.test php artisan <cmd>` / `... composer <cmd>`.
Ver [[bigorna-2026]].
