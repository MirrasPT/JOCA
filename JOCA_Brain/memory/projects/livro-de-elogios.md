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
- `docs/estado.md` está **DESACTUALIZADO** (sessão 12, 2026-05-25 — diz "Fase 0 Design, Laravel 11/Filament 3.2"). **Não confiar.**
- `README.md` + `CLAUDE.md` (2026-05-28) = estado real da stack/fases.
- Docs de trabalho mais recentes (2026-05-29): `docs/backoffice-cliente-ESTADO.md`+`-CONTRATO.md`, `docs/goal-auth-checkout.md`. Outros specs: `email-automations-strategy.md`, `marketplace-integration-spec.md`, `widget-api-spec.md`.

## ⚠ Estado do git (local difere do trabalho descrito)
- Branch local `master`, só **"Initial commit"** (protótipos + assets). Branches `pedro-dev` (backend) e `renato-dev` (frontend backoffice) referidas nos docs **NÃO existem localmente** — só `remotes/origin/{master, claude/analyze-project-fZ0Mo}`.
- Working tree tem backend/ + frontend/ com código real mas **não committed** (23 untracked + mods/deletes de reorganização da pasta). O trabalho descrito nas sessões não está no histórico local.
- Backend desenvolvido por **Pedro**; backoffice/frontend por **Renato**. Sessões anteriores correram em Mac (path `-Users-renatoferreira-JOCA-JOCA-Logic`).

## Roadmap / fases
- Fase 0 Design (protótipos HTML + design system) ✅
- Fase 1 Setup backend (Laravel, auth, migrações, 12 domínios) ✅
- Fase 2 Website público (API REST ~60 endpoints, checkout, blog CMS, loja) ✅
- Fase 3 Backoffice utilizador — **por iniciar / em curso (backoffice mock)**
- Fase 4 Admin + badges + rankings + afiliados + revendedores + multi-país — por iniciar

## Work streams pausados (2026-05-29)
1. **Backoffice de cliente** (`docs/backoffice-cliente-ESTADO.md`; contrato vinculativo em `docs/backoffice-cliente-CONTRATO.md` — ler primeiro). Frontend React 19, dados **mock/fixtures swappable** (`src/api/backoffice/*` por domínio → trocar p/ API real = 1 ficheiro/domínio), **não ligado ao admin Filament**, montado em `/app/*` sem auth gate. Fundação + **15 páginas** feitas e a compilar (`tsc -b` + build verde). **Parado a meio do Ciclo 1** de testes. Retomar: confirmar build verde → Ciclo 1 (review→fix por página) → Ciclo 2 (brand/a11y WCAG AA/responsivo 375/768/1280) → Ciclo 3 (adversarial + smoke browser :5173 `/app`). Branch `renato-dev`, **nada committed** (commit só após validação dos 3 ciclos).
2. **Auth + checkout** (`docs/goal-auth-checkout.md`). Infra existe mas **não ligada**: `Nav.tsx` não usa `useAuth` (link `/login` hardcoded); cart só localStorage (não sincroniza com backend; bridge slug↔product_id por resolver); `Carrinho.tsx` sem lógica real de submissão; só `/dashboard` protegido. 5 tarefas: Nav→useAuth+dropdown, cart sync, checkout 3-step funcional (resumo→morada→pagamento MB/MBWay via `api/orders.ts`), proteger rotas checkout, listar encomendas. Constraint: Sanctum **stateful** (cookies, `withCredentials:true`), não bearer.

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
