---
name: laravel-specialist
description: "Laravel apps, Eloquent models, Artisan commands, Sanctum auth, Horizon queues, RESTful APIs. MUST be invoked when the user says: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller. SHOULD also invoke when: middleware, service, job, queue, Sanctum, Horizon."
triggers: Laravel, Eloquent, Artisan, composer.json, artisan, migration, model, controller, middleware, service, job, queue, Sanctum, Horizon, Livewire, Laravel API, Laravel auth, Laravel testing, Pest, factory, seeder, observer, event, listener, notification, policy, gate, schedule, broadcasting, Laravel config, .env, route, form request, resource, collection
chain: tester-code, tester-api
---
# Laravel Specialist

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

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

### Windows + Sail (no host PHP)
`./vendor/bin/sail` is a bash script and won't run in PowerShell. Drive Sail via `docker compose` directly, exporting `$env:WWWUSER`/`$env:WWWGROUP` first; on PHP 8.5 fix `storage/` perms (tempnam returns 500 otherwise). Full host-specific note: see the `laravel-sail-windows` memory.

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

## Migrations que mexem em índices, FK ou tipos

- **Ciclo `up → down → up` contra o motor de PRODUÇÃO** (MySQL), não só a suite em SQLite. Em MySQL um índice único cuja coluna mais à esquerda é uma FK **é** o índice que serve essa FK: largá-lo dá `ERROR 1553`. O SQLite aceitou o `up()` e o `down()` partido (projecto de cliente, 2026-08-26). Doutrina do gate: `reference/gates-runtime.md` (linha «Ambiente de teste ≠ produção»).
- **`$table->dropForeign(['user_id'])` (array) em vez de `dropForeign('nome')`** — com array o Laravel deriva o nome convencional (`<tabela>_<coluna>_foreign`); a string tem de ser o nome exacto da constraint e parte em silêncio quando o nome real difere.
- **Ordem no `down()`:** largar a FK antes do índice que a serve; recriar o índice antes da FK.

## Mudar schema com dados reais — expand/contract

Renomear ou mudar uma coluna no mesmo deploy que o código que a usa parte a janela em que código velho e novo correm juntos. Nunca mudar a coluna no sítio. Por fases, cada uma deployável e reversível sozinha:
1. **Expand** — coluna nova `nullable` ao lado da velha. Deploy.
2. **Escrever nas duas** — a app grava a velha e a nova em cada insert/update. Deploy.
3. **Backfill em lotes** — copiar os dados antigos com `chunkById()`, fora do caminho quente. Um `UPDATE` único bloqueia a tabela.
4. **Ler da nova** — trocar as leituras, continuar a escrever nas duas. Deploy e observar.
5. **Contract** — parar de escrever na velha e, num deploy **posterior e isolado**, largar a coluna.

- Aditivo primeiro; destrutivo por último e sozinho.
- `down()` escrito e corrido antes do merge (ciclo `up → down → up` acima).
- Índice grande em tabela com escrita: DDL online do MySQL — confirmar na doc do MySQL da versão alvo, não de memória.

Adaptado de addyosmani/agent-skills `deprecation-and-migration` (MIT).

## Renomear um valor de enum vs só o rótulo

Rótulo e valor guardado **não têm de coincidir**. Antes de renomear o **valor** (o que está na BD):
1. Contar os ficheiros que o citam (`grep -rn "'backlog'" app resources database tests | wc -l`) e as linhas que exigem migração de dados (`SELECT count(*) … WHERE status = 'backlog'`).
2. Ganho só cosmético → muda-se o **rótulo** (`label()`/`getLabel()` do enum, tradução), não o valor.

Caso real (painel de gestão interno, 2026-09-09): renomear o valor = 35 ficheiros + migração de dados reais; mudar o rótulo = 1 ficheiro, zero risco. Precedente: um ecrã de conteúdos mostra «Planeada» sobre um `backlog`.

---

## Honeypot anti-spam — o campo que comeu um lead real

Um honeypot com nome que o **preenchimento automático do browser** reconhece (`website`, `url`, `email2`, `phone2`)
é preenchido por ele e descarta leads verdadeiros — o servidor devolve 2xx e a submissão desaparece sem rasto.
Incidente 2026-09-18: `name="website"`, lead real perdida em silêncio.

- **Nome neutro**, sem palavra que o preenchimento automático conheça (ex.: `contact_ref`), e o campo leva
  `autocomplete="off"`. A metade do HTML/formulário está em `.claude/skills/frontend.md`.
- **Cada descarte regista-se em log**, com o payload: descarte silencioso sem log = lead perdida sem recuperação.
- O honeypot é um campo **declarado** nas regras, não um extra que passa ao lado da validação.

```php
// Form Request
public function rules(): array
{
    return [
        'contact_ref' => ['nullable', 'string'],        // honeypot: vazio quando é humano
        'name'        => ['required', 'string', 'max:255'],
        'email'       => ['required', 'email'],
    ];
}

// Action — descarta, mas COM rasto; devolve o mesmo 2xx que um humano recebe
if ($request->filled('contact_ref')) {
    logger()->warning('Submissão descartada por honeypot', [
        'ip'      => $request->ip(),
        'payload' => $request->only(['name', 'email']),
    ]);

    return new JsonResponse(status: Response::HTTP_ACCEPTED);
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
| Nested route binding without scope | `->scopeBindings()` on nested groups — child must belong to parent (prevents cross-tenant/cross-parent record leak via ID swap) |
| Service/repository for one-off logic | Action class (no single-use abstraction) |
| Honeypot com nome que o preenchimento automático do browser reconhece (`website`, `url`) | Nome neutro + `autocomplete="off"`; cada descarte em log |

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
vendor/bin/phpstan analyse          # Larastan — zero errors at configured level
php artisan migrate --pretend       # read the SQL before running it in production
composer validate                   # composer.json / lock valid
php artisan schedule:list           # scheduled tasks registered
php artisan config:cache && php artisan route:cache && php artisan view:cache
                                    # with the PRODUCTION config (staging/target) — cache failures only show on deploy
```
- Locally, `php artisan optimize:clear` after the cache warm-up (otherwise the local `.env` stays frozen).
- Production target: `APP_ENV=production` and `APP_DEBUG=false` confirmed on the server.
- Commands from affaan-m/ECC `laravel-verification` (MIT); the `artisan` ones confirmed in Laravel 13.33.0 (`vendor/laravel/framework`, verificado 2026-09-28); `composer validate` is Composer's, not Laravel's.

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

### Connect to a React frontend (laravel-react)
When wiring the API/admin to a React SPA or storefront (Sanctum, CORS, Inertia, type sharing):
```
Read(".claude/skills/laravel-react.md")
```
Notify: `[+ laravel-react]`

---

## Quality gate
After implementation: "Run `tester-code`?"
After endpoints: "Run `tester-api`?"
Refactor / dead code / scale / Larastan: spawn `laravel-refactor` agent
Full Filament resource from a model: spawn `filament-agent` agent
Security code review: spawn `security-review` agent
On error: spawn `log-debugger`

## Próximo passo (chain)
Após implementar (reversível → encadear sem perguntar, `[chain → x]`):
1. `tester-code` (agente) — review da implementação vs plano/standards.
2. `tester-api` (agente) — se foram criados/alterados endpoints.
Migrations/deploy/push → 1 linha de confirmação. Ver `rules/chaining.md`.
