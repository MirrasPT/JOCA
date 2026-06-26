---
name: livro-de-elogios
description: Livro de Elogios — Nova Plataforma 2026. SaaS multi-tenant multi-país para empresas gerirem elogios de clientes; substitui plataforma em produção (27.000+ empresas).
type: project
directorio: D:\Mega\Livro_De_Elogios\2026_Nova_Plataforma
---

**Stack:** Laravel 13.14 + **PHP ≥8.4** (o `dev` exige 8.4; vendor compilado p/ 8.4) + Filament v5 (backend/admin) · React 19 + Vite 8 + Tailwind 4 + TypeScript (frontend) · MySQL (SQLite local) · Sanctum stateful SPA + Socialite (Google/Facebook) · Ifthenpay (MB/MBWay) + Stripe · Moloni (faturação) · Spatie Media Library · Sentry · Pest.
**Objectivo:** Reconstruir de raiz a plataforma de elogios. Multi-país com **isolamento completo por país** (gateway, produtos, encomendas, portes, CMS isolados; detecção por IP+sessão+perfil; tabela `countries` = fonte de verdade). PT e BR base, arquitectura para N países.
**Directório:** `D:\Mega\Livro_De_Elogios\2026_Nova_Plataforma`
**Idioma:** PT-PT sempre, nunca BR. Copy direto e humanista (foco nas pessoas).
**Why:** Plataforma antiga (27k+ empresas) em produção; esta é a substituição de raiz.
**How to apply:** Projecto full-stack. Skill-first: `frontend` (director → `react-patterns`/`react-composition`/`tailwind`/`shadcn`), `laravel-specialist`, `filament`/`filament-builder`, `laravel-react`, `auth`, `payment-integration`+`portugal-payments` (ifthenpay), `portugal-invoicing` (Moloni), `webhooks`, `saas-patterns`, `search`, `file-storage`, `rest-api`. Design (Renato é designer): `design-system`/`design-tokens`/`design-review`/`brand-guidelines`. Plugin local `design-craft@renato-local` (`/design-craft`) instalado scope project. Backend/DevOps → explicar decisão 1 linha antes de implementar.

## Regras de marca (CRÍTICAS)
- **1 só laranja** `#FD5000` (hover `#E54300`). Fonte única **Poppins**. Botões `border-radius: 9999px`, weight 600.
- **Fundos pretos PROIBIDOS** — nunca `#000/#0D0D0D/#111` como background de secção/card. `--color-dark` só p/ texto/botão Dark.
- SEM emojis em UI. SEM estrelas/rating de texto (usar SVG vetorizado quando necessário). Iconografia: Font Awesome + lucide-react no backoffice.
- Tokens completos em `CLAUDE.md` (cores, radius, shadows). Moeda backoffice: `€{n.toFixed(2).replace('.',',')}`.

## ⚠ Fontes de estado divergentes (ler na ordem certa)
- `docs/estado.md` — **DESACTUALIZADO** (sessão 12, 2026-05-25). Não confiar.
- `README.md` + `CLAUDE.md` = stack/fases reais.
- Specs: `spec-encomendas-institucionais.md` (raiz, novo, módulo institucional Pedro), `docs/email-automations-strategy.md`, `docs/marketplace-integration-spec.md`, `docs/widget-api-spec.md`, `docs/diretivas-revendedores.md`.
- **ATENÇÃO:** `docs/backoffice-cliente-ESTADO.md`, `docs/backoffice-cliente-CONTRATO.md`, `docs/goal-auth-checkout.md` — referenciados na memória anterior mas **NÃO EXISTEM** no repo local (eram ficheiros do Mac não committados).

## Estado git + ambiente local (2026-06-26, sessão 2)
- **Branch `dev`** a track `setuptechpt/livro-de-elogios-v3` (o repo REAL). O antigo `origin` `MirrasPT/livro_redesign` é repo de protótipos SEPARADO (histórias NÃO-relacionadas). Branch `backup/local-pre-dev` guarda o working tree pré-switch. Backend = Pedro (`pedro-dev`→PRs); frontend/admin-design = Renato.
- **TODO o redesign do admin desta sessão está POR COMMITAR no `dev`.**
- **Login admin:** `admin@livrodeelogios.com` / `password` (seeded; trocar em produção). 35 users de teste, todos password `password`.

