---
name: filament
description: "Building Laravel admin panels with Filament PHP, creating resources, forms, tables, or widgets. MUST be invoked when the user says: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page. SHOULD also invoke when: filament widget, filament form, filament table, filament action, Filament v4, Filament v5."
triggers: scaffold filament, build resource from model, admin for model, Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page, filament widget, filament form, filament table, filament action, Filament v4, Filament v5, make:filament-resource, NavigationGroup, admin painel, painel admin, gestao, dashboard admin
chain: tester-code
---
# Filament

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

Filament v4/v5 admin panels for Laravel. Slim resources, delegated schemas, enums with HasLabel+HasColor+HasIcon.

Invoked by `laravel-specialist` on admin panel work, or by user.

---

## BREAKING — Filament v5 namespace changes

These renames cause silent 500 errors. Check EVERY import before writing Filament code.

| v4 (WRONG) | v5 (CORRECT) |
|------------|-------------|
| `Filament\Forms\Components\Section` | `Filament\Schemas\Components\Section` |
| `Filament\Forms\Components\Grid` | `Filament\Schemas\Components\Grid` |
| `Filament\Forms\Components\Tabs` | `Filament\Schemas\Components\Tabs` |
| `Filament\Forms\Components\Fieldset` | `Filament\Schemas\Components\Fieldset` |
| `Filament\Tables\Actions\EditAction` | `Filament\Actions\EditAction` |
| `Filament\Tables\Actions\DeleteAction` | `Filament\Actions\DeleteAction` |
| `Filament\Tables\Actions\ViewAction` | `Filament\Actions\ViewAction` |
| `Filament\Tables\Actions\BulkAction` | `Filament\Actions\BulkAction` |

Rule: layout components → `Schemas\Components`. Table actions → `Actions` (top-level, not `Tables\Actions`).

Navigation props (`$navigationGroup`) must be typed `string|\UnitEnum|null`, not `?string`, or `discoverPages` fatals with "Type must be UnitEnum|string|null" and 500s the panel.

---

## Resource pattern -- slim, delegated

```php
<?php declare(strict_types=1);

namespace App\Filament\Resources;

use Filament\Resources\Resource;
use Filament\Schemas\Schema;

final class ProductResource extends Resource
{
    protected static ?string $model = Product::class;
    protected static ?string $slug = 'products';
    protected static ?string $recordTitleAttribute = 'name'; // obrigatorio -- global search
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShoppingBag;
    protected static string|\UnitEnum|null $navigationGroup = 'Shop';
    protected static ?int $navigationSort = 1;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            // form fields aqui
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([...])
            ->recordActions([...])        // NAO ->actions()
            ->groupedBulkActions([...])    // NAO ->bulkActions()
            ->toolbarActions([...]);       // create/import/export
    }
}
```

## Complexity tiers

| Nivel | Pages | Quando |
|-------|-------|--------|
| Simple | `ManageRecords` (modal CRUD) | <= 5 campos, sem relacoes |
| Standard | `List + Create + Edit` | CRUD normal |
| Full | `List + Create + Edit + View` + relation managers | Relacoes complexas |

---

## Forms

```php
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\RichEditor;

$schema->components([
    Section::make('General')->schema([
        TextInput::make('name')->required()->maxLength(255),
        TextInput::make('slug')
            ->live(onBlur: true)
            ->visible(fn (Get $get, string $operation): bool =>
                $operation === Operation::Create->value)
            ->disabled()
            ->dehydrated(),
        Select::make('category_id')
            ->relationship('category', 'name')
            ->searchable()    // obrigatorio
            ->preload(),      // obrigatorio
        RichEditor::make('description')->columnSpanFull(),
    ])->columns(2),
]);
```

---

## CMS / content patterns

- **Pages/blocks:** `Builder` field (repeatable typed blocks: hero, text, gallery, CTA) → renders to the storefront via `laravel-react`.
- **Media:** `spatie/laravel-medialibrary` + `SpatieMediaLibraryFileUpload` (conversions, responsive images → `file-storage`).
- **Menus/navigation:** dedicated resource + ordering (`->reorderable()`).
- **SEO fields:** a `Section::make('SEO')` (meta title/description/og-image) on content resources.
- **Slugs:** `TextInput::make('slug')->live(onBlur:true)` from title; unique/`scopedUnique`.
- **Publishing:** `published_at` + status enum; storefront query filters `whereNotNull('published_at')`.

---

## ⚠ Testes que apagam a base de dados — provar a ligação ANTES de correr

`RefreshDatabase`/`migrate:fresh` sem `.env.testing` apontam o comando à base de dados de desenvolvimento e apagam-na:
sem o ficheiro de teste (ou sem a ligação de teste configurada) o Artisan cai no `.env`, e `migrate:fresh` larga
**todas** as tabelas. Incidente 2026-09-18: um agente correu `migrate:fresh --env=testing` sem `.env.testing` e apagou
a base de dados de desenvolvimento.

Antes da suite, ou de qualquer `migrate:*`, provar a ligação na raiz da app Laravel:
```bash
test -f .env.testing || echo 'SEM .env.testing — PARAR e reportar'
php artisan db:show --env=testing    # ler o nome da BD antes de escrever nela
```
- Ficheiro em falta, **ou** nome de BD igual ao de desenvolvimento → **parar e reportar**; nunca correr «para ver».
- `migrate:fresh` é **irreversível** → gate de confirmação (`rules/task-intake.md` §Segurança), mesmo em teste.

---

