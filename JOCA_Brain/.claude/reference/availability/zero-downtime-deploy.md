Parte da skill `availability` — carregado on-demand via `Read(".claude/reference/availability/zero-downtime-deploy.md")` para deploy sem downtime (Envoy/symlink) e maintenance mode. (Tabela de safe migrations vive no corpo da skill.)

## 3. Zero-Downtime Deploys

### Envoy (Laravel-native)
```bash
composer require laravel/envoy --dev
```

```blade
{{-- Envoy.blade.php --}}
@servers(['web' => ['deploy@production.server']])

@setup
    $repository = 'git@github.com:org/app.git';
    $releases_dir = '/home/deploy/app/releases';
    $current_dir = '/home/deploy/app/current';
    $shared_dir = '/home/deploy/app/shared';
    $release = date('YmdHis');
    $new_release = $releases_dir . '/' . $release;
@endsetup

@story('deploy')
    clone_repository
    run_composer
    update_symlinks
    migrate
    optimize
    reload_services
    cleanup
@endstory

@task('clone_repository')
    echo "Cloning {{ $release }}"
    git clone --depth 1 {{ $repository }} {{ $new_release }}
@endtask

@task('run_composer')
    cd {{ $new_release }}
    composer install --no-dev --optimize-autoloader --no-interaction
@endtask

@task('update_symlinks')
    ln -nfs {{ $shared_dir }}/.env {{ $new_release }}/.env
    ln -nfs {{ $shared_dir }}/storage {{ $new_release }}/storage
    ln -nfs {{ $new_release }} {{ $current_dir }}
@endtask

@task('migrate')
    cd {{ $new_release }}
    php artisan migrate --force
@endtask

@task('optimize')
    cd {{ $new_release }}
    php artisan optimize
    php artisan cache:warm 2>/dev/null || true
@endtask

@task('reload_services')
    sudo systemctl reload php8.3-fpm
    cd {{ $new_release }} && php artisan horizon:terminate 2>/dev/null || true
    cd {{ $new_release }} && php artisan queue:restart
@endtask

@task('cleanup')
    cd {{ $releases_dir }} && ls -dt */ | tail -n +6 | xargs rm -rf
@endtask
```

```bash
envoy run deploy
```

Symlink swap (`ln -nfs`) is atomic -- zero downtime. Keep 5 releases for instant rollback.

### Instant rollback
```bash
# Point symlink to previous release
ln -nfs /home/deploy/app/releases/YYYYMMDDHHMMSS /home/deploy/app/current
sudo systemctl reload php8.3-fpm
```

Rollback in <5 seconds. No git pull or composer install needed.

## 4. Maintenance Mode

### Basic
```bash
php artisan down                           # 503 for all
php artisan down --secret="bypass-token"   # access via /bypass-token
php artisan down --redirect=/              # redirect instead of 503
php artisan down --render="errors::503"    # custom view
php artisan down --retry=60                # Retry-After header
php artisan up                              # back to normal
```

### Pre-rendered maintenance page
```bash
php artisan down --render="errors::503" --status=503
```

The view must be self-contained (inline CSS, no external assets) -- during maintenance the framework may not serve normal assets.

### Bypass by IP (custom middleware)
```php
class AllowMaintenanceBypass
{
    public function handle($request, $next)
    {
        $allowed = explode(',', env('MAINTENANCE_ALLOWED_IPS', ''));
        if (app()->isDownForMaintenance() && !in_array($request->ip(), $allowed)) {
            abort(503);
        }
        return $next($request);
    }
}
```

### Maintenance-safe deploy pattern
```bash
php artisan down --secret="deploy-$(date +%s)"
php artisan migrate --force
php artisan optimize
php artisan up
```

For zero-downtime: use Envoy symlink deploy instead of maintenance mode.