### Ambiente dev local (Windows) — montado nesta sessão
- **PHP 8.4.22 portátil** em `C:\Users\renat\php84` (XAMPP é 8.2; `dev` exige ≥8.4). `php.ini` lá: **opcache ON + JIT OFF** (JIT segfalha no Windows, exit 5); extensões curl/exif/gd/gmp/intl/mbstring/openssl/pdo_sqlite/sockets/sodium/sqlite3/zip. `composer.phar` em `C:\Users\renat\php84`.
- **Arranque:** backend `& C:\Users\renat\php84\php.exe artisan serve --host=127.0.0.1 --port=8000`; frontend `npm run dev` em `frontend/` (Vite :5173). Aceder via **`localhost`** (não 127.0.0.1 — `SESSION_DOMAIN=localhost`).
- **DB:** SQLite `backend/database/database.sqlite` (35 users), 6 migrações novas do dev aplicadas. `.env` na raiz = cópia do `.env.example` do dev (sqlite default, Sanctum stateful :5173, mail=log). Serviços externos desligados em local.
- ⚠ **Octane/FrankenPHP IMPOSSÍVEL no Windows nativo** (exige `pcntl`/`posix` POSIX; FrankenPHP só Linux/Mac). Velocidade Octane = WSL2/Docker. Em Windows: `artisan serve` + opcache (~0.2s/req warm) é o tecto; é single-thread → pedidos Livewire serializam.
- ⚠ **`composer install` no Windows falha symlinks** (precisa Developer Mode) → vendor pode ficar inconsistente → **opcache corrompe a tabela de funções** (`mb_convert_encoding`→`intltz_create_default`). Fix: `rm -rf vendor && composer install --no-scripts --ignore-platform-req=ext-pcntl --ignore-platform-req=ext-posix`, depois `php -d opcache.enable_cli=0 artisan package:discover`.
- Mobile: Flutter app em `mobile/` + `APP-MOVEL.md`.