## Validation tooling

- **FilaCheck** (`aldesrahim/filacheck`) — static analyzer for Filament code; catches deprecated methods + v5 namespace errors (our #1 silent-500 source). Run before delivery: `vendor/bin/filacheck`.
- **Filament Compass** (`aldesrahim/filament-compass`) — Filament v5 docs structured for LLMs; load via Laravel Boost MCP for accurate, current API reference instead of guessing.

---

## Scaffold de resource (model → resource completo)

Resource completo a partir de um model existente (form + table + infolist + relation managers + policy + validação). Inline, ou em paralelo com `Agent(subagent_type="filament-agent", prompt="Scaffold do resource Filament para App\\Models\\Product — CRUD completo + View")`.

1. **Versão:** `composer show filament/filament | grep versions` (v4 vs v5 muda namespaces).
2. **Ler o model:** `app/Models/<Model>.php` (fillable, casts, relações) + a migration (tipos, nullability, índices, unique).
3. **Mapear** (e escolher o nível em «Complexity tiers»):

| Sinal no model | Filament |
|---|---|
| `string`/`text` | `TextInput` / `Textarea` / `RichEditor` |
| cast enum | `Select` com as opções do enum (3 contratos) |
| `belongsTo` | `Select->relationship()->searchable()->preload()` |
| `hasMany`/`belongsToMany` | Relation Manager |
| `date`/`datetime` | `DatePicker` / `DateTimePicker` |
| `boolean` | `Toggle` |
| `decimal` (dinheiro) | `TextInput->numeric()->prefix('€')` |
| ficheiro/imagem | `FileUpload` / `SpatieMediaLibraryFileUpload` |
| coluna unique | `->unique(ignoreRecord: true)` / `->scopedUnique()` em multi-tenant |

4. **Âmbito:** model não trivial → 1 pergunta só («CRUD completo + View + relation managers, ou CRUD em modal? Colunas a esconder?»); senão inferir e declarar os pressupostos.
5. **Gerar e reescrever:** `php artisan make:filament-resource <Model> --generate --view` (v5) → reescrever no padrão slim acima (imports v5, `recordActions`/`groupedBulkActions`/`toolbarActions`, `infolist()`, relation managers, enums em falta). Policy: `php artisan make:policy <Model>Policy --model=<Model>` com `viewAny/view/create/update/delete`.
6. **Validar (os 500 do v5):**
```bash
vendor/bin/filacheck 2>/dev/null || echo "FilaCheck não instalado"
grep -rn "Filament\\\\Forms\\\\Components\\\\\(Section\|Grid\|Tabs\|Fieldset\)" app/Filament/ && echo "ERRADO: Filament\\Schemas\\Components"
grep -rn "Filament\\\\Tables\\\\Actions" app/Filament/ && echo "ERRADO: no v5 as actions são Filament\\Actions"
php artisan filament:optimize-clear 2>/dev/null
```
7. **Testar:** smoke test Pest+Livewire (list + create + validação; `reference/filament/testing-deploy.md`) → `php artisan test --filter=<Model>Resource`, depois de provar a ligação de teste (secção acima).
8. **Relatório:** nível · páginas · relation managers · campos/colunas gerados · validação (FilaCheck, namespaces, testes) · pressupostos · próximo passo (Policy, NavigationGroup).

Seguir o estilo dos resources que o projecto já tem; nunca inventar campos fora do model/migration; resource sem Policy é achado.

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| `->actions([])` na tabela | `->recordActions([])` |
| `->bulkActions([])` | `->groupedBulkActions([])` |
| `->form()` em action modals | `->schema()` |
| Import de `Filament\Tables\Actions\*` | `Filament\Actions\*` |
| String icones: `'heroicon-o-bag'` | `Heroicon::OutlinedShoppingBag` enum |
| Texto hardcoded | Language files, `__()` |
| Publicar Blade views | CSS hooks com prefixo `fi-` |
| `filament:optimize` em local | So producao |
| Selects multi-tenant sem `modifyQueryUsing` | Data leak |
| Sem `$recordTitleAttribute` | Global search quebrado |
| Sem `FilamentUser` interface em producao | Acesso sem controlo |

---

## Checklist

- [ ] `$recordTitleAttribute` em cada resource
- [ ] `Heroicon::` enum em todos os icones
- [ ] Actions importadas de `Filament\Actions\*`
- [ ] Tabela usa `recordActions()`, `groupedBulkActions()`, `toolbarActions()`
- [ ] Enums implementam HasLabel + HasColor + HasIcon
- [ ] Selects com `->searchable()` e `->preload()`
- [ ] Multi-tenant: selects com `modifyQueryUsing`
- [ ] `FilamentUser` interface + `canAccessPanel()` em producao
- [ ] Model policies para viewAny, create, update, delete
- [ ] Sem texto hardcoded -- language files

## Referências (carregar on-demand)

| Referência | Quando |
|---|---|
| `Read(".claude/reference/filament/advanced-blocks.md")` | Enums (HasLabel/HasColor/HasIcon + gotcha Heroicon), infolists, relation managers, widgets, custom actions, global search, import/export, notifications |
| `Read(".claude/reference/filament/tenancy-rbac.md")` | Multi-tenancy (scoping manual de selects — sem isto = data leak) e RBAC/Filament Shield (ordem de install, super_admin bypass, helper de testes) |
| `Read(".claude/reference/filament/testing-deploy.md")` | Testes Pest+Livewire de resources e optimize/deploy em produção |
