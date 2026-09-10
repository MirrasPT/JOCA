---
name: filament
description: "Building Laravel admin panels with Filament PHP, creating resources, forms, tables, or widgets. MUST be invoked when the user says: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page. SHOULD also invoke when: filament widget, filament form, filament table, filament action, Filament v4, Filament v5."
triggers: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page, filament widget, filament form, filament table, filament action, Filament v4, Filament v5, make:filament-resource, NavigationGroup, management, dashboard admin
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
    protected static ?string $recordTitleAttribute = 'name'; // mandatory -- global search
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShoppingBag;
    protected static string|\UnitEnum|null $navigationGroup = 'Shop';
    protected static ?int $navigationSort = 1;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            // form fields here
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([...])
            ->recordActions([...])        // NOT ->actions()
            ->groupedBulkActions([...])    // NOT ->bulkActions()
            ->toolbarActions([...]);       // create/import/export
    }
}
```

## Complexity tiers

| Level | Pages | When |
|-------|-------|--------|
| Simple | `ManageRecords` (modal CRUD) | <= 5 fields, no relations |
| Standard | `List + Create + Edit` | Normal CRUD |
| Full | `List + Create + Edit + View` + relation managers | Complex relations |

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
            ->searchable()    // mandatory
            ->preload(),      // mandatory
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

| Wrong | Correct |
|--------|----------|
| `->actions([])` on the table | `->recordActions([])` |
| `->bulkActions([])` | `->groupedBulkActions([])` |
| `->form()` in action modals | `->schema()` |
| Importing from `Filament\Tables\Actions\*` | `Filament\Actions\*` |
| Icon strings: `'heroicon-o-bag'` | `Heroicon::OutlinedShoppingBag` enum |
| Hardcoded text | Language files, `__()` |
| Publishing Blade views | CSS hooks with the `fi-` prefix |
| `filament:optimize` locally | Production only |
| Multi-tenant selects without `modifyQueryUsing` | Data leak |
| No `$recordTitleAttribute` | Global search broken |
| No `FilamentUser` interface in production | Uncontrolled access |

---

## Checklist

- [ ] `$recordTitleAttribute` on every resource
- [ ] `Heroicon::` enum on every icon
- [ ] Actions imported from `Filament\Actions\*`
- [ ] The table uses `recordActions()`, `groupedBulkActions()`, `toolbarActions()`
- [ ] Enums implement HasLabel + HasColor + HasIcon
- [ ] Selects with `->searchable()` and `->preload()`
- [ ] Multi-tenant: selects with `modifyQueryUsing`
- [ ] `FilamentUser` interface + `canAccessPanel()` in production
- [ ] Model policies for viewAny, create, update, delete
- [ ] No hardcoded text -- language files

## References (load on-demand)

| Reference | When |
|---|---|
| `Read(".claude/reference/filament/advanced-blocks.md")` | Enums (HasLabel/HasColor/HasIcon + the Heroicon gotcha), infolists, relation managers, widgets, custom actions, global search, import/export, notifications |
| `Read(".claude/reference/filament/tenancy-rbac.md")` | Multi-tenancy (manual scoping of selects — without it = data leak) and RBAC/Filament Shield (install order, super_admin bypass, test helper) |
| `Read(".claude/reference/filament/testing-deploy.md")` | Pest+Livewire tests for resources and optimize/deploy in production |
