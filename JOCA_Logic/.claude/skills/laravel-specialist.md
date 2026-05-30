---
name: laravel-specialist
description: "Laravel apps, Eloquent models, Artisan commands, Sanctum auth, Horizon queues, RESTful APIs. MUST be invoked when the user says: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller. SHOULD also invoke when: middleware, service, job, queue, Sanctum, Horizon."
triggers: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller, middleware, service, job, queue, Sanctum, Horizon, Livewire, Laravel API, Laravel auth, Laravel testing, Pest, factory, seeder, observer, event, listener, notification, policy, gate, schedule, broadcasting, Laravel config, .env, route, form request, resource, collection
---
# Laravel Specialist

Laravel 11+ backend. Single-action controllers, Action classes, strict types, ULIDs. One class, one job.

---

## Architecture

### Controllers -- single-action, final, invokable
```php
<?php declare(strict_types=1);

namespace App\Http\Controllers\Api\Posts\V1;

use App\Actions\StorePostAction;
use App\Http\Requests\Posts\StoreRequest;
use App\Http\Resources\PostResource;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class StoreController
{
    public function __construct(
        private readonly StorePostAction $action,
    ) {}

    public function __invoke(StoreRequest $request): JsonResponse
    {
        $post = $this->action->handle(payload: $request->payload());
        return new JsonResponse(data: new PostResource($post), status: Response::HTTP_CREATED);
    }
}
```

### Actions -- all business logic
```php
<?php declare(strict_types=1);

namespace App\Actions;

use App\DataTransferObjects\StorePayload;
use App\Models\Post;
use Illuminate\Database\DatabaseManager;

final class StorePostAction
{
    public function __construct(
        private readonly DatabaseManager $database,
    ) {}

    public function handle(StorePayload $payload): Post
    {
        return $this->database->transaction(
            callback: fn (): Post => Post::query()->create(attributes: $payload->toArray()),
        );
    }
}
```

### Form Requests -- validation + DTO via payload()
```php
<?php declare(strict_types=1);

namespace App\Http\Requests\Posts;

use App\DataTransferObjects\StorePayload;
use Illuminate\Foundation\Http\FormRequest;

final class StoreRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'title'   => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
        ];
    }

    public function payload(): StorePayload
    {
        return new StorePayload(
            title:   $this->string('title')->toString(),
            content: $this->string('content')->toString(),
            userId:  $this->user()->id,
        );
    }
}
```

### Models -- ULIDs, casts, strict
```php
<?php declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Post extends Model
{
    use HasUlids, SoftDeletes;

    protected $fillable = ['title', 'content', 'status', 'user_id'];

    protected function casts(): array
    {
        return [
            'status'       => PostStatus::class,
            'published_at' => 'immutable_datetime',
        ];
    }
}

// Migration: $table->ulid('id')->primary();  (NOT $table->id())
```

### AppServiceProvider -- required boot
```php
public function boot(): void
{
    Model::shouldBeStrict();
    JsonResource::withoutWrapping();
}
```

### Routes -- one file per resource, version in prefix
```php
// routes/api/posts.php
Route::prefix('v1/posts')
    ->middleware(['force.json', 'auth:sanctum', 'throttle:api'])
    ->group(function (): void {
        Route::get('/', Posts\V1\IndexController::class)->name('posts:v1:index');
        Route::post('/', Posts\V1\StoreController::class)->name('posts:v1:store');
        Route::get('/{post}', Posts\V1\ShowController::class)->name('posts:v1:show');
    });
```

---

## Conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| Controller | `{Action}Controller` | `StoreController` |
| Action | `{Action}{Resource}Action` | `StorePostAction` |
| DTO/Payload | `{Action}Payload` | `StorePayload` |
| Form Request | `{Action}Request` | `StoreRequest` |
| API Resource | `{Resource}Resource` | `PostResource` |
| Job | `{Action}{Resource}Job` | `PublishPostJob` |
| Route name | `{resource}:{version}:{action}` | `posts:v1:store` |

---

## Jobs -- async returns 202
```php
final class DestroyPostAction
{
    public function handle(Post $post): void
    {
        dispatch(new DestroyPostJob($post));
    }
}
// Controller returns Response::HTTP_ACCEPTED (202), not 200
```

Every job implements `failed()`:
```php
public function failed(\Throwable $e): void
{
    logger()->error('Job failed', ['error' => $e->getMessage()]);
}
```

---

## Anti-patterns

| Wrong | Correct |
|-------|---------|
| `$table->id()` on API models | `$table->ulid('id')->primary()` + HasUlids |
| Business logic in controller | Action class |
| Controllers with multiple methods | One final invokable controller per operation |
| `$model->toArray()` in controller | API Resource |
| `app(Foo::class)` inside method | Constructor DI: `private readonly Foo $foo` |
| `DB::transaction()` Facade | Inject `DatabaseManager` |
| `paginate()` on lists | `simplePaginate()` |
| Route group without `throttle:api` | Always include |
| Exceptions return HTML | `ForceJsonResponse` middleware |
| File without `declare(strict_types=1)` | First line after `<?php` |
| `if/elseif` for single value | `match` expression |
| Policy check in Action | Authorize in `FormRequest::authorize()` |
| `json_encode()` on field with `array` cast | Let Eloquent handle serialization — double-encode bug |
| Assume decimal fields arrive as `number` in JS | Eloquent serializes decimal as string. Use `Number(value)` or `'decimal'` cast |
| `rm` storage files without checking FK | Always query `media` table before deleting physical files |

---

## Testing (Pest)
```php
it('stores a post and returns 201', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user)
        ->postJson('/v1/posts', ['title' => 'Hello', 'content' => 'Body.'])
        ->assertStatus(Response::HTTP_CREATED)
        ->assertJsonPath('title', 'Hello');
});

it('returns 422 when title missing', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user)
        ->postJson('/v1/posts', ['content' => 'Body.'])
        ->assertStatus(Response::HTTP_UNPROCESSABLE_ENTITY);
});

it('returns 401 when unauthenticated', function (): void {
    $this->postJson('/v1/posts', [])
        ->assertStatus(Response::HTTP_UNAUTHORIZED);
});
```
Minimum: happy path + validation error + unauthenticated per endpoint. Target >85% coverage.

---

## Validation
```bash
php artisan migrate:status          # all Ran
php artisan route:list --path=api   # routes visible
php artisan queue:work --once       # no exceptions
php artisan test --coverage         # >85%, zero failures
./vendor/bin/pint --test            # PSR-12 OK
```

---

## Auto-invoke specialists

### API design (rest-api)
When designing endpoints or defining contracts:
```
Read(".claude/skills/rest-api.md")
```
Notify: `[+ rest-api]`

### Query optimization (mysql)
When queries are slow or need EXPLAIN:
```
Read(".claude/skills/mysql.md")
```
Notify: `[+ mysql]`

### Admin panel (filament)
When needing Filament Resources, Pages, Widgets:
```
Read(".claude/skills/filament.md")
```
Notify: `[+ filament]`

### Caching (caching)
When needing Redis cache, HTTP headers, CDN, invalidation:
```
Read(".claude/skills/caching.md")
```
Notify: `[+ caching]`

---

## Quality gate
After implementation: "Run `tester-code`?"
After endpoints: "Run `tester-api`?"
On error: spawn `log-debugger`
