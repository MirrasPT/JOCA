---
name: filament
description: "Building Laravel admin panels with Filament PHP, creating resources, forms, tables, or widgets. MUST be invoked when the user says: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page. SHOULD also invoke when: filament widget, filament form, filament table, filament action, Filament v4, Filament v5."
triggers: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page, filament widget, filament form, filament table, filament action, Filament v4, Filament v5, make:filament-resource, NavigationGroup, admin painel, painel admin, gestao, dashboard admin
chain: tester-code
---
# Filament

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

## Validation tooling

- **FilaCheck** (`aldesrahim/filacheck`) — static analyzer for Filament code; catches deprecated methods + v5 namespace errors (our #1 silent-500 source). Run before delivery: `vendor/bin/filacheck`.
- **Filament Compass** (`aldesrahim/filament-compass`) — Filament v5 docs structured for LLMs; load via Laravel Boost MCP for accurate, current API reference instead of guessing.

---

## Generation

For a full resource from an existing model (form + table + infolist + relation managers + policy + validation), use the **`filament-builder`** agent:
```
Agent(subagent_type="filament-builder", prompt="Build a Filament resource for App\\Models\\Product — full CRUD + View")
```

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
