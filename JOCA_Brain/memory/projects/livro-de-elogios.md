---
name: livro-de-elogios
description: Livro de Elogios — Nova Plataforma 2026. SaaS multi-tenant multi-país para empresas gerirem elogios de clientes; substitui plataforma em produção (27.000+ empresas).
type: project
directorio: D:\Mega\Livro_De_Elogios\2026_Nova_Plataforma
---

**Stack:** Laravel 13 + PHP 8.3 + Filament v5 (backend/admin) · React 19 + Vite 8 + Tailwind 4 + TypeScript (frontend) · MySQL (SQLite local) · Sanctum stateful SPA + Socialite (Google/Facebook) · Ifthenpay (MB/MBWay) + Stripe · Moloni (faturação) · Spatie Media Library · Sentry · Pest.
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

## Estado git (2026-06-26)
- Branch `master`. Último commit: `fa34b64` (2026-06-18, PR #15 pedro-dev).
- Working tree: 6 ficheiros modificados (backend Filament widgets/provider/CSS/login blade + frontend package-lock + public/images/ untracked). Nada committado do lado Renato.
- Backend desenvolvido por **Pedro** (branch `pedro-dev` → PRs → master); backoffice/frontend por **Renato** (trabalho Mac nunca committado).
- Mobile: Flutter app em `mobile/` + `APP-MOVEL.md` na raiz.

## Roadmap / fases
- Fase 0 Design (protótipos HTML + design system) ✅
- Fase 1 Setup backend (Laravel, auth, migrações, 12 domínios) ✅
- Fase 2 Website público (React 19/Vite 8, 20 páginas committadas) ✅
- Fase 3 Backoffice utilizador — **por iniciar** (trabalho Mac perdido/não committado)
- Fase 4 Admin + badges + rankings + afiliados + revendedores + multi-país — por iniciar
- Pedro (paralelo): módulo encomendas institucionais em curso (spec-encomendas-institucionais.md)

## Pendentes Renato (2026-06-26)
1. **Backoffice de cliente** — trabalho Mac de "15 páginas + 3 ciclos" nunca chegou ao repo. Recomeçar do zero a partir de protótipos `design/app/`. Dados mock swappable (`src/api/backoffice/*`), montado em `/app/*`, sem auth gate. Commitar só após Ciclo 3.
2. **Auth + checkout** — infra existe mas não ligada: `Nav.tsx` tem link `/login` hardcoded (não usa `useAuth`); cart só localStorage (sem sync backend; bridge slug↔product_id por resolver); `Carrinho.tsx` sem submissão real; só `/dashboard` protegido. 5 tarefas: Nav→useAuth+dropdown · cart sync · checkout 3-step (resumo→morada→pagamento MB/MBWay via `api/orders.ts`) · proteger rotas checkout · listar encomendas. Constraint: Sanctum **stateful** (cookies, `withCredentials:true`).
3. **Decisões de produto bloqueadas** — ver secção abaixo.

## Filament v5 — gotchas validados (ver CLAUDE.md secção completa)
- Namespaces: `Section`/`Fieldset`/`Schema` → `Filament\Schemas\*` (NÃO `Filament\Forms\*`). `EditAction`/`DeleteAction` → `Filament\Actions\*` (NÃO `Filament\Tables\Actions\*`). Form/Table components mantêm namespaces antigos.
- Table API v5: `->recordActions()` / `->toolbarActions()` (não `->actions()`/`->bulkActions()`).
- Multi-tenant scoping (country_admin): `Select::make('country_id')` precisa SEMPRE de `->default(auth country)` + `->disabled(isCountryAdmin)` + `->dehydrated()` — só `getEloquentQuery` scope NÃO previne IDOR no POST.
- Multi-dashboard Pages: cada um precisa de `$slug` E `getRoutePath()` senão colidem em `/admin`.
- Notification em transaction: envolver em `DB::afterCommit()`.
- `ExternalPartner` usa `protected $table = 'marketplaces'` (rename só conceptual; FKs `marketplace_id`).

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
