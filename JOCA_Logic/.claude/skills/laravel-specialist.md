---
name: laravel-specialist
description: "Building Laravel applications, Eloquent models, Artisan commands, Sanctum auth, Horizon queues, or RESTful APIs. MUST be invoked when the user says: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller. SHOULD also invoke when: middleware, service, job, queue, Sanctum, Horizon."
triggers: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller, middleware, service, job, queue, Sanctum, Horizon, Livewire, Laravel API, Laravel auth, Laravel testing, Pest, factory, seeder, observer, event, listener, notification, policy, gate, schedule, broadcasting, Laravel config, .env, route, form request, resource, collection
---
# Laravel Specialist

Laravel 11+ backend. Single-action controllers, Action classes, strict types, ULIDs. Cada classe faz uma coisa.

---

## Arquitectura

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

### Actions -- toda a logica de negocio
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

### Form Requests -- validacao + DTO via payload()
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

// Migration: $table->ulid('id')->primary();  (NAO $table->id())
```

### AppServiceProvider -- boot obrigatorio
```php
public function boot(): void
{
    Model::shouldBeStrict();
    JsonResource::withoutWrapping();
}
```

### Routes -- um ficheiro por recurso, versao no prefixo
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

## Convencoes

| Camada | Pattern | Exemplo |
|--------|---------|---------|
| Controller | `{Action}Controller` | `StoreController` |
| Action | `{Action}{Resource}Action` | `StorePostAction` |
| DTO/Payload | `{Action}Payload` | `StorePayload` |
| Form Request | `{Action}Request` | `StoreRequest` |
| API Resource | `{Resource}Resource` | `PostResource` |
| Job | `{Action}{Resource}Job` | `PublishPostJob` |
| Route name | `{resource}:{version}:{action}` | `posts:v1:store` |

---

## Jobs -- async retorna 202
```php
final class DestroyPostAction
{
    public function handle(Post $post): void
    {
        dispatch(new DestroyPostJob($post));
    }
}
// Controller retorna Response::HTTP_ACCEPTED (202), nao 200
```

Todo job implementa `failed()`:
```php
public function failed(\Throwable $e): void
{
    logger()->error('Job failed', ['error' => $e->getMessage()]);
}
```

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| `$table->id()` em modelos API | `$table->ulid('id')->primary()` + HasUlids |
| Logica de negocio no controller | Action class |
| Controllers com multiplos metodos | Um controller final invokable por operacao |
| `$model->toArray()` no controller | API Resource |
| `app(Foo::class)` dentro de metodo | Constructor DI: `private readonly Foo $foo` |
| `DB::transaction()` Facade | Injectar `DatabaseManager` |
| `paginate()` em listas | `simplePaginate()` |
| Route group sem `throttle:api` | Incluir sempre |
| Exceptions retornam HTML | `ForceJsonResponse` middleware |
| Ficheiro sem `declare(strict_types=1)` | Primeira linha apos `<?php` |
| `if/elseif` para valor unico | `match` expression |
| Policy check no Action | Autorizar em `FormRequest::authorize()` |

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
Minimo: happy path + validation error + unauthenticated por endpoint. Target >85% coverage.

---

## Validacao
```bash
php artisan migrate:status          # all Ran
php artisan route:list --path=api   # routes visiveis
php artisan queue:work --once       # sem exceptions
php artisan test --coverage         # >85%, zero failures
./vendor/bin/pint --test            # PSR-12 OK
```

---

## Invocar especialistas autonomamente

### API design (rest-api)
Quando preciso desenhar endpoints ou definir contratos:
```
Read(".claude/skills/SKILL.md")
```
Notificar: `[+ rest-api]`

### Query optimization (mysql)
Quando queries sao lentas ou preciso de EXPLAIN:
```
Read(".claude/skills/SKILL.md")
```
Notificar: `[+ mysql]`

### Admin panel (filament)
Quando preciso de Filament Resources, Pages, Widgets:
```
Read(".claude/skills/SKILL.md")
```
Notificar: `[+ filament]`

### Caching (caching)
Quando preciso de cache Redis, HTTP headers, CDN, invalidacao:
```
Read(".claude/skills/SKILL.md")
```
Notificar: `[+ caching]`

---

## Quality gate
Apos implementar: "Queres `tester-code`?"
Apos endpoints: "Queres `tester-api`?"
Se erro: spawnar `log-debugger`
