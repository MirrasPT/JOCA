---
name: filament
description: "Use when building Laravel admin panels with Filament PHP, creating resources, forms, tables, or widgets."
triggers: Filament, admin panel, admin, backoffice, Resource, Panel, filament resource, filament page, filament widget, filament form, filament table, filament action, Filament v4, Filament v5, make:filament-resource, NavigationGroup, admin painel, painel admin, gestao, dashboard admin
---
# Filament

Filament v4/v5 admin panels para Laravel. Resources slim, schemas delegados, enums com HasLabel+HasColor+HasIcon.

Invocada autonomamente pela skill `laravel-specialist` quando detecta admin panel work, ou directamente pelo utilizador.

---

## Resource pattern -- slim, delegado

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

## Enums -- sempre 3 contratos

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

## Multi-tenancy -- CRITICO

Form selects NAO sao auto-scoped. Scoping manual obrigatorio:

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

Sem isto = **data leak entre tenants**.

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
