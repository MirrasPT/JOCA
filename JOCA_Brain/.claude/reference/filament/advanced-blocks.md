> Parte da skill `filament` — carregado on-demand via Read().

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

    public function getIcon(): string|\BackedEnum|null
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

> **Gotcha:** `HasIcon::getIcon()` returns `string|\BackedEnum|null` in v5 — return the Heroicon enum **case** (`Heroicon::OutlinedClock`), never `->value`. Returning the string value bypasses the enum's SVG resolution and throws `Svg ... not found` when the badge renders.

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