## Admin Filament — design system DARK (2026-06-26)
**Decisão Renato: admin é DARK-MODE-ONLY** (`->darkMode(true, isForced: true)`) — **excepção** à regra "fundos pretos proibidos" (essa vale só p/ site/marketing). NÃO reverter para light.
- Tema = `backend/resources/css/filament/admin/theme.css` (fonte da verdade do design do admin; tokens `--st-*`). Charcoal quente (oklch hue ~55, nunca preto puro), 1 acento `--st-accent` (#FD5000 / #FF6A2B dark), Poppins (peso 900 carregado), radius 12 / pill, divisor laranja 44×3px no page header.
- Stats dashboard: número laranja peso 900 + label uppercase + sparkline 1-cor (`->color('primary')`) + descrição humanista (NUNCA "-100%"/trending icons). Contador animado: render hook `view('filament.stats-counter')`.
- Cores semânticas SÓ p/ estado: success #1A9A5C, info #1C64F2, error #c0392b, warning #d99a2b, muted #595959. Taxonomia/categoria = badge neutro.
- `fi-section-not-contained` = transparente (sem box-in-box). Item activo sidebar = fundo laranja-soft (sem side-stripe). Login custom dark (`app/Filament/Auth/Login.php` + `resources/views/filament/auth/login.blade.php`) espelha o AuthLayout do site.
- Auditoria anti-slop completa (workflow 6 agentes + 4 implementadores): emojis/em-dash/paletas multi-cor/roxo removidos; página API Docs (`resources/views/filament/pages/api-docs.blade.php`) reescrita dark. 3 dashboards: Elogios/Financeiro/Operacional consistentes.

## Roadmap / fases
- Fase 0 Design (protótipos HTML + design system) ✅
- Fase 1 Setup backend (Laravel, auth, migrações, 12 domínios) ✅
- Fase 2 Website público (React 19/Vite 8, 20 páginas committadas) ✅
- Fase 3 Backoffice utilizador — **RECUPERADO** (restaurado da `backup/local-pre-dev`, tsc verde, por testar/commitar)
- Fase 4 Admin + badges + rankings + afiliados + revendedores + multi-país — por iniciar
- Pedro (paralelo): módulo encomendas institucionais em curso (spec-encomendas-institucionais.md)

## Última sessão (2026-06-26, sessão 3)
Backoffice de cliente recuperado da branch `backup/local-pre-dev` (não estava perdido — estava numa branch de backup criada antes do switch para `setuptechpt/dev`). Restaurados via `git checkout backup/local-pre-dev -- ...`: 14 páginas `/app/*`, componentes `app/`, api `backoffice/`, mocks, types, BackofficeContext. App.tsx actualizado: `/dashboard` → redirect `/app`, `/app/*` → `Backoffice`. `tsc -b --noEmit` = 0 erros. Utilizador vai registar conta de teste para validar.

## Pendentes Renato (2026-06-26)
1. **Backoffice de cliente** — restaurado, `tsc` verde. Próximo: registar conta de teste → Ciclo 1 (review visual por página) → Ciclo 2 (brand/a11y/responsivo) → Ciclo 3 (smoke browser). Commitar após Ciclo 3.
2. **Auth + checkout** — infra existe mas não ligada: `Nav.tsx` tem link `/login` hardcoded (não usa `useAuth`); cart só localStorage (sem sync backend); `Carrinho.tsx` sem submissão real. 5 tarefas: Nav→useAuth+dropdown · cart sync · checkout 3-step (resumo→morada→pagamento MB/MBWay via `api/orders.ts`) · proteger rotas checkout · listar encomendas. Constraint: Sanctum **stateful** (cookies, `withCredentials:true`).
3. **Decisões de produto bloqueadas** — ver secção abaixo.
4. **Admin redesign POR COMMITAR** no `dev` (theme.css + widgets + provider + login + páginas + api-docs blade + `public/images/logo*.svg`). Commitar quando Renato validar.
5. **1 decisão de design pendente:** glifo `—` como marcador de célula vazia (~86 sítios) — normalizar p/ `·`/vazio via helper OU documentar excepção no DESIGN.md. (P3)
6. **Próximo no redesign (se Renato quiser):** páginas de tabela/listagem + formulários (mesmo registo dark/anti-slop); empty-state caloroso nos charts vazios.

## Filament v5 — gotchas validados (ver CLAUDE.md secção completa)
- Namespaces: `Section`/`Fieldset`/`Schema` → `Filament\Schemas\*` (NÃO `Filament\Forms\*`). `EditAction`/`DeleteAction` → `Filament\Actions\*` (NÃO `Filament\Tables\Actions\*`). Form/Table components mantêm namespaces antigos.
- Table API v5: `->recordActions()` / `->toolbarActions()` (não `->actions()`/`->bulkActions()`).
- Multi-tenant scoping (country_admin): `Select::make('country_id')` precisa SEMPRE de `->default(auth country)` + `->disabled(isCountryAdmin)` + `->dehydrated()` — só `getEloquentQuery` scope NÃO previne IDOR no POST.
- Multi-dashboard Pages: cada um precisa de `$slug` E `getRoutePath()` senão colidem em `/admin`.
- Notification em transaction: envolver em `DB::afterCommit()`.
- `ExternalPartner` usa `protected $table = 'marketplaces'` (rename só conceptual; FKs `marketplace_id`).
- **TableWidget heading:** `getHeading()` é **IGNORADO** num `TableWidget` v5 → o heading visível auto-deriva do nome da classe (em INGLÊS, ex.: `LowStockWidget`→"Low Stock"). Definir `->heading('...')` no `Table` dentro de `table()`.
- **`DATE_FORMAT` é MySQL-only** — parte em SQLite (dev local). Usar `config('database.default')==='sqlite' ? "strftime('%Y-%m', col)" : "DATE_FORMAT(col,'%Y-%m')"` (padrão já no codebase). `DATE()` é portável.
- **StatsOverviewWidget:** `->color()` pinta a sparkline/ícone; p/ 1-cor-laranja pôr tudo `'primary'`. Botão primário do login renderiza `fi-bg-color-400` pálido → forçar `var(--st-accent)` no `.le-login-card .fi-btn`.

## Config
- **`.env` ÚNICO na raiz** (não em backend/ nem frontend/). Laravel via `useEnvironmentPath()`; Vite via `envDir`. `VITE_*` = frontend. `cp .env.example .env` na raiz.
- Pricing 3 tiers independentes: mensal s/fidelização (`price_monthly`), anual mensal (`price_annual_monthly`), anual upfront (`price_upfront_monthly`+`price_annual_annual`).
- Domínios: Commerce, Company, Compliments, Content, EmailAutomation, Gamification, Integrations, Marketplaces, Monetization, Platform, Shipping.

## Sentry
- Org `setuptech-07`. Projectos: `le-backend` (id 4511461122048080) · `le-frontend` (id 4511461122179152). Token em `~/.sentryclirc`.
- Bug `sentry-cli organizations list` falha (`missing field 'requireEmailVerification'`) → usar API directa via curl. Events: `/api/0/organizations/{slug}/issues/{id}/events/latest/`.

## Decisões de produto BLOQUEADAS (não implementar sem decisão do Renato)
Limites concretos por tier · pricing final (subscrição/add-ons/créditos/afiliados/revendedores) · resposta a elogios (se avança) · mensagens diretas utilizador→empresa · widgets/API (formatos/webhooks/rate limiting por tier) · rankings de pessoas (elegibilidade/opt-in/out privacidade).

## Gaps de migração conhecidos (multi-país)
Faltam `country_id` em `products`, `articles` (+ slug UNIQUE por país, não global), `article_categories`, `shipping_costs`.

## Knowledge graph
`graphify-out/` existe; `graph.json` ~179 MB. Rebuild (Python API `_rebuild_code`) corrido em 2026-06-21.
