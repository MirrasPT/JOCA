---
name: filament
description: "Building Laravel admin panels with Filament PHP, creating resources, forms, tables, or widgets. MUST be invoked when the user says: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page. SHOULD also invoke when: filament widget, filament form, filament table, filament action, Filament v4, Filament v5."
triggers: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page, filament widget, filament form, filament table, filament action, Filament v4, Filament v5, make:filament-resource, NavigationGroup, admin painel, painel admin, gestao, dashboard admin
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
    protected static ?string $navigationGroup = 'Shop';
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

## Enums -- 3 contracts required

```php
<?php declare(strict_types=1);

namespace App\Enums;

use Filament\Support\Contracts\HasLabel;
use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasIcon;

enum OrderStatus: string implements HasLabel, HasColor, HasIcon
{
    case Pending    = 'pending';
    case Processing = 'processing';
    case Completed  = 'completed';
    case Cancelled  = 'cancelled';

    public function getLabel(): string
    {
        return match ($this) {
            self::Pending    => __('orders.status.pending'),
            self::Processing => __('orders.status.processing'),
            self::Completed  => __('orders.status.completed'),
            self::Cancelled  => __('orders.status.cancelled'),
        };
    }

    public function getColor(): string|array|null
    {
        return match ($this) {
            self::Pending    => 'warning',
            self::Processing => 'info',
            self::Completed  => 'success',
            self::Cancelled  => 'danger',
        };
    }

    public function getIcon(): string|null
    {
        return match ($this) {
            self::Pending    => Heroicon::OutlinedClock,
            self::Processing => Heroicon::OutlinedArrowPath,
            self::Completed  => Heroicon::OutlinedCheckCircle,
            self::Cancelled  => Heroicon::OutlinedXCircle,
        };
    }
}
```

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

## Multi-tenancy -- CRITICAL

Form selects are NOT auto-scoped. Manual scoping required:

```php
Select::make('team_id')
    ->relationship('team', 'name')
    ->modifyQueryUsing(fn (Builder $query) =>
        $query->where('id', Filament::getTenant()->id))
    ->searchable()
    ->preload()

// Validacao tenant-aware:
->scopedUnique()    // NAO ->unique()
->scopedExists()    // NAO ->exists()
```

Without this = **data leak between tenants**.

---

## Advanced building blocks

### Infolists (View page — read-only)
```php
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;

public static function infolist(Schema $schema): Schema
{
    return $schema->components([
        Section::make('Order')->schema([
            TextEntry::make('reference')->copyable(),
            TextEntry::make('status')->badge(),          // enum HasColor/HasIcon → coloured badge
            TextEntry::make('total')->money('EUR'),
        ])->columns(3),
    ]);
}
```

### Relation Managers (hasMany / belongsToMany on the Edit/View page)
```php
php artisan make:filament-relation-manager OrderResource items name
```
```php
final class ItemsRelationManager extends RelationManager
{
    protected static string $relationship = 'items';
    public function table(Table $table): Table
    {
        return $table->columns([...])->headerActions([CreateAction::make()])
            ->recordActions([EditAction::make(), DeleteAction::make()]);
    }
}
// Register in the Resource: public static function getRelations(): array { return [ItemsRelationManager::class]; }
```

### Widgets (dashboard)
```php
// Stats overview
final class OrderStats extends StatsOverviewWidget
{
    protected function getStats(): array
    {
        return [
            Stat::make('Revenue (30d)', Number::currency($revenue, 'EUR'))
                ->chart($spark)->color('success'),
            Stat::make('Pending', $pending)->color('warning'),
        ];
    }
}
// Chart widget → extends ChartWidget; Table widget → extends TableWidget.
// Register: getHeaderWidgets()/getFooterWidgets() on a Page, or auto-discovered Dashboard widgets.
```

### Custom Actions (row / bulk / header)
```php
use Filament\Actions\Action;

Action::make('refund')
    ->requiresConfirmation()
    ->schema([TextInput::make('amount')->numeric()->required()])   // modal form: ->schema NOT ->form
    ->action(fn (Order $record, array $data) => app(RefundAction::class)->handle($record, $data))
    ->visible(fn (Order $record) => $record->isRefundable());
```
Business logic stays in an Action class (`laravel-specialist`) — the Filament action only collects input and delegates.

### Global search
```php
protected static ?string $recordTitleAttribute = 'name';          // required
public static function getGloballySearchableAttributes(): array { return ['name', 'sku', 'reference']; }
public static function getGlobalSearchResultDetails(Model $record): array {
    return ['Category' => $record->category->name];
}
```

### Import / Export (bulk data — CMS/e-commerce)
```php
use Filament\Actions\ImportAction; use Filament\Actions\ExportAction;
// toolbarActions([ ImportAction::make()->importer(ProductImporter::class),
//                  ExportAction::make()->exporter(ProductExporter::class) ])
php artisan make:filament-importer Product --generate
php artisan make:filament-exporter Product --generate
```
Importers/exporters run on the **queue** by default (offload — see `queues`/`horizon`).

### Notifications
```php
use Filament\Notifications\Notification;
Notification::make()->title('Saved')->success()->send();            // to current user
Notification::make()->title('New order')->sendToDatabase($admin);   // persistent + bell badge
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

## Testing (Pest + Livewire)

```php
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user);
});

it('can list products', function () {
    $products = Product::factory()->count(5)->create();
    livewire(ListProducts::class)
        ->assertCanSeeTableRecords($products);
});

it('can create a product', function () {
    livewire(CreateProduct::class)
        ->fillForm(['name' => 'Widget', 'price' => 9.99])
        ->call('create')
        ->assertHasNoFormErrors()
        ->assertNotified();
    expect(Product::where('name', 'Widget')->exists())->toBeTrue();
});
```

---

## Deploy
```bash
php artisan optimize
php artisan filament:optimize   # SO PRODUCAO -- quebra dev local
```

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
